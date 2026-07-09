import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { ExternalLink } from "@/components/ExternalLink";

// Icons
import { BookText, Database, AudioLines, ExternalLinkIcon } from "lucide-react-native";

// A source we credit. `body` describes the contribution; `links` are the
// canonical homepages, opened in an in-app browser. Link labels are proper
// nouns, so they stay untranslated.
type Credit = {
  icon: any;
  titleKey: string;
  bodyKey: string;
  links: { label: string; href: string }[];
};

const CREDITS: Credit[] = [
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

const Acknowledgements = () => {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <VStack padding="$4" gap="$4">
        <Text size="md" color="$typographySecondary" paddingHorizontal="$2">
          {t("settings.acknowledgements.intro")}
        </Text>

        {CREDITS.map((credit) => (
          <Box
            key={credit.titleKey}
            padding="$5"
            borderRadius="$4"
            backgroundColor="$backgroundSecondary">
            <VStack gap="$3">
              <HStack alignItems="center" gap="$3">
                <Icon color="$accentPrimary" size="lg" as={credit.icon} />
                <Text size="lg" fontWeight="600" color="$typography" flexShrink={1}>
                  {t(credit.titleKey)}
                </Text>
              </HStack>

              <Text size="md" color="$typographySecondary">
                {t(credit.bodyKey)}
              </Text>

              <HStack gap="$2" flexWrap="wrap">
                {credit.links.map((link) => (
                  <ExternalLink key={link.href} href={link.href} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={t("a11y.acknowledgements.openLink", {
                        name: link.label,
                      })}>
                      <HStack
                        alignItems="center"
                        gap="$2"
                        paddingVertical="$2"
                        paddingHorizontal="$3"
                        borderRadius="$3"
                        backgroundColor="$background">
                        <Text size="sm" fontWeight="500" color="$accentPrimary">
                          {link.label}
                        </Text>
                        <Icon color="$accentPrimary" size="xs" as={ExternalLinkIcon} />
                      </HStack>
                    </Pressable>
                  </ExternalLink>
                ))}
              </HStack>
            </VStack>
          </Box>
        ))}
      </VStack>
    </ScrollView>
  );
};

export default Acknowledgements;
