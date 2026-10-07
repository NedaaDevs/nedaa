import path from "node:path";
import { findDexViolations, findRawViolations } from "./hms-artifact-markers.ts";

const [artifactArgument] = Bun.argv.slice(2);
const projectRoot = path.resolve(import.meta.dir, "..");

const run = async (command: string[], cwd = projectRoot): Promise<void> => {
  const process = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, BUILD_VARIANT: "hms" },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
  }
};

const capture = async (command: string[]): Promise<Uint8Array> => {
  const process = Bun.spawn(command, {
    cwd: projectRoot,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = new Uint8Array(await new Response(process.stdout).arrayBuffer());
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
  }
  return output;
};

console.log("Verifying the HMS release dependency graph...");
await run(["./gradlew", ":app:verifyHmsReleaseDependencies"], path.join(projectRoot, "android"));

if (!artifactArgument) {
  console.log("HMS dependency graph passed. Pass an AAB path to verify packaged bytecode too.");
  process.exit(0);
}

const artifactPath = path.resolve(projectRoot, artifactArgument);
if (!(await Bun.file(artifactPath).exists())) {
  throw new Error(`AAB not found: ${artifactPath}`);
}

const archiveEntries = new TextDecoder()
  .decode(await capture(["unzip", "-Z1", artifactPath]))
  .split("\n")
  .filter(Boolean);
const entriesToScan = archiveEntries.filter(
  (entry) =>
    (entry.includes("/dex/") && entry.endsWith(".dex")) ||
    entry.endsWith("/dependencies.pb") ||
    entry.endsWith("/AndroidManifest.xml")
);

if (!entriesToScan.some((entry) => entry.includes("/dex/") && entry.endsWith(".dex"))) {
  throw new Error("The AAB contains no DEX entries to inspect");
}

const violations: string[] = [];

for (const entry of entriesToScan) {
  const content = await capture(["unzip", "-p", artifactPath, entry]);
  const markers = entry.endsWith(".dex") ? findDexViolations(content) : findRawViolations(content);
  violations.push(...markers.map((marker) => `${entry}: ${marker}`));
}

if (violations.length > 0) {
  throw new Error(
    `HMS AAB contains forbidden Google runtime markers:\n - ${violations.join("\n - ")}`
  );
}

console.log(`HMS dependency graph and artifact passed: ${artifactPath}`);
