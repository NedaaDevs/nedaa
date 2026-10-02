import { LANGUAGE_ORDER } from "@/constants/Locales";
import { AppLocale } from "@/enums/app";

describe("LANGUAGE_ORDER", () => {
  // A new locale must be placed by hand, or the Language screen leaves it out.
  it("lists every locale once", () => {
    expect([...LANGUAGE_ORDER].sort()).toEqual(Object.values(AppLocale).sort());
  });
});
