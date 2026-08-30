import { useState, type ReactNode } from "react";
import clsx from "clsx";

interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  children: (active: string) => ReactNode;
  className?: string;
}

const Tabs = ({ tabs, defaultValue, children, className }: TabsProps) => {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);

  return (
    <div className={className}>
      <div className="flex gap-2 bg-white border border-amber-100 rounded-full p-1.5 w-fit mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={clsx(
              "px-5 py-2 rounded-full text-sm font-medium transition-colors",
              active === tab.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {children(active)}
    </div>
  );
};

export default Tabs;
