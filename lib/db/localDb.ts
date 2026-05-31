import Dexie, { type Table } from "dexie";
import type { ReadingTypographySettings } from "@/lib/books/reading-typography";

export interface LocalBook {
  id: string;
  title: string;
  authors: string;
  coverUrl: string;
  format: string;
  totalChapters?: number;
  coverAssetId?: string | null;
  createdAt?: string;
  typography?: ReadingTypographySettings | null;
  lastChapterOrder?: number;
  originalFile?: ArrayBuffer;
}

export interface LocalChapter {
  id: string;
  bookId: string;
  title: string;
  href: string;
  order: number;
  wordCount: number;
  content: string;
}

class ReaderOfflineDatabase extends Dexie {
  books!: Table<LocalBook>;
  chapters!: Table<LocalChapter>;

  constructor() {
    super("BookifiedOfflineDB");
    this.version(1).stores({
      books: "id",
      chapters: "id, bookId, [bookId+order]",
    });
  }
}

export const localDb = new ReaderOfflineDatabase();
