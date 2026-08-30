import { Link } from "react-router-dom";
import { Code2, Lock, Globe, ExternalLink } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const endpoints = [
  {
    method: "GET",
    path: "/public/books",
    desc: "List books, searchable/filterable, paginated.",
    query: "page, limit (max 50), search, category",
  },
  {
    method: "GET",
    path: "/public/books/:id",
    desc: "A single book's full public details.",
    query: "—",
  },
  {
    method: "GET",
    path: "/public/categories",
    desc: "Catalog categories with book counts.",
    query: "—",
  },
];

/**
 * Developer docs for the public, unauthenticated read-only API
 * (future.md Phase 12 — "public API" stretch). Rest of the platform's
 * endpoints remain behind the standard session/OAuth gate.
 */
const Developers = () => {
  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-2">
          <Code2 size={22} className="text-amber-600" />
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">Public API</p>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Build on LookBook's catalog</h1>
        <p className="text-slate-600 mt-4 leading-8">
          Every book on LookBook is available to read-only consumer applications — no auth key needed. Great for
          embedding book data, building reading-list apps, or exploring the catalog programmatically.
        </p>

        <div className="mt-8 bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Globe size={15} />
            <span>Base URL</span>
          </div>
          <code className="mt-2 block rounded-xl bg-slate-900 text-amber-300 text-sm px-4 py-3 overflow-x-auto">
            {API_URL}
          </code>
          <p className="mt-3 text-xs text-slate-400">
            Prefix any public endpoint below with the base URL. Responses match the normal LookBook envelope:
            <code className="text-slate-500"> {"{ success, message, data }"}</code>.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {endpoints.map((ep) => (
            <div key={ep.method + ep.path} className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-green-100 text-green-700 rounded-md px-2 py-1">{ep.method}</span>
                  <code className="text-sm font-semibold text-slate-800">{ep.path}</code>
                </div>
                <a
                  href={`${API_URL}${ep.path.replace(":id", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 hover:text-amber-700 shrink-0"
                  title="Open in browser"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <p className="mt-3 text-sm text-slate-500">{ep.desc}</p>
              <p className="mt-1 text-xs text-slate-400">
                Query params: <code className="text-slate-500">{ep.query}</code>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
            <Lock size={15} />
            <span>Example — get books</span>
          </div>
          <pre className="rounded-xl bg-slate-900 text-slate-200 text-xs px-4 py-3 overflow-x-auto leading-6">{`curl "${API_URL}/public/books?search=asimov&page=1&limit=5"

fetch("${API_URL}/public/books?category=Fiction&limit=10")
  .then((r) => r.json())
  .then(({ data }) => console.log(data));`}</pre>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          This catalog API is a small, read-only slice. The full LookBook API — checkout, rentals, AI search, listings
          — requires a logged-in session and is not intended for third-party use. Questions?{" "}
          <Link to="/" className="text-amber-600 hover:underline">
            Back to LookBook
          </Link>
          .
        </p>
      </div>
    </section>
  );
};

export default Developers;