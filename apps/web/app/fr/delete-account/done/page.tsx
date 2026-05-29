import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";

export const metadata = {
  title: "Compte supprimé — My Language Coach",
};

export default function Page() {
  const m = getMessages("fr").deleteAccount;
  return (
    <LegalLayout locale="fr">
      <h1>{m.doneTitle}</h1>
      <p>{m.doneBody}</p>
    </LegalLayout>
  );
}
