import { APPEARANCE_ORDER } from "@/constants/Appearance";
import { AppMode } from "@/enums/app";

describe("APPEARANCE_ORDER", () => {
  // A new mode must be placed by hand, or the Appearance screen leaves it out.
  it("lists every mode once", () => {
    expect([...APPEARANCE_ORDER].sort()).toEqual(Object.values(AppMode).sort());
  });
});
