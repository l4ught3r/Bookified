import { useTranslations } from "next-intl";
import UploadForm from "@/components/UploadForm";

const Page = () => {
  const t = useTranslations("NewBook");

  return (
    <main className="wrapper container">
      <div className="mx-auto max-w-180 space-y-10">
        <section className="flex flex-col gap-5">
          <h1 className="page-title-xl">{t("title")}</h1>
          <p className="subtitle">{t("subtitle")}</p>
        </section>

        <UploadForm />
      </div>
    </main>
  );
};

export default Page;
