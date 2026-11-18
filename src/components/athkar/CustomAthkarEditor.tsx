import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react-native";

import { MessageToast } from "@/components/feedback";
import { Background } from "@/components/ui/background";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ListGroup } from "@/components/ui/list-group";
import { Pressable } from "@/components/ui/pressable";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { Stepper } from "@/components/ui/stepper";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Text } from "@/components/ui/text";
import { Face } from "@/components/ui/text/face";
import { TextAction } from "@/components/ui/text-action";
import { VStack } from "@/components/ui/vstack";
import { CUSTOM_DHIKR_REPEATS } from "@/constants/Athkar";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { FONT_LANGUAGE } from "@/constants/Fonts";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { SECTION_KIND } from "@/constants/Section";
import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText } from "@/hooks/useRatioText";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import type { CustomAthkarItemDraft } from "@/types/athkar";

/** Three Arabic line boxes and the field's inset; a longer dhikr grows the field. */
const DHIKR_MIN_HEIGHT = "$24";
/** Two 44pt buttons and a four-digit count; the stepper fills its box. */
const STEPPER_WIDTH = 140;

type Row = CustomAthkarItemDraft & { key: number };

/** A key above every row's, so no two rows share one. */
const nextKey = (rows: readonly Row[]) => Math.max(-1, ...rows.map(({ key }) => key)) + 1;

type Props = {
  title: string;
  name: string;
  athkar: readonly CustomAthkarItemDraft[];
  /** Writes the group; false when the write failed. */
  onSave: (name: string, athkar: CustomAthkarItemDraft[]) => Promise<boolean>;
  /** Deletes the group, for one that exists. */
  onDelete?: () => Promise<void>;
  /** A line under the athkar, such as where the group can be found again. */
  note?: string;
};

const BLANK: CustomAthkarItemDraft = { arabicText: "", userCount: CUSTOM_DHIKR_REPEATS.MIN };

