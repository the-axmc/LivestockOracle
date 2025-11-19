export function truncateAddress(addr?: string, size = 4) {
  if (!addr) return "-";
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString();
}

export function formatUsd(value: bigint, decimals = 6) {
  const factor = 10n ** BigInt(decimals);
  const integer = value / factor;
  const fraction = value % factor;
  return `${integer}.${fraction.toString().padStart(decimals, "0")}`;
}
