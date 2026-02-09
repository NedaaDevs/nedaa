import AVFoundation
import AudioToolbox
import MediaPlayer
#if canImport(UIKit)
import UIKit
#endif

class AlarmAudioManager: NSObject, AVAudioPlayerDelegate {
    static let shared = AlarmAudioManager()

    private var audioPlayer: AVAudioPlayer?
    private var isPlaying = false
    private var isPreviewMode = false
    private var volume: Float = 1.0
    private var retryCount = 0
    private let maxRetries = 3
    private var retryWorkItem: DispatchWorkItem?

    private var vibrationTimer: Timer?
    private var isVibrating = false

    private var volumeObservation: NSKeyValueObservation?
    private var targetVolume: Float?
    private var volumeView: MPVolumeView?

    private var keepAlivePlayer: AVAudioPlayer?
    private var isKeepAliveActive = false

    private let savedVolumeKey = "savedSystemVolume"

    // Callback for playback finished (used for preview mode)
    var onPlaybackFinished: (() -> Void)?

    private override init() {
        super.init()
        setupInterruptionHandling()
    }

    // MARK: - AVAudioPlayerDelegate

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        log("Audio finished playing, success: \(flag), preview mode: \(isPreviewMode)")
        if isPreviewMode {
            isPlaying = false
            isPreviewMode = false
            onPlaybackFinished?()
        }
    }

    private func log(_ message: String) {
        if #available(iOS 14.0, *) {
            NativeLogger.shared.audio(message)
        }
        PersistentLog.shared.audio(message)
    }

    private func logError(_ message: String) {
        if #available(iOS 14.0, *) {
            NativeLogger.shared.audioError(message)
        }
        PersistentLog.shared.audio(message)
    }

    #if canImport(UIKit)
    private func getAppStateString() -> String {
        let appState = UIApplication.shared.applicationState
        switch appState {
        case .active: return "ACTIVE"
        case .inactive: return "INACTIVE"
        case .background: return "BACKGROUND"
        @unknown default: return "UNKNOWN"
        }
    }
    #endif

    func setVolume(_ newVolume: Float) {
        volume = max(0, min(1, newVolume))
        audioPlayer?.volume = volume
        log("Volume set to: \(volume)")
    }

    func getVolume() -> Float {
        return volume
    }

    func saveSystemVolume() {
        // Check persisted value first (survives app kills)
        if UserDefaults.standard.object(forKey: savedVolumeKey) != nil {
            log("System volume already saved (persisted), skipping")
            return
        }
        let audioSession = AVAudioSession.sharedInstance()
        let volume = audioSession.outputVolume
        UserDefaults.standard.set(volume, forKey: savedVolumeKey)
        log("Saved system volume: \(volume)")
    }

    func restoreSystemVolume() {
        guard UserDefaults.standard.object(forKey: savedVolumeKey) != nil else {
            log("No saved volume to restore")
            return
        }
        let saved = UserDefaults.standard.float(forKey: savedVolumeKey)
        log("Restoring system volume to: \(saved)")
        setSystemVolume(saved)
        UserDefaults.standard.removeObject(forKey: savedVolumeKey)
    }

    @discardableResult
    func configureSession() -> Bool {
        do {
            let session = AVAudioSession.sharedInstance()

            // .playback category: continues in silent mode and when screen locked
            try session.setCategory(
                .playback,
                mode: .default,
                options: []
            )

            try session.setActive(true, options: .notifyOthersOnDeactivation)

            if #available(iOS 15.0, *) {
                try session.setPrefersNoInterruptionsFromSystemAlerts(true)
            }

            log("Session configured (playback, active)")
            return true
        } catch let error as NSError {
            logError("Session error: \(error.localizedDescription)")
            logError("  Domain: \(error.domain), Code: \(error.code)")
            if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
                logError("  Underlying: \(underlying.domain) code=\(underlying.code)")
            }
            if let reason = error.userInfo["NSLocalizedFailureReason"] as? String {
                logError("  Reason: \(reason)")
            }
            for (key, value) in error.userInfo {
                logError("  [\(key)]: \(value)")
            }
            return false
        }
    }

    func startAlarmSound(soundName: String = "beep", isPreview: Bool = false) {
        retryWorkItem?.cancel()
        retryWorkItem = nil

        log("Starting alarm sound: \(soundName), isPlaying=\(isPlaying), retry=\(retryCount)/\(maxRetries), preview=\(isPreview)")

        guard !isPlaying else {
            log("Already playing, ignoring")
            retryCount = 0
            return
        }

        isPreviewMode = isPreview

        let sessionConfigured = configureSession()

        if !sessionConfigured {
            if retryCount < maxRetries {
                retryCount += 1
                let delay = Double(retryCount) * 0.5
                log("Session failed, retry \(retryCount)/\(maxRetries) in \(delay)s")

                let workItem = DispatchWorkItem { [weak self] in
                    self?.startAlarmSound(soundName: soundName, isPreview: isPreview)
                }
                retryWorkItem = workItem
                DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
                return
            } else {
                logError("Max retries (\(maxRetries)) exceeded, proceeding anyway")
            }
        }

        guard let url = findSoundFile(named: soundName) else {
            logError("Sound file not found: \(soundName)")
            return
        }

        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.numberOfLoops = isPreview ? 0 : -1  // Play once for preview, loop for alarm
            audioPlayer?.volume = volume
            audioPlayer?.prepareToPlay()
            let success = audioPlayer?.play() ?? false
            isPlaying = success

            if success {
                log("Playback started: \(url.lastPathComponent)")
                retryCount = 0
            } else {
                logError("play() returned false - audio session issue?")
                if retryCount < maxRetries {
                    retryCount += 1
                    let delay = Double(retryCount) * 0.5
                    log("play() failed, retry \(retryCount)/\(maxRetries) in \(delay)s")

                    let workItem = DispatchWorkItem { [weak self] in
                        self?.audioPlayer = nil
                        self?.startAlarmSound(soundName: soundName, isPreview: isPreview)
                    }
                    retryWorkItem = workItem
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
                }
            }
        } catch let error as NSError {
            logError("Play error: \(error.localizedDescription)")
            logError("  Domain: \(error.domain), Code: \(error.code)")
        }
    }

    func stopAlarmSound() {
        retryWorkItem?.cancel()
        retryWorkItem = nil
        retryCount = 0

        // Always attempt to stop, regardless of isPlaying flag (fixes state mismatch from retry logic)
        log("Stopping alarm sound")
        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        isPreviewMode = false

        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch let error as NSError {
            logError("Deactivate error: \(error.localizedDescription)")
        }
    }

    func isCurrentlyPlaying() -> Bool {
        return isPlaying
    }

    func startContinuousVibration() {
        guard !isVibrating else { return }

        log("Starting vibration")
        isVibrating = true

        DispatchQueue.main.async { [weak self] in
            self?.vibrationTimer?.invalidate()
            self?.vibrationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                guard self?.isVibrating == true else { return }
                AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            }
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
    }

    func stopContinuousVibration() {
        guard isVibrating else { return }

        log("Stopping vibration")
        isVibrating = false
        vibrationTimer?.invalidate()
        vibrationTimer = nil
    }

    func isCurrentlyVibrating() -> Bool {
        return isVibrating
    }

    func startVolumeMonitoring(targetVolume: Float) {
        log("Starting volume monitoring, target: \(targetVolume)")
        self.targetVolume = targetVolume

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if self.volumeView == nil {
                self.volumeView = MPVolumeView(frame: CGRect(x: -1000, y: -1000, width: 1, height: 1))
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let window = windowScene.windows.first {
                    window.addSubview(self.volumeView!)
                }
            }

            let session = AVAudioSession.sharedInstance()
            self.volumeObservation = session.observe(\.outputVolume, options: [.new]) { [weak self] session, change in
                guard let self = self,
                      let target = self.targetVolume,
                      let newVolume = change.newValue else { return }

                if abs(newVolume - target) > 0.01 {
                    self.log("Volume changed to \(newVolume), resetting to \(target)")
                    self.setSystemVolume(target)
                }
            }

            if session.outputVolume != targetVolume {
                self.setSystemVolume(targetVolume)
            }
        }
    }

    func stopVolumeMonitoring() {
        volumeObservation?.invalidate()
        volumeObservation = nil
        targetVolume = nil

        DispatchQueue.main.async { [weak self] in
            self?.volumeView?.removeFromSuperview()
            self?.volumeView = nil
        }
    }

    private func setSystemVolume(_ volume: Float) {
        DispatchQueue.main.async { [weak self] in
            guard let volumeView = self?.volumeView else { return }
            for subview in volumeView.subviews {
                if let slider = subview as? UISlider {
                    slider.value = volume
                    break
                }
            }
        }
    }

    func stopAll() {
        log("Stopping all audio effects")
        stopAlarmSound()
        stopContinuousVibration()
        restoreSystemVolume()
        stopVolumeMonitoring()
        stopQuietKeepAlive()
    }

    /// Plays alarm sound at inaudible volume (0.001) to keep app alive in background.
    /// Volume 0.0 gets optimized away and iOS kills the app.
    func startQuietKeepAlive(soundName: String = "beep") {
        if isKeepAliveActive {
            if keepAlivePlayer?.isPlaying == true {
                return
            }
            log("Keep-alive player not playing, restarting")
            isKeepAliveActive = false
        }

        log("Starting quiet keep-alive")

        do {
            // .mixWithOthers allows other audio to play (doesn't interrupt music/podcasts),
            // unlike the loud alarm which uses no mixing options
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)

            guard let url = findSoundFile(named: soundName) else {
                logError("Keep-alive audio file not found: \(soundName)")
                return
            }

            keepAlivePlayer = try AVAudioPlayer(contentsOf: url)
            keepAlivePlayer?.numberOfLoops = -1
            keepAlivePlayer?.volume = 0.001
            keepAlivePlayer?.prepareToPlay()

            let success = keepAlivePlayer?.play() ?? false
            isKeepAliveActive = success

            if success {
                log("Quiet keep-alive started")

                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                    guard let self = self, self.isKeepAliveActive else { return }
                    if !(self.keepAlivePlayer?.isPlaying ?? false) {
                        self.logError("Keep-alive stopped playing after 2s")
                    }
                }
            } else {
                logError("Keep-alive play() returned false")
            }
        } catch {
            logError("Keep-alive failed: \(error.localizedDescription)")
        }
    }

    func stopQuietKeepAlive() {
        guard isKeepAliveActive else { return }

        log("Stopping quiet keep-alive")
        keepAlivePlayer?.stop()
        keepAlivePlayer = nil
        isKeepAliveActive = false
    }

    func isKeepAliveRunning() -> Bool {
        return isKeepAliveActive
    }

    /// Transition from quiet keep-alive to loud alarm (called when observer detects hardware dismiss)
    func transitionToLoudAlarm(soundName: String = "beep", alarmVolume: Float = 1.0) {
        log("Transitioning to loud alarm, volume: \(alarmVolume)")

        // Reset vibration state to ensure it restarts (fixes bug where BGTask expires
        // and timer dies but isVibrating stays true, preventing restart)
        isVibrating = false
        vibrationTimer?.invalidate()
        vibrationTimer = nil

        if isKeepAliveActive {
            keepAlivePlayer?.stop()
            keepAlivePlayer = nil
            isKeepAliveActive = false
        }

        // Save system volume before we change it
        saveSystemVolume()

        // Set the alarm volume for audio player
        volume = alarmVolume

        // No mixWithOthers — we want to be loud and interrupt other audio
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playback,
                mode: .default,
                options: []
            )
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            logError("Failed to reconfigure session: \(error)")
            logError("Continuing anyway - vibration still works, audio works in foreground")
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.startAlarmSound(soundName: soundName)
            self.startContinuousVibration()
            self.startVolumeMonitoring(targetVolume: alarmVolume)
        }
    }

    private func setupInterruptionHandling() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            log("Interrupted - audio paused by system")

        case .ended:
            guard let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt else {
                return
            }
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)

            if options.contains(.shouldResume) && isPlaying {
                configureSession()
                audioPlayer?.play()
                log("Resumed after interruption")
            }

        @unknown default:
            break
        }
    }

    private func findSoundFile(named name: String) -> URL? {
        for ext in ["caf", "mp3", "wav", "m4a"] {
            if let url = Bundle.main.url(forResource: name, withExtension: ext) {
                return url
            }
        }
        return nil
    }
}
