"use client";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sb = createSupabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-semibold">Admin sign-in</h1>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button className="w-full bg-slate-900 text-white rounded py-2">
          Send magic link
        </button>
        {sent && <p className="text-green-700">Check your email for the link.</p>}
        {error && <p className="text-red-700">{error}</p>}
      </form>
    </main>
  );
}
