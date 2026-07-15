import type { LucideIcon } from "lucide-react-native";
import { BookText, Database, AudioLines } from "lucide-react-native";

// A source we credit. `body` describes the contribution; `links` are the
// canonical homepages, opened in an in-app browser. Link labels are proper
// nouns, so they stay untranslated.
export type Credit = {
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  links: { label: string; href: string }[];
};

export const CREDITS: Credit[] = [
  {
    icon: BookText,
    titleKey: "settings.acknowledgements.quranText.title",
    bodyKey: "settings.acknowledgements.quranText.body",
    links: [
      { label: "Tanzil.net", href: "https://tanzil.net" },
      { label: "KFGQPC", href: "https://qurancomplex.gov.sa" },
    ],
  },
  {
    icon: Database,
    titleKey: "settings.acknowledgements.metadata.title",
    bodyKey: "settings.acknowledgements.metadata.body",
    links: [{ label: "QUL / Tarteel", href: "https://qul.tarteel.ai" }],
  },
  {
    icon: AudioLines,
    titleKey: "settings.acknowledgements.recitation.title",
    bodyKey: "settings.acknowledgements.recitation.body",
    links: [
      { label: "QuranicAudio", href: "https://quranicaudio.com" },
      { label: "quran.com", href: "https://quran.com" },
    ],
  },
];

// Contributors grouped by contribution type. Category titles are localized; names are
// proper nouns and never are. A short qualifier can follow the name — `detail` is shown
// verbatim (a language's endonym), `detailKey` is a translation key (a translatable
// word like a surface or platform). Qualifiers name an area, never describe a feature;
// the group title alone says what kind of contribution it was. To credit someone new,
// add an entry to the matching group, or add a group with a `contributors.*` title key
// in every locale file.
export type Contributor = { name: string; detail?: string; detailKey?: string };
export type ContributorGroup = { titleKey: string; entries: Contributor[] };

export const CONTRIBUTORS: ContributorGroup[] = [
  {
    titleKey: "settings.acknowledgements.contributors.translations",
    entries: [{ name: "عبدالرحمن راجا", detail: "اردو" }],
  },
  {
    titleKey: "settings.acknowledgements.contributors.design",
    entries: [{ name: "سعد راجا" }],
  },
  {
    titleKey: "settings.acknowledgements.contributors.ideas",
    entries: [
      { name: "Hazem", detailKey: "settings.acknowledgements.contributors.iosLockScreenWidget" },
    ],
  },
  {
    titleKey: "settings.acknowledgements.contributors.support",
    entries: [{ name: "M.N" }],
  },
];
