import UIKit
import Security
import UserNotifications
import WebKit
import WidgetKit
import Vision
import PDFKit

final class MonoController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private lazy var speech = SpeechBridge { [weak self] id, event, info in
        self?.send("speechEvent", [id, event, info])
    }
    private let reminders = MonoReminders()
    private let saveFeedback = UIImpactFeedbackGenerator(style: .soft)
    private lazy var saveWave = MonoSaveWave(parent: self, web: web,
        ready: { [weak self] id, captured in self?.send("saveWaveReady", [id, captured]) },
        finished: { [weak self] id in self?.send("saveWaveFinished", [id]) })

    override func viewDidLoad() {
        super.viewDidLoad()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "mono")
        let access = loadAccess()
        config.userContentController.addUserScript(WKUserScript(
            source: "window.monoStoredAccess = \(access); window.monoSaveWaveSupported = true;",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Системная тема известна сразу: страница не мигает светлой при запуске из уведомления
        let systemDark = UIScreen.main.traitCollection.userInterfaceStyle == .dark
        config.userContentController.addUserScript(WKUserScript(
            source: "window.monoSystemDark = \(systemDark ? "true" : "false")",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.isOpaque = false
        // Фон до загрузки страницы — цвет заставки выбранной темы (запомнили при прошлом запуске)
        view.backgroundColor = Self.savedLaunchColor() ?? UIColor(named: "LaunchBackground")
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.frame = view.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(web)
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        NotificationCenter.default.addObserver(self, selector: #selector(interruptSpeech),
                                               name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(refreshReminders),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    private static let darkKey = "monoDarkTheme"
    private static let launchColorKey = "monoLaunchColor"

    // Цвет заставки в виде "#rrggbb" → UIColor
    private static func color(hex: String) -> UIColor? {
        let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                       blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }

    private static func savedLaunchColor() -> UIColor? {
        guard let hex = UserDefaults.standard.string(forKey: launchColorKey) else { return nil }
        return color(hex: hex)
    }
    private let launchedAt = Date()

    // Фон под веб-страницей в цвет темы: без чёрной полосы над клавиатурой в светлой теме
    private func applyThemeBackground(dark: Bool) {
        view.backgroundColor = dark
            ? UIColor(red: 0.086, green: 0.090, blue: 0.106, alpha: 1)
            : UIColor(red: 0.925, green: 0.933, blue: 0.949, alpha: 1)
    }

    @objc private func interruptSpeech() { speech.cancel(); saveWave.cancel() }
    @objc private func refreshReminders() {
        send("refreshReminders", [])
        send("refreshAccess", [])
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "saveFeedback":
            saveFeedback.prepare()
            saveFeedback.impactOccurred(intensity: 0.35)
        case "speechStart", "speechStop", "speechAbort":
            guard let id = body["id"] as? String else { return }
            switch action {
            case "speechStart": speech.start(id)
            case "speechStop": speech.stop(id)
            default: speech.cancel(id)
            }
        case "prepareSaveWave":
            saveWave.prepare(body)
        case "finishSaveWave":
            if let id = body["id"] as? String { saveWave.reveal(id) }
        case "cancelSaveWave":
            if let id = body["id"] as? String { saveWave.cancel(id) }
        case "recognizeDocument":
            recognizeDocument(body)
        case "share":
            guard let name = body["name"] as? String, let text = body["text"] as? String else { return }
            share(name, text: text)
        case "invite":
            // Текст с кодом приглашения и ссылка
            var items: [Any] = []
            if let text = body["text"] as? String, !text.isEmpty { items.append(text) }
            if let url = URL(string: "https://monoapp.ru") { items.append(url) }
            presentActivity(items)
        case "settings":
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        case "storeAccess":
            guard let access = body["access"] as? [String: Any] else { return }
            storeAccess(access)
        case "reminders":
            reminders.replace(body["items"] as? [[String: String]] ?? [])
        case "widget":
            if let data = body["data"] as? [String: Any], let defaults = UserDefaults(suiteName: MonoShared.group) {
                for (key, value) in data { defaults.set(value, forKey: key) }
                WidgetCenter.shared.reloadAllTimelines()
            }
        case "enableReminders":
            reminders.requestAuthorization { [weak self] granted in
                self?.send("reminderPermission", [granted])
            }
        case "notificationStatus":
            reminders.isAuthorized { [weak self] granted in
                self?.send("notificationStatus", [granted])
            }
        case "theme":
            guard let dark = body["dark"] as? Bool else { return }
            UserDefaults.standard.set(dark, forKey: Self.darkKey)
            if let bg = body["bg"] as? String, Self.color(hex: bg) != nil {
                UserDefaults.standard.set(bg, forKey: Self.launchColorKey)
            }
            // Цвет темы — только после заставки (около 2 секунд)
            let wait = max(0, 2.2 - Date().timeIntervalSince(launchedAt))
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in
                guard UserDefaults.standard.bool(forKey: Self.darkKey) == dark else { return }
                self?.applyThemeBackground(dark: dark)
            }
        default: break
        }
    }

    private var accessKey: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: (Bundle.main.bundleIdentifier ?? "mono") + ".access",
            kSecAttrAccount as String: "identity"
        ]
    }

    private func loadAccess() -> String {
        var query = accessKey
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return "null" }
        guard status == errSecSuccess,
              let data = item as? Data,
              (try? JSONSerialization.jsonObject(with: data)) is [String: Any],
              let json = String(data: data, encoding: .utf8) else { return "false" }
        return json
    }

    private func storeAccess(_ access: [String: Any]) {
        guard let deviceId = access["deviceId"] as? String,
              deviceId.range(of: "^[0-9a-f]{32}$", options: .regularExpression) != nil,
              let secret = access["secret"] as? String,
              secret.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil,
              let trialUntil = access["trialUntil"] as? NSNumber,
              trialUntil.doubleValue.isFinite, trialUntil.doubleValue > 0 else { return }
        var identity: [String: Any] = ["deviceId": deviceId, "secret": secret, "trialUntil": trialUntil]
        if let code = access["code"] as? String, code.range(of: "^[0-9]{6}$", options: .regularExpression) != nil {
            identity["code"] = code
            identity["provisional"] = access["provisional"] as? Bool ?? false
        }
        guard let data = try? JSONSerialization.data(withJSONObject: identity) else { return }
        let attributes = [kSecValueData as String: data]
        let status = SecItemUpdate(accessKey as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = accessKey
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(item as CFDictionary, nil)
        }
    }

    // Vision and PDFKit keep financial documents on the device.
    private func recognizeDocument(_ body: [String: Any]) {
        guard let id = body["id"] as? String, id.count < 80,
              let encoded = body["data"] as? String, encoded.count <= 28_000_000,
              let data = Data(base64Encoded: encoded), data.count <= 20_000_000 else { return }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                func recognize(_ image: CGImage) throws -> String {
                    let request = VNRecognizeTextRequest()
                    request.recognitionLevel = .accurate
                    request.recognitionLanguages = ["ru-RU", "en-US"]
                    request.usesLanguageCorrection = false
                    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
                    let observations = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
                    var rows: [[VNRecognizedTextObservation]] = []
                    for observation in observations {
                        if let last = rows.last, let first = last.first,
                           abs(first.boundingBox.midY - observation.boundingBox.midY) < min(first.boundingBox.height, observation.boundingBox.height) * 0.5 {
                            rows[rows.count - 1].append(observation)
                        } else { rows.append([observation]) }
                    }
                    return rows.map { row in row.sorted { $0.boundingBox.minX < $1.boundingBox.minX }.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\t") }.joined(separator: "\n")
                }
                func bankRows(_ page: PDFPage) -> [[String: String]]? {
                    let normalized = (page.string ?? "").components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
                    guard normalized.contains("Дата и время"), normalized.contains("в валюте карты"), normalized.contains("Описание") else { return nil }
                    let bounds = page.bounds(for: .mediaBox), w = bounds.width
                    let column = CGRect(x: bounds.minX + w * 0.09, y: bounds.minY + 55, width: w * 0.11, height: bounds.height - 55)
                    let lines = page.selection(for: column)?.selectionsByLine() ?? []
                    let dates = lines.filter { ($0.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).range(of: "^\\d{2}\\.\\d{2}\\.\\d{4}$", options: .regularExpression) != nil }.sorted { $0.bounds(for: page).maxY > $1.bounds(for: page).maxY }
                    return dates.enumerated().map { index, line in
                        let top = line.bounds(for: page).maxY + 2
                        let next = index + 1 < dates.count ? dates[index + 1].bounds(for: page).maxY + 2 : bounds.minY + 55
                        let bottom = max(next, top - 85)
                        let amountRect = CGRect(x: bounds.minX + w * 0.49, y: line.bounds(for: page).minY - 2, width: w * 0.155, height: line.bounds(for: page).height + 4)
                        let titleRect = CGRect(x: bounds.minX + w * 0.65, y: bottom, width: w * 0.187, height: max(1, top - bottom))
                        return ["date": (line.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines), "amount": page.selection(for: amountRect)?.string ?? "", "title": page.selection(for: titleRect)?.string ?? ""]
                    }
                }
                var text = ""
                var structured: [[String: String]] = []
                var bankDetected = false

                if body["kind"] as? String == "pdf" {
                    guard let document = PDFDocument(data: data), !document.isLocked,
                          document.pageCount > 0, document.pageCount <= 30 else {
                        throw NSError(domain: "MonoDocument", code: 1, userInfo: [NSLocalizedDescriptionKey: "Нужен PDF без пароля, не больше 30 страниц."])
                    }
                    for i in 0..<document.pageCount {
                        guard let page = document.page(at: i) else { continue }
                        let pageText = page.string ?? ""
                        if let rows = bankRows(page) { bankDetected = true; structured.append(contentsOf: rows) }
                        if pageText.trimmingCharacters(in: .whitespacesAndNewlines).count > 30 { text += pageText }
                        else if let image = page.thumbnail(of: CGSize(width: 1800, height: 2400), for: .mediaBox).cgImage { text += try recognize(image) }
                        text += "\n\u{000C}\n"
                        if text.utf8.count > 300_000 { throw NSError(domain: "MonoDocument", code: 2, userInfo: [NSLocalizedDescriptionKey: "Документ слишком большой. Разделите выписку на части."]) }
                    }
                } else {
                    // UIImage decodes HEIC/JPEG/PNG and normalizes orientation before OCR.
                    guard let image = UIImage(data: data), image.size.width * image.size.height <= 60_000_000 else {
                        throw NSError(domain: "MonoDocument", code: 3, userInfo: [NSLocalizedDescriptionKey: "Не удалось открыть изображение."])
                    }
                    let scale = min(1, 2400 / max(image.size.width, image.size.height))
                    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                    let format = UIGraphicsImageRendererFormat(); format.scale = 1
                    let normalized = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
                    guard let cg = normalized.cgImage else { throw NSError(domain: "MonoDocument", code: 4, userInfo: [NSLocalizedDescriptionKey: "Не удалось подготовить изображение."]) }
                    text = try recognize(cg)
                }
                if bankDetected {
                    let payload: [String: Any] = ["format": "mono-bank-table-v1", "rows": structured, "sourceText": text]
                    let encoded = try JSONSerialization.data(withJSONObject: payload)
                    text = String(decoding: encoded, as: UTF8.self)
                }
                DispatchQueue.main.async { self?.send("documentResult", [id, text, ""]) }
            } catch {
                DispatchQueue.main.async { self?.send("documentResult", [id, "", error.localizedDescription]) }
            }
        }
    }

    private func send(_ name: String, _ arguments: [Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: arguments),
              let json = String(data: data, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.MonoNative?.\(name)(...\(json))")
    }

    private func share(_ name: String, text: String) {
        guard presentedViewController == nil, text.utf8.count <= 24_000_000 else { return }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let url = folder.appendingPathComponent((name as NSString).lastPathComponent)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try text.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            let alert = UIAlertController(title: "Экспорт не удался", message: error.localizedDescription, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "ОК", style: .default))
            present(alert, animated: true)
            return
        }
        presentActivity([url]) { try? FileManager.default.removeItem(at: folder) }
    }

    private func presentActivity(_ items: [Any], onDone: (() -> Void)? = nil) {
        guard presentedViewController == nil else { onDone?(); return }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.completionWithItemsHandler = { _, _, _, _ in onDone?() }
        present(sheet, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            let isMonoWebsite = url.scheme == "http" && url.host == "monoapp.ru" && url.port == nil
            if navigationAction.navigationType == .linkActivated,
               isMonoWebsite || ["https", "mailto", "tg"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Отмена", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Продолжить", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "ОК", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    // Быстрые действия с виджетов (mono://record, mono://text).
    private var pageReady = false
    private var pendingLink: String?

    func openLink(_ kind: String) {
        pendingLink = kind
        flushLink()
    }

    private func flushLink() {
        guard pageReady, let kind = pendingLink else { return }
        pendingLink = nil
        send("deepLink", [kind])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = true
        flushLink()
    }
}

enum MonoShared {
    // Должна совпадать с App Group, включённой у приложения и у виджета.
    static let group = "group.ru.mono.app"
}
