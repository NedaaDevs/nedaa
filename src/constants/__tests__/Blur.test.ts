import { BLUR } from "@/constants/Blur";

describe("blur", () => {
  it("steps 24, 28 and 40", () => {
    expect(BLUR).toEqual({ REST: 24, FLOAT: 28, SHEET: 40 });
  });
});
