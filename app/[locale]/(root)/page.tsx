import { getTranslations } from "next-intl/server";
import BookCard from "@/components/BookCard";
import HeroSection from "@/components/HeroSection";
import Search from "@/components/Search";
import { getAllBooks } from "@/lib/actions/book.actions";

const Page = async ({ searchParams }: { searchParams: Promise<{ query?: string }> }) => {
  const t = await getTranslations("Home");

  const { query } = await searchParams;

  const bookResults = await getAllBooks(query);
  const books = bookResults.success ? (bookResults.data ?? []) : [];

  return (
    <main className="wrapper container">
      <HeroSection />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <h2 className="text-3xl font-serif font-bold text-[#212a3b]">{t("recentBooks")}</h2>
        <Search />
      </div>

      <div className="library-books-grid">
        {books.map((book) => (
          <BookCard
            key={book._id}
            title={book.title}
            author={book.author}
            coverURL={book.coverURL}
            slug={book.slug}
          />
        ))}
      </div>
    </main>
  );
};

export default Page;
