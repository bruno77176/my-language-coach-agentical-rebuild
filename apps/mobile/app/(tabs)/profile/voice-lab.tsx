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
  LANGUAGES,
  TTS_STYLES,
  OPENAI_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  TTS_SPEED_OPTIONS,
  type TtsProvider,
} from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { previewVoice } from "@/src/lib/api-client";
import { playOnce } from "@/src/features/practice/audio-controller";
import { useVoiceLab } from "@/src/features/voice-lab/voice-lab-store";

function Chip({
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
        color={active ? palette.cream : palette.ink}
      >
        {label}
      </EditorialText>
    </Pressable>
  );
}

export default function VoiceLabScreen() {
  const { overrideEnabled, config, setOverrideEnabled, setConfig, reset } =
    useVoiceLab();
  const [previewLang, setPreviewLang] = useState("es");
  const [status, setStatus] = useState<string>("");

  const voices =
    config.provider === "openai"
      ? OPENAI_TTS_VOICES.map((v) => ({ id: v, name: v }))
      : ELEVENLABS_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));

  async function onPreview() {
    setStatus("Synthesizing…");
    try {
      const { audioBase64 } = await previewVoice({
        languageCode: previewLang,
        config,
      });
      const uri = (cacheDirectory ?? "") + "voice-lab-preview.mp3";
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
          title: "🎛 Voice Lab",
          headerShown: true,
          headerStyle: { backgroundColor: palette.cream },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerBackTitle: "Profile",
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText kind="bodySm" color={palette.inkSoft} style={styles.note}>
          Dev tool — pick a provider, voice, speed and tone, then Preview. Toggle
          “Apply to live conversation” to use the config in real practice turns.
        </EditorialText>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Apply to live conversation
        </EditorialText>
        <View style={styles.row}>
          <Chip
            label={overrideEnabled ? "ON" : "OFF"}
            active={overrideEnabled}
            onPress={() => setOverrideEnabled(!overrideEnabled)}
          />
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Provider
        </EditorialText>
        <View style={styles.row}>
          {(["openai", "elevenlabs"] as TtsProvider[]).map((p) => (
            <Chip
              key={p}
              label={p}
              active={config.provider === p}
              onPress={() =>
                setConfig({
                  provider: p,
                  voiceId: p === "openai" ? "nova" : ELEVENLABS_TTS_VOICES[0]!.id,
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
              active={config.voiceId === v.id}
              onPress={() => setConfig({ voiceId: v.id })}
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
              active={config.speed === s}
              onPress={() => setConfig({ speed: s })}
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
              active={config.style === s}
              onPress={() => setConfig({ style: s })}
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
          <EditorialText kind="bodySm" color={palette.inkSoft} style={styles.status}>
            {status}
          </EditorialText>
        ) : null}

        <Pressable style={styles.resetBtn} onPress={reset}>
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
  resetBtn: { marginTop: spacing.md, alignItems: "center" },
});
