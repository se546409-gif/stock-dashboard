import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols") || "";
  if (!symbols) return NextResponse.json({ error: "symbols 파라미터 필요" }, { status: 400 });

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } });
    const data = await resp.json();
    const result: Record<string, unknown> = {};
    if (data.quoteResponse?.result) {
      for (const q of data.quoteResponse.result) {
        result[q.symbol] = {
          price: q.regularMarketPrice, change: q.regularMarketChange,
          pct: q.regularMarketChangePercent, prevClose: q.regularMarketPreviousClose,
          name: q.shortName || q.symbol, marketCap: q.marketCap, pe: q.trailingPE,
          volume: q.regularMarketVolume, fiftyDayAvg: q.fiftyDayAverage,
          twoHundredDayAvg: q.twoHundredDayAverage,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh, fiftyTwoWeekLow: q.fiftyTwoWeekLow,
        };
      }
    }
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: "시세 조회 실패" }, { status: 500 }); }
}
