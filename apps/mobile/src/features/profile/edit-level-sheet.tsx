import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PROFICIENCY_LEVELS } from "@language-coach/shared";
import { EditorialText, GlassCard, TAB_BAR_RESERVE } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Props = {
  langName: string;
  initialValue: string; // "" = "I'm not sure"
  onSave: (level: string) => Promise<void>;
};

const UNSURE = {
  code: "",
  label: "I'm not sure",
  blurb: "Let the coach figure it out",
};
const OPTIONS = [...PROFICIENCY_LEVELS, UNSURE];

export const EditLevelSheet = forwardRef<BottomSheetModal, Props>(
  function EditLevelSheet({ langName, initialValue, onSave }, ref) {
    const insets = useSafeAreaInsets();
    const footerInset = insets.bottom + TAB_BAR_RESERVE;
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
      setSaving(true);
      try {
        await onSave(value);
        (ref as { current: BottomSheetModal | null }).current?.dismiss();
      } catch (err) {
        Alert.alert("Couldn't save", (err as Error).message);
      } finally {
        setSaving(false);
      }
    }

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={footerInset}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && styles.disabled]}
          >
            <EditorialText
              kind="bodyLg"
              color={palette.peach}
              style={{ fontWeight: "600" }}
            >
              {saving ? "Saving…" : "Save"}
            </EditorialText>
          </Pressable>
        </BottomSheetFooter>
      ),
      // handleSave closes over saving/value; re-create the footer when those or
      // the inset change (matches the sibling edit sheets' dependency intent).
      [saving, value, footerInset],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["80%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footerInset + 80 },
          ]}
        >
          <View style={styles.header}>
            <EditorialText kind="displayMd">
              Your {langName} level
            </EditorialText>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              The coach adapts to this, then fine-tunes as you practice.
            </EditorialText>
          </View>
          <View style={styles.list}>
            {OPTIONS.map((o) => {
              const selected = value === o.code;
              const body = (
                <View>
                  <EditorialText
                    kind="bodyLg"
                    color={selected ? palette.peach : palette.ink}
                  >
                    {o.label}
                    {o.code ? (
                      <EditorialText
                        kind="bodyMd"
                        color={selected ? palette.peach : palette.inkSoft}
                      >
                        {"  ·  " + o.code}
                      </EditorialText>
                    ) : null}
                  </EditorialText>
                  <EditorialText
                    kind="bodySm"
                    color={selected ? palette.peach : palette.inkSoft}
                  >
                    {o.blurb}
                  </EditorialText>
                </View>
              );
              return (
                <Pressable
                  key={o.code || "unsure"}
                  onPress={() => setValue(o.code)}
                >
                  {selected ? (
                    <View style={styles.cardSelected}>{body}</View>
                  ) : (
                    <GlassCard radiusToken="lg" padding="base">
                      {body}
                    </GlassCard>
                  )}
                </Pressable>
              );
            })}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.peach,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: palette.glassFaint },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  scrollContent: { paddingHorizontal: spacing.xl },
  list: { gap: spacing.sm },
  cardSelected: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  saveButton: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  disabled: { opacity: 0.5 },
});
