import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { EditorialText } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The card to preview + capture (wrap it in a share-cards component). */
  children: ReactNode;
};

/**
 * Previews a share card and, on "Share image", captures it to a PNG and hands
 * it to the OS share sheet (expo-sharing). The captured view carries the app +
 * mylanguagecoach.app branding, so the shared image is itself the install CTA.
 */
export function ShareCardModal({ visible, onClose, children }: Props) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const onShare = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share",
        });
      }
    } catch {
      // capture failed or the user dismissed the sheet — nothing to do
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* collapsable=false keeps this a real, capturable view on Android. */}
          <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
            {children}
          </View>
          <Pressable
            onPress={onShare}
            disabled={busy}
            style={[styles.shareBtn, busy && styles.busy]}
          >
            {busy ? (
              <ActivityIndicator color={palette.peach} />
            ) : (
              <EditorialText kind="bodyMd" color={palette.peach}>
                Share image
              </EditorialText>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <EditorialText kind="bodySm" color={palette.cream}>
              Close
            </EditorialText>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardWrap: { borderRadius: radius.xl, overflow: "hidden", ...shadow.cta },
  shareBtn: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    minWidth: 200,
    ...shadow.cta,
  },
  busy: { opacity: 0.7 },
  cancel: { padding: spacing.sm },
});
