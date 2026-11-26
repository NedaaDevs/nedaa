import { MARK_ORDER } from "@/constants/ObservanceMarks";
import { ObservanceClass } from "@/enums/observances";

describe("MARK_ORDER", () => {
  it("holds every observance class once", () => {
    expect([...MARK_ORDER].sort()).toEqual(Object.values(ObservanceClass).sort());
  });
});
