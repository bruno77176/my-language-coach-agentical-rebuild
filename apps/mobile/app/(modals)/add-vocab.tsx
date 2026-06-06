import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAddVocab } from "@/src/features/vocab/use-vocab-mutations";

export default function AddVocabScreen() {
  const params = useLocalSearchParams<{
    prefill?: string;
    language?: string;
  }>();
  const { data: profile } = useProfile();
  const language = params.language ?? profile?.target_lang ?? "en";
  const add = useAddVocab(language);

  const [term, setTerm] = useState(params.prefill ?? "");
  const [translation, setTranslation] = useState("");

  async function save() {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      await add.mutateAsync({
        term: trimmed,
        translation: translation.trim() || undefined,
      });
      router.back();
    } catch {
      // Keep the sheet open so the user can retry on failure.
    }
  }

  return (
    <Screen variant="gradient">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Cancel
            </EditorialText>
          </Pressable>
          <Pressable onPress={save} hitSlop={10} disabled={add.isPending}>
            <EditorialText kind="bodyMd" color={palette.accent}>
              {add.isPending ? "Saving…" : "Save"}
            </EditorialText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <EditorialText kind="displayMd" italic color={palette.ink}>
            Save a word
          </EditorialText>

          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.label}
          >
            Word or phrase
          </EditorialText>
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="e.g. faire la grasse matinée"
            placeholderTextColor={palette.inkSoft}
            style={styles.input}
            autoFocus
            multiline
          />

          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.label}
          >
            Translation (optional)
          </EditorialText>
          <TextInput
            value={translation}
            onChangeText={setTranslation}
            placeholder="Leave blank to auto-translate"
            placeholderTextColor={palette.inkSoft}
            style={styles.input}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  body: { padding: spacing.xl, gap: spacing.sm },
  label: { marginTop: spacing.lg },
  input: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: palette.ink,
    fontSize: 17,
    ...shadow.cta,
  },
});
