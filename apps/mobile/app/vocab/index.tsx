import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
import { useRemoveVocab } from "@/src/features/vocab/use-vocab-mutations";
import type { VocabItem } from "@/src/features/vocab/api";

export default function VocabDeckScreen() {
  const { data: profile } = useProfile();
  const language = profile?.target_lang ?? "en";
  const { data, isLoading } = useVocabDeck(language);
  const remove = useRemoveVocab(language);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const dueCount = data?.dueCount ?? 0;

  return (
    <Screen variant="gradient">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            ‹ Back
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(modals)/add-vocab")}
          hitSlop={10}
        >
          <EditorialText kind="bodyMd" color={palette.accent}>
            + Add word
          </EditorialText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Your words
        </EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          {items.length} saved · {dueCount} to review
        </EditorialText>

        {isLoading ? (
          <ActivityIndicator
            color={palette.accent}
            style={{ marginTop: spacing.xl }}
          />
        ) : items.length === 0 ? (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={{ marginTop: spacing.xl }}
          >
            No words yet. They&apos;ll appear here as you talk with your coach —
            or add one yourself.
          </EditorialText>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <DeckRow
                key={item.id}
                item={item}
                confirming={confirmId === item.id}
                onLongPress={() => setConfirmId(item.id)}
                onCancel={() => setConfirmId(null)}
                onRemove={() => {
                  setConfirmId(null);
                  remove.mutate(item.id);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.cta, items.length === 0 && styles.ctaDisabled]}
        disabled={items.length === 0}
        onPress={() => router.push("/vocab/review")}
      >
        <EditorialText
          kind="bodyLg"
          color={palette.peach}
          style={styles.ctaText}
        >
          {"▸"} Start review
        </EditorialText>
      </Pressable>
    </Screen>
  );
}

function DeckRow({
  item,
  confirming,
  onLongPress,
  onCancel,
  onRemove,
}: {
  item: VocabItem;
  confirming: boolean;
  onLongPress: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <EditorialText kind="bodyLg" color={palette.ink}>
          {item.term}
        </EditorialText>
        {item.translation ? (
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {item.translation}
          </EditorialText>
        ) : null}
      </View>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              Cancel
            </EditorialText>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8}>
            <EditorialText kind="bodySm" color={palette.coral}>
              Remove
            </EditorialText>
          </Pressable>
        </View>
      ) : (
        <MasteryPips mastery={item.mastery} />
      )}
    </Pressable>
  );
}

function MasteryPips({ mastery }: { mastery: number }) {
  return (
    <View style={styles.pips}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.pip, i < mastery && styles.pipFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  scroll: { padding: spacing.xl, paddingBottom: 140, gap: spacing.sm },
  title: { color: palette.ink },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  confirmRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  pips: { flexDirection: "row", gap: 4 },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.inkSoft,
    opacity: 0.3,
  },
  pipFilled: { backgroundColor: palette.accent, opacity: 1 },
  cta: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    minHeight: 52,
    ...shadow.cta,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontWeight: "600" },
});
