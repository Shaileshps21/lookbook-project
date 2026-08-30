import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

const AuthCard = ({ title, subtitle, children, footer }: AuthCardProps) => {
  return (
    <section className="bg-[#F5F2EA] min-h-[85vh] flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-4xl shadow-sm border border-amber-100 p-10 w-full max-w-md"
      >
        <div className="flex items-center gap-2 justify-center mb-6">
          <BookOpen className="text-amber-500" size={26} />
          <span className="text-2xl font-bold text-slate-900">LookBook</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center">{title}</h1>
        <p className="text-slate-500 text-center mt-2 mb-8">{subtitle}</p>

        {children}

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </motion.div>
    </section>
  );
};

export default AuthCard;
