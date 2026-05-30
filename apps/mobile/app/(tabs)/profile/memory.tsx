import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { LANGUAGES } from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import {
  useCoachMemory,
  type CoachMemoryEntry,
} from "@/src/features/coach-memory/use-coach-memory";
import {
  useDeleteMemory,
  useUpdateMemory,
} from "@/src/features/coach-memory/use-update-memory";
import { useUpdateMemoryConsent } from "@/src/features/coach-memory/use-update-memory-consent";

export default function MemoryEditorScreen() {
  const { data, isLoading } = useCoachMemory();
  return (
    <Screen variant="gradient">
      <Stack.Screen options={{ title: "Coach's Memory" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.intro}
        >
          What your coach remembers about you. Edit freely — your changes apply
          on your next session.
        </EditorialText>
        {isLoading && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}
        {data?.memories.length === 0 && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Your coach hasn&apos;t gathered any memory yet. Have a conversation
            first.
          </EditorialText>
        )}
        {data?.memories.map((entry) => (
          <MemoryCard key={entry.language_code} entry={entry} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function MemoryCard({ entry }: { entry: CoachMemoryEntry }) {
  // Opted-out entries get a dedicated "off" card with a re-enable CTA.
  // Splitting components keeps the rules-of-hooks happy (the editable
  // card uses local state that we don't want to mount for opted-out rows).
  if (entry.opted_out) {
    return <OptedOutCard entry={entry} />;
  }
  return <EditableMemoryCard entry={entry} />;
}

function OptedOutCard({ entry }: { entry: CoachMemoryEntry }) {
  const consent = useUpdateMemoryConsent();
  const lang = LANGUAGES.find((l) => l.code === entry.language_code);

  return (
    <View style={styles.card}>
      <EditorialText kind="bodyMd" style={styles.langTitle}>
        {lang?.englishName ?? entry.language_code}
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Memory is off for this language. Turn it on to start collecting your
        topics.
      </EditorialText>
      <Pressable
        onPress={() =>
          consent.mutate({
            languageCode: entry.language_code,
            optedOut: false,
          })
        }
        style={[styles.btn, styles.btnSave, { marginTop: spacing.md }]}
        disabled={consent.isPending}
      >
        <EditorialText kind="bodyMd" color={palette.peach}>
          {consent.isPending ? "Turning on…" : "Turn on memory"}
        </EditorialText>
      </Pressable>
    </View>
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
    update.mutate({
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
    });
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
          onPress: () => del.mutate(entry.language_code),
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
  container: { padding: spacing.base, gap: spacing.lg },
  intro: { marginBottom: spacing.md },
  card: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  langTitle: { color: palette.ink, marginBottom: spacing.sm, fontWeight: "600" },
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
