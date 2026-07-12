export function formatMW(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} MW`;
}

export function formatKWh(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
