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
const STRING_IDS_SIZE_OFFSET = 0x38;
const STRING_IDS_OFF_OFFSET = 0x3c;

const readUleb128End = (bytes: Uint8Array, start: number): number => {
  let position = start;
  while (bytes[position] & 0x80) position += 1;
  return position + 1;
};

// Every class, member and literal name in a DEX lives in its string table.
export const readDexStrings = (dex: Uint8Array): string[] => {
  if (new TextDecoder("latin1").decode(dex.subarray(0, DEX_MAGIC.length)) !== DEX_MAGIC) {
    throw new Error("Not a DEX file");
  }
  const view = new DataView(dex.buffer, dex.byteOffset, dex.byteLength);
  const count = view.getUint32(STRING_IDS_SIZE_OFFSET, true);
  const idsOffset = view.getUint32(STRING_IDS_OFF_OFFSET, true);
  const decoder = new TextDecoder();
  return Array.from({ length: count }, (_, index) => {
    const dataStart = readUleb128End(dex, view.getUint32(idsOffset + index * 4, true));
    const dataEnd = dex.indexOf(0, dataStart);
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
