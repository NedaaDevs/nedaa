import {
  ASR_OPTIONS,
  MIDNIGHT_OPTIONS,
  matchesQuery,
  methodName,
  methodNameKey,
  methodsMatching,
  optionNameKey,
  recalculates,
  resolvedMethod,
  tuneShift,
} from "@/components/calculation/calculationOptions";
import { PRAYER_ID } from "@/constants/Prayer";
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import type { AladhanSettings } from "@/types/providers/aladhan";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const UMM_AL_QURA = ALADHAN.methods.find(({ nameKey }) => nameKey === "makkah")!;
const MWL = ALADHAN.methods.find(({ nameKey }) => nameKey === "mwl")!;

const NAMES: Record<string, string> = {
  makkah: "جامعة أم القرى، مكة المكرمة",
  mwl: "رابطة العالم الإسلامي",
  isna: "الجمعية الإسلامية لأمريكا الشمالية (⁦ISNA⁩)",
};
const nameOf = ({ nameKey }: { nameKey: string }) => NAMES[nameKey] ?? nameKey;

const settings = (patch: Partial<AladhanSettings> = {}): AladhanSettings => ({
  method: UMM_AL_QURA.id,
  madhab: ASR_SCHOOL.SHAFI,
  midnightMode: MIDNIGHT_MODE.STANDARD,
  ...patch,
});

describe("matchesQuery", () => {
  it("matches every name for an empty or blank query", () => {
    expect(matchesQuery(NAMES.mwl, "")).toBe(true);
    expect(matchesQuery(NAMES.mwl, "   ")).toBe(true);
  });

  it("matches an Arabic name typed without its hamza", () => {
    expect(matchesQuery(NAMES.makkah, "ام القرى")).toBe(true);
  });

  it("matches a Latin name in any letter case", () => {
    expect(matchesQuery(NAMES.isna, "isna")).toBe(true);
  });

  it("ignores harakat and tatweel in the query", () => {
    expect(matchesQuery(NAMES.mwl, "رابِطـة")).toBe(true);
  });

  it("rejects a name that does not hold the query", () => {
    expect(matchesQuery(NAMES.mwl, "مكة")).toBe(false);
  });
});

describe("methodsMatching", () => {
  it("keeps the methods in their listed order", () => {
    const shown = methodsMatching("", nameOf);
    expect(shown.map(({ id }) => id)).toEqual(ALADHAN.methods.map(({ id }) => id));
  });

  it("filters the methods by their shown name", () => {
    expect(methodsMatching("رابطة", nameOf)).toEqual([MWL]);
  });
});

describe("tuneShift", () => {
  it("is the draft's offset less the applied one", () => {
    const draft = { ...ALADHAN.tuning, [PRAYER_ID.FAJR]: 5 };
    const applied = { ...ALADHAN.tuning, [PRAYER_ID.FAJR]: 2 };
    expect(tuneShift(draft, applied, PRAYER_ID.FAJR)).toBe(3);
  });

  it("reads a missing tune as no offset", () => {
    expect(tuneShift(undefined, { ...ALADHAN.tuning, isha: -4 }, PRAYER_ID.ISHA)).toBe(4);
    expect(tuneShift(undefined, undefined, PRAYER_ID.ISHA)).toBe(0);
  });
});

describe("recalculates", () => {
  it("is false when only the tuning differs", () => {
    expect(recalculates(settings({ tune: { ...ALADHAN.tuning, fajr: 3 } }), settings())).toBe(
      false
    );
  });

  it.each([
    ["method", { method: MWL.id }],
    ["Asr school", { madhab: ASR_SCHOOL.HANAFI }],
    ["midnight rule", { midnightMode: MIDNIGHT_MODE.JAFARI }],
  ] as const)("is true when the %s differs", (_name, patch) => {
    expect(recalculates(settings(patch), settings())).toBe(true);
  });

  it("reads an unset method on both sides as the same", () => {
    expect(recalculates(settings({ method: null }), settings({ method: undefined }))).toBe(false);
  });
});

describe("methodNameKey", () => {
  it("names a chosen method by its locale key", () => {
    expect(methodNameKey(UMM_AL_QURA.id)).toBe("providers.aladhan.methods.makkah");
  });

  it("is null when the provider picks the method", () => {
    expect(methodNameKey(undefined)).toBeNull();
    expect(methodNameKey(null)).toBeNull();
  });
});

describe.each([
  ["Asr", ASR_OPTIONS, ALADHAN.schools],
  ["midnight", MIDNIGHT_OPTIONS, ALADHAN.midnightModes],
] as const)("%s options", (_name, options, source) => {
  it("offers every option the provider takes, in its order", () => {
    expect(options.map(({ id }) => id)).toEqual(source.map(({ id }) => id));
  });
});

describe("optionNameKey", () => {
  it("names the chosen option", () => {
    expect(optionNameKey(ASR_OPTIONS, 1)).toBe(ASR_OPTIONS[1].nameKey);
  });

  it("is undefined for an unset or unknown choice", () => {
    expect(optionNameKey(ASR_OPTIONS, undefined)).toBeUndefined();
    expect(optionNameKey(MIDNIGHT_OPTIONS, 9)).toBeUndefined();
  });
});

describe("methodName", () => {
  const t = (key: string) => key;

  it("names a chosen method, and the provider's choice when none is", () => {
    expect(methodName(UMM_AL_QURA.id, t)).toBe("providers.aladhan.methods.makkah");
    expect(methodName(undefined, t)).toBe("settings.summary.methodAuto");
  });
});

describe("resolvedMethod", () => {
  it.each([
    ["a chosen method", MWL.id, MWL.id, UMM_AL_QURA.id, MWL.id],
    [
      "the provider's pick behind an applied choice left to it",
      undefined,
      undefined,
      UMM_AL_QURA.id,
      UMM_AL_QURA.id,
    ],
    ["nothing for a drafted choice left to the provider", undefined, MWL.id, MWL.id, undefined],
    ["nothing while the provider reported none", undefined, undefined, undefined, undefined],
    ["the provider's pick for a null choice", null, null, UMM_AL_QURA.id, UMM_AL_QURA.id],
  ] as const)("gives %s", (_, chosen, applied, reported, expected) => {
    expect(resolvedMethod(chosen, applied, reported)).toBe(expected);
  });
});
