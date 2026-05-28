import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/terms.fr.mdx";

export const metadata = {
  title: "Conditions d'utilisation — My Language Coach",
  alternates: {
    canonical: "/fr/terms",
    languages: { en: "/terms", fr: "/fr/terms" },
  },
};

export default function Page() {
  return (
    <LegalLayout locale="fr">
      <Content />
    </LegalLayout>
  );
}
