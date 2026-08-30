import { motion } from "framer-motion";
import clsx from "clsx";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
  action?: ReactNode;
  className?: string;
}

const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
}: SectionHeadingProps) => {
  return (
    <div
      className={clsx(
        "flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10",
        align === "center" && "md:flex-col md:items-center text-center",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {eyebrow && (
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">
            {eyebrow}
          </p>
        )}

        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mt-2">{title}</h2>

        {description && (
          <p className="text-slate-600 mt-3 max-w-xl leading-7">{description}</p>
        )}
      </motion.div>

      {action}
    </div>
  );
};

export default SectionHeading;
