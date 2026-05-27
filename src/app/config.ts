export const WATCHLIST: Record<string, { name: string; sector: string }> = {
  AAPL:    { name: "애플",        sector: "기술" },
  MSFT:    { name: "마이크로소프트", sector: "기술" },
  GOOGL:   { name: "알파벳",      sector: "기술" },
  AMZN:    { name: "아마존",      sector: "소비" },
  NVDA:    { name: "엔비디아",     sector: "기술" },
  TSLA:    { name: "테슬라",      sector: "자동차" },
  META:    { name: "메타",       sector: "기술" },
  JPM:     { name: "JP모건",      sector: "금융" },
  V:       { name: "비자",       sector: "금융" },
  JNJ:     { name: "존슨앤드존슨", sector: "헬스케어" },
  "005930.KS": { name: "삼성전자",   sector: "기술" },
  "000660.KS": { name: "SK하이닉스", sector: "기술" },
  "035720.KQ": { name: "카카오",     sector: "기술" },
  "051910.KS": { name: "LG화학",    sector: "소재" },
  "006400.KS": { name: "삼성SDI",   sector: "기술" },
};

export const INDEX_SYMBOLS: Record<string, string> = {
  코스피:    "^KS11",
  코스닥:    "^KQ11",
  "S&P 500": "^GSPC",
  나스닥:    "^IXIC",
};

export const HOLDINGS = [
  { ticker: "AAPL",        qty: 10, avg: 175.00 },
  { ticker: "MSFT",        qty: 5,  avg: 380.00 },
  { ticker: "NVDA",        qty: 20, avg: 95.00 },
  { ticker: "005930.KS",  qty: 50, avg: 78000 },
  { ticker: "JPM",         qty: 8,  avg: 190.00 },
];
