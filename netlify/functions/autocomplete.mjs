// 🍯 HoneyPot 서버리스 함수 — 구글 자동완성 (수요 신호)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handler(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  if (!q) return json({ error: "q 파라미터가 필요합니다" }, 400);
  try {
    const res = await fetch(
      "https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&gl=kr&q=" +
        encodeURIComponent(q),
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const kws = (Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [])
      .map((k) => (typeof k === "string" ? k.trim() : ""))
      .filter(Boolean);
    return json({ query: q, keywords: kws.slice(0, 12) });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

function json(obj, code = 200) {
  return {
    statusCode: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}