/** A custom group's name and athkar, each with its repeat count. */
export const CustomAthkarEditor = ({
  title,
  name: savedName,
  athkar,
  onSave,
  onDelete,
  note,
}: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const countText = useCountText();
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);

  const [name, setName] = useState(savedName);
  const [rows, setRows] = useState<Row[]>(() =>
    (athkar.length ? athkar : [BLANK]).map((draft, key) => ({ ...draft, key }))
  );
  const [saving, setSaving] = useState(false);

  const edit = (key: number, change: Partial<CustomAthkarItemDraft>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const leave = () =>
    router.canGoBack() ? router.back() : router.navigate(BACK_DESTINATION.ATHKAR.href);

  // A second tap while the write runs would save the group twice.
  const run = useSingleFlight();
  const save = () =>
    run(async () => {
      if (!name.trim()) return Alert.alert(t("athkar.customAthkar.nameRequired"));
      if (rows.some((row) => !row.arabicText.trim())) {
        return Alert.alert(t("athkar.customAthkar.textRequired"));
      }
      setSaving(true);
      const ok = await onSave(
        name.trim(),
        rows.map(({ arabicText, userCount }) => ({ arabicText: arabicText.trim(), userCount }))
      );
      setSaving(false);
      if (!ok) {
        MessageToast.showError(t("athkar.customAthkar.saveFailed"));
        return;
      }
      void success();
      MessageToast.showSuccess(t("athkar.customAthkar.saved"));
      leave();
    });

  const confirmDelete = (remove: () => Promise<void>) =>
    Alert.alert(t("athkar.customAthkar.deleteConfirm"), t("athkar.customAthkar.deleteWarning"), [
      { text: t("athkar.customAthkar.cancel"), style: "cancel" },
      {
        text: t("athkar.customAthkar.delete"),
        style: "destructive",
        onPress: () =>
          run(async () => {
            await remove();
            leave();
          }),
      },
    ]);

  return (
    <Background>
      <ScreenHeader
        title={title}
        subtitle={t("athkar.customAthkar.subtitle")}
        back={{ fallback: BACK_DESTINATION.ATHKAR }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <ScreenContent paddingTop="$2" paddingBottom="$section" gap="$section">
          <VStack gap="$inline">
            <Text size="label" fontWeight="600" color="$muted">
              {t("athkar.customAthkar.nameLabel")}
            </Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t("athkar.customAthkar.titlePlaceholder")}
              accessibilityLabel={t("athkar.customAthkar.nameLabel")}
            />
          </VStack>

          <Section
            title={t("athkar.customAthkar.rowsSection")}
            kind={SECTION_KIND.LABEL}
            accessory={
              <Text size="helper" color="$muted">
                {t("athkar.customAthkar.rowCount", { count: rows.length })}
              </Text>
            }>
            <VStack gap="$stack">
              {rows.map((row, index) => {
                const rowTitle = t("athkar.customAthkar.rowTitle", { number: index + 1 });
                return (
                  <ListGroup key={row.key}>
                    <VStack gap="$stack" padding="$stack">
                      <HStack
                        alignItems="center"
                        justifyContent="space-between"
                        minHeight="$target">
                        <Text size="label" fontWeight="700" color="$accentText">
                          {rowTitle}
                        </Text>
                        {rows.length > 1 ? (
                          <Button
                            variant="link"
                            onPress={() =>
                              setRows((prev) => prev.filter(({ key }) => key !== row.key))
                            }
                            accessibilityLabel={t("a11y.customAthkar.deleteRow", {
                              number: index + 1,
                            })}>
                            <Text size="label" fontWeight="600" color="$error">
                              {t("athkar.customAthkar.delete")}
                            </Text>
                          </Button>
                        ) : null}
                      </HStack>
                      <Face language={FONT_LANGUAGE.ARABIC}>
                        <Input
                          value={row.arabicText}
                          onChangeText={(arabicText) => edit(row.key, { arabicText })}
                          placeholder={t("athkar.customAthkar.thikirPlaceholder")}
                          accessibilityLabel={rowTitle}
                          multiline
                          minHeight={DHIKR_MIN_HEIGHT}
                          textAlign="right"
                          textAlignVertical="top"
                          paddingVertical="$stack"
                        />
                      </Face>
                      <HStack alignItems="center" justifyContent="space-between" gap="$stack">
                        <Text size="label" color="$muted" flexShrink={1}>
                          {t("athkar.myAthkar.repeatCount")}
                        </Text>
                        <Box width={STEPPER_WIDTH}>
                          <Stepper
                            value={row.userCount}
                            onChange={(userCount) => edit(row.key, { userCount })}
                            min={CUSTOM_DHIKR_REPEATS.MIN}
                            accessibilityLabel={t("a11y.join", {
                              first: rowTitle,
                              second: t("athkar.myAthkar.repeatCount"),
                            })}
                            valueText={t("athkar.library.repeats", { count: row.userCount })}>
                            <Text size="lg" fontWeight="600" color="$fg" numeric>
                              {countText(row.userCount)}
                            </Text>
                          </Stepper>
                        </Box>
                      </HStack>
                    </VStack>
                  </ListGroup>
                );
              })}
              <Pressable
                onPress={() => setRows((prev) => [...prev, { ...BLANK, key: nextKey(prev) }])}
                accessibilityRole="button"
                accessibilityLabel={t("athkar.customAthkar.addRow")}
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                gap="$inline"
                minHeight="$target"
                borderRadius="$control"
                borderWidth={1}
                borderStyle="dashed"
                borderColor="$accentEdge">
                <Icon as={Plus} size="sm" color="$accentText" />
                <Text size="label" fontWeight="600" color="$accentText">
                  {t("athkar.customAthkar.addRow")}
                </Text>
              </Pressable>
            </VStack>
          </Section>

          {note ? (
            <Text size="helper" color="$muted" textAlign="center">
              {note}
            </Text>
          ) : null}
          {onDelete ? (
            <HStack justifyContent="center">
              <TextAction
                label={t("athkar.customAthkar.deleteGroup")}
                onPress={() => confirmDelete(onDelete)}
              />
            </HStack>
          ) : null}
        </ScreenContent>
      </ScrollView>
      <StickyActionBar
        state={saving ? STICKY_ACTION_STATE.BUSY : STICKY_ACTION_STATE.READY}
        label={t("athkar.customAthkar.saveGroup")}
        busyStatus={t("athkar.customAthkar.saving")}
        onPress={() => void save()}
      />
    </Background>
  );
};
