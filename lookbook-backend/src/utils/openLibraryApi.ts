// Open Library (https://openlibrary.org/dev/docs/api) is free, keyless, and
// has no meaningful rate limit — a better fit for this environment than the
// Google Books API, whose unauthenticated quota is already exhausted on
// this network. Used to grow the catalog with real book data (future.md
// doesn't name a specific books API; this is the workable choice).

interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  key: string; // e.g. "/works/OL12345W"
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibraryDoc[];
}

export interface ExternalBookResult {
  sourceKey: string;
  title: string;
  author: string;
  isbn?: string;
  image?: string;
  published?: string;
  publisher?: string;
  pages?: number;
  subjects: string[];
}

const coverUrl = (coverId?: number): string | undefined =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;

const toExternalResult = (doc: OpenLibraryDoc): ExternalBookResult => ({
  sourceKey: doc.key,
  title: doc.title,
  author: doc.author_name?.join(", ") ?? "Unknown Author",
  isbn: doc.isbn?.[0],
  image: coverUrl(doc.cover_i),
  published: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
  publisher: doc.publisher?.[0],
  pages: doc.number_of_pages_median,
  subjects: doc.subject?.slice(0, 8) ?? [],
});

const FIELDS = "title,author_name,isbn,cover_i,first_publish_year,subject,publisher,number_of_pages_median,key";

/**
 * Open Library's search.json is genuinely slow — measured at ~11s for a
 * one-word query — so the original 5s budget aborted essentially every
 * search, surfacing as "Couldn't reach the external book database" in the
 * admin importer even though the service was up. These are user-initiated
 * lookups where waiting beats failing.
 */
const LOOKUP_TIMEOUT_MS = 20000;
/** Background enrichment: a slow description genuinely is worth abandoning,
 * since the import succeeds without it. */
const DESCRIPTION_TIMEOUT_MS = 8000;

export const searchExternalBooks = async (query: string, limit = 20): Promise<ExternalBookResult[]> => {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set("fields", FIELDS);
  // Only books with a cover and at least one identifiable author make for a
  // presentable catalog entry — filters out a lot of low-quality records.
  url.searchParams.set("has_fulltext", "false");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "LookBook/1.0 (contact: admin@lookbook.dev)" },
    // Never hang a request forever on a slow/unreachable Open Library —
    // search and ISBN lookups must degrade to a clean "not found" (or cached
    // catalog entry) instead of spinning the caller.
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);

  const body = (await res.json()) as OpenLibrarySearchResponse;
  return body.docs
    .filter((d) => d.title && d.author_name?.length)
    .map(toExternalResult);
};

/** Best-effort — work-level descriptions require a second request per book,
 * so this is only called for the (small) set of books actually being
 * imported, not for every search result. */
export const fetchWorkDescription = async (workKey: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://openlibrary.org${workKey}.json`, {
      headers: { "User-Agent": "LookBook/1.0 (contact: admin@lookbook.dev)" },
      signal: AbortSignal.timeout(DESCRIPTION_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { description?: string | { value: string } };
    if (!body.description) return null;
    return typeof body.description === "string" ? body.description : body.description.value;
  } catch {
    return null;
  }
};

/**
 * Direct ISBN lookup (barcode scanner / manual entry — Stretch goal #4 in
 * future.md). search.json?isbn= gives a single result doc with author names
 * baked in, reusing toExternalResult's normalization. Exact-branch ISBNs that
 * Open Library lacks a work for simply return null.
 */
export const fetchBookByIsbn = async (isbn: string): Promise<ExternalBookResult | null> => {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("isbn", isbn);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "LookBook/1.0 (contact: admin@lookbook.dev)" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Open Library ISBN lookup failed: ${res.status}`);

  const body = (await res.json()) as OpenLibrarySearchResponse;
  const doc = body.docs?.[0];
  if (!doc?.title || !doc.author_name?.length) return null;
  return toExternalResult(doc);
};
