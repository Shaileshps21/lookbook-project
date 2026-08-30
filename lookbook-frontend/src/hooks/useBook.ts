import { useEffect, useState } from "react";
import { fetchBookById, fetchSimilarBooks } from "../services/bookService";
import type { Book } from "../types";

interface UseBookResult {
  book: Book | null;
  similarBooks: Book[];
  loading: boolean;
  notFound: boolean;
}

export const useBook = (id: string | undefined): UseBookResult => {
  const [book, setBook] = useState<Book | null>(null);
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    setLoading(true);
    setNotFound(false);

    fetchBookById(id)
      .then(async (fetchedBook) => {
        if (cancelled) return;
        setBook(fetchedBook);
        try {
          const similar = await fetchSimilarBooks(id);
          if (!cancelled) setSimilarBooks(similar);
        } catch {
          if (!cancelled) setSimilarBooks([]);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { book, similarBooks, loading, notFound };
};
