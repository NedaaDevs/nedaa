export const BANNED_MARKERS = [
  "com.google.android.gms",
  "com.google.android.play",
  "com.google.firebase",
  "com/google/android/gms",
  "com/google/android/play",
  "com/google/firebase",
  "ExpoFirebaseMessagingService",
  "FirebaseInitProvider",
  "FirebaseInstanceIdReceiver",
  "FirebaseMessaging",
  "GoogleApiActivity",
  "com.google.android.c2dm.permission.RECEIVE",
  "play.core.integrity",
  "play.core.review",
] as const;

// OkHttp's probe for the Play Services Conscrypt provider, by name only.
export const ALLOWED_DEX_STRINGS: ReadonlySet<string> = new Set([
  "com.google.android.gms.org.conscrypt",
  "com.google.android.gms.org.conscrypt.",
]);

const DEX_MAGIC = "dex\n";
const DEX_HEADER_SIZE = 0x70;
const STRING_IDS_SIZE_OFFSET = 0x38;
const STRING_IDS_OFF_OFFSET = 0x3c;

const ULEB128_MAX_BYTES = 5;
const STRING_ID_SIZE = 4;

// Any read outside its section throws, so a corrupt DEX fails the scan instead of passing it.
const readUleb128End = (bytes: Uint8Array, start: number): number => {
  for (let index = 0; index < ULEB128_MAX_BYTES; index += 1) {
    const position = start + index;
    if (position >= bytes.length) throw new Error(`DEX ULEB128 runs past the end at ${start}`);
    if ((bytes[position] & 0x80) === 0) return position + 1;
  }
  throw new Error(`DEX ULEB128 longer than ${ULEB128_MAX_BYTES} bytes at ${start}`);
};

// Every class, member and literal name in a DEX lives in its string table.
export const readDexStrings = (dex: Uint8Array): string[] => {
  if (new TextDecoder("latin1").decode(dex.subarray(0, DEX_MAGIC.length)) !== DEX_MAGIC) {
    throw new Error("Not a DEX file");
  }
  if (dex.length < DEX_HEADER_SIZE) throw new Error("DEX header is truncated");
  const view = new DataView(dex.buffer, dex.byteOffset, dex.byteLength);
  const count = view.getUint32(STRING_IDS_SIZE_OFFSET, true);
  const idsOffset = view.getUint32(STRING_IDS_OFF_OFFSET, true);
  if (count > 0 && idsOffset < DEX_HEADER_SIZE) {
    throw new Error("DEX string_ids table starts inside the header");
  }
  if (idsOffset + count * STRING_ID_SIZE > dex.length) {
    throw new Error("DEX string_ids table runs past the end of the file");
  }
  const decoder = new TextDecoder();
  return Array.from({ length: count }, (_, index) => {
    const dataOffset = view.getUint32(idsOffset + index * STRING_ID_SIZE, true);
    if (dataOffset >= dex.length) {
      throw new Error(`DEX string ${index} starts past the end of the file`);
    }
    const dataStart = readUleb128End(dex, dataOffset);
    const dataEnd = dex.indexOf(0, dataStart);
    if (dataEnd === -1) throw new Error(`DEX string ${index} has no NUL terminator`);
    return decoder.decode(dex.subarray(dataStart, dataEnd));
  });
};

const markersIn = (text: string): string[] =>
  BANNED_MARKERS.filter((marker) => text.includes(marker));

export const findDexViolations = (dex: Uint8Array): string[] => [
  ...new Set(
    readDexStrings(dex)
      .filter((value) => !ALLOWED_DEX_STRINGS.has(value))
      .flatMap(markersIn)
  ),
];

export const findRawViolations = (content: Uint8Array): string[] =>
  markersIn(new TextDecoder("latin1").decode(content));
