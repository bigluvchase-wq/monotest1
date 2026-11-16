import UIKit
import WebKit
import SwiftUI
import Metal
import DistortionWavesKit

/// Entirely on-device, transient snapshots. Saving stays owned by the existing JS engine.
@MainActor
final class MonoSaveWave {
    private weak var parent: UIViewController?
    private weak var web: WKWebView?
    private let ready: (String, Bool) -> Void
    private let finished: (String) -> Void
    private var id: String?
    private var before: UIImage?
    private var source = CGRect.zero
    private var palette = "system"
    private var cover: UIImageView?
    private var host: UIHostingController<MonoSaveWaveView>?
    private var timeout: DispatchWorkItem?

    init(parent: UIViewController, web: WKWebView,
         ready: @escaping (String, Bool) -> Void, finished: @escaping (String) -> Void) {
        self.parent = parent; self.web = web; self.ready = ready; self.finished = finished
    }

    func prepare(_ data: [String: Any]) {
        guard let key = data["id"] as? String, key.count <= 32 else { return }
        guard id == nil, let web, let parent, parent.view.window != nil,
              MTLCreateSystemDefaultDevice() != nil,
              let rect = data["source"] as? [String: Any],
              let viewport = data["viewport"] as? [String: Any],
              let x = number(rect, "x"), let y = number(rect, "y"),
              let width = number(rect, "width"), let height = number(rect, "height"),
              let vw = number(viewport, "width"), let vh = number(viewport, "height"),
              vw > 0, vh > 0, width > 0, height > 0 else { ready(key, false); return }
        id = key; palette = data["palette"] as? String ?? "system"
        let sx = web.bounds.width / vw, sy = web.bounds.height / vh
        source = CGRect(x: x * sx, y: y * sy, width: width * sx, height: height * sy)
            .intersection(web.bounds)
        guard !source.isNull, !source.isEmpty else { cancel(key); ready(key, false); return }
        armTimeout(key, seconds: 4)
        let config = snapshotConfig(web)
        web.takeSnapshot(with: config) { [weak self] image, _ in
            guard let self, self.id == key else { return }
            guard let image else { self.cancel(key); self.ready(key, false); return }
            let image = self.opaque(image, background: parent.view.backgroundColor ?? .systemBackground)
            self.before = image
            let cover = UIImageView(image: image)
            cover.frame = parent.view.bounds; cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            cover.contentMode = .scaleToFill; cover.isUserInteractionEnabled = true
            cover.isAccessibilityElement = false; cover.accessibilityViewIsModal = true
            parent.view.addSubview(cover); self.cover = cover
            self.ready(key, true)
        }
    }

    func reveal(_ key: String) {
        guard id == key, let before, let parent, let web, host == nil else { return }
        web.takeSnapshot(with: snapshotConfig(web)) { [weak self] after, _ in
            guard let self, self.id == key else { return }
            guard let after else { self.cancel(key); return }
            var style = DistortionWaveStyle.vertical
            style.cornerRadius = 0 // UIKit/system clips the outer screen; no invented device corner radius.
            style.anticipation = 0.16; style.travel = 1.0
            style.linger = -0.1; style.rimFade = 0.75
            style.hairlineLinger = 0.1; style.hairlineFade = 0.6; style.particleLife = 1.0
            switch self.palette {
            case "black": style.palette = .mono
            case "blue": style.palette = .ocean
            case "green": style.palette = .green
            case "burgundy": style.palette = .sunset
            default: style.palette = .colorful
            }
            let image = self.opaque(after, background: parent.view.backgroundColor ?? .systemBackground)
            let scene = MonoSaveWaveView(before: before, after: image, source: self.source,
                                         size: parent.view.bounds.size, style: style,
                                         onFinish: { [weak self] in self?.cancel(key) })
            let host = UIHostingController(rootView: scene)
            host.safeAreaRegions = [] // Match the full WKWebView snapshot coordinate space.
            host.view.backgroundColor = .clear
            parent.addChild(host); host.view.frame = parent.view.bounds
            host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            parent.view.addSubview(host.view); host.didMove(toParent: parent)
            self.host = host; self.armTimeout(key, seconds: 3)
        }
    }

    func cancel(_ key: String? = nil) {
        guard let current = id, key == nil || key == current else { return }
        id = nil; timeout?.cancel(); timeout = nil
        host?.willMove(toParent: nil); host?.view.removeFromSuperview(); host?.removeFromParent(); host = nil
        cover?.removeFromSuperview(); cover = nil; before = nil
        finished(current)
    }

    private func armTimeout(_ key: String, seconds: TimeInterval) {
        timeout?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.cancel(key) }
        timeout = work; DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    private func opaque(_ image: UIImage, background: UIColor) -> UIImage {
        let format = UIGraphicsImageRendererFormat(); format.opaque = true; format.scale = image.scale
        return UIGraphicsImageRenderer(size: image.size, format: format).image { context in
            background.setFill(); context.fill(CGRect(origin: .zero, size: image.size))
            image.draw(at: .zero)
        }
    }

    private func snapshotConfig(_ web: WKWebView) -> WKSnapshotConfiguration {
        let config = WKSnapshotConfiguration(); config.rect = web.bounds
        // Keep texture/memory bounds predictable; UIImage still fills the same point-sized view.
        config.snapshotWidth = NSNumber(value: Double(min(web.bounds.width, 430)))
        config.afterScreenUpdates = true
        return config
    }

    private func number(_ values: [String: Any], _ key: String) -> CGFloat? {
        guard let value = values[key] as? NSNumber, value.doubleValue.isFinite else { return nil }
        return CGFloat(value.doubleValue)
    }
}
