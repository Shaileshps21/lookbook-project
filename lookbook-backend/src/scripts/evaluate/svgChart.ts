/**
 * Minimal dependency-free SVG bar chart generator for the §13.2 offline
 * evaluation report — the thesis needs "a results table + plots", and this
 * keeps the plot generation inside the Node toolchain (matplotlib would
 * require a separate Python install). Output is a standalone SVG that can be
 * embedded directly into a Markdown report or thesis document.
 */

export interface BarChartConfig {
  title: string;
  labels: string[];
  values: number[];
  /** Optional secondary series (e.g. ablations) rendered side by side. */
  secondary?: { label: string; values: number[] }[];
  yLabel?: string;
  height?: number;
}

const BAR_WIDTH = 46;
const GROUP_GAP = 18;
const SERIES_GAP = 6;
const PAD = { top: 54, right: 24, bottom: 64, left: 64 };

export const barChartSvg = (cfg: BarChartConfig): string => {
  const { labels, values, secondary } = cfg;
  const seriesCount = 1 + (secondary?.length ?? 0);
  const n = labels.length;
  const groupWidth = BAR_WIDTH * seriesCount + SERIES_GAP * (seriesCount - 1) + GROUP_GAP;
  const width = PAD.left + PAD.right + n * groupWidth;
  const height = cfg.height ?? 360;

  const maxVal = Math.max(1, ...[values, ...(secondary?.map((s) => s.values) ?? [])].flat());
  const plotH = height - PAD.top - PAD.bottom;

  const seriesColors = ["#d97706", "#0f766e", "#7c3aed", "#be123c"];
  const seriesList = [{ label: cfg.yLabel ?? "value", values }, ...(secondary ?? [])];

  const bars: string[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = PAD.left + i * groupWidth;
    for (let s = 0; s < seriesList.length; s++) {
      const v = seriesList[s].values[i] ?? 0;
      const h = (v / maxVal) * plotH;
      const x = x0 + s * (BAR_WIDTH + SERIES_GAP);
      const y = PAD.top + plotH - h;
      bars.push(
        `<rect x="${x}" y="${y}" width="${BAR_WIDTH}" height="${Math.max(0, h)}" rx="4" fill="${seriesColors[s % seriesColors.length]}" opacity="${s === 0 ? 1 : 0.75}"><title>${labels[i]} — ${seriesList[s].label}: ${v.toFixed(4)}</title></rect>`
      );
      // value label on top of the bar
      bars.push(
        `<text x="${x + BAR_WIDTH / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#475569" font-family="ui-sans-serif, system-ui, sans-serif">${v.toFixed(3)}</text>`
      );
    }
    // x-axis label
    bars.push(
      `<text x="${x0 + groupWidth / 2}" y="${height - PAD.bottom + 18}" text-anchor="middle" font-size="10" fill="#334155" font-family="ui-sans-serif, system-ui, sans-serif">${labels[i]}</text>`
    );
  }

  // y-axis gridlines
  const grid: string[] = [];
  for (let g = 0; g <= 4; g++) {
    const y = PAD.top + plotH - (plotH * g) / 4;
    const val = (maxVal * g) / 4;
    grid.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${width - PAD.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<text x="${PAD.left - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#64748b" font-family="ui-sans-serif, system-ui, sans-serif">${val.toFixed(3)}</text>`
    );
  }

  // legend
  const legend = seriesList
    .map(
      (s, i) =>
        `<rect x="${PAD.left + i * 110}" y="18" width="12" height="12" rx="2" fill="${seriesColors[i % seriesColors.length]}"/><text x="${PAD.left + i * 110 + 18}" y="28" font-size="11" fill="#334155" font-family="ui-sans-serif, system-ui, sans-serif">${s.label}</text>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-sans-serif, system-ui, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${PAD.left}" y="16" font-size="13" font-weight="bold" fill="#0f172a">${cfg.title}</text>
${legend}
${grid.join("")}
${bars.join("")}
</svg>`;
};