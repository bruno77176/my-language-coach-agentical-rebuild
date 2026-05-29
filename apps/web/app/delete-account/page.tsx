import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { RequestForm } from "./RequestForm.client";

export const metadata = {
  title: "Delete your account — My Language Coach",
  alternates: {
    canonical: "/delete-account",
    languages: { en: "/delete-account", fr: "/fr/delete-account" },
  },
};

export default function Page() {
  const m = getMessages("en").deleteAccount;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";
  return (
    <LegalLayout locale="en">
      <h1>{m.title}</h1>
      <p>{m.intro}</p>
      <RequestForm apiBaseUrl={apiBaseUrl} locale="en" />
      <h2>{m.whatIsDeleted}</h2>
      <p>{m.whatIsDeletedList}</p>
      <h2>{m.whatIsKept}</h2>
      <p>{m.whatIsKeptList}</p>
    </LegalLayout>
  );
}
