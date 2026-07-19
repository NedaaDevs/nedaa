import CoreLocation
import ExpoModulesCore
import UIKit

private struct StartWatchingOptions: Record {
    @Field var latitude: Double? = nil
    @Field var longitude: Double? = nil
    @Field var altitude: Double? = nil
    @Field var locationTimestamp: Double? = nil

    var hasValidCoordinates: Bool {
        guard let latitude, let longitude else { return false }

        return latitude.isFinite
            && longitude.isFinite
            && (-90...90).contains(latitude)
            && (-180...180).contains(longitude)
    }
}

public class ExpoOrientationModule: Module {
    private static let locationUpdateTimeout: TimeInterval = 5

    private var delegate: HeadingDelegate?
    private var locationManager: CLLocationManager?
    private var locationStopWorkItem: DispatchWorkItem?
    private var isUpdatingLocation = false
    private var orientationObservers: [NSObjectProtocol] = []
    private var startupWorkItem: DispatchWorkItem?
    private var isWatching = false

    public func definition() -> ModuleDefinition {
        Name("ExpoOrientation")

        Events("onHeadingUpdate")

        Function("startWatching") { [weak self] (options: StartWatchingOptions?) in
            self?.runOnMain { [weak self] in
                self?.startWatching(options: options)
            }
        }

        Function("stopWatching") { [weak self] in
            self?.runOnMain { [weak self] in
                self?.stopAll()
            }
        }

        OnDestroy {
            self.runOnMain {
                self.stopAll()
            }
        }
    }

    private func runOnMain(_ operation: @escaping () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.async(execute: operation)
        }
    }

    private func startWatching(options: StartWatchingOptions?) {
        precondition(Thread.isMainThread)

        let allowsTrueNorth = options?.hasValidCoordinates == true

        if isWatching {
            updateActiveMode(allowsTrueNorth: allowsTrueNorth)
            return
        }

        isWatching = true

        guard CLLocationManager.headingAvailable() else {
            emitInvalidHeading(error: "sensor_unavailable")
            return
        }

        let headingDelegate = HeadingDelegate(
            allowsTrueNorth: allowsTrueNorth,
            onTrueHeadingAvailable: { [weak self] in
                self?.stopOneShotLocationUpdates()
            },
            onHeading: { [weak self] sample in
                guard let self, self.isWatching else { return }

                self.startupWorkItem?.cancel()
                self.startupWorkItem = nil
                self.send(sample: sample)
            }
        )

        let manager = CLLocationManager()
        manager.delegate = headingDelegate
        manager.headingFilter = 1
        manager.headingOrientation = Self.currentHeadingOrientation()
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone

        delegate = headingDelegate
        locationManager = manager
        startObservingOrientationChanges()

        if allowsTrueNorth {
            startOneShotLocationUpdates()
        }
        manager.startUpdatingHeading()

        scheduleStartupTimeout()
    }

    private func updateActiveMode(allowsTrueNorth: Bool) {
        precondition(Thread.isMainThread)

        let wasUsingTrueNorth = delegate?.allowsTrueNorth == true
        delegate?.allowsTrueNorth = allowsTrueNorth

        guard let locationManager else { return }

        locationManager.headingOrientation = Self.currentHeadingOrientation()
        if allowsTrueNorth, !wasUsingTrueNorth {
            startOneShotLocationUpdates()
        } else if !allowsTrueNorth {
            stopOneShotLocationUpdates()
        }
    }

    private func startOneShotLocationUpdates() {
        precondition(Thread.isMainThread)
        guard let locationManager else { return }

        locationStopWorkItem?.cancel()
        isUpdatingLocation = true
        locationManager.startUpdatingLocation()

        let workItem = DispatchWorkItem { [weak self] in
            self?.stopOneShotLocationUpdates()
        }
        locationStopWorkItem = workItem
        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.locationUpdateTimeout,
            execute: workItem
        )
    }

    private func stopOneShotLocationUpdates() {
        precondition(Thread.isMainThread)

        locationStopWorkItem?.cancel()
        locationStopWorkItem = nil
        guard isUpdatingLocation else { return }

        isUpdatingLocation = false
        locationManager?.stopUpdatingLocation()
    }

    private func scheduleStartupTimeout() {
        startupWorkItem?.cancel()

        let workItem = DispatchWorkItem { [weak self] in
            guard let self, self.isWatching else { return }

            self.emitInvalidHeading(error: "startup_timeout")
        }
        startupWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: workItem)
    }

    private func startObservingOrientationChanges() {
        guard orientationObservers.isEmpty else { return }

        UIDevice.current.beginGeneratingDeviceOrientationNotifications()

        let orientationObserver = NotificationCenter.default.addObserver(
            forName: UIDevice.orientationDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            DispatchQueue.main.async { [weak self] in
                self?.synchronizeHeadingOrientation()
            }
        }
        let activeObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.synchronizeHeadingOrientation()
        }

        orientationObservers = [orientationObserver, activeObserver]
    }

    private func synchronizeHeadingOrientation() {
        precondition(Thread.isMainThread)
        locationManager?.headingOrientation = Self.currentHeadingOrientation()
    }

    private func send(sample: HeadingSample) {
        var payload: [String: Any] = [
            "heading": sample.heading,
            "accuracyDegrees": sample.accuracyDegrees.map { $0 as Any } ?? NSNull(),
            "northReference": sample.northReference,
            "isValid": sample.isValid,
            "timestamp": sample.timestamp,
            "source": "cl_location"
        ]

        if let error = sample.error {
            payload["error"] = error
        }

        sendEvent("onHeadingUpdate", payload)
    }

    private func emitInvalidHeading(error: String) {
        send(sample: HeadingSample(
            heading: 0,
            accuracyDegrees: nil,
            northReference: "unknown",
            isValid: false,
            timestamp: Date().timeIntervalSince1970 * 1_000,
            error: error
        ))
    }

    private func stopAll() {
        precondition(Thread.isMainThread)

        isWatching = false
        startupWorkItem?.cancel()
        startupWorkItem = nil
        locationStopWorkItem?.cancel()
        locationStopWorkItem = nil
        isUpdatingLocation = false
        orientationObservers.forEach { observer in
            NotificationCenter.default.removeObserver(observer)
        }
        if !orientationObservers.isEmpty {
            UIDevice.current.endGeneratingDeviceOrientationNotifications()
        }
        orientationObservers = []
        locationManager?.stopUpdatingHeading()
        locationManager?.stopUpdatingLocation()
        locationManager?.delegate = nil
        locationManager = nil
        delegate = nil
    }

    fileprivate static func currentHeadingOrientation() -> CLDeviceOrientation {
        precondition(Thread.isMainThread)

        let windowScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first

        switch windowScene?.interfaceOrientation {
        case .some(.portraitUpsideDown):
            return .portraitUpsideDown
        // UIKit names landscape by interface orientation; Core Location names the opposite physical rotation.
        case .some(.landscapeLeft):
            return .landscapeRight
        case .some(.landscapeRight):
            return .landscapeLeft
        case .some(.portrait), .some(.unknown), .none:
            return .portrait
        @unknown default:
            return .portrait
        }
    }
}

