"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  stockData: Record<string, { price: number; change: number; pct: number; name: string; pe?: number }>;
  currentTicker: string;
}

interface Message { role: "user" | "assistant"; content: string }

export default function AiChat({ stockData, currentTicker }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "안녕하세요! 주식 관련 질문을 해주세요. 현재 시세 데이터를 기반으로 분석해드립니다." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const context = Object.entries(stockData).map(([t, s]) =>
      `${t} (${s.name}): ${s.price} (${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(2)}%)`
    ).join("\n");
    context + `\n현재 선택 종목: ${currentTicker}`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, context }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.error || "응답 없음" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "연결 실패. Ollama가 실행 중인지 확인하세요." }]);
    }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition">
        {open ? <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg> : <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-[#1a1d27] border border-[#2a2d3a] rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2d3a] bg-[#141620]">
            <div className="font-semibold text-sm">AI 주식 분석</div>
            <div className="text-xs text-gray-500">Ollama 기반 로컬 AI</div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white" : "bg-[#2a2d3a] text-[#e1e5ea]"}`}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-[#2a2d3a] px-3 py-2 rounded-xl text-sm text-gray-400">분석 중<span className="animate-pulse">...</span></div></div>}
          </div>
          <div className="p-3 border-t border-[#2a2d3a]">
            <div className="flex gap-2">
              <input className="flex-1 bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="질문을 입력하세요" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
              <button onClick={send} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm text-white transition">전송</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
