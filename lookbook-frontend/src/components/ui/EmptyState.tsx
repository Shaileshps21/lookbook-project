import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import Button from "../common/Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

const EmptyState = ({ icon: Icon, title, description, actionLabel, actionTo }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-6">
        <Icon size={32} className="text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-500 mt-2 max-w-sm">{description}</p>

      {actionLabel && actionTo && (
        <Link to={actionTo} className="mt-8">
          <Button>{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
};

export default EmptyState;
