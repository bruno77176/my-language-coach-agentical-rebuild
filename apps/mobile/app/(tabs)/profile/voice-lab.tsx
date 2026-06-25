import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
// expo-file-system v19's default export is the new File/Paths API; the
// string-path helpers we need (write base64 → temp file) live under /legacy.
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import {
  DEFAULT_TTS_CONFIG,
  LANGUAGES,
  TTS_STYLES,
  OPENAI_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  GEMINI_TTS_VOICES,
  INWORLD_TTS_VOICES,
  TTS_SPEED_OPTIONS,
  type TtsConfig,
  type TtsProvider,
} from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { previewVoice } from "@/src/lib/api-client";
import {
  playOnce,
  resumePlayback,
} from "@/src/features/practice/audio-controller";
import { useStopAudioOnBlur } from "@/src/features/practice/use-stop-audio-on-blur";
import { useVoiceLab } from "@/src/features/voice-lab/voice-lab-store";
import {
  PROVIDER_LABELS,
  PROVIDER_TAGLINES,
  VOICE_DESCRIPTORS,
} from "@/src/features/voice-lab/voice-meta";

const PROVIDERS: TtsProvider[] = ["openai", "elevenlabs", "gemini", "inworld"];

function voicesFor(provider: TtsProvider): { id: string; name: string }[] {
  switch (provider) {
    case "elevenlabs":
      return ELEVENLABS_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    case "gemini":
      return GEMINI_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    case "inworld":
      return INWORLD_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    default:
      return OPENAI_TTS_VOICES.map((v) => ({ id: v, name: v }));
  }
}

function Chip({
  label,
  caption,
  active,
  onPress,
}: {
  label: string;
  caption?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <EditorialText kind="bodySm" color={active ? palette.cream : palette.ink}>
        {label}
      </EditorialText>
      {caption ? (
        <EditorialText
          kind="caps"
          color={active ? palette.cream : palette.inkSoft}
        >
          {caption}
        </EditorialText>
      ) : null}
    </Pressable>
  );
}

export default function CoachVoiceScreen() {
  // Stop the voice preview if the user navigates away mid-playback (BRU-16).
  useStopAudioOnBlur();
  const savedConfig = useVoiceLab((s) => s.config);
  const setConfig = useVoiceLab((s) => s.setConfig);
  const [previewLang, setPreviewLang] = useState("es");
  const [status, setStatus] = useState<string>("");

  // Edits stay in a local draft until the user taps Save — so a half-changed
  // selection never leaks into live conversations.
  const [draft, setDraft] = useState<TtsConfig>(savedConfig);
  const update = (patch: Partial<TtsConfig>) => {
    setStatus("");
    setDraft((d) => ({ ...d, ...patch }));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedConfig);

  const voices = voicesFor(draft.provider);

  function onSave() {
    setConfig(draft);
    setStatus("Saved ✓");
  }

  function onReset() {
    setStatus("");
    setDraft(DEFAULT_TTS_CONFIG);
  }

  async function onPreview() {
    // Preview is an explicit play action — clear any navigation latch left by
    // leaving the Practice screen so the sample is audible here.
    resumePlayback();
    setStatus("Synthesizing…");
    try {
      const { audioBase64, contentType } = await previewVoice({
        languageCode: previewLang,
        config: draft,
      });
      const ext = contentType === "audio/wav" ? "wav" : "mp3";
      const uri = (cacheDirectory ?? "") + `coach-voice-preview.${ext}`;
      await writeAsStringAsync(uri, audioBase64, {
        encoding: EncodingType.Base64,
      });
      setStatus("");
      await playOnce({ source: { uri } });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <Screen variant="gradient">
      <Stack.Screen
        options={{
          title: "Coach's voice",
          headerShown: true,
          headerStyle: { backgroundColor: palette.cream },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerBackTitle: "Profile",
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.note}
        >
          Pick how your coach sounds. Preview a sample, then Save to use it in
          every conversation.
        </EditorialText>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Provider
        </EditorialText>
        <View style={styles.row}>
          {PROVIDERS.map((p) => (
            <Chip
              key={p}
              label={PROVIDER_LABELS[p]}
              caption={PROVIDER_TAGLINES[p]}
              active={draft.provider === p}
              onPress={() =>
                update({
                  provider: p,
                  voiceId: voicesFor(p)[0]!.id,
                })
              }
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Voice
        </EditorialText>
        <View style={styles.row}>
          {voices.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              caption={VOICE_DESCRIPTORS[v.id]}
              active={draft.voiceId === v.id}
              onPress={() => update({ voiceId: v.id })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Speed
        </EditorialText>
        <View style={styles.row}>
          {TTS_SPEED_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={`${s}x`}
              active={draft.speed === s}
              onPress={() => update({ speed: s })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Tone
        </EditorialText>
        <View style={styles.row}>
          {TTS_STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={draft.style === s}
              onPress={() => update({ style: s })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Preview language
        </EditorialText>
        <View style={styles.row}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              label={l.code}
              active={previewLang === l.code}
              onPress={() => setPreviewLang(l.code)}
            />
          ))}
        </View>

        <Pressable style={styles.previewBtn} onPress={onPreview}>
          <EditorialText kind="bodyMd" color={palette.cream}>
            ▶ Preview
          </EditorialText>
        </Pressable>
        {status ? (
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.status}
          >
            {status}
          </EditorialText>
        ) : null}

        <Pressable
          style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={!dirty}
        >
          <EditorialText kind="bodyMd" color={palette.cream}>
            {dirty ? "Save voice" : "Saved"}
          </EditorialText>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={onReset}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Reset to default
          </EditorialText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xs, paddingBottom: 80 },
  note: { marginBottom: spacing.sm },
  label: { marginTop: spacing.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.coral,
  },
  chipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  previewBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  status: { marginTop: spacing.sm },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  resetBtn: { marginTop: spacing.md, alignItems: "center" },
});
