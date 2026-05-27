import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            self.enableWebViewSwipeBack(in: scene)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        enableWebViewSwipeBack(in: scene)
    }

    /// Safari-style edge swipe to go back through in-app history (React Router).
    private func enableWebViewSwipeBack(in scene: UIScene) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let root = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController
            ?? windowScene.windows.first?.rootViewController
        guard let bridge = root as? CAPBridgeViewController else { return }
        bridge.webView?.allowsBackForwardNavigationGestures = true
    }

}
