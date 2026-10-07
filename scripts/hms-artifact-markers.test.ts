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
});
