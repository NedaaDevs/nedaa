import { $ } from "bun";

export const ANDROID_ARTIFACT = {
  APK: "apk",
  AAB: "aab",
} as const;
export type AndroidArtifact = (typeof ANDROID_ARTIFACT)[keyof typeof ANDROID_ARTIFACT];

const APK_MANIFEST = "AndroidManifest.xml";
const AAB_MANIFEST = "base/manifest/AndroidManifest.xml";

// An APK keeps its manifest at the zip root; an AAB, in the base module.
export const androidArtifactFromEntries = (entries: readonly string[]): AndroidArtifact => {
  if (entries.includes(AAB_MANIFEST)) return ANDROID_ARTIFACT.AAB;
  if (entries.includes(APK_MANIFEST)) return ANDROID_ARTIFACT.APK;
  throw new Error("The archive is neither an APK nor an AAB");
};

export const androidArtifactOf = async (archive: string): Promise<AndroidArtifact> => {
  const listing = await $`unzip -Z1 ${archive}`.quiet().text();
  return androidArtifactFromEntries(listing.split("\n").filter(Boolean));
};
