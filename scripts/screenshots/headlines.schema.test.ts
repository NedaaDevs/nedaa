import { describe, expect, test } from "bun:test";
import { loadHeadlines, HEADLINE_KEYS } from "./headlines.schema.ts";

describe("headlines schema", () => {
  test("en file validates", () => {
    const en = loadHeadlines("en");
    for (const k of HEADLINE_KEYS) expect(en[k].headline.length).toBeGreaterThan(0);
  });
  test("ar file validates", () => {
    const ar = loadHeadlines("ar");
    for (const k of HEADLINE_KEYS) expect(ar[k].headline.length).toBeGreaterThan(0);
  });
});
