const fs = require("node:fs");
const path = require("node:path");

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

// Must equal CITY_CHECK_STORAGE_DB_NAME; a test compares the written files.
const CITY_CHECK_DB = "CityCheckStorage";
// expo-sqlite keeps key-value files in filesDir/SQLite, with these sidecars.
const EXCLUDED = ["", "-wal", "-shm", "-journal"].map((s) => `SQLite/${CITY_CHECK_DB}${s}`);

const BACKUP_RULES = "backup_rules";
const DATA_EXTRACTION_RULES = "data_extraction_rules";

const excludeLines = (indent) =>
  EXCLUDED.map((p) => `${indent}<exclude domain="file" path="${p}"/>`).join("\n");

// Only exclude rules, so Android still backs up everything else.
const backupRulesXml = () =>
  `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${excludeLines("  ")}
</full-backup-content>
`;

const dataExtractionRulesXml = () =>
  `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludeLines("    ")}
  </cloud-backup>
  <device-transfer>
${excludeLines("    ")}
  </device-transfer>
</data-extraction-rules>
`;

const withRuleAttributes = (config) =>
  withAndroidManifest(config, (config) => {
    const [application] = config.modResults.manifest.application;
    application.$["android:fullBackupContent"] = `@xml/${BACKUP_RULES}`;
    application.$["android:dataExtractionRules"] = `@xml/${DATA_EXTRACTION_RULES}`;
    return config;
  });

const withRuleFiles = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${BACKUP_RULES}.xml`), backupRulesXml());
      fs.writeFileSync(path.join(dir, `${DATA_EXTRACTION_RULES}.xml`), dataExtractionRulesXml());
      return config;
    },
  ]);

const withBackupRules = (config) => withRuleFiles(withRuleAttributes(config));

module.exports = withBackupRules;
module.exports.backupRulesXml = backupRulesXml;
module.exports.dataExtractionRulesXml = dataExtractionRulesXml;
