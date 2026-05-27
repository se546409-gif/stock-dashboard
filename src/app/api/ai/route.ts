import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, context } = await req.json();
  if (!message) return NextResponse.json({ error: "message 필요" }, { status: 400 });

  const systemPrompt = `당신은 전문 주식 분석 AI입니다. 사용자의 질문에 한국어로 답변하세요.
제공된 시세 데이터를 바탕으로 분석하고, 투자 조언 시 반드시 "투자는 본인 책임입니다"라는 면책 문구를 포함하세요.
현재 시세 데이터:
${context || "없음"}`;

  try {
    const resp = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "gemma4:31b-cloud",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: false,
      }),
    });
    if (!resp.ok) throw new Error(`Ollama 응답 오류: ${resp.status}`);
    const data = await resp.json();
    return NextResponse.json({ reply: data.message?.content || "응답 없음" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `AI 연결 실패: ${msg}. Ollama가 실행 중인지 확인하세요.` }, { status: 503 });
  }
}
