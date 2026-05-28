import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/privacy.fr.mdx";

export const metadata = {
  title: "Politique de confidentialité — My Language Coach",
  alternates: { canonical: "/fr/privacy", languages: { en: "/privacy", fr: "/fr/privacy" } },
};

export default function Page() {
  return (
    <LegalLayout locale="fr">
      <Content />
    </LegalLayout>
  );
}
