import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useBrightness, useThemeColor } from "@/components/ui/theme-color";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { focusWashImage } from "@/utils/athkarGround";

/** Test ids for the ground's parts. */
export const CLASSIC_GROUND_PART = { WASH: "classic-ground-wash" } as const;

/** Classic's Focus ground: the plain ground, with the sky as a wash at its top. */
export const ClassicGround = ({ children }: { children: ReactNode }) => {
  const ground = useThemeColor("$bg");
  const brightness = useBrightness();
  return (
    <View style={styles.fill}>
      <View
        testID={CLASSIC_GROUND_PART.WASH}
        pointerEvents="none"
        {...HIDDEN_FROM_READER}
        style={[
          StyleSheet.absoluteFill,
          { experimental_backgroundImage: focusWashImage(ground, brightness) },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
