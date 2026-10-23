import { useEffect, useId, useSyncExternalStore } from "react";
import { Play, Square } from "lucide-react-native";

import { HAIRLINE_STROKE, Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import type { PreviewSource } from "@/types/sound";
import { soundPreviewManager } from "@/utils/sound";

export type SoundPreviewProps = {
  /** What a press plays; null leaves the control disabled. */
  source: PreviewSource | null;
  /** The control's name while its sound is stopped. */
  playLabel: string;
  /** The control's name while its sound plays. */
  stopLabel: string;
  /** Draws the name beside the icon. */
  showLabel?: boolean;
};

const subscribe = (listener: () => void) => soundPreviewManager.addListener(listener);
const currentPreview = () => soundPreviewManager.getCurrentSound();

/** Stops the preview only when `owner` started it. */
const stopOwnPreview = (owner: string) => {
  if (currentPreview()?.startsWith(owner)) void soundPreviewManager.stopPreview();
};

/** Plays and stops one sound; stops it on unmount, new source or background. */
export const SoundPreview = ({
  source,
  playLabel,
  stopLabel,
  showLabel = false,
}: SoundPreviewProps) => {
  const owner = useId();
  const playing = useSyncExternalStore(subscribe, currentPreview);
  const { isActive } = useAppVisibility();
  const previewId = `${owner}${source}`;
  const isPlaying = playing === previewId;
  const label = isPlaying ? stopLabel : playLabel;

  // The cleanup runs on unmount and before a new source takes over.
  useEffect(() => () => stopOwnPreview(owner), [owner, source]);

  useEffect(() => {
    if (!isActive) stopOwnPreview(owner);
  }, [isActive, owner]);

  const toggle = () => {
    if (isPlaying) {
      void soundPreviewManager.stopPreview();
    } else if (source !== null) {
      // The manager logs a failed play and resets, so the control falls back to play.
      soundPreviewManager.playSource(previewId, source).catch(() => {});
    }
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={source === null}
      accessibilityLabel={label}
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap="$inline"
      paddingHorizontal={showLabel ? "$3" : undefined}
      borderWidth={1}
      borderColor="$hairline"
      borderRadius="$control">
      <Icon as={isPlaying ? Square : Play} size="md" color="$muted" strokeWidth={HAIRLINE_STROKE} />
      {showLabel ? (
        <Text size="sm" color="$fg">
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};
