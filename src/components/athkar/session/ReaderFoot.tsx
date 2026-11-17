import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Headphones, Maximize2 } from "lucide-react-native";

import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { FocusControl } from "@/components/athkar/session/FocusControl";
import { NextDhikr } from "@/components/athkar/session/NextDhikr";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Material, MATERIAL } from "@/components/ui/material";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

type ReaderFootProps = Pick<AthkarLookProps, "session" | "onOpenFocus" | "onStartAudio"> & {
  nextTestID: string;
};

/** The reader's foot: the next dhikr, then Focus and the audio session. */
export const ReaderFoot = ({ session, onOpenFocus, onStartAudio, nextTestID }: ReaderFootProps) => {
  const { t } = useTranslation();
  return (
    <>
      <NextDhikr
        testID={nextTestID}
        next={session.next}
        color="$mutedSky"
        minHeight="$7"
        justifyContent="center"
        marginTop="$3"
      />
      <HStack alignItems="center" justifyContent="center" gap="$3" marginTop="$2" marginBottom="$3">
        <Pressable
          minHeight="$target"
          flexDirection="row"
          alignItems="center"
          gap="$2"
          paddingHorizontal="$4"
          borderRadius="$pill"
          accessibilityLabel={t("athkar.session.focus.title")}
          accessibilityHint={t("athkar.session.focus.description")}
          onPress={onOpenFocus}>
          <Material
            material={MATERIAL.FLOAT}
            radius="$pill"
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <Icon as={Maximize2} size="sm" color="$fg" />
          <Text size="md" fontWeight="600" color="$fg">
            {t("athkar.session.focus.title")}
          </Text>
        </Pressable>
        <FocusControl
          icon={Headphones}
          accessibilityLabel={t("a11y.athkar.startAudioSession")}
          onPress={onStartAudio}
        />
      </HStack>
    </>
  );
};
