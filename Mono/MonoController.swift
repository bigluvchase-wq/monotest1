import UIKit
import Security
import UserNotifications
import WebKit
import WidgetKit

final class MonoController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private lazy var speech = SpeechBridge { [weak self] id, event, info in
        self?.send("speechEvent", [id, event, info])
    }
    private let reminders = MonoReminders()

    override func viewDidLoad() {
        super.viewDidLoad()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "mono")
        let access = loadAccess()
        config.userContentController.addUserScript(WKUserScript(
            source: "window.monoStoredAccess = \(access)",
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
        // До и во время заставки фон всегда тёмный, как у заставки, — без белой вспышки при запуске
        view.backgroundColor = UIColor(named: "LaunchBackground")
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
    private let launchedAt = Date()

    // Фон под веб-страницей в цвет темы: без чёрной полосы над клавиатурой в светлой теме
    private func applyThemeBackground(dark: Bool) {
        view.backgroundColor = dark
            ? UIColor(red: 0.086, green: 0.090, blue: 0.106, alpha: 1)
            : UIColor(red: 0.925, green: 0.933, blue: 0.949, alpha: 1)
    }

    @objc private func interruptSpeech() { speech.cancel() }
    @objc private func refreshReminders() {
        send("refreshReminders", [])
        send("refreshAccess", [])
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "speechStart", "speechStop", "speechAbort":
            guard let id = body["id"] as? String else { return }
            switch action {
            case "speechStart": speech.start(id)
            case "speechStop": speech.stop(id)
            default: speech.cancel(id)
            }
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
