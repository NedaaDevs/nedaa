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
import { useAppStore } from "@/stores/app";
import { CREDITS, CONTRIBUTORS } from "@/constants/Acknowledgements";

// Icons
import {
  ExternalLinkIcon,
  MessageCircleHeart,
  UsersRound,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";

const SHOW_CONTRIBUTORS = true;

// One entrance motion per element, staggered top-to-bottom; skipped entirely
// when the user prefers reduced motion.
const STAGGER_MS = 70;
const ENTER_MS = 350;

const Acknowledgements = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // The source credits are Qur'an-specific, so they stay hidden until the reader ships.
  // Contributors and the contact CTA are not, and always show.
  // TODO(quran-gate): drop the guard at 2.10.0
  const quranUnlocked = useAppStore((s) => s.quranUnlocked);
  const creditsCount = quranUnlocked ? CREDITS.length : 0;

  // Expanded by default; collapsible so a longer list can't push the closing CTA out of reach.
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
        {quranUnlocked &&
          CREDITS.map((credit, index) => (
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
            mixed-script list needs no RTL/LTR alignment. */}
        {SHOW_CONTRIBUTORS && (
          <Animated.View entering={enter(creditsCount)}>
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
                        {group.entries.map((entry) => {
                          const detail = entry.detailKey ? t(entry.detailKey) : entry.detail;
                          return (
                            <Text key={entry.name} size="md" color="$typography" textAlign="center">
                              {detail ? `${entry.name} · ${detail}` : entry.name}
                            </Text>
                          );
                        })}
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
        <Animated.View entering={enter(SHOW_CONTRIBUTORS ? creditsCount + 1 : creditsCount)}>
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
