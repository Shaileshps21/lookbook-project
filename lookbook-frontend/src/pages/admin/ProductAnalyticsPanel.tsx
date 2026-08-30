import { useEffect, useState } from "react";
import Loader from "../../components/common/Loader";
import { fetchProductAnalytics, fetchAbReport, type AbReport } from "../../services/adminService";

const EVENT_LABELS: Record<string, string> = {
  page_view: "Page views",
  product_view: "Product views",
  add_to_cart: "Add to cart",
  remove_from_cart: "Remove from cart",
  begin_checkout: "Begin checkout",
  checkout_success: "Checkout success",
  search: "Searches",
  ai_search: "AI searches",
  wishlist_add: "Wishlist adds",
  seller_apply: "Seller applications",
  listing_create: "Listings created",
};

const ProductAnalyticsPanel = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<{ funnel: Record<string, { count: number; sessions: number }>; daily: { date: string; total: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ab, setAb] = useState<AbReport | null>(null);

  useEffect(() => {
    let active = true;
    fetchProductAnalytics(days)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // §13.3 — fetch the recommendation-arm A/B report alongside the funnel.
    fetchAbReport(days)
      .then((r) => active && setAb(r))
      .catch(() => active && setAb(null));
    return () => {
      active = false;
    };
  }, [days]);

  const funnelEntries = data ? Object.entries(data.funnel).sort((a, b) => b[1].count - a[1].count) : [];
  const maxDaily = data?.daily.length ? Math.max(...data.daily.map((d) => d.total), 1) : 1;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-slate-900">Product Analytics</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {loading ? (
        <Loader label="Loading analytics..." />
      ) : !data || funnelEntries.length === 0 ? (
        <p className="text-slate-400 text-sm">
          No events captured yet — the tracker fires as visitors browse the storefront.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Events (last {days} days)</h3>
            <div className="space-y-2">
              {funnelEntries.map(([event, { count, sessions }]) => (
                <div key={event} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-slate-600">{EVENT_LABELS[event] ?? event}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${Math.min(100, (count / (funnelEntries[0]?.[1].count ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-slate-500 tabular-nums">
                    {count} <span className="text-slate-300">· {sessions} sess.</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Daily volume</h3>
            <div className="flex items-end gap-1.5 h-28">
              {data.daily.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg bg-amber-100"
                    style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: 4 }}
                    title={`${d.date}: ${d.total} events`}
                  />
                  <span className="text-[9px] text-slate-400">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {ab && (
        <div className="mt-8 border-t border-amber-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Recommendation A/B test (§13.3)</h3>
          <p className="text-xs text-slate-400 mb-4">
            "hybrid" (vector + collaborative pipeline) vs "popularity" control · two-proportion z-test, significant at p &lt; 0.05
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">Arm</th>
                  <th className="py-2 pr-4 font-medium">Impressions</th>
                  <th className="py-2 pr-4 font-medium">Clicks</th>
                  <th className="py-2 pr-4 font-medium">Conversions</th>
                  <th className="py-2 pr-4 font-medium">CTR</th>
                  <th className="py-2 font-medium">Click → Conv.</th>
                </tr>
              </thead>
              <tbody>
                {ab.arms.map((arm) => (
                  <tr key={arm.arm} className="border-b border-slate-50">
                    <td className="py-2 pr-4 font-semibold text-slate-800">{arm.arm}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-600">{arm.impressions}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-600">{arm.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-600">{arm.conversions}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-600">{(arm.ctr * 100).toFixed(2)}%</td>
                    <td className="py-2 tabular-nums text-slate-600">{(arm.clickToConversionRate * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <TestVerdict label="CTR — hybrid vs popularity" result={ab.tests.ctr} />
            <TestVerdict label="Click→conversion — hybrid vs popularity" result={ab.tests.clickToConversion} />
          </div>

          {ab.sources.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Conversions by recommendation source (§13.8)</h4>
              <div className="space-y-1.5">
                {ab.sources.map((s) => (
                  <div key={s.source} className="flex items-center gap-3 text-sm">
                    <span className="w-72 truncate text-slate-600" title={s.source}>{s.source}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${s.conversionRate * 100}%` }} />
                    </div>
                    <span className="w-28 text-right text-slate-500 tabular-nums">
                      {s.conversions}/{s.clicks} conv.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TestVerdict = ({
  label,
  result,
}: {
  label: string;
  result: { p1: number; p2: number; z: number; pValue: number; significant: boolean; direction: string };
}) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
    <p className="text-xs font-semibold text-slate-600">{label}</p>
    <p className="text-sm mt-1 text-slate-500 tabular-nums">
      hybrid {result.p1.toFixed(3)} vs popularity {result.p2.toFixed(3)} · z={result.z.toFixed(2)}, p={result.pValue.toFixed(4)}
    </p>
    <p className={`text-sm font-semibold mt-1 ${result.significant ? "text-amber-700" : "text-slate-400"}`}>
      {result.significant
        ? `Significant — ${result.direction === "one-greater" ? "hybrid wins" : result.direction === "two-greater" ? "popularity wins" : "difference detected"}`
        : "Not significant (p ≥ 0.05)"}
    </p>
  </div>
);

export default ProductAnalyticsPanel;