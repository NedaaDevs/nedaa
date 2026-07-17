// Pure download-planning logic (no RN/native imports, so it's unit-testable).
// Images and meta/bounds are versioned independently; we track both installed
// versions to re-download only the leg that changed and keep bounds geometry
// matched to its render.
// `ornament_<category>` keys track each installed ornament pack's version;
// `markers` is the pre-ornaments legacy key, kept so old installed.json parses.
export type InstalledVersions = {
  images?: string;
  meta?: string;
  markers?: string;
  [key: string]: string | undefined;
};

// Decide which legs to (re)download. Meta is "ok" only when its own version
// matches AND the images it was built against (`requiresImages`) are the ones
// installed — mismatched geometry would misplace markers/highlights.
export const planEditionDownload = (
  installed: InstalledVersions,
  edition: { imagesVersion: string; metaVersion: string; requiresImages: string },
  imagesOnDisk: boolean,
  boundsOnDisk: boolean
): { needImages: boolean; needMeta: boolean } => {
  const imagesOk = imagesOnDisk && installed.images === edition.imagesVersion;
  const metaOk =
    boundsOnDisk &&
    installed.meta === edition.metaVersion &&
    installed.images === edition.requiresImages;
  return { needImages: !imagesOk, needMeta: !metaOk };
};
