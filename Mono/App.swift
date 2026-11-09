import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = MonoController()
        window.makeKeyAndVisible()
        self.window = window
        if let url = options?[.url] as? URL { _ = (window.rootViewController as? MonoController)?.openShortcut(url) }
        return true
    }
    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        (window?.rootViewController as? MonoController)?.openShortcut(url) ?? false
    }
}
