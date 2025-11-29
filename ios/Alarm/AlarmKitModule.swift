import Foundation
import React

#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif

// Debug logging - only in DEBUG builds
private func log(_ message: String) {
  #if DEBUG
  print("[AlarmKitModule] \(message)")
  #endif
}

@objc(AlarmKitModule)
class AlarmKitModule: RCTEventEmitter {

  private var hasListeners = false
  private var alarmObservationTask: Task<Void, Never>?
  private var authObservationTask: Task<Void, Never>?

  @objc override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    ["onAlarmStateChanged", "onAuthorizationChanged"]
  }

  override func startObserving() {
    hasListeners = true
    startObservingAlarms()
    startObservingAuthorization()
  }

  override func stopObserving() {
    hasListeners = false
    stopObservingAlarms()
    stopObservingAuthorization()
  }

  // MARK: - Platform Check

  @objc func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      resolve(true)
    } else {
      resolve(false)
    }
    #else
    resolve(false)
    #endif
  }

  // MARK: - Authorization

  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    guard #available(iOS 26.0, *) else {
      reject("UNSUPPORTED", "AlarmKit requires iOS 26+", nil)
      return
    }
    
    Task { @MainActor in
      do {
        let state = try await AlarmManager.shared.requestAuthorization()
        let statusString: String
        switch state {
        case .authorized:
          statusString = "authorized"
        case .denied:
          statusString = "denied"
        case .notDetermined:
          statusString = "notDetermined"
        @unknown default:
          statusString = "unknown"
        }
        resolve(["status": statusString])
      } catch {
        reject("AUTH_ERROR", "Failed to request AlarmKit authorization: \(error.localizedDescription)", error)
      }
    }
    #else
    reject("UNSUPPORTED", "AlarmKit not available on this platform", nil)
    #endif
  }

  @objc func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    guard #available(iOS 26.0, *) else {
      resolve("unsupported")
      return
    }
    
    Task { @MainActor in
      let status: String
      switch AlarmManager.shared.authorizationState {
      case .notDetermined: status = "notDetermined"
      case .authorized: status = "authorized"
      case .denied: status = "denied"
      @unknown default: status = "unknown"
      }
      resolve(status)
    }
    #else
    resolve("unsupported")
    #endif
  }

  // MARK: - Schedule Alarm

  @objc func scheduleAlarm(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    guard #available(iOS 26.0, *) else {
      reject("UNSUPPORTED", "AlarmKit requires iOS 26+", nil)
      return
    }

    guard let title = config["title"] as? String,
          let timestamp = config["timestamp"] as? Double else {
      reject("INVALID_CONFIG", "Missing required fields: title, timestamp", nil)
      return
    }

    let date = Date(timeIntervalSince1970: timestamp / 1000)
    let calendar = Calendar.current
    let hour = calendar.component(.hour, from: date)
    let minute = calendar.component(.minute, from: date)

    log("scheduleAlarm: \(title) at \(date)")

      Task { @MainActor in
        do {
          let manager = AlarmManager.shared

          // Check authorization
          if manager.authorizationState != .authorized {
            let state = try await manager.requestAuthorization()
            guard state == .authorized else {
              reject("UNAUTHORIZED", "AlarmKit authorization denied", nil)
              return
            }
          }

          // Parse weekdays if provided (0=Sunday, 6=Saturday)
          let weekdays: [Locale.Weekday]?
          if let days = config["weekdays"] as? [Int], !days.isEmpty {
            weekdays = days.compactMap { day in
              switch day {
              case 0: return .sunday
              case 1: return .monday
              case 2: return .tuesday
              case 3: return .wednesday
              case 4: return .thursday
              case 5: return .friday
              case 6: return .saturday
              default: return nil
              }
            }
          } else {
            weekdays = nil
          }

          // Style configuration with defaults
          let stopButtonText = config["stopButtonText"] as? String ?? "Dismiss"
          let stopButtonIcon = config["stopButtonIcon"] as? String ?? "checkmark.circle.fill"
          let stopButtonColor = config["stopButtonColor"] as? String
          let snoozeButtonIcon = config["snoozeButtonIcon"] as? String ?? "clock.arrow.circlepath"
          let snoozeButtonColor = config["snoozeButtonColor"] as? String
          let tintColorHex = config["tintColor"] as? String ?? "#4CAF50"

          // Build stop button
          let stopButton = AlarmButton(
            text: LocalizedStringResource(stringLiteral: stopButtonText),
            textColor: stopButtonColor != nil ? self.parseColor(stopButtonColor!) : .white,
            systemImageName: stopButtonIcon
          )

          // Build snooze button if enabled
          var secondaryButton: AlarmButton? = nil
          var snoozeDuration: TimeInterval? = nil
          var preAlertDuration: TimeInterval? = nil

          if let snoozeMinutes = config["snoozeMinutes"] as? Int, snoozeMinutes > 0 {
            let snoozeButtonText = config["snoozeButtonText"] as? String ?? "Snooze \(snoozeMinutes)m"
            secondaryButton = AlarmButton(
              text: LocalizedStringResource(stringLiteral: snoozeButtonText),
              textColor: snoozeButtonColor != nil ? self.parseColor(snoozeButtonColor!) : .white,
              systemImageName: snoozeButtonIcon
            )
            snoozeDuration = TimeInterval(snoozeMinutes * 60)
          }

          if let preAlertSeconds = config["preAlertSeconds"] as? Int, preAlertSeconds > 0 {
            preAlertDuration = TimeInterval(preAlertSeconds)
          }

          // Build alert presentation
          let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: stopButton,
            secondaryButton: secondaryButton,
            secondaryButtonBehavior: .countdown
          )

          let tintColor = self.parseColor(tintColorHex)

          // Build attributes
          let attributes = AlarmAttributes<EmptyMetadata>(
            presentation: AlarmPresentation(alert: alert),
            tintColor: tintColor
          )

          // Build schedule
          let schedule: Alarm.Schedule
          if let days = weekdays, !days.isEmpty {
            // Weekly recurring alarm
            let scheduleTime = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
            let recurrence = Alarm.Schedule.Relative.Recurrence.weekly(days)
            schedule = .relative(Alarm.Schedule.Relative(
              time: scheduleTime,
              repeats: recurrence
            ))
          } else {
            // One-time alarm at exact timestamp
            schedule = .fixed(date)
            log("Fixed schedule for: \(date)")
          }

          // Build duration (supports both pre-alert countdown and post-alert snooze)
          let duration: Alarm.CountdownDuration?
          if preAlertDuration != nil || snoozeDuration != nil {
            duration = Alarm.CountdownDuration(
              preAlert: preAlertDuration,   // Optional: countdown before alarm fires
              postAlert: snoozeDuration      // Optional: snooze duration after alarm fires
            )
          } else {
            duration = nil
          }

          // Build configuration (sound parameter uses .default directly)
          let alarmConfig = AlarmManager.AlarmConfiguration<EmptyMetadata>(
            countdownDuration: duration,
            schedule: schedule,
            attributes: attributes,
            sound: .default
          )

          // Schedule the alarm
          let alarmId = UUID()
          let _ = try await manager.schedule(id: alarmId, configuration: alarmConfig)

          log("Scheduled alarm: \(alarmId.uuidString)")
          
          resolve([
            "alarmId": alarmId.uuidString,
            "success": true
          ])

        } catch {
          let nsError = error as NSError
          log("Failed to schedule: \(error.localizedDescription) (code: \(nsError.code))")

          // Provide specific error messages based on error description
          let errorCode: String
          let errorMessage: String
          
          let errorDesc = error.localizedDescription.lowercased()
          if errorDesc.contains("authorization") || errorDesc.contains("authorized") {
            errorCode = "NOT_AUTHORIZED"
            errorMessage = "AlarmKit authorization not granted. Please enable alarm permissions in Settings."
          } else if errorDesc.contains("past") {
            errorCode = "SCHEDULED_IN_PAST"
            errorMessage = "Cannot schedule alarm in the past. The alarm time has already passed."
          } else if errorDesc.contains("too many") || errorDesc.contains("limit") {
            errorCode = "TOO_MANY_ALARMS"
            errorMessage = "Maximum number of alarms reached. Please cancel some existing alarms."
          } else if errorDesc.contains("configuration") || errorDesc.contains("invalid") {
            errorCode = "INVALID_CONFIGURATION"
            errorMessage = "Invalid alarm configuration. Check schedule time and attributes."
          } else {
            errorCode = "SCHEDULE_ERROR"
            errorMessage = "Failed to schedule alarm: \(error.localizedDescription)"
          }
          
          reject(errorCode, errorMessage, error)
        }
      }
    #else
    reject("UNSUPPORTED", "AlarmKit not available on this platform", nil)
    #endif
  }

  // MARK: - Alarm Management

  @objc func cancelAlarm(
    _ alarmId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      guard let uuid = UUID(uuidString: alarmId) else {
        reject("INVALID_ID", "Invalid alarm ID format", nil)
        return
      }
      Task { @MainActor in
        do {
          // First check if the alarm exists
          let alarms = try AlarmManager.shared.alarms
          let alarmExists = alarms.contains { $0.id == uuid }
          
          guard alarmExists else {
            log("Alarm \(alarmId) not found")
            resolve(["success": true, "alreadyCancelled": true])
            return
          }

          try AlarmManager.shared.cancel(id: uuid)
          log("Cancelled alarm: \(alarmId)")
          resolve(["success": true, "alreadyCancelled": false])
        } catch {
          let nsError = error as NSError
          log("Failed to cancel \(alarmId): \(error.localizedDescription)")

          if nsError.code == 0 {
            resolve(["success": true, "alreadyCancelled": true])
          } else {
            reject("CANCEL_ERROR", "Failed to cancel alarm: \(error.localizedDescription)", error)
          }
        }
      }
    } else {
      reject("UNSUPPORTED", "AlarmKit requires iOS 26+", nil)
    }
    #else
    reject("UNSUPPORTED", "AlarmKit not available on this platform", nil)
    #endif
  }

  @objc func getAllAlarms(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      Task { @MainActor in
        do {
          let alarms = try AlarmManager.shared.alarms
          log("Found \(alarms.count) alarm(s)")
          
          let data = alarms.map { alarm -> [String: Any] in
            var alarmData: [String: Any] = [
              "id": alarm.id.uuidString,
              "state": self.alarmStateToString(alarm.state)
            ]
            
            // Add schedule information
            switch alarm.schedule {
            case .some(.fixed(let date)):
              alarmData["scheduleType"] = "fixed"
              alarmData["scheduledDate"] = ISO8601DateFormatter().string(from: date)
              alarmData["nextFireDate"] = ISO8601DateFormatter().string(from: date)
              
            case .some(.relative(let relativeSchedule)):
              alarmData["scheduleType"] = "relative"
              alarmData["hour"] = relativeSchedule.time.hour
              alarmData["minute"] = relativeSchedule.time.minute
              
              // Add recurrence info
              switch relativeSchedule.repeats {
              case .never:
                alarmData["repeats"] = "once"
              case .weekly(let weekdays):
                // Check if it's all 7 days (daily alarm)
                if weekdays.count == 7 {
                  alarmData["repeats"] = "daily"
                  alarmData["weekdays"] = weekdays.map { self.weekdayToInt($0) }
                } else {
                  alarmData["repeats"] = "weekly"
                  alarmData["weekdays"] = weekdays.map { self.weekdayToInt($0) }
                }
              @unknown default:
                alarmData["repeats"] = "unknown"
              }
              
            case .none:
              // Timer without schedule (countdown only)
              alarmData["scheduleType"] = "timer"
              
            @unknown default:
              alarmData["scheduleType"] = "unknown"
            }

            return alarmData
          }
          resolve(data)
        } catch {
          log("Error fetching alarms: \(error.localizedDescription)")
          reject("FETCH_ERROR", "Failed to fetch alarms: \(error.localizedDescription)", error)
        }
      }
    } else {
      resolve([])
    }
    #else
    resolve([])
    #endif
  }

  // MARK: - Observation
  
  /// Starts observing alarm state changes.
  ///
  /// This method sets up an async observation loop that monitors AlarmKit's `alarmUpdates` sequence.
  /// When alarms are added, removed, or their states change, events are sent to React Native listeners.
  ///
  /// ## What You Can Listen For:
  ///
  /// - **Alarm scheduled**: A new alarm was created
  /// - **Alarm state changed**: Alarm transitioned between states (scheduled → countdown → alerting → paused)
  /// - **Alarm dismissed**: User dismissed the alarm
  /// - **Alarm snoozed**: User snoozed the alarm (it will re-fire after snooze duration)
  /// - **Alarm cancelled**: Alarm was cancelled programmatically
  /// - **Alarm fired and completed**: One-time alarm fired and was removed
  ///
  /// ## React Native Usage:
  ///
  /// ```javascript
  /// import { NativeEventEmitter } from 'react-native';
  /// 
  /// const alarmEmitter = new NativeEventEmitter(AlarmKit);
  ///
  /// // Listen for alarm state changes
  /// const subscription = alarmEmitter.addListener('onAlarmStateChanged', (event) => {
  ///   console.log('Alarms updated:', event.alarms);
  ///   event.alarms.forEach(alarm => {
  ///     console.log(`Alarm ${alarm.id} is ${alarm.state}`);
  ///   });
  /// });
  ///
  /// // Clean up when done
  /// subscription.remove();
  /// ```
  ///
  /// ## Event Structure:
  ///
  /// ```javascript
  /// {
  ///   alarms: [
  ///     {
  ///       id: "uuid-string",
  ///       state: "scheduled" | "countdown" | "alerting" | "paused"
  ///     }
  ///   ]
  /// }
  /// ```
  ///
  /// ## Important Notes:
  ///
  /// - **Automatic lifecycle**: Called automatically when React Native adds a listener
  /// - **Battery efficient**: Only runs when JavaScript has active listeners
  /// - **System-managed UI**: Even with observation, the system still presents alarm UI
  /// - **No app required**: Alarms fire even if your app isn't running; observation only works when app is active
  ///
  /// - See also: `stopObservingAlarms()` for cleanup
  /// - See also: `onAlarmStateChanged` event in `supportedEvents()`
  private func startObservingAlarms() {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      // Cancel existing observation task if any
      alarmObservationTask?.cancel()
      
      alarmObservationTask = Task { @MainActor in
        for await alarms in AlarmManager.shared.alarmUpdates {
          // Only send events if JavaScript has active listeners
          guard hasListeners else { continue }
          
          let alarmData = alarms.map { alarm -> [String: Any] in
            var data: [String: Any] = [
              "id": alarm.id.uuidString,
              "state": self.alarmStateToString(alarm.state)
            ]
            
            // Add schedule information
            if let schedule = alarm.schedule {
              switch schedule {
              case .fixed(let date):
                data["scheduleType"] = "fixed"
                data["nextFireDate"] = ISO8601DateFormatter().string(from: date)
                
              case .relative(let relative):
                data["scheduleType"] = "relative"
                data["hour"] = relative.time.hour
                data["minute"] = relative.time.minute
                
                switch relative.repeats {
                case .never:
                  data["repeats"] = "once"
                case .weekly(let weekdays):
                  data["repeats"] = weekdays.count == 7 ? "daily" : "weekly"
                  data["weekdays"] = weekdays.map { self.weekdayToInt($0) }
                @unknown default:
                  data["repeats"] = "unknown"
                }
                
              @unknown default:
                data["scheduleType"] = "unknown"
              }
            }
            
            return data
          }
          
          sendEvent(withName: "onAlarmStateChanged", body: [
            "alarms": alarmData,
            "count": alarms.count
          ])
        }
      }

      log("Started observing alarm updates")
    }
    #endif
  }

  /// Stops observing alarm state changes.
  ///
  /// Cancels the async observation task to free resources and prevent memory leaks.
  /// Called automatically when React Native removes all listeners.
  ///
  /// - See also: `startObservingAlarms()` for the observation setup
  private func stopObservingAlarms() {
    alarmObservationTask?.cancel()
    alarmObservationTask = nil
    log("Stopped observing alarm updates")
  }
  
  /// Starts observing authorization state changes.
  ///
  /// Monitors when the user grants or denies AlarmKit permissions in Settings.
  ///
  /// ## React Native Usage:
  ///
  /// ```javascript
  /// const subscription = alarmEmitter.addListener('onAuthorizationChanged', (event) => {
  ///   console.log('Auth status:', event.status); // "authorized", "denied", "notDetermined"
  /// });
  /// ```
  private func startObservingAuthorization() {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      authObservationTask?.cancel()
      
      authObservationTask = Task { @MainActor in
        for await authState in AlarmManager.shared.authorizationUpdates {
          guard hasListeners else { continue }
          
          let status: String
          switch authState {
          case .notDetermined: status = "notDetermined"
          case .authorized: status = "authorized"
          case .denied: status = "denied"
          @unknown default: status = "unknown"
          }
          
          sendEvent(withName: "onAuthorizationChanged", body: [
            "status": status
          ])
        }
      }

      log("Started observing authorization changes")
    }
    #endif
  }
  
  private func stopObservingAuthorization() {
    authObservationTask?.cancel()
    authObservationTask = nil
    log("Stopped observing authorization changes")
  }

  // MARK: - Helpers

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  private func alarmStateToString(_ state: Alarm.State) -> String {
    switch state {
    case .scheduled: return "scheduled"
    case .countdown: return "countdown"
    case .alerting: return "alerting"
    case .paused: return "paused"
    @unknown default: return "unknown"
    }
  }
  
  @available(iOS 26.0, *)
  private func weekdayToInt(_ weekday: Locale.Weekday) -> Int {
    switch weekday {
    case .sunday: return 0
    case .monday: return 1
    case .tuesday: return 2
    case .wednesday: return 3
    case .thursday: return 4
    case .friday: return 5
    case .saturday: return 6
    @unknown default: return -1
    }
  }
  #endif

  private func parseColor(_ hex: String) -> Color {
    let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&int)
    let r = Double((int >> 16) & 0xFF) / 255
    let g = Double((int >> 8) & 0xFF) / 255
    let b = Double(int & 0xFF) / 255
    return Color(red: r, green: g, blue: b)
  }
}

// Empty metadata for alarms
#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct EmptyMetadata: AlarmMetadata {}
#endif
