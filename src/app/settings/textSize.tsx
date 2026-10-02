import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen } from "lucide-react-native";

import { TextSizePreview } from "@/components/settings/TextSizePreview";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SkyBackground, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { SteppedSlider } from "@/components/ui/stepped-slider";
import { Text, type TextSize as TextSizeName } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { TextSize, type TextSizeValue } from "@/enums/app";
import { usePreferencesStore } from "@/stores/preferences";

const PRESETS = Object.values(TextSize);

export default function TextSizeScreen() {
  return (
    <SkyBackground>
      <TextSizeContent />
    </SkyBackground>
  );
}

/** The screen over its sky: the preview follows a drag, the store a release. */
const TextSizeContent = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const textSize = usePreferencesStore((state) => state.textSize);
  const setTextSize = usePreferencesStore((state) => state.setTextSize);
  // The preset under a drag; null once the drag lands or comes back.
  const [draft, setDraft] = useState<TextSizeValue | null>(null);

  const presetName = (preset: TextSizeValue) => t(`settings.textSize.options.${preset}`);
  const mark = (size: TextSizeName) => (
    <Text size={size} bold glyph color="$fg">
      {t("settings.textSize.glyph")}
    </Text>
  );

  return (
    // The sky runs under the status bar; the content pads itself clear of it.
    <SkyScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <SkyOccluder>
        <ScreenHeader
          title={t("settings.textSize.title")}
          subtitle={t("settings.textSize.intro")}
          back={{ fallback: BACK_DESTINATION.SETTINGS_PREFERENCES }}
        />
      </SkyOccluder>

      <VStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$8" gap="$5">
        <SkyOccluder>
          <SteppedSlider
            stops={PRESETS}
            value={textSize}
            onDraft={(preset) => setDraft(preset === textSize ? null : preset)}
            onChange={(preset) => {
              setDraft(null);
              setTextSize(preset);
            }}
            formatValue={presetName}
            stopLabel={presetName}
            accessibilityLabel={t("settings.textSize.title")}
            startMark={mark("xs")}
            endMark={mark("xl")}
          />
        </SkyOccluder>

        <TextSizePreview size={draft ?? textSize} />

        {/* The reader sizes its own text; this preset does not reach it. */}
        <SkyOccluder>
          <HStack
            accessible
            alignItems="center"
            gap="$3"
            padding="$3"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$card"
            backgroundColor="$surface2">
            <Icon as={BookOpen} size="md" color="$accent" />
            <Text flex={1} size="sm" fontWeight="600" typography="helper" color="$fg">
              {t("settings.textSize.quranNote")}
            </Text>
          </HStack>
        </SkyOccluder>
      </VStack>
    </SkyScrollView>
  );
};
