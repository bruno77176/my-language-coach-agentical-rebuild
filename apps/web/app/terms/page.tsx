import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/terms.en.mdx";

export const metadata = {
  title: "Terms of Service — My Language Coach",
  alternates: { canonical: "/terms", languages: { en: "/terms", fr: "/fr/terms" } },
};

export default function Page() {
  return (
    <LegalLayout locale="en">
      <Content />
    </LegalLayout>
  );
}
