// 🍯 HoneyPot 서버리스 함수 — 상태 확인
export async function handler() {
  return json({ ok: true, name: "honeypot-fn", version: "1.0" });
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
