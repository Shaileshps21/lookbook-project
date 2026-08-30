import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({ label, type, ...props }, ref) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  // Once revealed, the field becomes a plain text input — the toggle owns the
  // effective type, so `type` is only the initial/default here.
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <label className="block mb-5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          ref={ref}
          type={effectiveType}
          className={`mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition ${
            isPassword ? "pr-12" : ""
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </label>
  );
});

FormField.displayName = "FormField";

export default FormField;
