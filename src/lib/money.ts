/**
 * Money formatting helpers. All amounts in INTEGER CENTS — convert at the
 * UI boundary only.
 */

export function formatUsdCents(cents: number, opts?: { sign?: "auto" | "always" | "never"; precision?: number }): string {
  const sign = opts?.sign ?? "auto";
  const usd = cents / 100;
  const prefix =
    sign === "always"
      ? cents >= 0
        ? "+"
        : "-"
      : sign === "never"
        ? ""
        : cents < 0
          ? "-"
          : "";

  const abs = Math.abs(usd);
  let body: string;
  if (abs >= 1_000_000_000) body = `$${(abs / 1_000_000_000).toFixed(opts?.precision ?? 2)}B`;
  else if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(opts?.precision ?? 2)}M`;
  else if (abs >= 10_000) body = `$${(abs / 1_000).toFixed(opts?.precision ?? 1)}K`;
  else body = `$${abs.toFixed(opts?.precision ?? 0)}`;
  return prefix + body;
}

export function formatUsdMillions(usd: number, precision = 1): string {
  return `$${(usd / 1_000_000).toFixed(precision)}M`;
}
