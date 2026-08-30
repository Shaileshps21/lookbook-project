import { useEffect, useState } from "react";
import { fetchBooks, type BookListParams, type BookListResult } from "../services/bookService";
import type { Book } from "../types";

interface UseBooksResult {
  books: Book[];
  loading: boolean;
  error: string | null;
  meta: Omit<BookListResult, "books">;
}

export const useBooks = (params: BookListParams): UseBooksResult => {
  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState<Omit<BookListResult, "books">>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable dependency key so refetches only happen when a filter actually changes.
  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    setLoading(true);
    setError(null);

    fetchBooks(params)
      .then((result) => {
        if (cancelled) return;
        setBooks(result.books);
        setMeta({ page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load books. Is the API running?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { books, loading, error, meta };
};
