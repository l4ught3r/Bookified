"use client";

import { useParams } from "next/navigation";
import { ReaderView } from "@/components/bookified/reader-view";

export default function ReaderBookPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;

  if (!bookId) {
    return null;
  }

  return <ReaderView bookId={bookId} />;
}
