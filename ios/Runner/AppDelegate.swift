import UIKit
import Flutter
import workmanager

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
  GeneratedPluginRegistrant.register(with: self)
  
    // Just like we implemented for Android, we have set up registerPeriodicTask to run every 2 days on iOS as well.
    WorkmanagerPlugin.setPluginRegistrantCallback { registry in
            GeneratedPluginRegistrant.register(with: registry)
        }
        
    WorkmanagerPlugin.registerPeriodicTask(withIdentifier: "io.nedaa.schedule",  frequency: NSNumber(value: 172800))    
    
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
