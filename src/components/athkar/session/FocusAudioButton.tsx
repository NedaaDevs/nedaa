import { useTranslation } from "react-i18next";
import { Headphones, Pause, Play } from "lucide-react-native";

import { FocusControl } from "@/components/athkar/session/FocusControl";
import { PLAYER_STATE, type PlayerState } from "@/types/athkar-audio";

type Props = { state: PlayerState; onPress: () => void };

/** The Focus screen's one audio control: start, pause or resume. */
export const FocusAudioButton = ({ state, onPress }: Props) => {
  const { t } = useTranslation();
  if (state === PLAYER_STATE.PLAYING) {
    return (
      <FocusControl
        icon={Pause}
        accessibilityLabel={t("a11y.athkar.audioPause")}
        filled
        onPress={onPress}
      />
    );
  }
  if (state === PLAYER_STATE.LOADING) {
    return (
      <FocusControl
        icon={Headphones}
        accessibilityLabel={t("a11y.athkar.audioPreparing")}
        busy
        onPress={onPress}
      />
    );
  }
  return (
    <FocusControl
      icon={state === PLAYER_STATE.PAUSED ? Play : Headphones}
      accessibilityLabel={t("a11y.athkar.startAudioSession")}
      onPress={onPress}
    />
  );
};
