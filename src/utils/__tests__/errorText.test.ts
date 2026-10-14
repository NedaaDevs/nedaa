import { errorText } from "@/utils/errorText";

it("gives an error's message", () => {
  expect(errorText(new Error("open failed"))).toBe("open failed");
});

it("writes a thrown value that is not an error as text", () => {
  expect(errorText("offline")).toBe("offline");
  expect(errorText(42)).toBe("42");
  expect(errorText(undefined)).toBe("undefined");
});
