// Pure converter: Waqar144 dataset (juz-keyed, absolute ayah numbers) → de-duplicated
// groups keyed by content (sorted "surah:ayah" members). No RN/sqlite imports.

export type RawEntry = {
  src: { ayah: number | number[] };
  muts: { ayah: number | number[] }[];
  ctx?: number;
};
export type RawData = Record<string, RawEntry[]>;

export type SeedGroup = {
  id: string; // canonical: sorted member verse-keys joined by ',', e.g. "17:41,18:54"
  members: string[]; // "surah:ayah", sorted
  showContext: number; // Waqar144 ctx (0 = none)
};

const asArray = (a: number | number[]): number[] => (Array.isArray(a) ? a : [a]);

const byVerseKey = (a: string, b: string): number => {
  const [as, aa] = a.split(":").map(Number);
  const [bs, ba] = b.split(":").map(Number);
  return as - bs || aa - ba;
};

export const convertWaqar144 = (
  raw: RawData,
  absToKey: (abs: number) => string | undefined
): SeedGroup[] => {
  const byId = new Map<string, SeedGroup>();

  for (const entry of Object.values(raw).flat()) {
    const absMembers = [
      ...asArray(entry.src.ayah),
      ...entry.muts.flatMap((m) => asArray(m.ayah)),
    ];
    const keys = absMembers.map(absToKey);
    if (keys.some((k) => k === undefined)) continue; // skip if any abs is unmapped

    const members = [...new Set(keys as string[])].sort(byVerseKey);
    if (members.length < 2) continue;

    const id = members.join(",");
    if (!byId.has(id)) byId.set(id, { id, members, showContext: entry.ctx ?? 0 });
  }

  return [...byId.values()];
};
