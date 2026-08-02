// 🍯 HoneyPot 서버리스 함수 — 워드프레스 발행 (REST API)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({}, 204);
  if (event.httpMethod !== "POST") return json({ error: "POST만 허용" }, 405);

  let cfg;
  try {
    cfg = JSON.parse(event.body || "{}");
  } catch (e) {
    return json({ error: "JSON 파싱 실패" }, 400);
  }

  const base = (cfg.wpUrl || "").trim().replace(/\/+$/, "");
  if (!base || !cfg.wpUser || !cfg.wpPass) {
    return json({ error: "wpUrl/wpUser/wpPass 필요" }, 400);
  }

  try {
    const body = JSON.stringify({
      title: cfg.title || "",
      content: cfg.content || "",
      slug: cfg.slug || null,
      status: cfg.status || "future",
      date: cfg.date || null,
      comment_status: "closed",
    });
    const res = await fetch(base + "/wp-json/wp/v2/posts", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(cfg.wpUser + ":" + cfg.wpPass),
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": UA,
      },
      body,
    });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch (e) { /* WP가 JSON 아닌 에러 반환 시 */ }
    return json({ code: res.status, result: data }, res.status < 400 ? 200 : 502);
  } catch (e) {
    return json({ code: 0, result: String((e && e.message) || e) }, 502);
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
