import clsx from "clsx";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: "amber" | "green" | "blue" | "red" | "slate";
  className?: string;
}

const colorStyles = {
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

const Badge = ({ children, color = "amber", className }: BadgeProps) => (
  <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", colorStyles[color], className)}>
    {children}
  </span>
);

export default Badge;
