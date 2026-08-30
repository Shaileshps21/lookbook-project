import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { X, ScanLine } from "lucide-react";

/**
 * Camera barcode → ISBN scanner (future.md Stretch #4). Uses ZXing's browser
 * multi-format reader against a live getUserMedia() stream. On the first
 * decoded barcode we normalize it to an ISBN-style numeric string (the parent
 * does the actual Open Library lookup) and stop the camera immediately.
 */
interface IsbnScannerProps {
  onDetected: (isbn: string) => void;
  onClose: () => void;
  busy?: boolean;
  scanLabel?: string;
}

const normalizeIsbn = (raw: string): string | null => {
  const digits = raw.replace(/[^0-9Xx]/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  const withoutX = digits.replace(/X$/i, "");
  if (withoutX.length < 10) return null;
  // Put back a trailing check char if it was a valid ISBN-10.
  return digits.endsWith("X") || digits.length === 13 || digits.length === 10 ? digits : withoutX;
};

const IsbnScanner = ({ onDetected, onClose, busy, scanLabel }: IsbnScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        reader.decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          "scanner-video",
          (result) => {
            if (cancelled || firedRef.current) return;
            if (!result) return;
            const isbn = normalizeIsbn(`${result.getText()}`.trim());
            if (!isbn) return;
            firedRef.current = true;
            stopAll();
            onDetected(isbn);
          }
        );
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't start the camera. Allow camera access, or just type the ISBN below."
          );
        }
      }
    };

    const stopAll = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const delay = setTimeout(start, 300);

    return () => {
      cancelled = true;
      clearTimeout(delay);
      stopAll();
      readerRef.current = null;
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ScanLine size={18} className="text-amber-600" /> Scan book barcode
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-500 py-6 text-center">{error}</p>
        ) : (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-slate-900">
              <video
                id="scanner-video"
                ref={videoRef}
                muted
                playsInline
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-8 border-2 border-amber-400 rounded-lg animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Point the camera at the ISBN barcode on the back of the book.
            </p>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          {busy && (
            <span className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-medium text-center animate-pulse">
              Looking up ISBN…
            </span>
          )}
        </div>
        {scanLabel && !busy && <p className="text-xs text-amber-600 text-center mt-3">{scanLabel}</p>}
      </div>
    </div>
  );
};

export default IsbnScanner;