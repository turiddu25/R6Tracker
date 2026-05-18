export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace("%", "").trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function round(value: number | null, digits = 2): number | null {
  if (value === null) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatNumber(value: number | null, fallback = "--"): string {
  if (value === null) {
    return fallback;
  }

  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDecimal(value: number | null, fallback = "--"): string {
  if (value === null) {
    return fallback;
  }

  return value.toFixed(2);
}

export function formatPercent(value: number | null, fallback = "--"): string {
  if (value === null) {
    return fallback;
  }

  return `${value.toFixed(1)}%`;
}
