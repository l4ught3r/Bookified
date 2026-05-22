import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import VapiControls from "@/components/VapiControls";
import { Link } from "@/lib/i18n/navigation";
import { getBookBySlug } from "@/lib/actions/book.actions";

export default async function BookDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { userId } = await auth();
  const { slug, locale } = await params;

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }

  const result = await getBookBySlug(slug);

  if (!result.success || !result.data) {
    redirect(`/${locale}`);
  }

  const book = result.data;
  const t = await getTranslations("BookPage");

  return (
    <div className="book-page-container">
      <Link href="/" className="back-btn-floating" aria-label={t("backAriaLabel")}>
        <ArrowLeft className="size-6 text-[#212a3b]" />
      </Link>

      <VapiControls book={book} />
    </div>
  );
}
