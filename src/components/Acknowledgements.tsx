import { useState } from "react";
import { ScrollView, LayoutAnimation } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { ExternalLink } from "@/components/ExternalLink";

// Icons
import {
  BookText,
  Database,
  AudioLines,
  ExternalLinkIcon,
  MessageCircleHeart,
  UsersRound,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";

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

// Contributors grouped by contribution type (translation, code, features…),
// not translation-only. Names are proper nouns (not localized); the centered
// layout keeps a mixed-script list clean with no RTL/LTR handling. MOCK DATA —
// replace with the real, consented list; category titles need i18n keys before
// this section is shown.
// Category titles are localized; names are proper nouns and never are. `detail` uses the
// language's endonym so it reads correctly in every locale without a translation matrix.
type Contributor = { name: string; detail?: string };
type ContributorGroup = { titleKey: string; entries: Contributor[] };

const CONTRIBUTORS: ContributorGroup[] = [
  {
    titleKey: "settings.acknowledgements.contributors.translations",
    entries: [{ name: "عبد الرحمن راجا", detail: "اردو" }],
  },
  {
    titleKey: "settings.acknowledgements.contributors.design",
    entries: [{ name: "سعد راجا" }],
  },
  {
    titleKey: "settings.acknowledgements.contributors.support",
    entries: [{ name: "M.N" }],
  },
];

const SHOW_CONTRIBUTORS = true;

// One entrance motion per element, staggered top-to-bottom; skipped entirely
// when the user prefers reduced motion.
const STAGGER_MS = 70;
const ENTER_MS = 350;

const Acknowledgements = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // Contributors can grow long, so collapse by default to keep the closing
  // gratitude + CTA within reach.
  const [contributorsOpen, setContributorsOpen] = useState(true);
  const toggleContributors = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setContributorsOpen((open) => !open);
  };

  const enter = (index: number) =>
    reduceMotion ? undefined : FadeInDown.duration(ENTER_MS).delay(index * STAGGER_MS);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <VStack padding="$4" gap="$3.5">
        {CREDITS.map((credit, index) => (
          <Animated.View key={credit.titleKey} entering={enter(index)}>
            <Box
              padding="$5"
              borderRadius="$4"
              backgroundColor="$backgroundSecondary"
              borderWidth={1}
              borderColor="$borderColor">
              <VStack gap="$3.5">
                <HStack alignItems="center" gap="$3">
                  <Box
                    width={40}
                    height={40}
                    borderRadius="$3"
                    backgroundColor="$backgroundMuted"
                    alignItems="center"
                    justifyContent="center">
                    <Icon color="$accentPrimary" size="md" as={credit.icon} />
                  </Box>
                  <Text size="lg" fontWeight="600" color="$typography" flexShrink={1}>
                    {t(credit.titleKey)}
                  </Text>
                </HStack>

                <Text size="md" color="$typographySecondary" lineHeight={22}>
                  {t(credit.bodyKey)}
                </Text>

                <HStack gap="$2" flexWrap="wrap">
                  {credit.links.map((link) => (
                    <ExternalLink key={link.href} href={link.href} asChild>
                      <Pressable
                        hitSlop={8}
                        accessibilityRole="link"
                        accessibilityLabel={t("a11y.acknowledgements.openLink", {
                          name: link.label,
                        })}>
                        <HStack
                          alignItems="center"
                          gap="$1.5"
                          paddingVertical="$2"
                          paddingHorizontal="$3"
                          borderRadius="$3"
                          borderWidth={1}
                          borderColor="$borderColor"
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
          </Animated.View>
        ))}

        {/* Contributors — grouped by contribution type, centered so a
            mixed-script list needs no RTL/LTR alignment. Hidden for now. */}
        {SHOW_CONTRIBUTORS && (
          <Animated.View entering={enter(CREDITS.length)}>
            <Box
              padding="$5"
              borderRadius="$4"
              backgroundColor="$backgroundSecondary"
              borderWidth={1}
              borderColor="$borderColor">
              <VStack gap="$3.5">
                <Pressable
                  onPress={toggleContributors}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: contributorsOpen }}
                  accessibilityLabel={t("settings.acknowledgements.contributors.title")}>
                  <HStack alignItems="center" justifyContent="center" gap="$2">
                    <Icon color="$accentPrimary" size="sm" as={UsersRound} />
                    <Text size="lg" fontWeight="600" color="$typography">
                      {t("settings.acknowledgements.contributors.title")}
                    </Text>
                    <Icon
                      color="$typographySecondary"
                      size="md"
                      as={contributorsOpen ? ChevronUp : ChevronDown}
                    />
                  </HStack>
                </Pressable>

                {contributorsOpen && (
                  <VStack gap="$4" alignItems="center">
                    {CONTRIBUTORS.map((group) => (
                      <VStack key={group.titleKey} gap="$1" alignItems="center">
                        <Text size="sm" fontWeight="600" color="$typographySecondary">
                          {t(group.titleKey)}
                        </Text>
                        {group.entries.map((entry) => (
                          <Text key={entry.name} size="md" color="$typography" textAlign="center">
                            {entry.detail ? `${entry.name} · ${entry.detail}` : entry.name}
                          </Text>
                        ))}
                      </VStack>
                    ))}
                  </VStack>
                )}
              </VStack>
            </Box>
          </Animated.View>
        )}

        {/* Closing: gratitude to the sources and the user, then an open invite
            to contribute (any kind of help), routing to the Contact screen. */}
        <Animated.View entering={enter(SHOW_CONTRIBUTORS ? CREDITS.length + 1 : CREDITS.length)}>
          <Box
            padding="$5"
            borderRadius="$4"
            backgroundColor="$backgroundSecondary"
            borderWidth={1}
            borderColor="$borderColor">
            <VStack gap="$4">
              <Text size="md" color="$typography" lineHeight={24}>
                {t("settings.acknowledgements.thanks")}
              </Text>
              <Text size="md" color="$typographySecondary" lineHeight={22}>
                {t("settings.acknowledgements.contribute.body")}
              </Text>
              <Pressable
                onPress={() => router.push("/settings/feedback" as never)}
                accessibilityRole="button"
                accessibilityLabel={t("settings.acknowledgements.contribute.cta")}
                accessibilityHint={t("a11y.acknowledgements.contribute")}>
                <HStack
                  alignItems="center"
                  justifyContent="center"
                  gap="$2"
                  paddingVertical="$3.5"
                  paddingHorizontal="$4"
                  borderRadius="$3"
                  borderWidth={1.5}
                  borderColor="$accentPrimary"
                  backgroundColor="$background">
                  <Icon color="$accentPrimary" size="sm" as={MessageCircleHeart} />
                  <Text size="md" fontWeight="600" color="$accentPrimary">
                    {t("settings.acknowledgements.contribute.cta")}
                  </Text>
                </HStack>
              </Pressable>
            </VStack>
          </Box>
        </Animated.View>
      </VStack>
    </ScrollView>
  );
};

export default Acknowledgements;
