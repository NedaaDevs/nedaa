import ExpoModulesCore
import CoreLocation

public class ExpoOrientationModule: Module {
    private var delegate: HeadingDelegate?
    private var locationManager: CLLocationManager?
    private var isWatching = false

    public func definition() -> ModuleDefinition {
        Name("ExpoOrientation")

        Events("onHeadingUpdate")

        Function("startWatching") { [weak self] in
            guard let self = self, !self.isWatching else { return }
            self.isWatching = true

            let del = HeadingDelegate { [weak self] heading, accuracy in
                self?.sendEvent("onHeadingUpdate", [
                    "heading": heading,
                    "accuracy": accuracy,
                    "source": "cl_location"
                ])
            }
            self.delegate = del

            let manager = CLLocationManager()
            manager.delegate = del
            manager.headingFilter = 1
            manager.startUpdatingHeading()
            manager.startUpdatingLocation()
            self.locationManager = manager
        }

        Function("stopWatching") { [weak self] in
            self?.stopAll()
        }

        OnDestroy {
            self.stopAll()
        }
    }

    private func stopAll() {
        isWatching = false
        locationManager?.stopUpdatingHeading()
        locationManager?.stopUpdatingLocation()
        locationManager?.delegate = nil
        locationManager = nil
        delegate = nil
    }
}

private class HeadingDelegate: NSObject, CLLocationManagerDelegate {
    private let onHeading: (Double, Double) -> Void
    private var lastHeading: Double = 0
    private var hasLastHeading = false

    init(onHeading: @escaping (Double, Double) -> Void) {
        self.onHeading = onHeading
        super.init()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let heading: Double
        if newHeading.trueHeading >= 0 {
            heading = newHeading.trueHeading
        } else {
            heading = newHeading.magneticHeading
        }

        let smoothed = smoothHeading(heading)
        let accuracy = newHeading.headingAccuracy >= 0 ? newHeading.headingAccuracy : -1

        onHeading(smoothed, accuracy)
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        if let heading = manager.heading {
            return heading.headingAccuracy < 0 || heading.headingAccuracy > 30
        }
        return true
    }

    private func smoothHeading(_ newHeading: Double) -> Double {
        guard hasLastHeading else {
            lastHeading = newHeading
            hasLastHeading = true
            return newHeading
        }

        var diff = newHeading - lastHeading
        if diff > 180 { diff -= 360 }
        if diff < -180 { diff += 360 }
        if abs(diff) < 0.5 { return lastHeading }

        let alpha = 0.3
        var smoothed = lastHeading + alpha * diff
        if smoothed < 0 { smoothed += 360 }
        if smoothed >= 360 { smoothed -= 360 }
        lastHeading = smoothed
        return smoothed
    }
}
