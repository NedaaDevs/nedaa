import { errorText } from "@/utils/errorText";

it("gives an error's message", () => {
  expect(errorText(new Error("open failed"))).toBe("open failed");
});

it("writes a thrown value that is not an error as text", () => {
  expect(errorText("offline")).toBe("offline");
  expect(errorText(42)).toBe("42");
  expect(errorText(undefined)).toBe("undefined");
});

// The API client rejects with a response object, not an Error.
it("gives the message a thrown object carries", () => {
  expect(errorText({ success: false, message: "Network Error" })).toBe("Network Error");
});

it("writes an object with no text message as text", () => {
  expect(errorText({ message: 404 })).toBe("[object Object]");
  expect(errorText(null)).toBe("null");
});
