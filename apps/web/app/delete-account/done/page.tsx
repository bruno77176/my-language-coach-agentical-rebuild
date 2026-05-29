import { LegalLayout } from "@/components/LegalLayout";
import { getMessages } from "@/lib/i18n";

export const metadata = {
  title: "Account deleted — My Language Coach",
};

export default function Page() {
  const m = getMessages("en").deleteAccount;
  return (
    <LegalLayout locale="en">
      <h1>{m.doneTitle}</h1>
      <p>{m.doneBody}</p>
    </LegalLayout>
  );
}
