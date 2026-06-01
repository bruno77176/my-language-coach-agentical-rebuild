import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { LANGUAGES } from "@language-coach/shared";
import { EditorialText, Screen, TAB_BAR_RESERVE } from "@/src/design";
import {
  useCoachMemory,
  type CoachMemoryEntry,
} from "@/src/features/coach-memory/use-coach-memory";
import {
  useDeleteMemory,
  useUpdateMemory,
} from "@/src/features/coach-memory/use-update-memory";
import { useUpdateMemoryConsent } from "@/src/features/coach-memory/use-update-memory-consent";
import { showToast } from "@/src/lib/toast";

export default function MemoryEditorScreen() {
  const { data, isLoading } = useCoachMemory();
  const consent = useUpdateMemoryConsent();
  const enabled = data?.memory_enabled ?? true;

  return (
    <Screen variant="gradient">
      <Stack.Screen
        options={{
          title: "Coach's Memory",
          headerShown: true,
          headerStyle: { backgroundColor: palette.cream },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerBackTitle: "Profile",
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.intro}
        >
          What your coach remembers about you. Edit freely — your changes apply
          on your next session.
        </EditorialText>

        {/* Master switch: one global opt in/out for every coach. */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleText}>
            <EditorialText kind="bodyMd" style={styles.langTitle}>
              Coach memory
            </EditorialText>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              {enabled
                ? "On — your coach remembers you across every language."
                : "Off — your coach won't remember your past sessions."}
            </EditorialText>
          </View>
          <Switch
            value={enabled}
            onValueChange={(v) => consent.mutate({ enabled: v })}
            disabled={isLoading || consent.isPending}
            trackColor={{ true: palette.ink, false: palette.glass }}
            thumbColor={palette.cream}
          />
        </View>

        {isLoading && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}

        {enabled && data?.memories.length === 0 && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Your coach hasn&apos;t gathered any memory yet. Have a conversation
            first.
          </EditorialText>
        )}

        {enabled &&
          data?.memories.map((entry) => (
            <EditableMemoryCard key={entry.language_code} entry={entry} />
          ))}

        {!enabled && !isLoading && (
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Turn memory on to view and edit what your coach remembers for each
            language.
          </EditorialText>
        )}
      </ScrollView>
    </Screen>
  );
}

function EditableMemoryCard({ entry }: { entry: CoachMemoryEntry }) {
  const update = useUpdateMemory();
  const del = useDeleteMemory();
  const lang = LANGUAGES.find((l) => l.code === entry.language_code);
  const [summary, setSummary] = useState(
    entry.memory.last_session_summary ?? "",
  );
  const [topics, setTopics] = useState(
    entry.memory.recent_topics.map((t) => t.topic).join("\n"),
  );
  const [weakAreas, setWeakAreas] = useState(
    entry.memory.weak_areas.join("\n"),
  );

  useEffect(() => {
    setSummary(entry.memory.last_session_summary ?? "");
    setTopics(entry.memory.recent_topics.map((t) => t.topic).join("\n"));
    setWeakAreas(entry.memory.weak_areas.join("\n"));
  }, [entry]);

  const onSave = () => {
    update.mutate(
      {
        languageCode: entry.language_code,
        memory: {
          ...entry.memory,
          last_session_summary: summary || null,
          recent_topics: topics
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({
              topic: t,
              last_practiced_at: new Date().toISOString(),
            })),
          weak_areas: weakAreas
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          showToast("Memory saved");
          if (router.canGoBack()) router.back();
        },
      },
    );
  };

  const onDelete = () => {
    Alert.alert(
      `Delete ${lang?.englishName ?? entry.language_code} memory?`,
      "Your coach will start over fresh for this language.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            del.mutate(entry.language_code, {
              onSuccess: () => {
                showToast("Memory cleared");
                if (router.canGoBack()) router.back();
              },
            }),
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <EditorialText kind="bodyMd" style={styles.langTitle}>
        {lang?.englishName ?? entry.language_code}
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Recent topics (one per line)
      </EditorialText>
      <TextInput
        multiline
        value={topics}
        onChangeText={setTopics}
        style={styles.input}
      />
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Weak areas (one per line)
      </EditorialText>
      <TextInput
        multiline
        value={weakAreas}
        onChangeText={setWeakAreas}
        style={styles.input}
      />
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Last session summary
      </EditorialText>
      <TextInput
        multiline
        value={summary}
        onChangeText={setSummary}
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable
          onPress={onSave}
          style={[styles.btn, styles.btnSave]}
          disabled={update.isPending}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            {update.isPending ? "Saving…" : "Save"}
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={[styles.btn, styles.btnDelete]}
          disabled={del.isPending}
        >
          <EditorialText kind="bodyMd" color={palette.danger}>
            Delete this language&apos;s memory
          </EditorialText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.base,
    gap: spacing.lg,
    // Clear the floating glass tab bar so the last card's Delete button
    // isn't trapped underneath it (matches progress/profile screens).
    paddingBottom: TAB_BAR_RESERVE + spacing.xl,
  },
  intro: { marginBottom: spacing.md },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  toggleText: { flex: 1, gap: spacing.xs },
  card: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  langTitle: {
    color: palette.ink,
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  input: {
    backgroundColor: palette.cream,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    color: palette.ink,
  },
  row: { gap: spacing.sm, marginTop: spacing.md },
  btn: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  btnSave: { backgroundColor: palette.ink },
  btnDelete: { backgroundColor: palette.glass },
});
