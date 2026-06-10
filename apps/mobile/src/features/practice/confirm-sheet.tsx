import { Modal, Pressable, StyleSheet, View } from "react-native";
import { EditorialText } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

export type ConfirmAction = {
  label: string;
  // primary = filled ink button (peach text); destructive = red text;
  // default = soft glass button (ink text).
  kind?: "primary" | "default" | "destructive";
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  actions: ConfirmAction[];
  onRequestClose: () => void;
  cancelLabel?: string;
};

/**
 * Branded confirm dialog — replaces the stock grey `Alert.alert`, matching the
 * Sunrise design (cream card, editorial title, full-width action buttons).
 * Actions render top-to-bottom; the cancel row sits at the bottom and is what
 * the backdrop tap maps to.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  actions,
  onRequestClose,
  cancelLabel = "Cancel",
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        {/* Inner press is a no-op so taps on the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <EditorialText kind="displayMd" italic style={styles.title}>
            {title}
          </EditorialText>
          {body ? (
            <EditorialText
              kind="bodyMd"
              color={palette.inkSoft}
              style={styles.body}
            >
              {body}
            </EditorialText>
          ) : null}
          <View style={styles.actions}>
            {actions.map((a) => {
              const isPrimary = a.kind === "primary";
              return (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={[
                    styles.btn,
                    isPrimary ? styles.btnPrimary : styles.btnDefault,
                  ]}
                >
                  <EditorialText
                    kind="bodyMd"
                    color={
                      isPrimary
                        ? palette.peach
                        : a.kind === "destructive"
                          ? palette.danger
                          : palette.ink
                    }
                  >
                    {a.label}
                  </EditorialText>
                </Pressable>
              );
            })}
            <Pressable onPress={onRequestClose} style={styles.cancel}>
              <EditorialText kind="bodyMd" color={palette.inkSoft}>
                {cancelLabel}
              </EditorialText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    backgroundColor: palette.cream,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.cta,
  },
  title: { color: palette.ink, marginBottom: spacing.sm },
  body: { marginBottom: spacing.lg },
  actions: { gap: spacing.sm },
  btn: {
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: palette.ink, ...shadow.cta },
  btnDefault: { backgroundColor: palette.glassStrong },
  cancel: { alignItems: "center", paddingVertical: spacing.sm },
});
