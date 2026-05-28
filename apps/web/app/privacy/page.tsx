import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/privacy.en.mdx";

export const metadata = {
  title: "Privacy Policy — My Language Coach",
  alternates: { canonical: "/privacy", languages: { en: "/privacy", fr: "/fr/privacy" } },
};

export default function Page() {
  return (
    <LegalLayout locale="en">
      <Content />
    </LegalLayout>
  );
}
