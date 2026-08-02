// 🍯 HoneyPot 서버리스 함수 — 토픽 경쟁 신호 (네이버 뉴스 검색)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handler(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  if (!q) return json({ error: "q 파라미터가 필요합니다" }, 400);
  try {
    const res = await fetch(
      "https://search.naver.com/search.naver?where=news&query=" +
        encodeURIComponent(q) +
        "&sm=tab_opt&sort=0",
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();

    const items = [];
    const seen = new Set();
    const re = /<a[^>]*href="([^"]+)"[^>]*data-heatmap-target="\.tit"[^>]*>(.*?)<\/a>/gs;
    let m;
    while ((m = re.exec(html)) && items.length < 8) {
      const title = clean(m[2]);
      const link = m[1];
      if (!title || seen.has(link)) continue;
      seen.add(link);
      items.push({ title, link });
    }

    const presses = [];
    const pre = /data-heatmap-target="\.prof"[^>]*>(.*?)<\/a>/gs;
    let pm;
    while ((pm = pre.exec(html)) && presses.length < 12) {
      const p = clean(pm[1]);
      if (p) presses.push(p);
    }
    const dates = [...html.matchAll(/(?:\d+일 전|\d+시간 전|\d+분 전|\d{4}\.\d{2}\.\d{2})/g)]
      .map((x) => x[0]);

    items.forEach((it, i) => {
      if (i < presses.length) it.press = presses[i];
      if (i < dates.length) it.date = dates[i];
    });

    return json({ total: items.length < 10 ? items.length : "10+", items });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

function clean(s) {
  return (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/새 창 열림/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
