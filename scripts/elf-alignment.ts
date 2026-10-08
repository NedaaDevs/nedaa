/** The page size Google Play requires of every 64-bit native library. */
export const PAGE_SIZE_16K = 0x4000;

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46] as const;
const EI_CLASS = 4;
const EI_DATA = 5;
const ELFCLASS64 = 2;
const ELFDATA2LSB = 1;
const PT_LOAD = 1;

// Field offsets differ by class; p_align ends a program header in both.
const LAYOUT = {
  ELF32: { phoff: 0x1c, phentsize: 0x2a, phnum: 0x2c, palign: 0x1c, minEntry: 32 },
  ELF64: { phoff: 0x20, phentsize: 0x36, phnum: 0x38, palign: 0x30, minEntry: 56 },
} as const;

// APK: lib/<abi>/x.so. AAB: <module>/lib/<abi>/x.so; assets/ is not a module.
const NATIVE_LIBRARY_ENTRY = /^(?:(?!assets\/|res\/|root\/)[^/]+\/)?lib\/([^/]+)\/[^/]+\.so$/;

export type NativeLibrary = { entry: string; bytes: Uint8Array };
export type MisalignedLibrary = { entry: string; alignment: number };

/** The ABI of a packaged native library, or null for any other entry. */
export const nativeLibraryAbi = (entry: string): string | null =>
  NATIVE_LIBRARY_ENTRY.exec(entry)?.[1] ?? null;

/** The smallest LOAD p_align: the largest page size the library loads on. */
export const loadSegmentAlignment = (elf: Uint8Array): number => {
  if (elf.length < 0x34 || ELF_MAGIC.some((byte, index) => elf[index] !== byte)) {
    throw new Error("not an ELF file");
  }
  const is64 = elf[EI_CLASS] === ELFCLASS64;
  const little = elf[EI_DATA] === ELFDATA2LSB;
  const layout = is64 ? LAYOUT.ELF64 : LAYOUT.ELF32;
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const readWord = (offset: number): number =>
    is64 ? Number(view.getBigUint64(offset, little)) : view.getUint32(offset, little);

  if (elf.length < layout.phnum + 2) throw new Error("ELF header is truncated");
  const tableOffset = readWord(layout.phoff);
  const entrySize = view.getUint16(layout.phentsize, little);
  const entryCount = view.getUint16(layout.phnum, little);
  if (entrySize < layout.minEntry || tableOffset + entrySize * entryCount > elf.length) {
    throw new Error("program headers lie outside the file");
  }

  const alignments: number[] = [];
  for (let index = 0; index < entryCount; index++) {
    const entry = tableOffset + index * entrySize;
    if (view.getUint32(entry, little) === PT_LOAD) alignments.push(readWord(entry + layout.palign));
  }
  if (alignments.length === 0) throw new Error("no LOAD segment");
  return Math.min(...alignments);
};

/** Every library aligned below 16 KB, in input order. */
export const findMisalignedLibraries = (libraries: NativeLibrary[]): MisalignedLibrary[] =>
  libraries
    .map(({ entry, bytes }) => ({ entry, alignment: loadSegmentAlignment(bytes) }))
    .filter(({ alignment }) => alignment < PAGE_SIZE_16K);

export type AlignmentVerdict = {
  failures: MisalignedLibrary[];
  allowed: MisalignedLibrary[];
  /** Allowances no misaligned library matches; the vendor fixed it. */
  staleAllowances: string[];
};

/** A library's allowlist key: its ABI and file name, as in arm64-v8a/libx.so. */
export const allowanceKey = (entry: string): string => entry.split("/").slice(-2).join("/");

/** Splits misaligned libraries by an allowlist of <abi>/<file> keys. */
export const judgeAlignment = (
  misaligned: MisalignedLibrary[],
  allowances: readonly string[]
): AlignmentVerdict => {
  const allow = new Set(allowances);
  const isAllowed = ({ entry }: MisalignedLibrary) => allow.has(allowanceKey(entry));
  const matched = new Set(misaligned.filter(isAllowed).map(({ entry }) => allowanceKey(entry)));
  return {
    failures: misaligned.filter((library) => !isAllowed(library)),
    allowed: misaligned.filter(isAllowed),
    staleAllowances: allowances.filter((key) => !matched.has(key)),
  };
};
