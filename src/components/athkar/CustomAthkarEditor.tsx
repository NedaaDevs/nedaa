import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, type TextInputInstance } from "react-native";
import { useNavigation, useRouter } from "expo-router";
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
import { tokenLine } from "@/components/ui/text/sizing";
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
import { useTextScale } from "@/hooks/useTextScale";
import type { CustomAthkarItemDraft } from "@/types/athkar";
import { AppLogger } from "@/utils/appLogger";
import { focusOn } from "@/utils/accessibilityFocus";

/** Test ids for the editor's parts. */
export const CUSTOM_EDITOR_PART = { STEPPER: "custom-athkar-stepper" } as const;

/** Three Arabic line boxes and the field's inset; a longer dhikr grows the field. */
const DHIKR_MIN_HEIGHT = "$24";
/** The stepper's two 44pt buttons and the gaps beside its count. */
const STEPPER_BUTTONS = 96;
/** Room for a four-digit count, in ems of the count's font. */
const COUNT_EMS = 2.75;
const COUNT_SIZE = "lg";

const log = AppLogger.create("athkar");

type Row = CustomAthkarItemDraft & { key: number };

/** A key above every row's, so no two rows share one. */
const nextKey = (rows: readonly Row[]) => Math.max(-1, ...rows.map(({ key }) => key)) + 1;

type Props = {
  title: string;
  name: string;
  athkar: readonly CustomAthkarItemDraft[];
  /** Writes the group; false when the write failed. */
  onSave: (name: string, athkar: CustomAthkarItemDraft[]) => Promise<boolean>;
  /** Deletes the group, for one that exists; false when the delete failed. */
  onDelete?: () => Promise<boolean>;
  /** A line under the athkar, such as where the group can be found again. */
  note?: string;
};

const BLANK: CustomAthkarItemDraft = { arabicText: "", userCount: CUSTOM_DHIKR_REPEATS.MIN };

/** Whether the drafts are the saved rows, in order, unchanged. */
const sameRows = (
  drafts: readonly CustomAthkarItemDraft[],
  saved: readonly CustomAthkarItemDraft[]
) =>
  drafts.length === saved.length &&
  drafts.every(
    (draft, index) =>
      draft.id === saved[index].id &&
      draft.arabicText === saved[index].arabicText &&
      draft.userCount === saved[index].userCount
  );

/** Runs a write; false when it failed or threw. */
const attempt = async (write: () => Promise<boolean>, what: string) => {
  try {
    return await write();
  } catch (error) {
    log.e("Editor", what, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
};

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
  const navigation = useNavigation();
  const countText = useCountText();
  const stepperMinWidth =
    STEPPER_BUTTONS + COUNT_EMS * tokenLine(useTextScale(), COUNT_SIZE).fontSize;
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);

  const [name, setName] = useState(savedName);
  const [rows, setRows] = useState<Row[]>(() =>
    (athkar.length ? athkar : [BLANK]).map((draft, key) => ({ ...draft, key }))
  );
  const [saving, setSaving] = useState(false);
  const fields = useRef(new Map<number, TextInputInstance>());
  /** The row whose field takes reader focus once the rows are drawn. */
  const focusRow = useRef<number | null>(null);

  useEffect(() => {
    if (focusRow.current === null) return;
    focusOn(fields.current.get(focusRow.current));
    focusRow.current = null;
  }, [rows]);

  const edit = (key: number, change: Partial<CustomAthkarItemDraft>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...change } : row)));

  // A deleted row's button goes with it; focus moves to the row before, or after.
  const removeRow = (index: number) => {
    focusRow.current = (rows[index - 1] ?? rows[index + 1]).key;
    setRows((prev) => prev.filter(({ key }) => key !== rows[index].key));
  };

  // A write can finish after the reader has left; only the screen on top goes back.
  const leave = () => {
    if (!navigation.isFocused()) return;
    if (router.canGoBack()) router.back();
    else router.navigate(BACK_DESTINATION.ATHKAR.href);
  };

  // A second tap while the write runs would save the group twice.
  const run = useSingleFlight();
  const save = () =>
    run(async () => {
      const trimmed = name.trim();
      if (!trimmed) return Alert.alert(t("athkar.customAthkar.nameRequired"));
      if (rows.some((row) => !row.arabicText.trim())) {
        return Alert.alert(t("athkar.customAthkar.textRequired"));
      }
      const drafts = rows.map(({ id, arabicText, userCount }) => ({
        id,
        arabicText: arabicText.trim(),
        userCount,
      }));
      const unchanged = trimmed === savedName && sameRows(drafts, athkar);
      setSaving(true);
      const ok =
        unchanged || (await attempt(() => onSave(trimmed, drafts), "the group was not saved"));
      setSaving(false);
      if (!ok) {
        MessageToast.showError(t("athkar.customAthkar.saveFailed"));
        return;
      }
      void success();
      MessageToast.showSuccess(t("athkar.customAthkar.saved"));
      leave();
    });

  const confirmDelete = (remove: () => Promise<boolean>) =>
    Alert.alert(t("athkar.customAthkar.deleteConfirm"), t("athkar.customAthkar.deleteWarning"), [
      { text: t("athkar.customAthkar.cancel"), style: "cancel" },
      {
        text: t("athkar.customAthkar.delete"),
        style: "destructive",
        onPress: () =>
          run(async () => {
            if (await attempt(remove, "the group was not deleted")) return leave();
            MessageToast.showError(t("athkar.customAthkar.deleteFailed"));
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
                            onPress={() => removeRow(index)}
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
                          ref={(field) => {
                            if (field) fields.current.set(row.key, field);
                            else fields.current.delete(row.key);
                          }}
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
                        <Box testID={CUSTOM_EDITOR_PART.STEPPER} minWidth={stepperMinWidth}>
                          <Stepper
                            value={row.userCount}
                            onChange={(userCount) => edit(row.key, { userCount })}
                            min={CUSTOM_DHIKR_REPEATS.MIN}
                            accessibilityLabel={t("a11y.join", {
                              first: rowTitle,
                              second: t("athkar.myAthkar.repeatCount"),
                            })}
                            valueText={t("athkar.library.repeats", { count: row.userCount })}>
                            <Text
                              size={COUNT_SIZE}
                              fontWeight="600"
                              color="$fg"
                              numeric
                              numberOfLines={1}
                              adjustsFontSizeToFit>
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
