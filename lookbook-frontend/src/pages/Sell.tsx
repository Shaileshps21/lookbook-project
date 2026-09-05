import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UploadCloud,
  IndianRupee,
  CheckCircle2,
  PackageSearch,
  Banknote,
  Truck,
  LogIn,
  X,
  ScanLine,
  Sparkles,
  Barcode,
} from "lucide-react";
import Button from "../components/common/Button";
import FormField from "../components/auth/FormField";
const IsbnScanner = lazy(() => import("../components/sell/IsbnScanner"));
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "../hooks/useAuth";
import {
  createListing,
  scanBookCover,
  suggestListingPrice,
} from "../services/listingService";
import { lookupBookByIsbn } from "../services/bookService";
import { uploadImage } from "../services/uploadService";
import { ApiClientError } from "../services/apiClient";
import type { ListingCondition } from "../types";

const steps = [
  { icon: PackageSearch, title: "List Your Book", description: "Add details, photos, and set your price." },
  { icon: Truck, title: "We Pick It Up", description: "Schedule a free pickup from your doorstep." },
  { icon: Banknote, title: "Get Paid", description: "Receive payment once your book is verified." },
];

const conditions: ListingCondition[] = ["New", "Like New", "Good", "Fair", "Worn"];

const Sell = () => {
  const { user } = useAuth();
  const { categoryNames } = useCategories();
  const categories = categoryNames.filter((c) => c !== "All");

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<ListingCondition>("Good");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isbnScanOpen, setIsbnScanOpen] = useState(false);
  const [isbnScanning, setIsbnScanning] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  const resetForm = () => {
    setTitle("");
    setAuthor("");
    setCategory("");
    setPrice("");
    setCondition("Good");
    setImages([]);
    setAiMessage(null);
  };

  const handleScanIsbn = async (isbn: string) => {
    setIsbnScanning(true);
    setError("");
    try {
      const meta = await lookupBookByIsbn(isbn);
      setTitle(meta.title);
      setAuthor(meta.author);
      if (meta.category) setCategory(meta.category);
      const extra: string[] = [meta.published, meta.publisher, meta.pages ? `${meta.pages} pages` : undefined].filter(
        (v): v is string => Boolean(v)
      );
      setAiMessage(
        `Barcode matched "${meta.title}"${meta.author ? ` by ${meta.author}` : ""} via ${meta.source === "catalog" ? "our catalog" : "Open Library"}.${extra.length ? ` ${extra.join(" · ")}.` : ""}`
      );
      setIsbnScanOpen(false);
      setManualIsbn("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't resolve that ISBN. Check it and try again.");
    } finally {
      setIsbnScanning(false);
    }
  };

  const handleScanCover = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setScanning(true);
    setError("");
    setAiMessage("Scanning the cover…");
    try {
      const scan = await scanBookCover(file);
      setTitle(scan.title);
      setAuthor(scan.author);
      if (scan.category) setCategory(scan.category);
      if (scan.suggestedBuyPrice > 0) setPrice(String(scan.suggestedBuyPrice));
      setAiMessage(
        `Found "${scan.title}"${scan.author ? ` by ${scan.author}` : ""}. Suggested asking price: ₹${scan.suggestedBuyPrice}.`
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "We couldn't scan that cover. Try a clearer photo.");
      setAiMessage(null);
    } finally {
      setScanning(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleSuggestPrice = async () => {
    if (!title.trim()) {
      setError("Enter a title first so we can suggest a price.");
      return;
    }
    setSuggesting(true);
    setError("");
    try {
      const suggestion = await suggestListingPrice({
        title: title.trim(),
        author: author.trim() || undefined,
        category: category || undefined,
      });
      setPrice(String(suggestion.suggestedBuyPrice));
      setAiMessage(`Suggested asking price: ₹${suggestion.suggestedBuyPrice} (rent ₹${suggestion.suggestedRentPrice} · demand ${suggestion.demandScore}/100).`);
    } catch { 
      setError("Couldn't generate a price suggestion. Please try again.");
    } finally {
      setSuggesting(false);
    }
  };

  const handlePhotoSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadImage(file)));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Surface Cloudinary-not-configured errors and AI quality rejections clearly
        setError(err.message);
      } else {
        setError("Couldn't upload photo. Please try a different image.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author || !category || !price) return;

    setSubmitting(true);
    setError("");
    try {
      await createListing({
        title,
        author,
        category,
        price: Number(price),
        condition,
        images,
      });
      setSubmitted(true);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't submit your listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-[#F5F2EA] pt-20 pb-14">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">Sell Books</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mt-3">
            Turn Your Shelf Into Cash
          </h1>
          <p className="text-slate-600 mt-4 leading-8">
            Sell your used books to thousands of readers on LookBook. List in minutes, we handle the rest.
          </p>
        </div>
      </section>

      <section className="bg-[#F5F2EA] pb-16">
        <div className="max-w-5xl mx-auto px-6 grid sm:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title: stepTitle, description }, idx) => (
            <div key={stepTitle} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm relative">
              <span className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Icon size={20} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900 mt-4">{stepTitle}</h3>
              <p className="text-slate-500 text-sm mt-1">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F5F2EA] pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-4xl p-8 lg:p-10 border border-amber-100 shadow-sm"
          >
            {!user ? (
              <div className="text-center py-10">
                <LogIn size={40} className="text-amber-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 mt-5">Log in to Sell a Book</h2>
                <p className="text-slate-500 mt-2">
                  Create a free account or log in to list your books for sale.
                </p>
                <Link to="/login" state={{ from: "/sell" }} className="inline-block mt-6">
                  <Button>Log In</Button>
                </Link>
              </div>
            ) : submitted ? (
              <div className="text-center py-10">
                <CheckCircle2 size={48} className="text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 mt-5">Listing Submitted!</h2>
                <p className="text-slate-500 mt-2">
                  We'll review your book and reach out to schedule a free pickup.
                </p>
                <Button className="mt-6" onClick={() => setSubmitted(false)}>
                  List Another Book
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">List a Book For Sale</h2>

                <div className="mb-6 flex items-center gap-3 flex-wrap">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleScanCover(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={scanning}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 border border-amber-300 rounded-full px-4 py-2 hover:bg-amber-50 transition disabled:opacity-50"
                  >
                    <ScanLine size={16} />
                    {scanning ? "Scanning…" : "Scan cover with AI"}
                  </button>
                  <span className="text-xs text-slate-400">
                    Upload a cover photo and we'll pre-fill the details.
                  </span>
                </div>

                <div className="mb-6 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={manualIsbn}
                      onChange={(e) => setManualIsbn(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && manualIsbn.trim() && handleScanIsbn(manualIsbn.trim())}
                      placeholder="or type an ISBN"
                      className="w-44 px-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setIsbnScanOpen(true)}
                      disabled={isbnScanning}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-full px-4 py-2 hover:border-amber-400 hover:text-amber-600 transition disabled:opacity-50"
                    >
                      <Barcode size={16} />
                      Scan ISBN barcode
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Point the camera at the ISBN barcode on the back cover — we'll fetch the details for you.
                  </p>
                </div>

                {isbnScanOpen && (
                  <Suspense fallback={null}>
                    <IsbnScanner
                      busy={isbnScanning}
                      onDetected={(isbn) => handleScanIsbn(isbn)}
                      onClose={() => setIsbnScanOpen(false)}
                    />
                  </Suspense>
                )}

                {aiMessage && (
                  <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm text-amber-800">
                    <Sparkles size={15} className="mt-0.5 shrink-0" />
                    <span>{aiMessage}</span>
                  </div>
                )}

                <FormField
                  label="Book Title"
                  placeholder="e.g. Atomic Habits"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <FormField
                  label="Author"
                  placeholder="e.g. James Clear"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />

                <label className="block mb-5">
                  <span className="text-sm font-medium text-slate-700">Category</span>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white"
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block mb-5">
                  <span className="text-sm font-medium text-slate-700">Condition</span>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ListingCondition)}
                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white"
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block mb-5">
                  <span className="text-sm font-medium text-slate-700 flex items-center justify-between">
                    Asking Price
                    <button
                      type="button"
                      onClick={handleSuggestPrice}
                      disabled={suggesting}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      {suggesting ? "Suggesting…" : "Suggest price"}
                    </button>
                  </span>
                  <div className="mt-2 flex items-center px-4 rounded-2xl border border-slate-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition">
                    <IndianRupee size={16} className="text-slate-400" />
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="299"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full py-3 px-2 outline-none bg-transparent"
                    />
                  </div>
                </label>

                <label className="block mb-6">
                  <span className="text-sm font-medium text-slate-700">Condition Photos</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoSelect(e.target.files)}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center text-slate-400 hover:border-amber-300 transition cursor-pointer"
                  >
                    <UploadCloud size={28} />
                    <p className="mt-2 text-sm">{uploading ? "Uploading..." : "Click to upload photos"}</p>
                  </div>
                  {images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {images.map((url) => (
                        <div key={url} className="relative w-20 h-20">
                          <img src={url} alt="Listing" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </label>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <Button type="submit" fullWidth disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Listing"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Sell;
