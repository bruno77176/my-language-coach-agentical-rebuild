"use client";

import { useState } from "react";
import { getMessages } from "@/lib/i18n";

type Props = {
  apiBaseUrl: string;
  locale: "en" | "fr";
};

export function RequestForm({ apiBaseUrl, locale }: Props) {
  const m = getMessages(locale).deleteAccount;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`${apiBaseUrl}/account-deletion/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <p>{m.sent}</p>;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="not-prose flex flex-col gap-3 max-w-md"
    >
      <label className="font-body text-sm">
        {m.emailLabel}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-ink/20 px-3 py-2 font-body"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-md bg-ink text-cream px-4 py-2 font-body disabled:opacity-50"
      >
        {state === "sending" ? m.submitting : m.submit}
      </button>
      {state === "error" ? (
        <p className="text-danger text-sm">{m.errorGeneric}</p>
      ) : null}
    </form>
  );
}
