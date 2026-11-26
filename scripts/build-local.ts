import { $ } from "bun";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import appJson from "../app.json";
import { PlatformType } from "@/enums/app";
import { androidArtifactOf } from "./android-artifact.ts";

const [platform, profile = "production"] = Bun.argv.slice(2);

const PLATFORMS: readonly string[] = Object.values(PlatformType);

if (!platform || !PLATFORMS.includes(platform)) {
  console.error("Usage: bun scripts/build-local.ts <ios|android> [profile]");
  process.exit(1);
}

const version = appJson.expo.version;

let buildNum = "0";
try {
  const raw = (await $`eas build:version:get -p ${platform} --profile ${profile}`.text()).trim();
  const match = raw.match(/(\d+)\s*$/);
  if (match) buildNum = match[1];
} catch {}

const suffix = profile.includes("hms") ? "-hms" : "";

await $`mkdir -p ./builds`;

const base = `./builds/nedaa-${version}-${buildNum}${suffix}`;

// EAS deletes its working dir after a build, and R8's mapping with it.
const workingDir = path.join(tmpdir(), `nedaa-eas-${randomUUID()}`);
const mappingSource = path.join(
  workingDir,
  "build/android/app/build/outputs/mapping/release/mapping.txt"
);
const mappingOutput = `${base}.mapping.txt`;
// EAS picks the Android format per profile; the file is named once built.
const rawOutput = path.join(tmpdir(), `nedaa-build-${randomUUID()}`);
const easEnv = {
  ...process.env,
  EAS_LOCAL_BUILD_WORKINGDIR: workingDir,
  EAS_LOCAL_BUILD_SKIP_CLEANUP: "1",
};

console.log(`Building ${platform} (${profile})`);
let output = "";
try {
  await $`eas build -p ${platform} --profile ${profile} --local --non-interactive --output ${rawOutput}`.env(
    easEnv
  );
  const ext = platform === PlatformType.IOS ? "ipa" : await androidArtifactOf(rawOutput);
  output = `${base}.${ext}`;
  await $`mv ${rawOutput} ${output}`;
  if (platform === PlatformType.ANDROID) {
    if (!(await Bun.file(mappingSource).exists())) {
      throw new Error(`No R8 mapping at ${mappingSource}; ${output} cannot be deobfuscated`);
    }
    await $`cp ${mappingSource} ${mappingOutput}`;
    console.log(`Mapping: ${mappingOutput}`);
  }
} finally {
  await $`rm -rf ${workingDir} ${rawOutput}`;
}
console.log(`Done: ${output}`);
