import { $ } from "bun";
import appJson from "../app.json";

const [platform, profile = "production"] = Bun.argv.slice(2);

if (!platform || !["ios", "android"].includes(platform)) {
  console.error("Usage: bun scripts/build-local.ts <ios|android> [profile]");
  process.exit(1);
}

const version = appJson.expo.version;

let buildNum = "0";
try {
  buildNum = (await $`eas build:version:get -p ${platform} --profile ${profile}`.text()).trim();
} catch {}

const suffix = profile.includes("hms") ? "-hms" : "";
const ext = platform === "ios" ? "ipa" : "aab";

await $`mkdir -p ./builds`;

const output = `./builds/nedaa-${version}-${buildNum}${suffix}.${ext}`;

console.log(`Building ${platform} (${profile}) -> ${output}`);
await $`eas build -p ${platform} --profile ${profile} --local --non-interactive --output ${output}`;
console.log(`Done: ${output}`);
