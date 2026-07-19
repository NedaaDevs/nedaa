import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");
const buildsDir = path.join(projectRoot, "builds");

const [aabArgument] = Bun.argv.slice(2);

const run = async (command: string[]): Promise<void> => {
  const process = Bun.spawn(command, {
    cwd: projectRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command[0]}`);
  }
};

const capture = async (command: string[]): Promise<string> => {
  const process = Bun.spawn(command, { cwd: projectRoot, stdin: "ignore", stdout: "pipe" });
  const output = await new Response(process.stdout).text();
  await process.exited;
  return output;
};

const requireEnv = (name: string): string => {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required. Export it or run: eas credentials -p android`);
  return value;
};

// bundletool accepts pass:/file: prefixes; bare values are treated as literals.
const asPassword = (value: string): string =>
  value.startsWith("pass:") || value.startsWith("file:") ? value : `pass:${value}`;

const resolveAdb = async (): Promise<string> => {
  const fromPath = (await capture(["sh", "-c", "command -v adb || true"])).trim();
  if (fromPath) return fromPath;

  const sdkRoot =
    Bun.env.ANDROID_HOME ?? Bun.env.ANDROID_SDK_ROOT ?? `${Bun.env.HOME}/Library/Android/sdk`;
  const candidate = path.join(sdkRoot, "platform-tools", "adb");
  if (await Bun.file(candidate).exists()) return candidate;

  throw new Error("adb not found. Add platform-tools to PATH or set ANDROID_HOME.");
};

const resolveAab = async (): Promise<string> => {
  if (aabArgument) {
    const explicit = path.resolve(projectRoot, aabArgument);
    if (!(await Bun.file(explicit).exists())) throw new Error(`AAB not found: ${explicit}`);
    return explicit;
  }

  const listing = await capture(["sh", "-c", `ls -t ${buildsDir}/*-hms.aab 2>/dev/null || true`]);
  const newest = listing.split("\n").filter(Boolean)[0];
  if (!newest) throw new Error(`No *-hms.aab in ${buildsDir}. Run: bun run build:android:hms`);
  return newest;
};

const adb = await resolveAdb();
const attached = (await capture([adb, "devices"]))
  .split("\n")
  .slice(1)
  .filter((line) => line.trim().endsWith("device"));

if (attached.length === 0) {
  throw new Error("No device attached. Enable USB debugging and reconnect.");
}

const keystore = path.resolve(projectRoot, requireEnv("NEDAA_KEYSTORE_PATH"));
if (!(await Bun.file(keystore).exists())) throw new Error(`Keystore not found: ${keystore}`);

const storePass = asPassword(requireEnv("NEDAA_KEYSTORE_PASS"));
const keyAlias = requireEnv("NEDAA_KEY_ALIAS");
const keyPass = asPassword(requireEnv("NEDAA_KEY_PASS"));

const aab = await resolveAab();
const apks = path.join(buildsDir, `${path.basename(aab, ".aab")}.apks`);

console.log(`Bundle:  ${path.relative(projectRoot, aab)}`);
console.log(`Devices: ${attached.length}`);

// --connected-device emits only the attached device's splits, matching what AppGallery delivers.
await run([
  "bundletool",
  "build-apks",
  `--bundle=${aab}`,
  `--output=${apks}`,
  "--overwrite",
  "--connected-device",
  `--adb=${adb}`,
  `--ks=${keystore}`,
  `--ks-pass=${storePass}`,
  `--ks-key-alias=${keyAlias}`,
  `--key-pass=${keyPass}`,
]);

await run(["bundletool", "install-apks", `--apks=${apks}`, `--adb=${adb}`]);

// Location Kit authenticates against the fingerprint registered in AppGallery Connect.
const certificate = await capture([
  "keytool",
  "-list",
  "-v",
  "-keystore",
  keystore,
  "-alias",
  keyAlias,
  "-storepass",
  storePass.replace(/^pass:/, ""),
]);
const sha256 = certificate.match(/SHA256:\s*([0-9A-F:]+)/i)?.[1];

console.log(`\nInstalled: ${path.relative(projectRoot, apks)}`);
console.log(`SHA-256:   ${sha256 ?? "unavailable"}`);
console.log("Must match AGC > Project settings > General information > SHA-256 fingerprint.");
