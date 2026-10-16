import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import { Fab } from "@/components/ui/fab";
import { AppDirection } from "@/enums/app";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";

const FAB_ID = "fab";
const SCREEN_WIDTH = 390;

describe("Fab placement", () => {
  it.each(PHONE_APP_PAIRS)(
    "puts a bottom end Fab at the reading end on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await renderWithTheme(<Fab testID={FAB_ID} placement="bottom end" />, {
        isRTL: app === AppDirection.RTL,
      });

      const [, fab] = await layOutSpans(
        {
          style: { width: SCREEN_WIDTH },
          children: [
            { style: onPhone(StyleSheet.flatten(screen.getByTestId(FAB_ID).props.style), phone) },
          ],
        },
        app
      );

      const leftGap = fab.left;
      const rightGap = SCREEN_WIDTH - fab.left - fab.width;
      const [endGap, startGap] =
        app === AppDirection.RTL ? [leftGap, rightGap] : [rightGap, leftGap];
      expect(endGap).toBe(getTokenValue("$group", "space"));
      expect(endGap).toBeLessThan(startGap);
    }
  );
});
