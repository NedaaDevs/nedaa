import ExpoModulesCore
import MediaPlayer

public class ExpoMediaControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("ExpoMediaControls")

    Events("onRemoteNext", "onRemotePrevious")

    Function("enable") {
      let center = MPRemoteCommandCenter.shared()

      center.nextTrackCommand.isEnabled = true
      self.nextTarget = center.nextTrackCommand.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          self?.sendEvent("onRemoteNext", [:])
        }
        return .success
      }

      center.previousTrackCommand.isEnabled = true
      self.previousTarget = center.previousTrackCommand.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          self?.sendEvent("onRemotePrevious", [:])
        }
        return .success
      }
    }

    Function("disable") {
      let center = MPRemoteCommandCenter.shared()

      if let target = self.nextTarget {
        center.nextTrackCommand.removeTarget(target)
        self.nextTarget = nil
      }
      center.nextTrackCommand.isEnabled = false

      if let target = self.previousTarget {
        center.previousTrackCommand.removeTarget(target)
        self.previousTarget = nil
      }
      center.previousTrackCommand.isEnabled = false
    }
  }
}
