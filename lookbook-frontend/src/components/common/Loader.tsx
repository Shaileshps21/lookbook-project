import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import clsx from "clsx";

interface LoaderProps {
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

const Loader = ({ fullScreen, label = "Loading books...", className }: LoaderProps) => {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-4 text-slate-500",
        fullScreen ? "min-h-[60vh]" : "py-16",
        className
      )}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center"
      >
        <BookOpen className="text-amber-500" size={22} />
      </motion.div>
      <p className="font-medium">{label}</p>
    </div>
  );
};

export default Loader;
