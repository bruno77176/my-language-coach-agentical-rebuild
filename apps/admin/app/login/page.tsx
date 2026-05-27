"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const sb = createSupabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const sb = createSupabaseBrowser();
    const { error } = await sb.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      {step === "email" ? (
        <form
          onSubmit={onSendCode}
          className="w-full max-w-sm space-y-4 p-8 bg-white rounded-xl shadow"
        >
          <h1 className="text-2xl font-semibold">Admin sign-in</h1>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full border rounded px-3 py-2"
          />
          <button
            disabled={busy || !email}
            className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
          {error && <p className="text-red-700 text-sm">{error}</p>}
        </form>
      ) : (
        <form
          onSubmit={onVerifyCode}
          className="w-full max-w-sm space-y-4 p-8 bg-white rounded-xl shadow"
        >
          <h1 className="text-2xl font-semibold">Enter the code</h1>
          <p className="text-sm text-slate-600">
            We sent a code to <span className="font-medium">{email}</span>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            placeholder="Code from email"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            autoComplete="one-time-code"
            className="w-full border rounded px-3 py-2 tracking-widest text-center text-lg"
          />
          <button
            disabled={busy || code.length < 4}
            className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCode("");
              setError(null);
              setStep("email");
            }}
            className="w-full text-slate-500 text-sm"
          >
            Use a different email
          </button>
          {error && <p className="text-red-700 text-sm">{error}</p>}
        </form>
      )}
    </main>
  );
}
