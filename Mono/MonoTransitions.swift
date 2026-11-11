import UIKit
import WebKit

/// Нативные переходы между экранами моно.
///
/// Экраны нарисованы в WKWebView, а двигает их iOS: перед переходом делается снимок текущего
/// экрана, веб-часть мгновенно рисует новый экран под снимком, и дальше снимок и новый экран
/// анимируются Core Animation — с частотой экрана, независимо от JavaScript.
///
/// Протокол с JS (native-bridge.js):
///   transitionBegin {id, kind, dir, rect} → натив кладёт снимок и отвечает transitionReady(id)
///   transitionGo {id}                     → новый экран нарисован, натив проигрывает анимацию
///   pageDrag {from, to, dir}              → свайп между экранами: дальше палец ведёт натив,
///                                           по отпусканию натив вызывает nativeNavigate(to) или отменяет
///   cachePage {page}                      → запомнить снимок корневого экрана для свайпов
final class MonoTransitions: NSObject, UIGestureRecognizerDelegate {
    private weak var web: WKWebView?
    private weak var host: UIView?
    private let send: (String, [Any]) -> Void

    private var cache: [String: UIView] = [:]
    private var overlay: UIView?
    private var pending: (id: Int, kind: String, dir: CGFloat, rect: CGRect?)?
    private var drag: Drag?
    private var lastFinish: (() -> Void)?

    private struct Drag {
        let from: String
        let to: String
        let dir: CGFloat           // +1 — следующий экран справа, −1 — слева
        let baseX: CGFloat         // смещение пальца в момент передачи жеста нативу
        let current: UIView
        let incoming: UIView
        let container: UIView
    }

    // Те же параметры, что у карусели напоминаний на главной
    private let depth: CGFloat = 0.08
    private let fade: CGFloat = 0.42
    private let curve = UICubicTimingParameters(controlPoint1: CGPoint(x: 0.22, y: 1), controlPoint2: CGPoint(x: 0.36, y: 1))

    private lazy var pan: UIPanGestureRecognizer = {
        let p = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        p.cancelsTouchesInView = false
        p.delaysTouchesBegan = false
        p.delaysTouchesEnded = false
        p.delegate = self
        return p
    }()

    init(web: WKWebView, host: UIView, send: @escaping (String, [Any]) -> Void) {
        self.web = web
        self.host = host
        self.send = send
        super.init()
        web.addGestureRecognizer(pan)
    }

