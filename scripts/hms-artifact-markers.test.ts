import { describe, expect, test } from "bun:test";
import { findDexViolations, findRawViolations, readDexStrings } from "./hms-artifact-markers.ts";

const HEADER_SIZE = 0x70;
const CONSCRYPT_PROBE = "com.google.android.gms.org.conscrypt";

// Header plus string_ids and string_data, the only sections the scan reads.
const buildDex = (strings: string[]): Uint8Array => {
  const encoder = new TextEncoder();
  const idsOffset = HEADER_SIZE;
  const data = strings.map((value) => {
    const bytes = encoder.encode(value);
    return Uint8Array.from([value.length, ...bytes, 0]);
  });
  const dataStart = idsOffset + strings.length * 4;
  const total = dataStart + data.reduce((sum, item) => sum + item.length, 0);
  const dex = new Uint8Array(total);
  const view = new DataView(dex.buffer);
  dex.set(encoder.encode("dex\n035\0"));
  view.setUint32(0x38, strings.length, true);
  view.setUint32(0x3c, idsOffset, true);
  let cursor = dataStart;
  data.forEach((item, index) => {
    view.setUint32(idsOffset + index * 4, cursor, true);
    dex.set(item, cursor);
    cursor += item.length;
  });
  return dex;
};

const STRING_IDS_SIZE_OFFSET = 0x38;
const STRING_IDS_OFF_OFFSET = 0x3c;

const setUint32 = (dex: Uint8Array, offset: number, value: number): Uint8Array => {
  new DataView(dex.buffer, dex.byteOffset, dex.byteLength).setUint32(offset, value, true);
  return dex;
};

const firstStringIdOffset = (dex: Uint8Array): number =>
  new DataView(dex.buffer, dex.byteOffset, dex.byteLength).getUint32(STRING_IDS_OFF_OFFSET, true);

describe("HMS artifact markers", () => {
  test("reads the DEX string table", () => {
    expect(readDexStrings(buildDex(["a", "Lfoo/Bar;"]))).toEqual(["a", "Lfoo/Bar;"]);
  });

  test("allows OkHttp's Conscrypt probe string", () => {
    expect(findDexViolations(buildDex([CONSCRYPT_PROBE, `${CONSCRYPT_PROBE}.`]))).toEqual([]);
  });

  test("rejects a GMS class reference", () => {
    const dex = buildDex([
      CONSCRYPT_PROBE,
      "Lcom/google/android/gms/common/GoogleApiAvailability;",
    ]);
    expect(findDexViolations(dex)).toEqual(["com/google/android/gms"]);
  });

  test("rejects a GMS dotted name that only starts with the probe", () => {
    const dex = buildDex([`${CONSCRYPT_PROBE}.OpenSSLProvider`]);
    expect(findDexViolations(dex)).toEqual(["com.google.android.gms"]);
  });

  test("rejects any other GMS string literal", () => {
    const dex = buildDex(["com.google.android.gms.provider.action.PICK_IMAGES"]);
    expect(findDexViolations(dex)).toEqual(["com.google.android.gms"]);
  });

  test("allows nothing outside DEX files", () => {
    const manifest = new TextEncoder().encode(`x${CONSCRYPT_PROBE}x`);
    expect(findRawViolations(manifest)).toEqual(["com.google.android.gms"]);
  });

  describe("rejects a malformed DEX", () => {
    test("with a ULEB128 length cut off by the end of the file", () => {
      const dex = buildDex(["a"]);
      dex[dex.length - 1] = 0x80;
      setUint32(dex, firstStringIdOffset(dex), dex.length - 1);
      expect(() => readDexStrings(dex)).toThrow();
      expect(() => findDexViolations(dex)).toThrow();
    });

    test("with a ULEB128 length longer than five bytes", () => {
      const dex = buildDex(["abcdef"]);
      const dataStart = firstStringIdOffset(dex) + 4;
      dex.fill(0x80, dataStart, dataStart + 6);
      expect(() => readDexStrings(dex)).toThrow();
    });

    test("with a string data offset past the end of the file", () => {
      const dex = setUint32(buildDex(["a"]), HEADER_SIZE, 0xffff);
      expect(() => readDexStrings(dex)).toThrow();
      expect(() => findDexViolations(dex)).toThrow();
    });

    test("with string data missing its NUL terminator", () => {
      const dex = buildDex(["abc"]).subarray(0, -1);
      expect(() => readDexStrings(dex)).toThrow();
      expect(() => findDexViolations(dex)).toThrow();
    });

    test("with a string_ids table running past the end of the file", () => {
      const dex = setUint32(buildDex(["a"]), STRING_IDS_SIZE_OFFSET, 1000);
      expect(() => readDexStrings(dex)).toThrow();
      expect(() => findDexViolations(dex)).toThrow();
    });

    test("with a string_ids table that starts inside the header", () => {
      const dex = setUint32(buildDex(["a"]), STRING_IDS_OFF_OFFSET, 0x40);
      expect(() => readDexStrings(dex)).toThrow();
      expect(() => findDexViolations(dex)).toThrow();
    });

    test("with a file shorter than the DEX header", () => {
      const dex = buildDex([]).subarray(0, HEADER_SIZE - 1);
      expect(() => readDexStrings(dex)).toThrow();
    });

    test("with a header shorter than the string_ids fields", () => {
      expect(() => readDexStrings(new TextEncoder().encode("dex\n035\0"))).toThrow();
    });
  });
});
