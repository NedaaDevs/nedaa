import { BRIGHTNESS } from "@/constants/Palette";
import { FOCUS_WASH, focusWashImage } from "@/utils/athkarGround";

describe("focusWashImage", () => {
  it("covers the sky with the ground, thinner at the top, whole at the wash's foot", () => {
    expect(focusWashImage("#D8EBF6", BRIGHTNESS.LIGHT)).toBe(
      `linear-gradient(180deg, #D8EBF680 0px, #D8EBF6FF ${FOCUS_WASH.HEIGHT}px)`
    );
  });

  it("lets more of the night sky through", () => {
    expect(focusWashImage("#000103", BRIGHTNESS.DARK)).toBe(
      `linear-gradient(180deg, #00010366 0px, #000103FF ${FOCUS_WASH.HEIGHT}px)`
    );
  });

  it("drops an alpha the ground colour carries", () => {
    expect(focusWashImage("#D8EBF6CC", BRIGHTNESS.LIGHT)).toContain("#D8EBF680 0px");
  });
});
