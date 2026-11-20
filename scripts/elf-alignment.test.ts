import { describe, expect, test } from "bun:test";
import {
  PAGE_SIZE_16K,
  judgeAlignment,
  findMisalignedLibraries,
  loadSegmentAlignment,
  nativeLibraryAbi,
} from "./elf-alignment.ts";

const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const ELF_CLASS = { ELF32: 1, ELF64: 2 } as const;
const ELF_DATA = { LITTLE: 1, BIG: 2 } as const;

type Segment = { type: number; align: number };
type ElfShape = {
  elfClass?: (typeof ELF_CLASS)[keyof typeof ELF_CLASS];
  data?: (typeof ELF_DATA)[keyof typeof ELF_DATA];
  segments: Segment[];
};

// ELF header plus program headers, the only parts the check reads.
const buildElf = ({ elfClass = ELF_CLASS.ELF64, data = ELF_DATA.LITTLE, segments }: ElfShape) => {
  const is64 = elfClass === ELF_CLASS.ELF64;
  const little = data === ELF_DATA.LITTLE;
  const headerSize = is64 ? 64 : 52;
  const entrySize = is64 ? 56 : 32;
  const bytes = new Uint8Array(headerSize + entrySize * segments.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, elfClass, data, 1]);
  if (is64) {
    view.setBigUint64(0x20, BigInt(headerSize), little);
    view.setUint16(0x36, entrySize, little);
    view.setUint16(0x38, segments.length, little);
  } else {
    view.setUint32(0x1c, headerSize, little);
    view.setUint16(0x2a, entrySize, little);
    view.setUint16(0x2c, segments.length, little);
  }
  segments.forEach(({ type, align }, index) => {
    const entry = headerSize + index * entrySize;
    view.setUint32(entry, type, little);
    if (is64) view.setBigUint64(entry + 0x30, BigInt(align), little);
    else view.setUint32(entry + 0x1c, align, little);
  });
  return bytes;
};

describe("loadSegmentAlignment", () => {
  test("returns the smallest LOAD alignment of a 64-bit library", () => {
    const elf = buildElf({
      segments: [
        { type: PT_LOAD, align: 0x10000 },
        { type: PT_LOAD, align: PAGE_SIZE_16K },
      ],
    });
    expect(loadSegmentAlignment(elf)).toBe(PAGE_SIZE_16K);
  });

  test("ignores segments that are not LOAD", () => {
    const elf = buildElf({
      segments: [
        { type: PT_DYNAMIC, align: 8 },
        { type: PT_LOAD, align: PAGE_SIZE_16K },
      ],
    });
    expect(loadSegmentAlignment(elf)).toBe(PAGE_SIZE_16K);
  });

  test("reads a 4 KB library as 4 KB", () => {
    const elf = buildElf({ segments: [{ type: PT_LOAD, align: 0x1000 }] });
    expect(loadSegmentAlignment(elf)).toBe(0x1000);
  });

  test("reads 32-bit and big-endian headers", () => {
    const segments = [{ type: PT_LOAD, align: PAGE_SIZE_16K }];
    expect(loadSegmentAlignment(buildElf({ elfClass: ELF_CLASS.ELF32, segments }))).toBe(
      PAGE_SIZE_16K
    );
    expect(loadSegmentAlignment(buildElf({ data: ELF_DATA.BIG, segments }))).toBe(PAGE_SIZE_16K);
  });

  test("rejects a file that is not ELF", () => {
    expect(() => loadSegmentAlignment(new TextEncoder().encode("PK\u0003\u0004"))).toThrow(
      /not an ELF file/
    );
  });

  test("rejects a library with no LOAD segment", () => {
    const elf = buildElf({ segments: [{ type: PT_DYNAMIC, align: 8 }] });
    expect(() => loadSegmentAlignment(elf)).toThrow(/no LOAD segment/);
  });

  test("rejects program headers that run past the end of the file", () => {
    const elf = buildElf({ segments: [{ type: PT_LOAD, align: PAGE_SIZE_16K }] });
    expect(() => loadSegmentAlignment(elf.subarray(0, elf.length - 1))).toThrow(/program headers/);
  });
});

describe("nativeLibraryAbi", () => {
  test("reads the ABI from APK and AAB entry paths", () => {
    expect(nativeLibraryAbi("lib/arm64-v8a/libhermes.so")).toBe("arm64-v8a");
    expect(nativeLibraryAbi("base/lib/x86_64/libc++_shared.so")).toBe("x86_64");
  });

  test("skips entries that are not packaged native libraries", () => {
    expect(nativeLibraryAbi("assets/lib/arm64-v8a/libfake.so")).toBeNull();
    expect(nativeLibraryAbi("lib/arm64-v8a/readme.txt")).toBeNull();
    expect(nativeLibraryAbi("classes.dex")).toBeNull();
  });
});

describe("findMisalignedLibraries", () => {
  const aligned = buildElf({ segments: [{ type: PT_LOAD, align: PAGE_SIZE_16K }] });
  const legacy = buildElf({ segments: [{ type: PT_LOAD, align: 0x1000 }] });

  test("lists every library below 16 KB with its alignment", () => {
    const result = findMisalignedLibraries([
      { entry: "lib/arm64-v8a/libgood.so", bytes: aligned },
      { entry: "lib/arm64-v8a/libTransform.so", bytes: legacy },
      { entry: "lib/x86_64/libold.so", bytes: legacy },
    ]);
    expect(result).toEqual([
      { entry: "lib/arm64-v8a/libTransform.so", alignment: 0x1000 },
      { entry: "lib/x86_64/libold.so", alignment: 0x1000 },
    ]);
  });

  test("returns nothing when every library is aligned", () => {
    expect(
      findMisalignedLibraries([{ entry: "lib/arm64-v8a/libgood.so", bytes: aligned }])
    ).toEqual([]);
  });
});

describe("judgeAlignment", () => {
  const transform = { entry: "lib/arm64-v8a/libTransform.so", alignment: 0x1000 };
  const other = { entry: "lib/x86_64/libold.so", alignment: 0x1000 };

  test("fails every misaligned library that is not allowed", () => {
    expect(judgeAlignment([transform, other], [])).toEqual({
      failures: [transform, other],
      allowed: [],
      staleAllowances: [],
    });
  });

  test("moves an allowed library out of the failures by ABI and file name", () => {
    expect(judgeAlignment([transform, other], ["arm64-v8a/libTransform.so"])).toEqual({
      failures: [other],
      allowed: [transform],
      staleAllowances: [],
    });
  });

  test("reports an allowance that matches no misaligned library", () => {
    expect(judgeAlignment([], ["arm64-v8a/libTransform.so"])).toEqual({
      failures: [],
      allowed: [],
      staleAllowances: ["arm64-v8a/libTransform.so"],
    });
  });

  test("keeps an allowance to one ABI from covering another", () => {
    const x86 = { entry: "base/lib/x86_64/libTransform.so", alignment: 0x1000 };
    expect(judgeAlignment([x86], ["arm64-v8a/libTransform.so"])).toEqual({
      failures: [x86],
      allowed: [],
      staleAllowances: ["arm64-v8a/libTransform.so"],
    });
  });
});
