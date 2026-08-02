// 🍯 HoneyPot 서버리스 함수 — 워드프레스 연결 테스트
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({}, 204);
  const p = event.queryStringParameters || {};
  const base = (p.wpUrl || "").trim().replace(/\/+$/, "");
  if (!base || !p.wpUser || !p.wpPass) {
    return json({ error: "wpUrl/wpUser/wpPass 필요" }, 400);
  }
  try {
    const res = await fetch(base + "/wp-json/wp/v2/users/me", {
      headers: {
        "Authorization": "Basic " + btoa(p.wpUser + ":" + p.wpPass),
        "User-Agent": UA,
      },
    });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch (e) { /* ignore */ }
    return json({ code: res.status, result: data }, res.status === 200 ? 200 : 502);
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
