const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject, IOSConfig } = require("@expo/config-plugins");

// Credits shown in the iOS system Settings app (Settings > Nedaa). Mirrors the
// in-app Acknowledgements screen and README. Keys are looked up per-locale in
// <lang>.lproj/Root.strings; the English literals double as the fallback.
const STRINGS = {
  en: {
    ACK_QURANTEXT_TITLE: "Qur'an text & Mushaf",
    ACK_QURANTEXT_BODY:
      "Qur'an text from Tanzil.net. UthmanicHafs font and page layout by the King Fahd Glorious Qur'an Printing Complex.",
    ACK_METADATA_TITLE: "Verse metadata & timing",
    ACK_METADATA_BODY:
      "Verse divisions and recitation timing from the Qur'anic Universal Library by Tarteel.",
    ACK_RECITATION_TITLE: "Recitation",
    ACK_RECITATION_BODY: "Recitation audio from QuranicAudio and quran.com, mirrored via QUL.",
  },
  ar: {
    ACK_QURANTEXT_TITLE: "نص القرآن والمصحف",
    ACK_QURANTEXT_BODY:
      "نص القرآن من Tanzil.net. خط عثمان طه (حفص) وتنسيق الصفحات من مجمع الملك فهد لطباعة المصحف الشريف.",
    ACK_METADATA_TITLE: "بيانات الآيات والتوقيت",
    ACK_METADATA_BODY: "تقسيمات الآيات وتوقيت التلاوة من المكتبة القرآنية الشاملة من ترتيل.",
    ACK_RECITATION_TITLE: "التلاوة",
    ACK_RECITATION_BODY: "الصوت من QuranicAudio وquran.com، عبر قُل.",
  },
  ms: {
    ACK_QURANTEXT_TITLE: "Teks al-Quran & Mushaf",
    ACK_QURANTEXT_BODY:
      "Teks al-Quran dari Tanzil.net. Fon UthmanicHafs dan susun atur halaman oleh Kompleks Percetakan al-Quran Raja Fahd.",
    ACK_METADATA_TITLE: "Metadata ayat & pemasaan",
    ACK_METADATA_BODY:
      "Pembahagian ayat dan pemasaan bacaan daripada Qur'anic Universal Library oleh Tarteel.",
    ACK_RECITATION_TITLE: "Bacaan",
    ACK_RECITATION_BODY: "Audio bacaan dari QuranicAudio dan quran.com, dicermin melalui QUL.",
  },
  ur: {
    ACK_QURANTEXT_TITLE: "قرآن متن اور مصحف",
    ACK_QURANTEXT_BODY:
      "قرآن متن Tanzil.net سے۔ عثمانی حفص فونٹ اور صفحہ ترتیب شاہ فہد قرآن کمپلیکس کی جانب سے۔",
    ACK_METADATA_TITLE: "آیات کا میٹا ڈیٹا اور وقت بندی",
    ACK_METADATA_BODY:
      "آیات کی تقسیم اور تلاوت کی وقت بندی ترتیل کی Qur'anic Universal Library سے۔",
    ACK_RECITATION_TITLE: "تلاوت",
    ACK_RECITATION_BODY: "تلاوت آڈیو QuranicAudio اور quran.com سے، QUL کے ذریعے۔",
  },
};

const BUNDLE_NAME = "Settings.bundle";
const APP_DIR = "nedaa";
// Path relative to the ios/ project root, used for the pbxproj file reference.
const BUNDLE_PROJECT_PATH = `${APP_DIR}/${BUNDLE_NAME}`;

const ROOT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>StringsTable</key>
	<string>Root</string>
	<key>PreferenceSpecifiers</key>
	<array>
		<dict>
			<key>Type</key>
			<string>PSGroupSpecifier</string>
			<key>Title</key>
			<string>ACK_QURANTEXT_TITLE</string>
			<key>FooterText</key>
			<string>ACK_QURANTEXT_BODY</string>
		</dict>
		<dict>
			<key>Type</key>
			<string>PSGroupSpecifier</string>
			<key>Title</key>
			<string>ACK_METADATA_TITLE</string>
			<key>FooterText</key>
			<string>ACK_METADATA_BODY</string>
		</dict>
		<dict>
			<key>Type</key>
			<string>PSGroupSpecifier</string>
			<key>Title</key>
			<string>ACK_RECITATION_TITLE</string>
			<key>FooterText</key>
			<string>ACK_RECITATION_BODY</string>
		</dict>
	</array>
</dict>
</plist>
`;

// A .strings body escapes double-quotes in values; our copy has none.
const stringsFile = (table) =>
  Object.entries(table)
    .map(([k, v]) => `"${k}" = "${v}";`)
    .join("\n") + "\n";

const writeSettingsBundle = (iosRoot) => {
  const bundleDir = path.join(iosRoot, APP_DIR, BUNDLE_NAME);
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.writeFileSync(path.join(bundleDir, "Root.plist"), ROOT_PLIST, "utf8");
  for (const [locale, table] of Object.entries(STRINGS)) {
    const lprojDir = path.join(bundleDir, `${locale}.lproj`);
    fs.mkdirSync(lprojDir, { recursive: true });
    fs.writeFileSync(path.join(lprojDir, "Root.strings"), stringsFile(table), "utf8");
  }
};

module.exports = function withIosAcknowledgements(config) {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      writeSettingsBundle(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    // Idempotent: skip if a Settings.bundle reference already exists.
    const alreadyLinked = Object.values(project.pbxFileReferenceSection()).some(
      (ref) => typeof ref === "object" && ref.path && ref.path.includes(BUNDLE_NAME)
    );
    if (!alreadyLinked) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: BUNDLE_PROJECT_PATH,
        groupName: APP_DIR,
        project,
        isBuildFile: true,
        verbatim: true,
      });
    }
    return config;
  });

  return config;
};
