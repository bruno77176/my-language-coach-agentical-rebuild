import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LANGUAGES } from "@language-coach/shared";
import { Bubble, EditorialText, Screen } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import { useConversationTranscript } from "@/src/features/practice/use-conversation-transcript";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function TranscriptScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    conversationId?: string;
    kind?: string;
    secondsSpoken?: string;
  }>();
  // `conversationId` carries the id to open: a checkpoint id when kind is
  // 'checkpoint' (a continuous-thread segment), else a conversation id.
  const openId = one(params.conversationId);
  const kind = one(params.kind) === "checkpoint" ? "checkpoint" : "session";
  const secondsSpoken = one(params.secondsSpoken);
  const { data, isLoading, isError } = useConversationTranscript(openId, kind);
  const [showTr, setShowTr] = useState<Record<string, boolean>>({});

  const langName = data
    ? (LANGUAGES.find((l) => l.code === data.language)?.englishName ??
      data.language)
    : "";
  const dateStr = data
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(data.startedAt))
    : "";

  const onFeedback = () => {
    if (!openId) return;
    router.push({
      pathname: "/(modals)/end-of-session",
      params:
        kind === "checkpoint"
          ? { checkpointId: openId, secondsSpoken: secondsSpoken ?? "0" }
          : { conversationId: openId, secondsSpoken: secondsSpoken ?? "0" },
    });
  };

  return (
    <Screen variant="gradient">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={palette.ink} />
        </Pressable>
        <Pressable onPress={onFeedback} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.accent}>
            Feedback ›
          </EditorialText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic color={palette.ink}>
          Conversation
        </EditorialText>
        {data ? (
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.sub}
          >
            {langName} · {dateStr}
          </EditorialText>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={palette.accent} style={styles.loading} />
        ) : null}
        {isError ? (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.sub}
          >
            Couldn&apos;t load this conversation.
          </EditorialText>
        ) : null}

        {data?.messages.map((m) => {
          const isUser = m.role === "user";
          const canTranslate = !isUser && !!m.translation;
          return (
            <Pressable
              key={m.id}
              onPress={
                canTranslate
                  ? () => setShowTr((s) => ({ ...s, [m.id]: !s[m.id] }))
                  : undefined
              }
              style={[styles.row, isUser && styles.rowUser]}
            >
              <Bubble variant={isUser ? "you" : "coach"}>
                <EditorialText
                  kind="bodyLg"
                  color={isUser ? palette.peach : palette.ink}
                >
                  {m.text}
                </EditorialText>
                {canTranslate && showTr[m.id] ? (
                  <>
                    <View style={styles.divider} />
                    <EditorialText kind="bodySm" italic color={palette.inkSoft}>
                      {m.translation}
                    </EditorialText>
                  </>
                ) : null}
              </Bubble>
            </Pressable>
          );
        })}

        {data && data.messages.length === 0 ? (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.sub}
          >
            No messages saved for this session.
          </EditorialText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.xs,
    paddingBottom: spacing.xl * 2,
  },
  sub: { marginTop: spacing.xs, marginBottom: spacing.md },
  loading: { marginTop: spacing.xl },
  row: { marginVertical: spacing.xs, alignItems: "flex-start" },
  rowUser: { alignItems: "flex-end" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.inkSoft,
    opacity: 0.2,
    marginVertical: spacing.sm,
  },
});
