import { useState, useCallback } from "react";
import { Alert, ScrollView, TextInput as RNTextInput } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

import { Plus, Trash2, Check, Minus } from "lucide-react-native";

import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useHaptic } from "@/hooks/useHaptic";

import type { CustomAthkarItemDraft } from "@/types/athkar";

type DraftRow = CustomAthkarItemDraft & { key: string };

const makeDraft = (): DraftRow => ({
  key: String(Date.now() + Math.random()),
  arabicText: "",
  userCount: 1,
});

export default function EditCustomAthkarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);

  const groups = useCustomAthkarStore((s) => s.groups);
  const getGroupItems = useCustomAthkarStore((s) => s.getGroupItems);
  const updateGroup = useCustomAthkarStore((s) => s.updateGroup);
  const deleteGroup = useCustomAthkarStore((s) => s.deleteGroup);
  const hapticSuccess = useHaptic("success");
  const hapticWarning = useHaptic("warning");

  const group = groups.find((g) => g.id === groupId);

  const [title, setTitle] = useState(group?.title ?? "");
  const [drafts, setDrafts] = useState<DraftRow[]>(() =>
    getGroupItems(groupId).map((item) => ({
      key: String(item.id),
      arabicText: item.arabicText,
      userCount: item.userCount,
    }))
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValid = title.trim().length > 0 && drafts.length > 0;

  const handleAddThikir = useCallback(() => {
    const draft = makeDraft();
    setDrafts((prev) => [...prev, draft]);
    setExpandedKey(draft.key);
  }, []);

  const handleConfirmDraft = useCallback((_key: string) => {
    setExpandedKey(null);
  }, []);

  const handleDeleteDraft = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setExpandedKey(null);
  }, []);

  const handleUpdateText = useCallback((key: string, text: string) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, arabicText: text } : d)));
  }, []);

  const handleUpdateCount = useCallback((key: string, delta: number) => {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, userCount: Math.max(1, d.userCount + delta) } : d))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert(t("athkar.customAthkar.validationTitle"));
      return;
    }
    if (drafts.length === 0) {
      Alert.alert(t("athkar.customAthkar.validationThikir"));
      return;
    }
    const hasEmptyText = drafts.some((d) => !d.arabicText.trim());
    if (hasEmptyText) {
      Alert.alert(t("athkar.customAthkar.validationText"));
      return;
    }
    setIsSaving(true);
    const ok = await updateGroup(
      groupId,
      title.trim(),
      drafts.map((d) => ({ arabicText: d.arabicText.trim(), userCount: d.userCount }))
    );
    setIsSaving(false);
    if (ok) {
      hapticSuccess();
      router.back();
    } else {
      hapticWarning();
    }
  }, [title, drafts, groupId, updateGroup, hapticSuccess, hapticWarning, router, t]);

  const handleDelete = useCallback(() => {
    Alert.alert(t("athkar.customAthkar.deleteConfirm"), t("athkar.customAthkar.deleteWarning"), [
      { text: t("athkar.customAthkar.cancel"), style: "cancel" },
      {
        text: t("athkar.customAthkar.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteGroup(groupId);
          router.back();
        },
      },
    ]);
  }, [groupId, deleteGroup, router, t]);

  if (!group) return null;

  return (
    <Box flex={1} backgroundColor="$background">
      {/* Header */}
      <Box
        paddingTop={insets.top + 8}
        paddingBottom="$3"
        paddingHorizontal="$4"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderBottomColor="$outlineSecondary">
        <HStack justifyContent="space-between" alignItems="center">
          <Pressable
            onPress={() => router.back()}
            minWidth={44}
            minHeight={44}
            alignItems="flex-start"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("athkar.customAthkar.cancel")}>
            <Text color="$primary" fontWeight="500">
              {t("athkar.customAthkar.cancel")}
            </Text>
          </Pressable>
          <Text fontWeight="700" size="lg" color="$typography">
            {t("athkar.customAthkar.edit")}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!isValid || isSaving}
            minWidth={44}
            minHeight={44}
            alignItems="flex-end"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("athkar.customAthkar.save")}
            accessibilityState={{ disabled: !isValid || isSaving }}>
            <Text
              color={isValid && !isSaving ? "$primary" : "$typographySecondary"}
              fontWeight="700">
              {t("athkar.customAthkar.save")}
            </Text>
          </Pressable>
        </HStack>
      </Box>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <VStack padding="$4" gap="$4">
          {/* Title Field */}
          <VStack gap="$2">
            <Text size="sm" fontWeight="600" color="$typographySecondary" textTransform="uppercase">
              {t("athkar.customAthkar.titleLabel")}
            </Text>
            <Box
              borderWidth={1}
              borderColor="$outline"
              borderRadius="$4"
              paddingHorizontal="$3"
              paddingVertical="$2"
              backgroundColor="$backgroundSecondary">
              <RNTextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("athkar.customAthkar.titlePlaceholder")}
                style={{ fontSize: 16, minHeight: 44 }}
                accessibilityLabel={t("athkar.customAthkar.titleLabel")}
              />
            </Box>
          </VStack>

          {/* Thikirs Section */}
          <VStack gap="$3">
            <Text size="sm" fontWeight="600" color="$typographySecondary" textTransform="uppercase">
              {t("athkar.customAthkar.thikirs")}
            </Text>

            {drafts.map((draft) => (
              <VStack
                key={draft.key}
                borderWidth={1}
                borderColor={expandedKey === draft.key ? "$primary" : "$outline"}
                borderRadius="$4"
                overflow="hidden"
                backgroundColor="$backgroundSecondary">
                {expandedKey === draft.key ? (
                  <VStack padding="$3" gap="$3">
                    <RNTextInput
                      value={draft.arabicText}
                      onChangeText={(text) => handleUpdateText(draft.key, text)}
                      placeholder={t("athkar.customAthkar.thikirPlaceholder")}
                      multiline
                      style={{
                        fontSize: 18,
                        textAlign: "right",
                        lineHeight: 32,
                        minHeight: 72,
                      }}
                      accessibilityLabel={t("athkar.customAthkar.thikirPlaceholder")}
                    />
                    <Box height={1} backgroundColor="$outlineSecondary" />
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack gap="$3" alignItems="center">
                        <Pressable
                          onPress={() => handleUpdateCount(draft.key, -1)}
                          width={44}
                          height={44}
                          borderRadius={999}
                          borderWidth={1}
                          borderColor="$outline"
                          alignItems="center"
                          justifyContent="center"
                          accessibilityRole="button"
                          accessibilityLabel={t("a11y.customAthkar.decrementCount")}>
                          <Icon as={Minus} size="sm" color="$typography" />
                        </Pressable>
                        <Text fontWeight="700" size="lg" minWidth={32} textAlign="center">
                          {draft.userCount}
                        </Text>
                        <Pressable
                          onPress={() => handleUpdateCount(draft.key, 1)}
                          width={44}
                          height={44}
                          borderRadius={999}
                          borderWidth={1}
                          borderColor="$outline"
                          alignItems="center"
                          justifyContent="center"
                          accessibilityRole="button"
                          accessibilityLabel={t("athkar.customAthkar.count")}>
                          <Icon as={Plus} size="sm" color="$typography" />
                        </Pressable>
                      </HStack>
                      <HStack gap="$2">
                        <Pressable
                          onPress={() => handleDeleteDraft(draft.key)}
                          width={44}
                          height={44}
                          borderRadius={999}
                          alignItems="center"
                          justifyContent="center"
                          accessibilityRole="button"
                          accessibilityLabel={t("a11y.customAthkar.deleteThikir")}>
                          <Icon as={Trash2} size="sm" color="$error" />
                        </Pressable>
                        <Pressable
                          onPress={() => handleConfirmDraft(draft.key)}
                          width={44}
                          height={44}
                          borderRadius={999}
                          backgroundColor="$primary"
                          alignItems="center"
                          justifyContent="center"
                          accessibilityRole="button"
                          accessibilityLabel={t("a11y.customAthkar.confirmThikir")}>
                          <Icon as={Check} size="sm" color="$typographyContrast" />
                        </Pressable>
                      </HStack>
                    </HStack>
                  </VStack>
                ) : (
                  <Pressable
                    onPress={() => setExpandedKey(draft.key)}
                    padding="$3"
                    minHeight={44}
                    accessibilityRole="button"
                    accessibilityLabel={
                      draft.arabicText || t("athkar.customAthkar.thikirPlaceholder")
                    }>
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text
                        flex={1}
                        numberOfLines={2}
                        style={{ textAlign: "right" }}
                        color={draft.arabicText ? "$typography" : "$typographySecondary"}>
                        {draft.arabicText || t("athkar.customAthkar.thikirPlaceholder")}
                      </Text>
                      <Text size="sm" color="$typographySecondary" marginStart="$3">
                        ×{draft.userCount}
                      </Text>
                    </HStack>
                  </Pressable>
                )}
              </VStack>
            ))}

            <Pressable
              onPress={handleAddThikir}
              padding="$3"
              minHeight={44}
              borderRadius="$4"
              borderWidth={1}
              borderColor="$primary"
              alignItems="center"
              justifyContent="center"
              accessibilityRole="button"
              accessibilityLabel={t("athkar.customAthkar.addThikir")}>
              <Text color="$primary" fontWeight="600">
                {t("athkar.customAthkar.addThikir")}
              </Text>
            </Pressable>
          </VStack>

          {/* Delete Group */}
          <Pressable
            onPress={handleDelete}
            padding="$3"
            minHeight={44}
            borderRadius="$4"
            borderWidth={1}
            borderColor="$error"
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.customAthkar.deleteGroup")}>
            <Text color="$error" fontWeight="600">
              {t("athkar.customAthkar.delete")}
            </Text>
          </Pressable>
        </VStack>
      </ScrollView>
    </Box>
  );
}
