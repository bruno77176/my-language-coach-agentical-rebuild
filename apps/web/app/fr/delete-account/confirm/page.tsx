import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";
import { ConfirmButton } from "../../../delete-account/confirm/ConfirmButton.client";

export const metadata = {
  title: "Confirmer la suppression — My Language Coach",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const m = getMessages("fr").deleteAccount;
  const params = await searchParams;
  const token = params.token;
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://my-language-coach-agentical-rebuild.fly.dev";

  if (!token) {
    return (
      <LegalLayout locale="fr">
        <h1>{m.confirmTitle}</h1>
        <p>{m.confirmInvalid}</p>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout locale="fr">
      <h1>{m.confirmTitle}</h1>
      <p>{m.confirmIntro}</p>
      <ConfirmButton apiBaseUrl={apiBaseUrl} token={token} locale="fr" />
    </LegalLayout>
  );
}
