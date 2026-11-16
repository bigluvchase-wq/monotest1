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
    private var panelFrame = CGRect.zero
    private var panelRadius: CGFloat = 0
    private var palette = DistortionWavePalette.mono
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
              let panel = data["panel"] as? [String: Any],
              let px = number(panel, "x"), let py = number(panel, "y"),
              let pw = number(panel, "width"), let ph = number(panel, "height"),
              let viewport = data["viewport"] as? [String: Any],
              let x = number(rect, "x"), let y = number(rect, "y"),
              let width = number(rect, "width"), let height = number(rect, "height"),
              let vw = number(viewport, "width"), let vh = number(viewport, "height"),
              vw > 0, vh > 0, width > 0, height > 0, pw > 0, ph > 0 else { ready(key, false); return }
        id = key
        let accent = color(data["accent"]) ?? DistortionWaveColor(hex: 0x6658ce)
        let secondary = color(data["secondary"]) ?? accent
        palette = DistortionWavePalette(colors: [accent, secondary, accent], ahead: accent, behind: secondary)
        let sx = web.bounds.width / vw, sy = web.bounds.height / vh
        panelFrame = CGRect(x: px * sx, y: py * sy, width: pw * sx, height: ph * sy)
            .intersection(web.bounds)
        guard !panelFrame.isNull, !panelFrame.isEmpty else { cancel(key); ready(key, false); return }
        panelRadius = min(max(number(panel, "cornerRadius") ?? 0, 0) * sx, min(panelFrame.width, panelFrame.height) / 2)
        source = CGRect(x: x * sx - panelFrame.minX, y: y * sy - panelFrame.minY, width: width * sx, height: height * sy)
        armTimeout(key, seconds: 4)
        let config = snapshotConfig(web)
        web.takeSnapshot(with: config) { [weak self] image, _ in
            guard let self, self.id == key else { return }
            guard let image else { self.cancel(key); self.ready(key, false); return }
            let snapshot = self.opaque(image, background: parent.view.backgroundColor ?? .systemBackground)
            self.before = snapshot
            let cover = UIImageView(image: snapshot)
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
            var style = DistortionWaveStyle.center
            style.cornerRadius = Double(self.panelRadius)
            style.anticipation = 0.16 * 1.15; style.travel = 1.15
            // Keep the visible movement 15% slower, without a frozen tail after it clears.
            style.linger = -0.1; style.rimFade = 0.65
            style.hairlineLinger = 0; style.hairlineFade = 0.65
            style.particleLife = style.travel * 0.6
            style.amplitude *= 0.85; style.swell *= 0.85; style.blur *= 0.85
            style.aberration *= 0.85; style.strength *= 0.85
            style.rimStrength *= 0.85; style.hairlineOpacity *= 0.85
            style.pull *= 0.85; style.inhale *= 0.85; style.gatherGlow *= 0.85
            style.particleSize *= 0.85
            style.palette = self.palette
            let image = self.opaque(after, background: parent.view.backgroundColor ?? .systemBackground)
            let scene = MonoSaveWaveView(before: self.crop(before), after: self.crop(image), source: self.source,
                                         size: self.panelFrame.size, style: style,
                                         onFinish: { [weak self] in self?.complete(key) })
            let host = UIHostingController(rootView: scene)
            host.safeAreaRegions = [] // Match the full WKWebView snapshot coordinate space.
            host.view.backgroundColor = .clear
            parent.addChild(host); host.view.frame = self.panelFrame
            host.view.layer.cornerRadius = self.panelRadius; host.view.clipsToBounds = true
            parent.view.addSubview(host.view); host.didMove(toParent: parent)
            self.host = host; self.armTimeout(key, seconds: 3)
        }
    }

    private func complete(_ key: String) {
        guard id == key, let host else { return }
        // Blend into the live web view instead of holding, then abruptly removing a still frame.
        host.view.isUserInteractionEnabled = false; cover?.isUserInteractionEnabled = false
        finished(key) // Close the saved receipt in the live web view while its snapshot fades out.
        UIView.animate(withDuration: UIAccessibility.isReduceMotionEnabled ? 0.08 : 0.12,
                       delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            host.view.alpha = 0; self.cover?.alpha = 0
        } completion: { [weak self] _ in self?.cancel(key) }
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

    private func crop(_ image: UIImage) -> UIImage {
        let format = UIGraphicsImageRendererFormat(); format.opaque = true; format.scale = image.scale
        let viewport = web?.bounds.size ?? image.size
        return UIGraphicsImageRenderer(size: panelFrame.size, format: format).image { _ in
            image.draw(in: CGRect(x: -panelFrame.minX, y: -panelFrame.minY,
                                  width: viewport.width, height: viewport.height))
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

    private func color(_ value: Any?) -> DistortionWaveColor? {
        guard let text = value as? String, text.hasPrefix("#"), text.count == 7,
              let hex = UInt32(text.dropFirst(), radix: 16) else { return nil }
        return DistortionWaveColor(hex: hex)
    }
}
