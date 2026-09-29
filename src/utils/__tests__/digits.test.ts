import { LTR_ISOLATE, isolateLatinNumbers } from "@/utils/digits";

const isolated = (number: string) => `${LTR_ISOLATE.OPEN}${number}${LTR_ISOLATE.CLOSE}`;

describe("isolateLatinNumbers", () => {
  // Unisolated in RTL text, a sign, colon or range dash reorders its parts.
  it.each([
    ["15", isolated("15")],
    ["-5", isolated("-5")],
    ["+2", isolated("+2")],
    ["5–10", isolated("5–10")],
    ["3:32 م", `${isolated("3:32")} م`],
    ["1,000.5", isolated("1,000.5")],
    ["من 5 إلى 10", `من ${isolated("5")} إلى ${isolated("10")}`],
  ])("isolates the number in %s", (text, expected) => {
    expect(isolateLatinNumbers(text)).toBe(expected);
  });

  it.each(["١٥", "٣:٣٢ م", "الفجر", ""])("leaves %p without Latin digits unchanged", (text) => {
    expect(isolateLatinNumbers(text)).toBe(text);
  });
});
