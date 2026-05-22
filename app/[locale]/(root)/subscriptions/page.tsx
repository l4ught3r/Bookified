import { PricingTable } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

export default function SubscriptionsPage() {
  const t = useTranslations("Subscriptions");

  return (
    <div className="container wrapper py-10">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl font-bold font-serif mb-4">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("description")}</p>
      </div>

      <div className="clerk-pricing-container">
        <PricingTable />
      </div>
    </div>
  );
}