private struct HeadingSample {
    let heading: Double
    let accuracyDegrees: Double?
    let northReference: String
    let isValid: Bool
    let timestamp: Double
    let error: String?
}

private final class HeadingDelegate: NSObject, CLLocationManagerDelegate {
    private static let maximumSampleAge: TimeInterval = 5
    private static let maximumFutureSkew: TimeInterval = 1

    var allowsTrueNorth: Bool

    private let onTrueHeadingAvailable: () -> Void
    private let onHeading: (HeadingSample) -> Void

    init(
        allowsTrueNorth: Bool,
        onTrueHeadingAvailable: @escaping () -> Void,
        onHeading: @escaping (HeadingSample) -> Void
    ) {
        self.allowsTrueNorth = allowsTrueNorth
        self.onTrueHeadingAvailable = onTrueHeadingAvailable
        self.onHeading = onHeading
        super.init()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        precondition(Thread.isMainThread)
        manager.headingOrientation = ExpoOrientationModule.currentHeadingOrientation()

        let timestamp = newHeading.timestamp.timeIntervalSince1970 * 1_000
        let sampleAge = Date().timeIntervalSince(newHeading.timestamp)

        guard sampleAge <= Self.maximumSampleAge, sampleAge >= -Self.maximumFutureSkew else {
            onHeading(HeadingSample(
                heading: 0,
                accuracyDegrees: nil,
                northReference: "unknown",
                isValid: false,
                timestamp: timestamp,
                error: "stale_heading"
            ))
            return
        }

        let hasTrueHeading = allowsTrueNorth
            && newHeading.trueHeading.isFinite
            && newHeading.trueHeading >= 0
        if hasTrueHeading {
            onTrueHeadingAvailable()
        }

        guard newHeading.headingAccuracy.isFinite, newHeading.headingAccuracy >= 0 else {
            onHeading(HeadingSample(
                heading: 0,
                accuracyDegrees: nil,
                northReference: "unknown",
                isValid: false,
                timestamp: timestamp,
                error: "invalid_accuracy"
            ))
            return
        }

        let heading = hasTrueHeading ? newHeading.trueHeading : newHeading.magneticHeading
        let northReference = hasTrueHeading ? "true" : "magnetic"

        guard heading.isFinite, heading >= 0 else {
            onHeading(HeadingSample(
                heading: 0,
                accuracyDegrees: newHeading.headingAccuracy,
                northReference: northReference,
                isValid: false,
                timestamp: timestamp,
                error: "invalid_heading"
            ))
            return
        }

        onHeading(HeadingSample(
            heading: Self.normalize(heading),
            accuracyDegrees: newHeading.headingAccuracy,
            northReference: northReference,
            isValid: true,
            timestamp: timestamp,
            error: nil
        ))
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        guard let heading = manager.heading else { return true }

        return heading.headingAccuracy < 0 || heading.headingAccuracy > 30
    }

    private static func normalize(_ heading: Double) -> Double {
        let normalized = heading.truncatingRemainder(dividingBy: 360)
        return normalized >= 0 ? normalized : normalized + 360
    }
}
