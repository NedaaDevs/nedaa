const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const EXPO_AUDIO_SERVICE_PATH =
  "node_modules/expo-audio/android/src/main/java/expo/modules/audio/service";

module.exports = function withAthkarMediaControls(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      patchAudioControlsService(projectRoot);
      patchAudioMediaSessionCallback(projectRoot);

      return config;
    },
  ]);
};

function patchAudioControlsService(projectRoot) {
  const filePath = path.join(projectRoot, EXPO_AUDIO_SERVICE_PATH, "AudioControlsService.kt");
  let content = fs.readFileSync(filePath, "utf8");

  // Skip if already patched
  if (content.includes("ACTION_NEXT")) {
    return;
  }

  // Patch 1: Add ACTION_NEXT/PREVIOUS constants and track control fields to companion object
  const companionPatch = `
    const val ACTION_NEXT = "expo.modules.audio.action.NEXT"
    const val ACTION_PREVIOUS = "expo.modules.audio.action.PREVIOUS"

    @JvmField @Volatile
    var trackControlsEnabled: Boolean = false

    @JvmField
    var onNextTrack: (() -> Unit)? = null
    @JvmField
    var onPreviousTrack: (() -> Unit)? = null

    @JvmStatic
    fun refreshTrackControls() {
      val service = instance ?: return
      val player = service.currentPlayer?.ref ?: return
      service.updateSessionCustomLayout(player.isPlaying)
      service.postOrStartForegroundNotification(startInForeground = false)
    }`;

  content = content.replace(
    `const val SEEK_INTERVAL_MS = 10000L`,
    `const val SEEK_INTERVAL_MS = 10000L\n${companionPatch}`
  );

  // Patch 2: Add ACTION_NEXT/PREVIOUS handling in onStartCommand when block
  content = content.replace(
    `ACTION_SEEK_BACKWARD -> withPlayerOnAppThread { player ->
        player.seekTo(player.currentPosition - SEEK_INTERVAL_MS)
      }
    }`,
    `ACTION_SEEK_BACKWARD -> withPlayerOnAppThread { player ->
        player.seekTo(player.currentPosition - SEEK_INTERVAL_MS)
      }

      ACTION_NEXT -> onNextTrack?.invoke()
      ACTION_PREVIOUS -> onPreviousTrack?.invoke()
    }`
  );

  // Patch 3: Add previous/next buttons in updateSessionCustomLayout
  // Insert previous button before play/pause when trackControlsEnabled
  content = content.replace(
    `    // Add play/pause button (always present)
    customLayout.add(
      CommandButton.Builder(if (isPlaying) CommandButton.ICON_PAUSE else CommandButton.ICON_PLAY)
        .setDisplayName(if (isPlaying) "Pause" else "Play")
        .setEnabled(true)
        .setPlayerCommand(Player.COMMAND_PLAY_PAUSE)
        .build()
    )`,
    `    // Add previous track button if track controls enabled
    if (trackControlsEnabled) {
      customLayout.add(
        CommandButton.Builder(CommandButton.ICON_PREVIOUS)
          .setDisplayName("Previous")
          .setEnabled(true)
          .setSessionCommand(SessionCommand(ACTION_PREVIOUS, Bundle.EMPTY))
          .build()
      )
    }

    // Add play/pause button (always present)
    customLayout.add(
      CommandButton.Builder(if (isPlaying) CommandButton.ICON_PAUSE else CommandButton.ICON_PLAY)
        .setDisplayName(if (isPlaying) "Pause" else "Play")
        .setEnabled(true)
        .setPlayerCommand(Player.COMMAND_PLAY_PAUSE)
        .build()
    )`
  );

  // Insert next button after seek forward block
  content = content.replace(
    `    // Add seek forward button if enabled
    if (currentOptions?.showSeekForward == true) {
      customLayout.add(
        CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD)
          .setDisplayName("Seek Forward")
          .setEnabled(true)
          .setSessionCommand(SessionCommand(ACTION_SEEK_FORWARD, Bundle.EMPTY))
          .build()
      )
    }

    session.setCustomLayout(customLayout)`,
    `    // Add seek forward button if enabled
    if (currentOptions?.showSeekForward == true) {
      customLayout.add(
        CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD)
          .setDisplayName("Seek Forward")
          .setEnabled(true)
          .setSessionCommand(SessionCommand(ACTION_SEEK_FORWARD, Bundle.EMPTY))
          .build()
      )
    }

    // Add next track button if track controls enabled
    if (trackControlsEnabled) {
      customLayout.add(
        CommandButton.Builder(CommandButton.ICON_NEXT)
          .setDisplayName("Next")
          .setEnabled(true)
          .setSessionCommand(SessionCommand(ACTION_NEXT, Bundle.EMPTY))
          .build()
      )
    }

    session.setCustomLayout(customLayout)`
  );

  fs.writeFileSync(filePath, content, "utf8");
}

function patchAudioMediaSessionCallback(projectRoot) {
  const filePath = path.join(projectRoot, EXPO_AUDIO_SERVICE_PATH, "AudioMediaSessionCallback.kt");
  let content = fs.readFileSync(filePath, "utf8");

  // Skip if already patched
  if (content.includes("ACTION_NEXT")) {
    return;
  }

  // Patch 1: Add ACTION_NEXT/PREVIOUS to available session commands in onConnect
  content = content.replace(
    `.add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))
            .build()`,
    `.add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))
            .add(SessionCommand(AudioControlsService.ACTION_NEXT, Bundle.EMPTY))
            .add(SessionCommand(AudioControlsService.ACTION_PREVIOUS, Bundle.EMPTY))
            .build()`
  );

  // Patch 2: Add ACTION_NEXT/PREVIOUS handling in onCustomCommand
  content = content.replace(
    `      AudioControlsService.ACTION_SEEK_BACKWARD -> {
        session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)
      }
    }`,
    `      AudioControlsService.ACTION_SEEK_BACKWARD -> {
        session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)
      }
      AudioControlsService.ACTION_NEXT -> {
        AudioControlsService.onNextTrack?.invoke()
      }
      AudioControlsService.ACTION_PREVIOUS -> {
        AudioControlsService.onPreviousTrack?.invoke()
      }
    }`
  );

  fs.writeFileSync(filePath, content, "utf8");
}
