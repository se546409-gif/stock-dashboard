import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") || "";
  const range = req.nextUrl.searchParams.get("range") || "1mo";
  if (!symbol) return NextResponse.json({ error: "symbol 파라미터 필요" }, { status: 400 });

  const intervalMap: Record<string, string> = { "5d":"1d", "1mo":"1d", "3mo":"1d", "6mo":"1wk", "1y":"1wk" };
  const interval = intervalMap[range] || "1d";

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } });
    const data = await resp.json();
    const result = data.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: "차트 데이터 없음" }, { status: 404 });

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const volumes = result.indicators.quote[0].volume || [];
    const labels: string[] = []; const prices: number[] = []; const volumesArr: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] !== null) {
        const d = new Date(timestamps[i] * 1000);
        labels.push(`${d.getMonth()+1}/${d.getDate()}`);
        prices.push(closes[i]);
        volumesArr.push(volumes[i] || 0);
      }
    }
    return NextResponse.json({ labels, prices, volumes: volumesArr });
  } catch { return NextResponse.json({ error: "차트 조회 실패" }, { status: 500 }); }
}
