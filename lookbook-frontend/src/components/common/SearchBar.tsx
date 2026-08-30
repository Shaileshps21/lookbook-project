import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Mic } from "lucide-react";
import clsx from "clsx";

interface SearchBarProps {
  variant?: "navbar" | "page";
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  onSearch?: (query: string) => void;
}

// Web Speech API types aren't in the default DOM lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
const getSpeechRecognition = (): any | null => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const SearchBar = ({
  variant = "navbar",
  placeholder = "Search books, authors...",
  className,
  defaultValue = "",
  onSearch,
}: SearchBarProps) => {
  const [query, setQuery] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const navigate = useNavigate();
  const recognition = getSpeechRecognition();

  const submit = (text: string) => {
    if (onSearch) {
      onSearch(text);
    } else {
      navigate(`/categories?search=${encodeURIComponent(text)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(query);
  };

  const toggleListening = () => {
    if (!recognition) {
      setUnsupported(true);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new recognition();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      const transcript = (event.results?.[0]?.[0]?.transcript ?? "").trim();
      if (transcript) {
        setQuery(transcript);
        submit(transcript);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setUnsupported(true);
      setTimeout(() => setUnsupported(false), 2500);
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        "flex items-center bg-white border border-orange-100 shadow-sm",
        variant === "navbar" ? "rounded-full px-4 py-2" : "rounded-2xl px-5 py-4",
        className
      )}
    >
      <Search size={18} className="text-slate-400 shrink-0" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={unsupported ? "Voice not supported in this browser" : placeholder}
        className="outline-none px-3 bg-transparent w-full text-slate-700"
      />
      <button
        type="button"
        onClick={toggleListening}
        aria-label="Search by voice"
        disabled={listening && !recognition}
        className={clsx(
          "shrink-0 transition-colors",
          listening ? "text-amber-500 animate-pulse" : "text-slate-300 hover:text-amber-500"
        )}
      >
        {listening ? (
          <span className="flex items-center gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1 h-1 rounded-full bg-amber-500 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        ) : (
          <Mic size={18} />
        )}
      </button>
    </form>
  );
};

export default SearchBar;
