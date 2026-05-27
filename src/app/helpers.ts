export const isKRW = (t: string) => t.endsWith(".KS") || t.endsWith(".KQ");
export const fmtPrice = (t: string, p: number) =>
  isKRW(t)
    ? Math.round(p).toLocaleString("ko-KR") + "원"
    : "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = (n: number, d = 2) => n.toFixed(d);
export const displayTicker = (t: string) => t.replace(".KS", "").replace(".KQ", "");
