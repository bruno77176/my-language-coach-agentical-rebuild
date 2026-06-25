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
import RNShare from "react-native-share";
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
  /** Text caption shared alongside the image — full content + tappable link. */
  caption: string;
  /** The poster card to preview + capture (a share-cards component). */
  children: ReactNode;
};

/**
 * Previews a poster card, then shares it as an IMAGE with a text CAPTION via
 * react-native-share — so WhatsApp & co. show the branded image and a tappable
 * invite link together (the built-in Share / expo-sharing can't do both on
 * Android). The caption carries the full content + the link.
 */
export function ShareCardModal({ visible, onClose, caption, children }: Props) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const onShare = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      const url = uri.startsWith("file://") ? uri : `file://${uri}`;
      await RNShare.open({
        url,
        message: caption,
        type: "image/png",
        failOnCancel: false,
      });
    } catch {
      // user dismissed the sheet or capture failed — nothing to do
    } finally {
      setBusy(false);
      onClose();
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
          {/* The drop shadow lives on the OUTER wrapper, NOT the captured view:
              capturing a shadowed view bakes the black halo into the PNG as a
              border (BRU-24). The ref'd view keeps only the rounded clip. */}
          <View style={styles.cardShadow}>
            {/* collapsable=false keeps this a real, capturable view on Android. */}
            <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
              {children}
            </View>
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
                Share
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
  // Shadow on the wrapper (preview only — never captured).
  cardShadow: { borderRadius: radius.xl, ...shadow.cta },
  // Captured view: rounded clip only, no shadow → clean PNG edges.
  cardWrap: { borderRadius: radius.xl, overflow: "hidden" },
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
