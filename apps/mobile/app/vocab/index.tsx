import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
import {
  useRemoveVocab,
  useToggleStar,
} from "@/src/features/vocab/use-vocab-mutations";
import type { VocabItem } from "@/src/features/vocab/api";

export default function VocabDeckScreen() {
  const { data: profile } = useProfile();
  const language = profile?.target_lang ?? "en";
  const [starredOnly, setStarredOnly] = useState(false);
  const { data, isLoading } = useVocabDeck(language, starredOnly);
  const remove = useRemoveVocab(language);
  const toggleStar = useToggleStar(language);

  const items = data?.items ?? [];
  const dueCount = data?.dueCount ?? 0;
  const starredCount = data?.starredCount ?? 0;

  function confirmRemove(item: VocabItem) {
    Alert.alert("Remove word", `Remove "${item.term}" from your deck?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => remove.mutate(item.id),
      },
    ]);
  }

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
          {items.length} {starredOnly ? "starred" : "saved"} · {dueCount} to
          review
        </EditorialText>

        <View style={styles.filterRow}>
          <FilterChip
            label="All"
            active={!starredOnly}
            onPress={() => setStarredOnly(false)}
          />
          <FilterChip
            label={`★ Important${starredCount ? ` (${starredCount})` : ""}`}
            active={starredOnly}
            onPress={() => setStarredOnly(true)}
          />
        </View>

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
            {starredOnly
              ? "No starred words yet. Tap the star on a word to mark it important."
              : "No words yet. They'll appear here as you talk with your coach — or add one yourself."}
          </EditorialText>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <DeckRow
                key={item.id}
                item={item}
                onToggleStar={() =>
                  toggleStar.mutate({ id: item.id, starred: !item.starred })
                }
                onRemove={() => confirmRemove(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.cta, items.length === 0 && styles.ctaDisabled]}
        disabled={items.length === 0}
        onPress={() =>
          router.push(starredOnly ? "/vocab/review?starred=1" : "/vocab/review")
        }
      >
        <EditorialText
          kind="bodyLg"
          color={palette.peach}
          style={styles.ctaText}
        >
          {"▸"} Start review{starredOnly ? " ★" : ""}
        </EditorialText>
      </Pressable>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <EditorialText
        kind="bodySm"
        color={active ? palette.peach : palette.inkSoft}
      >
        {label}
      </EditorialText>
    </Pressable>
  );
}

function DeckRow({
  item,
  onToggleStar,
  onRemove,
}: {
  item: VocabItem;
  onToggleStar: () => void;
  onRemove: () => void;
}) {
  const mastered = item.mastery >= 3;
  return (
    <View style={styles.row}>
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
      {mastered ? (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={palette.accent}
          style={styles.masteredIcon}
        />
      ) : null}
      <Pressable onPress={onToggleStar} hitSlop={8} style={styles.iconBtn}>
        <Ionicons
          name={item.starred ? "star" : "star-outline"}
          size={20}
          color={item.starred ? palette.coral : palette.inkSoft}
        />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={19} color={palette.inkSoft} />
      </Pressable>
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
  filterRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.glassStrong,
  },
  chipActive: { backgroundColor: palette.ink },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  masteredIcon: { marginRight: spacing.xs },
  iconBtn: { padding: spacing.xs },
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
