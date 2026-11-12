import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";

import { SKY_PART } from "@/components/ui/sky-background/parts";
import { PlatformType } from "@/enums/app";
import { useStatusBarFade } from "@/hooks/useStatusBarFade";
import { statusBarMaskImage } from "@/utils/sky";

/** A scroll view whose content fades out under the status bar. */
export const StatusBarFadeScrollView = (props: ScrollViewProps) => {
  const fade = useStatusBarFade();
  if (!fade) return <ScrollView {...props} />;
  // On Android a mask keeps a window-sized bitmap for each mounted screen.
  if (Platform.OS === PlatformType.ANDROID) {
    // The edge takes whole dp: rounded down, it stops short of resting content.
    const start = Math.floor(fade.hidden + fade.ramp);
    return <ScrollView {...props} fadingEdgeLength={{ start, end: 0 }} />;
  }
  return (
    <MaskedView
      testID={SKY_PART.STATUS_BAR_MASK}
      style={styles.fill}
      maskElement={
        <View
          testID={SKY_PART.STATUS_BAR_MASK_IMAGE}
          style={[styles.fill, { experimental_backgroundImage: statusBarMaskImage(fade) }]}
        />
      }>
      <ScrollView {...props} />
    </MaskedView>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
