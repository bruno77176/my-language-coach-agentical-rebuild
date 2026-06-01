"use client";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] error boundary:", error);
  }, [error]);

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-red-900 mb-2">
        Something went wrong loading this page.
      </h2>
      <pre className="text-xs text-red-800 bg-red-100 rounded p-3 overflow-auto whitespace-pre-wrap">
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-4 text-sm bg-slate-900 text-white rounded px-3 py-1.5"
      >
        Try again
      </button>
    </div>
  );
}
