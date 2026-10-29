import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CITY_CHECK_STORAGE_DB_NAME } from "@/constants/DB";
import { REPO_ROOT } from "@/test-helpers/routeTree";

const MAIN = join(REPO_ROOT, "android", "app", "src", "main");
const XML_DIR = join(MAIN, "res", "xml");
const PLUGIN = "./plugins/withBackupRules";

// The plugin is CommonJS, loaded by the path app.json registers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backupRulesXml, dataExtractionRulesXml } = require(join(REPO_ROOT, PLUGIN));

// expo-sqlite opens a database with these sidecar files beside it.
const SIDECARS = ["", "-wal", "-shm", "-journal"];
const EXCLUDED = SIDECARS.map((s) => `SQLite/${CITY_CHECK_STORAGE_DB_NAME}${s}`);

const read = (path: string) => readFileSync(path, "utf8");
const backupRules = () => read(join(XML_DIR, "backup_rules.xml"));
const extractionRules = () => read(join(XML_DIR, "data_extraction_rules.xml"));

const excludes = (xml: string) =>
  [...xml.matchAll(/<exclude domain="file" path="([^"]+)"\s*\/>/g)].map(([, path]) => path);

const section = (xml: string, tag: string) => {
  const found = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return found ? found[1] : "";
};

describe("Android backup rules", () => {
  it("excludes the city-check database and its sidecars from cloud backup and device transfer", () => {
    expect(excludes(section(extractionRules(), "cloud-backup"))).toEqual(EXCLUDED);
    expect(excludes(section(extractionRules(), "device-transfer"))).toEqual(EXCLUDED);
  });

  it("excludes them from the full backup before Android 12", () =>
    expect(excludes(section(backupRules(), "full-backup-content"))).toEqual(EXCLUDED));

  it("points the manifest at both rule files", () => {
    const manifest = read(join(MAIN, "AndroidManifest.xml"));
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
  });

  it.todo("registers ./plugins/withBackupRules in app.json so prebuild keeps the rules");

  it("writes the committed rule files when the plugin runs", () => {
    expect(backupRulesXml()).toBe(backupRules());
    expect(dataExtractionRulesXml()).toBe(extractionRules());
  });

  it("keeps the key-value databases in filesDir/SQLite, where the rules point", () =>
    expect(
      read(
        join(
          REPO_ROOT,
          "node_modules/expo-sqlite/android/src/main/java/expo/modules/sqlite/SQLiteModule.kt"
        )
      )
    ).toContain('filesDir.canonicalPath + File.separator + "SQLite"'));
});
