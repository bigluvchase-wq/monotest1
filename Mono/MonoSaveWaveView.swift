import SwiftUI
import UIKit
import DistortionWavesKit

/// The shader receives SwiftUI images, never the UIKit-backed WKWebView itself.
struct MonoSaveWaveView: View {
    let before: UIImage
    let after: UIImage
    let source: CGRect
    let size: CGSize
    let style: DistortionWaveStyle
    let onFinish: () -> Void
    @State private var revealed = false

    var body: some View {
        DistortionWave(isRevealed: revealed, source: source,
                       focus: CGPoint(x: source.midX, y: source.midY),
                       style: style, onFinish: onFinish) {
            Image(uiImage: before).resizable().frame(width: size.width, height: size.height)
                .background(Color.black)
        } revealed: {
            Image(uiImage: after).resizable().frame(width: size.width, height: size.height)
                .background(Color.black)
        }
        .frame(width: size.width, height: size.height)
        // Bound the shader output to the screen as well as clipping its UIKit host.
        .clipShape(RoundedRectangle(cornerRadius: CGFloat(style.cornerRadius), style: .circular))
        .accessibilityHidden(true)
        .task {
            // Let the kit warm its Metal shaders before the first visible movement.
            try? await Task.sleep(for: .milliseconds(170))
            guard !Task.isCancelled else { return }
            revealed = true
        }
    }
}
