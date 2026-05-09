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
