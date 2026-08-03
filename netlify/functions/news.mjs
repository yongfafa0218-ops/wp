// 🍯 HoneyPot 서버리스 함수 — 토픽 경쟁 신호 (구글 뉴스 공식 RSS)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handler(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  if (!q) return json({ error: "q 파라미터가 필요합니다" }, 400);
  try {
    // 정확 구문("키워드") 검색 — 퍼지 검색은 희귀 주제도 100건이 나와 신호가 죽으므로 따옴표 필수
    const res = await fetch(
      "https://news.google.com/rss/search?q=" +
        encodeURIComponent('"' + q + '"') +
        "&hl=ko&gl=KR&ceid=KR:ko",
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();

    const items = [];
    const seen = new Set();
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml))) {
      const b = m[1];
      const tm = b.match(/<title>([\s\S]*?)<\/title>/);
      if (!tm) continue;
      let title = decodeEntities(tm[1].trim());
      if (seen.has(title)) continue;
      seen.add(title);
      const sm = b.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      let press = sm ? decodeEntities(sm[1].trim()) : "";
      if (press && title.endsWith(" - " + press)) {
        title = title.slice(0, -(press.length + 3));
      }
      let date = "";
      const dm = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      if (dm) {
        const d = new Date(dm[1].trim());
        if (!isNaN(d)) date = d.toISOString().slice(0, 10).replace(/-/g, ".");
      }
      const lm = b.match(/<link>([\s\S]*?)<\/link>/);
      items.push({ title, link: lm ? lm[1].trim() : "", press, date });
    }

    return json({ total: items.length, items: items.slice(0, 8) });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
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
