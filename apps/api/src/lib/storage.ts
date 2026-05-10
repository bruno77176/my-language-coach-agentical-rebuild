import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../env";

export function createStorageClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UploadInput = {
  userId: string;
  conversationId: string;
  messageId: string;
  audioBuffer: Buffer;
  contentType: string;
};

export type UploadResult = {
  path: string;
  signedUrl: string;
};

/**
 * Upload coach TTS audio to the user's private folder in Supabase Storage and
 * return a 1-hour-validity signed URL the mobile app can fetch.
 *
 * Path scheme: {userId}/{conversationId}/{messageId}.mp3
 * Bucket policy enforces auth.uid()::text = (storage.foldername(name))[1].
 */
export async function uploadCoachAudio(
  client: SupabaseClient,
  input: UploadInput,
): Promise<UploadResult> {
  const path = `${input.userId}/${input.conversationId}/${input.messageId}.mp3`;
  const upload = await client.storage
    .from("user-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (upload.error) {
    throw new Error(`Storage upload failed: ${upload.error.message}`);
  }
  const signed = await client.storage
    .from("user-audio")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (signed.error || !signed.data) {
    throw new Error(`Signed URL failed: ${signed.error?.message ?? "unknown"}`);
  }
  return { path, signedUrl: signed.data.signedUrl };
}

/**
 * Upload a single TTS audio chunk for streaming coach responses.
 *
 * Path scheme: {userId}/{conversationId}/{messageId}-{chunkIndex}.mp3
 * Bucket: user-audio (same RLS policies as uploadCoachAudio).
 */
export async function uploadCoachAudioChunk(
  client: SupabaseClient,
  input: {
    userId: string;
    conversationId: string;
    messageId: string;
    chunkIndex: number;
    audioBuffer: Buffer;
    contentType: string;
  },
): Promise<{ audioUrl: string }> {
  const path = `${input.userId}/${input.conversationId}/${input.messageId}-${input.chunkIndex}.mp3`;
  const { error: uploadErr } = await client.storage
    .from("user-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (uploadErr) throw new Error(`storage upload failed: ${uploadErr.message}`);

  const { data, error: signErr } = await client.storage
    .from("user-audio")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (signErr || !data?.signedUrl) {
    throw new Error(`storage sign failed: ${signErr?.message}`);
  }
  return { audioUrl: data.signedUrl };
}

/**
 * Upload a pre-generated greeting audio clip to the shared greeting-audio bucket.
 *
 * Path scheme: greeting-{lang}-{nameHash}.mp3
 * Bucket: greeting-audio (public).
 *
 * REQUIRES (one-shot, run once in Supabase SQL Editor before first use):
 *
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('greeting-audio', 'greeting-audio', true)
 *   ON CONFLICT (id) DO UPDATE SET public = true;
 */
export async function uploadGreetingAudio(
  client: SupabaseClient,
  input: {
    lang: string;
    nameHash: string;
    audioBuffer: Buffer;
    contentType: string;
  },
): Promise<{ audioUrl: string }> {
  const path = `greeting-${input.lang}-${input.nameHash}.mp3`;
  const { error: uploadErr } = await client.storage
    .from("greeting-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (uploadErr)
    throw new Error(`greeting upload failed: ${uploadErr.message}`);

  const { data, error: signErr } = await client.storage
    .from("greeting-audio")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 1 week
  if (signErr || !data?.signedUrl) {
    throw new Error(`greeting sign failed: ${signErr?.message}`);
  }
  return { audioUrl: data.signedUrl };
}

/**
 * Return a signed URL for a cached greeting clip, or null if it doesn't exist yet.
 *
 * Bucket: greeting-audio (public).
 */
export async function getGreetingAudioUrl(
  client: SupabaseClient,
  input: { lang: string; nameHash: string },
): Promise<string | null> {
  const path = `greeting-${input.lang}-${input.nameHash}.mp3`;
  const { data: list, error: listErr } = await client.storage
    .from("greeting-audio")
    .list("", { search: path });
  if (listErr) return null;
  if (!list || list.length === 0 || !list.find((f) => f.name === path)) {
    return null;
  }
  const { data, error: signErr } = await client.storage
    .from("greeting-audio")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Return a signed URL for a cached coach audio chunk if it exists, or null.
 * Used by /v1/messages/:id/audio so repeated taps don't regenerate TTS
 * (which both costs money AND produces slightly different audio each call).
 */
export async function getCachedCoachAudioUrl(
  client: SupabaseClient,
  input: {
    userId: string;
    conversationId: string;
    messageId: string;
    chunkIndex: number;
  },
): Promise<string | null> {
  const folder = `${input.userId}/${input.conversationId}`;
  const fileName = `${input.messageId}-${input.chunkIndex}.mp3`;
  const { data: list, error: listErr } = await client.storage
    .from("user-audio")
    .list(folder, { search: fileName });
  if (listErr) return null;
  if (!list || list.length === 0 || !list.find((f) => f.name === fileName)) {
    return null;
  }
  const { data, error: signErr } = await client.storage
    .from("user-audio")
    .createSignedUrl(`${folder}/${fileName}`, 60 * 60);
  if (signErr || !data?.signedUrl) return null;
  return data.signedUrl;
}