    private var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled }
    private var width: CGFloat { host?.bounds.width ?? UIScreen.main.bounds.width }

    // MARK: - Снимки

    private func snapshot() -> UIView? {
        guard let web = web else { return nil }
        let view = web.snapshotView(afterScreenUpdates: false)
        view?.frame = web.frame
        view?.isUserInteractionEnabled = false
        return view
    }

    func cachePage(_ page: String) {
        guard drag == nil, overlay == nil, let snap = snapshot() else { return }
        cache[page] = snap
    }

    private func makeContainer() -> UIView? {
        guard let host = host, let web = web else { return nil }
        let container = UIView(frame: host.bounds)
        container.isUserInteractionEnabled = false
        container.backgroundColor = .clear
        host.insertSubview(container, aboveSubview: web)
        return container
    }

    private func clear() {
        overlay?.removeFromSuperview()
        overlay = nil
        web?.transform = .identity
        web?.alpha = 1
        web?.layer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        if let host = host { web?.frame = host.bounds }
    }

    // MARK: - Переходы по нажатию

    func begin(id: Int, kind: String, dir: CGFloat, rect: CGRect?, from: String = "") {
        lastFinish?()
        guard !reduceMotion, drag == nil, let container = makeContainer(), let snap = snapshot() else {
            send("transitionReady", [id, false])
            return
        }
        clear()
        container.addSubview(snap)
        overlay = container
        // старый корневой экран пригодится для свайпа назад
        if ["home", "history", "menu"].contains(from), let copy = snapshot() { cache[from] = copy }
        pending = (id, kind, dir, rect)
        send("transitionReady", [id, true])
        // Страховка: если веб-часть не ответила, снимок не должен висеть
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            guard let self = self, self.pending?.id == id else { return }
            self.pending = nil
            self.clear()
        }
    }

    func go(id: Int) {
        guard let p = pending, p.id == id, let container = overlay, let web = web,
              let snap = container.subviews.first else { return }
        pending = nil
        let w = width
        var animations: () -> Void = {}
        var duration: TimeInterval = 0.5
        var timing: UITimingCurveProvider = curve

        switch p.kind {
        case "slide":
            // Корневые экраны: как карусель — уходящий уменьшается и бледнеет, приходящий вырастает
            web.transform = CGAffineTransform(translationX: p.dir * w, y: 0).scaledBy(x: 1 - depth, y: 1 - depth)
            web.alpha = 1 - fade
            animations = {
                snap.transform = CGAffineTransform(translationX: -p.dir * w, y: 0).scaledBy(x: 1 - self.depth, y: 1 - self.depth)
                snap.alpha = 1 - self.fade
                web.transform = .identity
                web.alpha = 1
            }
            duration = 0.48
        case "push":
            // Вложенные экраны: как в iOS — новый выезжает целиком, старый сдвигается на треть и темнеет
            if p.dir > 0 {
                // вперёд: новый экран выезжает справа поверх старого
                web.transform = CGAffineTransform(translationX: w, y: 0)
                host?.bringSubviewToFront(web)
                animations = {
                    snap.transform = CGAffineTransform(translationX: -w * 0.3, y: 0)
                    snap.alpha = 0.7
                    web.transform = .identity
                }
            } else {
                // назад: старый экран уезжает вправо, под ним из-под сдвига возвращается прежний
                web.transform = CGAffineTransform(translationX: -w * 0.3, y: 0)
                web.alpha = 0.7
                animations = {
                    snap.transform = CGAffineTransform(translationX: w, y: 0)
                    web.transform = .identity
                    web.alpha = 1
                }
            }
            duration = 0.46
            timing = UISpringTimingParameters(dampingRatio: 1, initialVelocity: .zero)
        case "dive":
            // «Премиум»: пролёт сквозь кнопку
            let center = p.rect.map { CGPoint(x: $0.midX, y: $0.midY) } ?? CGPoint(x: w / 2, y: (host?.bounds.height ?? 0) / 2)
            setAnchor(snap, to: center)
            setAnchor(web, to: center)
            web.transform = CGAffineTransform(scaleX: 0.82, y: 0.82)
            web.alpha = 0
            animations = {
                snap.transform = CGAffineTransform(scaleX: 1.35, y: 1.35)
                snap.alpha = 0
                web.transform = .identity
                web.alpha = 1
            }
            duration = 0.56
        case "zoom":
            // Напоминание с главной: главная растворяется, экран приближается из карточки
            let center = p.rect.map { CGPoint(x: $0.midX, y: $0.midY) } ?? CGPoint(x: w / 2, y: (host?.bounds.height ?? 0) / 2)
            setAnchor(web, to: center)
            web.transform = CGAffineTransform(scaleX: 0.92, y: 0.92)
            web.alpha = 0
            UIView.animate(withDuration: 0.2, delay: 0, options: [.curveEaseOut]) {
                snap.alpha = 0
                snap.transform = CGAffineTransform(scaleX: 1.04, y: 1.04)
            }
            animations = {
                web.transform = .identity
                web.alpha = 1
            }
            duration = 0.56
        default:
            // fade: мягкая смена экрана
            web.alpha = 0
            web.transform = CGAffineTransform(translationX: 0, y: 12)
            animations = {
                snap.alpha = 0
                web.alpha = 1
                web.transform = .identity
            }
            duration = 0.42
        }

        let animator = UIViewPropertyAnimator(duration: duration, timingParameters: timing)
        animator.addAnimations(animations)
        let finish: () -> Void = { [weak self] in
            self?.lastFinish = nil
            self?.clear()
            self?.host?.bringSubviewToFront(web)
        }
        lastFinish = { animator.stopAnimation(true); finish() }
        animator.addCompletion { _ in finish() }
        animator.startAnimation()
    }

    private func setAnchor(_ view: UIView, to point: CGPoint) {
        let frame = view.frame
        guard frame.width > 0, frame.height > 0 else { return }
        view.layer.anchorPoint = CGPoint(x: (point.x - frame.minX) / frame.width, y: (point.y - frame.minY) / frame.height)
        view.frame = frame
    }

    // MARK: - Свайп между экранами

    func beginDrag(from: String, to: String, dir: CGFloat) {
        guard !reduceMotion, drag == nil, pending == nil,
              pan.state == .began || pan.state == .changed,
              let container = makeContainer(), let current = snapshot() else {
            send("pageDragDenied", [to])
            return
        }
        lastFinish?()
        let incoming: UIView
        if let cached = cache[to] {
            incoming = cached
        } else {
            incoming = UIView(frame: container.bounds)
            incoming.backgroundColor = host?.backgroundColor ?? .systemBackground
        }
        incoming.transform = .identity
        incoming.alpha = 1
        incoming.frame = container.bounds
        container.addSubview(incoming)
        container.addSubview(current)
        overlay = container
        drag = Drag(from: from, to: to, dir: dir, baseX: pan.translation(in: host).x, current: current, incoming: incoming, container: container)
        layoutDrag(dx: 0)
    }

    private func layoutDrag(dx raw: CGFloat) {
        guard let d = drag else { return }
        let w = width
        // палец тянет только в сторону следующего экрана; в обратную — с сопротивлением
        let dx = d.dir > 0 ? (raw <= 0 ? raw : raw * 0.15) : (raw >= 0 ? raw : raw * 0.15)
        let p = min(1, abs(dx) / w)
        d.current.transform = CGAffineTransform(translationX: dx, y: 0).scaledBy(x: 1 - depth * p, y: 1 - depth * p)
        d.current.alpha = 1 - fade * p
        let s = 1 - depth * (1 - p)
        d.incoming.transform = CGAffineTransform(translationX: d.dir * w + dx, y: 0).scaledBy(x: s, y: s)
        d.incoming.alpha = 1 - fade * (1 - p)
    }

    @objc private func handlePan(_ g: UIPanGestureRecognizer) {
        guard let d = drag else { return }
        let dx = g.translation(in: host).x - d.baseX
        switch g.state {
        case .changed:
            layoutDrag(dx: dx)
        case .ended, .cancelled, .failed:
            let v = g.velocity(in: host).x
            let toward = -d.dir
            let distance = dx * toward
            let commit = g.state == .ended && (distance > min(90, width * 0.22) || (distance > 38 && v * toward > 500))
            finishDrag(commit: commit, velocity: v)
        default: break
        }
    }

    private func finishDrag(commit: Bool, velocity: CGFloat) {
        guard let d = drag else { return }
        drag = nil
        let w = width
        if commit {
            // Веб-часть сразу рисует новый экран под снимками
            send("nativeNavigate", [d.to])
        }
        let animator = UIViewPropertyAnimator(duration: 0.42, timingParameters: curve)
        animator.addAnimations {
            if commit {
                d.current.transform = CGAffineTransform(translationX: -d.dir * w, y: 0).scaledBy(x: 1 - self.depth, y: 1 - self.depth)
                d.current.alpha = 1 - self.fade
                d.incoming.transform = .identity
                d.incoming.alpha = 1
            } else {
                d.current.transform = .identity
                d.current.alpha = 1
                let s = 1 - self.depth
                d.incoming.transform = CGAffineTransform(translationX: d.dir * w, y: 0).scaledBy(x: s, y: s)
                d.incoming.alpha = 1 - self.fade
            }
        }
        animator.addCompletion { [weak self] _ in
            guard let self = self else { return }
            if commit {
                // старый экран запоминаем для следующего свайпа назад
                d.current.transform = .identity
                d.current.alpha = 1
                d.current.removeFromSuperview()
                self.cache[d.from] = d.current
                // настоящий экран уже нарисован под снимком — плавно убираем снимок
                UIView.animate(withDuration: 0.14, animations: { d.container.alpha = 0 }, completion: { _ in
                    if self.overlay === d.container { self.clear() } else { d.container.removeFromSuperview() }
                })
            } else {
                if self.overlay === d.container { self.clear() } else { d.container.removeFromSuperview() }
            }
            self.send("pageDragEnd", [commit])
        }
        animator.startAnimation()
    }

    // Наш жест не мешает прокрутке и жестам страницы: он только слушает
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}
