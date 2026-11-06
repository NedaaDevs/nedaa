import { AppDirection } from "@/enums/app";
import { drawnSides, onPhone } from "@/test-helpers/nativeSurface";

const FIRST_INK = "#111111";
const SECOND_INK = "#222222";

describe("onPhone", () => {
  it("keeps every edge on an LTR phone", () => {
    const style = { left: 1, marginRight: 2, borderLeftWidth: 3, borderTopRightRadius: 4 };

    expect(onPhone(style, AppDirection.LTR)).toEqual(style);
  });

  it("moves the Yoga edges to their logical twins on an RTL phone", () => {
    expect(
      onPhone(
        {
          left: 1,
          right: 2,
          marginLeft: 3,
          marginRight: 4,
          paddingLeft: 5,
          paddingRight: 6,
          borderLeftWidth: 7,
          borderRightWidth: 8,
        },
        AppDirection.RTL
      )
    ).toEqual({
      start: 1,
      end: 2,
      marginStart: 3,
      marginEnd: 4,
      paddingStart: 5,
      paddingEnd: 6,
      borderStartWidth: 7,
      borderEndWidth: 8,
    });
  });

  it("moves the corner radii and border colours to their logical twins on an RTL phone", () => {
    expect(
      onPhone(
        {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 2,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 4,
          borderLeftColor: FIRST_INK,
          borderRightColor: SECOND_INK,
        },
        AppDirection.RTL
      )
    ).toEqual({
      borderTopStartRadius: 1,
      borderTopEndRadius: 2,
      borderBottomStartRadius: 3,
      borderBottomEndRadius: 4,
      borderStartColor: FIRST_INK,
      borderEndColor: SECOND_INK,
    });
  });

  it("leaves a style with no physical edge as it is", () => {
    const style = { start: 1, borderEndWidth: 2, borderTopStartRadius: 3, width: 4 };

    expect(onPhone(style, AppDirection.RTL)).toEqual(style);
  });
});

describe("drawnSides", () => {
  it("draws start on the left and end on the right in an LTR app", () => {
    expect(drawnSides({ marginStart: 1, borderEndWidth: 2 }, AppDirection.LTR)).toEqual({
      marginLeft: 1,
      borderRightWidth: 2,
    });
  });

  it("draws start on the right and end on the left in an RTL app", () => {
    expect(
      drawnSides({ start: 1, borderTopEndRadius: 2, borderStartColor: FIRST_INK }, AppDirection.RTL)
    ).toEqual({ right: 1, borderTopLeftRadius: 2, borderRightColor: FIRST_INK });
  });

  it("lets a logical value replace the physical side it lands on", () => {
    expect(drawnSides({ paddingLeft: 1, paddingStart: 2 }, AppDirection.LTR)).toEqual({
      paddingLeft: 2,
    });
  });
});
