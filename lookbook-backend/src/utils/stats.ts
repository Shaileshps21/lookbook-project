/**
 * Small statistics helpers used by the §13.3 A/B report (two-proportion
 * z-test) and by the §13.9 LLM-provider comparison script. Kept dependency-
 * free so the offline experiment scripts can run with zero installs.
 */

/** Complementary error function (Abramowitz & Stegun 7.1.26) — accurate to ~1e-7. */
const erfc = (x: number): number => {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const tau =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? tau : 2 - tau;
};

/** Standard normal CDF. */
export const normalCdf = (z: number): number => 0.5 * erfc(-z / Math.SQRT2);

/** Two-tailed p-value from a z statistic. */
export const normalTwoTailedP = (z: number): number => erfc(Math.abs(z) / Math.SQRT2);

export interface ProportionTestResult {
  p1: number;
  p2: number;
  n1: number;
  n2: number;
  z: number;
  pValue: number;
  /** Standard significance threshold used in the thesis (§13.3): p < 0.05. */
  significant: boolean;
  direction: "equal" | "one-greater" | "two-greater";
}

/**
 * Two-proportion z-test (pooled variance). `a` and `b` are { success, total }
 * counts for two independent arms. Returns the z statistic, the two-tailed
 * p-value, and a plain-language direction.
 */
export const twoProportionZTest = (
  a: { success: number; total: number },
  b: { success: number; total: number }
): ProportionTestResult => {
  const p1 = a.total === 0 ? 0 : a.success / a.total;
  const p2 = b.total === 0 ? 0 : b.success / b.total;

  if (a.total === 0 || b.total === 0) {
    return { p1, p2, n1: a.total, n2: b.total, z: 0, pValue: 1, significant: false, direction: "equal" };
  }

  const pooled = (a.success + b.success) / (a.total + b.total);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.total + 1 / b.total));
  const z = se === 0 ? 0 : (p1 - p2) / se;
  const pValue = normalTwoTailedP(z);

  return {
    p1,
    p2,
    n1: a.total,
    n2: b.total,
    z,
    pValue,
    significant: pValue < 0.05,
    direction: p1 > p2 ? "one-greater" : p2 > p1 ? "two-greater" : "equal",
  };
};