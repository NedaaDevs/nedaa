import path from "node:path";
import { parseArgs } from "node:util";

import {
  findMisalignedLibraries,
  judgeAlignment,
  nativeLibraryAbi,
  type MisalignedLibrary,
} from "./elf-alignment.ts";

// Play's 16 KB rule covers 64-bit ABIs only.
const CHECKED_ABIS: ReadonlySet<string> = new Set(["arm64-v8a", "x86_64"]);

const USAGE = "Usage: bun scripts/check-16kb-alignment.ts <apk|aab> [--allow <abi>/<lib>.so]...";

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { allow: { type: "string", multiple: true, default: [] } },
});
const [artifactArgument] = positionals;
if (!artifactArgument || positionals.length > 1) {
  console.error(USAGE);
  process.exit(2);
}

const artifactPath = path.resolve(artifactArgument);
if (!(await Bun.file(artifactPath).exists())) {
  throw new Error(`Artifact not found: ${artifactPath}`);
}

const capture = async (command: string[]): Promise<Uint8Array> => {
  const child = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "inherit" });
  const output = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
  return output;
};

const entries = new TextDecoder()
  .decode(await capture(["unzip", "-Z1", artifactPath]))
  .split("\n")
  .filter((entry) => CHECKED_ABIS.has(nativeLibraryAbi(entry) ?? ""));
if (entries.length === 0) {
  throw new Error(`No 64-bit native libraries in ${artifactPath}`);
}

const libraries = await Promise.all(
  entries.map(async (entry) => ({
    entry,
    bytes: await capture(["unzip", "-p", artifactPath, entry]),
  }))
);
const verdict = judgeAlignment(findMisalignedLibraries(libraries), values.allow);

const describe = ({ entry, alignment }: MisalignedLibrary): string =>
  `${entry}: LOAD aligned to ${alignment} bytes`;

console.log(`Checked ${entries.length} native libraries in ${path.basename(artifactPath)}.`);
for (const library of verdict.allowed) {
  console.log(`::warning::Allowed below 16 KB: ${describe(library)}`);
}
for (const library of verdict.failures) {
  console.log(`::error::Below 16 KB: ${describe(library)}`);
}
for (const name of verdict.staleAllowances) {
  console.log(`::error::--allow ${name} matches no misaligned library; remove it.`);
}

if (verdict.failures.length > 0 || verdict.staleAllowances.length > 0) process.exit(1);
console.log(
  verdict.allowed.length === 0
    ? "Every 64-bit native library supports 16 KB pages."
    : "Every other 64-bit native library supports 16 KB pages."
);
