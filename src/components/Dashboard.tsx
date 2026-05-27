"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WATCHLIST, INDEX_SYMBOLS, HOLDINGS } from "../app/config";
import { isKRW, fmtPrice, fmt, displayTicker } from "../app/helpers";
import { Chart as ChartJS, registerables } from "chart.js"; ChartJS.register(...registerables);;
import AiChat from "./AiChat";

interface QuoteData {
  price: number; change: number; pct: number; name: string;
  pe?: number; fiftyDayAvg?: number; twoHundredDayAvg?: number;
  fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; volume?: number;
}

interface ChartData { labels: string[]; prices: number[]; volumes: number[] }

const REC_THRESHOLD = { strong: 80, buy: 60, hold: 40 };

function analyzeStock(quote: QuoteData, prices: number[]) {
  if (!quote || !prices || prices.length < 5) return null;
  let score = 50;
  const reasons: string[] = [];
  const last = prices[prices.length - 1];
  const recent5 = prices.slice(-6, -1);
  const avg5 = recent5.reduce((a, b) => a + b, 0) / recent5.length;
  if (last > avg5 * 1.02) { score += 8; reasons.push("5일 이평선 상향 돌파"); }
  else if (last < avg5 * 0.98) { score -= 8; reasons.push("5일 이평선 하향 이탈"); }
  if (quote.fiftyDayAvg) {
    const r = (last - quote.fiftyDayAvg) / quote.fiftyDayAvg;
    if (r > 0.05) { score += 6; reasons.push("50일 이평 대비 +5% 이상"); }
    else if (r > 0) { score += 3; reasons.push("50일 이평 위에 위치"); }
    else if (r < -0.05) { score -= 6; reasons.push("50일 이평 대비 -5% 이상 하락"); }
    else { score -= 3; reasons.push("50일 이평 아래에 위치"); }
  }
  if (quote.twoHundredDayAvg) {
    if (last > quote.twoHundredDayAvg) { score += 4; reasons.push("200일 이평 위 (장기 상승추세)"); }
    else { score -= 4; reasons.push("200일 이평 아래 (장기 하락추세)"); }
  }
  if (quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow) {
    const range = quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow;
    const pos = (last - quote.fiftyTwoWeekLow) / range;
    if (pos > 0.8) { score += 5; reasons.push("52주 고점 근처 (강세장)"); }
    else if (pos < 0.2) { score -= 5; reasons.push("52주 저점 근처 (약세장)"); }
  }
  if (quote.pct > 3) { score += 5; reasons.push(`당일 강한 상승 (+${fmt(quote.pct)}%)`); }
  else if (quote.pct > 0) { score += 2; reasons.push(`당일 상승 (+${fmt(quote.pct)}%)`); }
  else if (quote.pct < -3) { score -= 5; reasons.push(`당일 급락 (${fmt(quote.pct)}%)`); }
  else if (quote.pct < 0) { score -= 2; reasons.push(`당일 하락 (${fmt(quote.pct)}%)`); }
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / changes.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / changes.length : 0.001;
  const rsi = 100 - 100 / (1 + avgGain / avgLoss);
  if (rsi < 30) { score += 10; reasons.push(`RSI 과매도 (${fmt(rsi)}) — 반등 가능`); }
  else if (rsi < 40) { score += 4; reasons.push(`RSI 낮음 (${fmt(rsi)}) — 저점 매수 기회`); }
  else if (rsi > 70) { score -= 10; reasons.push(`RSI 과매수 (${fmt(rsi)}) — 조정 가능`); }
  else if (rsi > 60) { score -= 3; reasons.push(`RSI 높음 (${fmt(rsi)}) — 단기 과열`); }
  if (quote.pe) {
    if (quote.pe < 15) { score += 5; reasons.push(`PER 낮음 (${fmt(quote.pe)}) — 저평가 가능`); }
    else if (quote.pe > 40) { score -= 3; reasons.push(`PER 높음 (${fmt(quote.pe)}) — 고평가 주의`); }
  }
  score = Math.max(0, Math.min(100, score));
  let grade: string, gradeKo: string, recColor: string;
  if (score >= REC_THRESHOLD.strong) { grade = "STRONG_BUY"; gradeKo = "강력 매수"; recColor = "border-l-green-500"; }
  else if (score >= REC_THRESHOLD.buy) { grade = "BUY"; gradeKo = "매수"; recColor = "border-l-blue-500"; }
  else if (score >= REC_THRESHOLD.hold) { grade = "HOLD"; gradeKo = "관망"; recColor = "border-l-yellow-500"; }
  else { grade = "SELL"; gradeKo = "매도"; recColor = "border-l-red-500"; }
  return { score, grade, gradeKo, recColor, reasons, rsi };
}

