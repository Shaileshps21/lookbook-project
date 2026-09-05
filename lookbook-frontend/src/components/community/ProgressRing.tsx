interface ProgressRingProps {
  progress: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/** A circular progress indicator — used for challenge progress instead of
 * the reading-dashboard's existing thin bar, both so a challenge card is
 * legible at a glance and so it doesn't visually double as "just another
 * stat bar" the way the old Challenges page did. */
const ProgressRing = ({ progress, target, size = 64, strokeWidth = 6, label }: ProgressRingProps) => {
  const pct = target > 0 ? Math.min(1, progress / target) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const complete = progress >= target;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FEF3C7" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? "#22C55E" : "#F59E0B"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-slate-900">
          {progress}/{target}
        </span>
        {label && <span className="text-[9px] text-slate-400">{label}</span>}
      </div>
    </div>
  );
};

export default ProgressRing;
