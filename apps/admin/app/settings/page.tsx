import { RateCardsEditor } from "@/components/rate-cards-editor";
import { FixedCostsEditor } from "@/components/fixed-costs-editor";
import { UpfrontCostsEditor } from "@/components/upfront-costs-editor";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [rateCards, fixedCosts, upfrontCosts] = await Promise.all([
    apiGet("/admin/rate-cards"),
    apiGet("/admin/fixed-costs"),
    apiGet("/admin/upfront-costs"),
  ]);
  return (
    <>
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
          Rate cards
        </h2>
        <RateCardsEditor initial={rateCards as never[]} />
      </section>
      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
          Fixed costs
        </h2>
        <FixedCostsEditor initial={fixedCosts as never[]} />
      </section>
      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
          Upfront costs
        </h2>
        <UpfrontCostsEditor initial={upfrontCosts as never[]} />
      </section>
    </>
  );
}