export default function Dashboard() {
  const [stockData, setStockData] = useState<Record<string, QuoteData>>({});
  const [indexData, setIndexData] = useState<Record<string, QuoteData>>({});
  const [currentTicker, setCurrentTicker] = useState("AAPL");
  const [currentRange, setCurrentRange] = useState("1mo");
  const [tab, setTab] = useState("watchlist");
  const [recommendations, setRecommendations] = useState<Array<{ symbol: string; quote: QuoteData; analysis: NonNullable<ReturnType<typeof analyzeStock>> }>>([]);
  const [search, setSearch] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<ChartJS | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartPrices, setChartPrices] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const stockSymbols = Object.keys(WATCHLIST);
    const indexSymbols = Object.values(INDEX_SYMBOLS);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`/api/quotes?symbols=${stockSymbols.join(",")}`),
        fetch(`/api/quotes?symbols=${indexSymbols.join(",")}`),
      ]);
      const sData = await sRes.json();
      const iData = await iRes.json();
      setStockData(sData);
      setIndexData(iData);
    } catch { /* 무시 */ }
    setLoading(false);
    setLastUpdate(new Date().toLocaleTimeString("ko-KR"));
  }, []);

  const loadChart = useCallback(async (ticker: string, range: string) => {
    try {
      const res = await fetch(`/api/chart?symbol=${encodeURIComponent(ticker)}&range=${range}`);
      const data: ChartData = await res.json();
      if (data.labels) { setChartLabels(data.labels); setChartPrices(data.prices); }
    } catch { /* 무시 */ }
  }, []);

  const loadRecommendations = useCallback(async () => {
    const results: typeof recommendations = [];
    const symbols = Object.keys(WATCHLIST);
    const chartDataMap: Record<string, number[]> = {};
    await Promise.all(symbols.map(async (s) => {
      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(s)}&range=3mo`);
        const data = await res.json();
        chartDataMap[s] = data.prices || [];
      } catch { /* 무시 */ }
    }));
    for (const s of symbols) {
      const q = stockData[s];
      const p = chartDataMap[s];
      if (!q || !p || p.length < 5) continue;
      const analysis = analyzeStock(q, p);
      if (analysis) results.push({ symbol: s, quote: q, analysis });
    }
    results.sort((a, b) => b.analysis.score - a.analysis.score);
    setRecommendations(results);
  }, [stockData]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (Object.keys(stockData).length) loadRecommendations(); }, [stockData, loadRecommendations]);
  useEffect(() => { loadChart(currentTicker, currentRange); }, [currentTicker, currentRange, loadChart]);

  useEffect(() => {
    if (!canvasRef.current || !chartLabels.length) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d")!;
    const pct = stockData[currentTicker]?.pct ?? 0;
    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    if (pct >= 0) { grad.addColorStop(0, "rgba(34,197,94,0.25)"); grad.addColorStop(1, "rgba(34,197,94,0)"); }
    else { grad.addColorStop(0, "rgba(239,68,68,0.25)"); grad.addColorStop(1, "rgba(239,68,68,0)"); }
    chartRef.current = new ChartJS(ctx, {
      type: "line", data: { labels: chartLabels, datasets: [{ data: chartPrices, borderColor: pct >= 0 ? "#22c55e" : "#ef4444", backgroundColor: grad, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }] },
      options: { responsive: true, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1a1d27", titleColor: "#e1e5ea", bodyColor: "#e1e5ea", borderColor: "#2a2d3a", borderWidth: 1, callbacks: { label: (c: any) => fmtPrice(currentTicker, c.parsed.y) } } }, scales: { x: { grid: { color: "#2a2d3a" }, ticks: { color: "#9ca3af", maxTicksLimit: 8 } }, y: { grid: { color: "#2a2d3a" }, ticks: { color: "#9ca3af", callback: (v: any) => fmtPrice(currentTicker, v) } } } },
    });
  }, [chartLabels, chartPrices, currentTicker, stockData]);

  const tickerEntries = [...Object.entries(indexData), ...Object.entries(stockData)];
  const filteredWatchlist = Object.entries(WATCHLIST).filter(([t, info]) => {
    if (!search) return true;
    const dt = displayTicker(t);
    const s = stockData[t];
    return dt.includes(search.toUpperCase()) || info.name.includes(search) || (s?.name?.toUpperCase().includes(search.toUpperCase()));
  });

  const rangeLabels: Record<string, string> = { "5d": "1주", "1mo": "1개월", "3mo": "3개월", "6mo": "6개월", "1y": "1년" };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[#2a2d3a] bg-[#0f1117]/90 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 4 5-8"/></svg>
            <span className="text-lg font-semibold tracking-tight">주식대시보드</span>
          </div>
          <input className="flex-1 max-w-md bg-[#1a1d27] border border-[#2a2d3a] rounded-lg px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="종목 검색" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="hidden sm:inline">{lastUpdate || "불러오는 중..."}</span>
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-[#2a2d3a] transition" title="새로고침">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.6-12.6L1 10"/></svg>
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#2a2d3a] overflow-hidden bg-[#141620]">
        <div className="flex whitespace-nowrap py-2 text-xs font-medium" style={{ animation: "scroll 40s linear infinite" }}>
          {tickerEntries.map(([t, s]) => s?.price == null ? null : (
            <span key={t} className="inline-flex items-center gap-2 px-4">
              <span className="text-gray-300 font-medium">{displayTicker(t)}</span>
              <span className="text-gray-200">{fmtPrice(t, s.price)}</span>
              <span className={s.pct >= 0 ? "text-green-400" : "text-red-400"}>{s.pct >= 0 ? "▲" : "▼"}{fmt(Math.abs(s.pct))}%</span>
            </span>
          ))}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-gray-400 mb-3">시장 지수</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(INDEX_SYMBOLS).map(([name, symbol]) => {
              const s = indexData[symbol];
              if (!s || s.price == null) return <div key={name} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-3 animate-pulse"><div className="h-4 bg-[#2a2d3a] rounded w-16 mb-2" /><div className="h-6 bg-[#2a2d3a] rounded w-24" /></div>;
              const up = s.pct >= 0;
              return <div key={name} className={`bg-[#1a1d27] border ${up ? "border-green-900/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "border-red-900/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]"} rounded-xl p-3`}>
                <div className="text-xs text-gray-400 mb-1">{name}</div>
                <div className="text-lg font-semibold">{s.price.toLocaleString()}</div>
                <div className={`text-sm mt-1 ${up ? "text-green-400" : "text-red-400"}`}>{up ? "▲" : "▼"} {fmt(Math.abs(s.pct))}% ({up ? "+" : ""}{fmt(s.change)})</div>
              </div>;
            })}
          </div>
        </section>

        <section>
          <div className="flex gap-2 mb-4">
            {[
              { key: "watchlist", label: "관심종목" },
              { key: "recommend", label: "추천 종목" },
              { key: "holdings", label: "보유종목" },
              { key: "sector", label: "섹터별" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === key ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-[#2a2d3a]"}`}>{label}</button>
            ))}
          </div>

          {tab === "watchlist" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredWatchlist.map(([t, info]) => {
                const s = stockData[t];
                if (!s || s.price == null) return <div key={t} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-3 animate-pulse"><div className="h-4 bg-[#2a2d3a] rounded w-12 mb-2" /><div className="h-6 bg-[#2a2d3a] rounded w-20" /></div>;
                const up = s.pct >= 0;
                return <div key={t} onClick={() => setCurrentTicker(t)} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-3 cursor-pointer hover:border-[#3a3d4a] transition">
                  <div className="flex items-start justify-between mb-2"><div><div className="font-semibold text-sm">{displayTicker(t)}</div><div className="text-xs text-gray-500">{s.name || info.name}</div></div><span className={`text-[10px] px-2 py-0.5 rounded ${up ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>{info.sector}</span></div>
                  <div className="text-lg font-semibold mb-1">{fmtPrice(t, s.price)}</div>
                  <div className="flex items-center justify-between"><span className={`text-sm ${up ? "text-green-400" : "text-red-400"}`}>{up ? "▲" : "▼"} {fmt(Math.abs(s.pct))}%</span><span className={`text-xs ${up ? "text-green-400" : "text-red-400"}`}>{up ? "+" : ""}{fmt(s.change, isKRW(t) ? 0 : 2)}</span></div>
                </div>;
              })}
            </div>
          )}

          {tab === "recommend" && (
            <div className="space-y-3">
              {recommendations.length === 0 && <div className="text-gray-500 text-sm">분석 데이터를 불러오는 중...</div>}
              {recommendations.map(r => {
                const up = r.quote.pct >= 0;
                const badgeCls = r.analysis.grade === "STRONG_BUY" ? "bg-green-900 text-green-400" : r.analysis.grade === "BUY" ? "bg-blue-900 text-blue-400" : r.analysis.grade === "HOLD" ? "bg-yellow-900 text-yellow-400" : "bg-red-900 text-red-400";
                return <div key={r.symbol} className={`bg-[#1a1d27] border border-[#2a2d3a] border-l-4 ${r.analysis.recColor} rounded-xl p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div><div className="font-semibold">{displayTicker(r.symbol)} <span className="text-gray-400 font-normal text-sm">{r.quote.name || WATCHLIST[r.symbol]?.name}</span></div><div className="text-lg font-semibold mt-1">{fmtPrice(r.symbol, r.quote.price)} <span className={`text-sm font-normal ${up ? "text-green-400" : "text-red-400"}`}>{up ? "▲" : "▼"} {fmt(Math.abs(r.quote.pct))}%</span></div></div>
                    <div className="text-right"><span className={`text-xs px-3 py-1 rounded-full font-semibold ${badgeCls}`}>{r.analysis.gradeKo}</span><div className="text-2xl font-bold mt-1">{r.analysis.score}<span className="text-sm text-gray-400 font-normal">점</span></div></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
                    <div className="bg-[#0f1117] rounded-lg p-2"><div className="text-gray-500">RSI</div><div className="font-medium">{r.analysis.rsi ? fmt(r.analysis.rsi, 0) : "-"}</div></div>
                    <div className="bg-[#0f1117] rounded-lg p-2"><div className="text-gray-500">PER</div><div className="font-medium">{r.quote.pe ? fmt(r.quote.pe, 1) : "-"}</div></div>
                    <div className="bg-[#0f1117] rounded-lg p-2"><div className="text-gray-500">50일 이평</div><div className="font-medium">{r.quote.fiftyDayAvg ? fmtPrice(r.symbol, r.quote.fiftyDayAvg) : "-"}</div></div>
                    <div className="bg-[#0f1117] rounded-lg p-2"><div className="text-gray-500">200일 이평</div><div className="font-medium">{r.quote.twoHundredDayAvg ? fmtPrice(r.symbol, r.quote.twoHundredDayAvg) : "-"}</div></div>
                  </div>
                  <div className="space-y-1">{r.analysis.reasons.map((reason, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="w-1 h-1 rounded-full bg-gray-500 shrink-0" /><span className="text-gray-300">{reason}</span></div>)}</div>
                </div>;
              })}
            </div>
          )}

          {tab === "holdings" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">보유 현황</h3>
                <table className="w-full text-sm"><thead><tr className="text-gray-500 border-b border-[#2a2d3a]"><th className="text-left py-2 font-medium">종목</th><th className="text-right py-2 font-medium">수량</th><th className="text-right py-2 font-medium">평균단가</th><th className="text-right py-2 font-medium">현재가</th><th className="text-right py-2 font-medium">수익률</th></tr></thead><tbody>
                {HOLDINGS.map(h => { const s = stockData[h.ticker]; if (!s) return null; const pnl = ((s.price - h.avg) / h.avg * 100); const up = pnl >= 0; return <tr key={h.ticker} className="border-b border-[#2a2d3a] hover:bg-[#1e2130] cursor-pointer" onClick={() => setCurrentTicker(h.ticker)}><td className="py-2"><span className="font-medium">{displayTicker(h.ticker)}</span><br /><span className="text-xs text-gray-500">{s.name || WATCHLIST[h.ticker]?.name}</span></td><td className="text-right py-2">{h.qty}</td><td className="text-right py-2">{fmtPrice(h.ticker, h.avg)}</td><td className="text-right py-2">{fmtPrice(h.ticker, s.price)}</td><td className={`text-right py-2 font-medium ${up ? "text-green-400" : "text-red-400"}`}>{up ? "+" : ""}{fmt(pnl)}%</td></tr>; })}
                </tbody></table>
              </div>
              <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">자산 구성</h3>
                <div className="text-center text-gray-500 text-sm">차트 로딩 중...</div>
              </div>
            </div>
          )}

          {tab === "sector" && <div className="text-center text-gray-500 text-sm py-8">섹터 분석 로딩 중...</div>}
        </section>

        <section className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="font-semibold">{displayTicker(currentTicker)}</h3><span className="text-sm text-gray-400">{stockData[currentTicker]?.name || WATCHLIST[currentTicker]?.name}</span></div>
            <div className="flex gap-1">
              {Object.entries(rangeLabels).map(([range, label]) => (
                <button key={range} onClick={() => setCurrentRange(range)} className={`px-3 py-1 rounded text-xs transition ${currentRange === range ? "bg-blue-600 text-white" : "bg-[#2a2d3a] text-gray-400 hover:bg-[#3a3d4a]"}`}>{label}</button>
              ))}
            </div>
          </div>
          <canvas ref={canvasRef} height={280} />
        </section>
      </main>

      <AiChat stockData={stockData} currentTicker={currentTicker} />
    </div>
  );
}
