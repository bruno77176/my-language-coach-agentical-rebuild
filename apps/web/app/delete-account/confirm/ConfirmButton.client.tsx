"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMessages } from "@/lib/i18n";

type Props = {
  apiBaseUrl: string;
  token: string;
  locale: "en" | "fr";
};

export function ConfirmButton({ apiBaseUrl, token, locale }: Props) {
  const m = getMessages(locale).deleteAccount;
  const router = useRouter();
  const donePath =
    locale === "fr" ? "/fr/delete-account/done" : "/delete-account/done";
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");

  async function onClick() {
    setState("deleting");
    try {
      const res = await fetch(`${apiBaseUrl}/account-deletion/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.push(donePath);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="not-prose flex flex-col gap-3 max-w-md">
      <button
        onClick={onClick}
        disabled={state === "deleting"}
        className="rounded-md bg-danger text-cream px-4 py-2 font-body disabled:opacity-50"
      >
        {state === "deleting" ? "…" : m.confirmButton}
      </button>
      {state === "error" ? (
        <p className="text-danger text-sm">{m.confirmFailed}</p>
      ) : null}
    </div>
  );
}
