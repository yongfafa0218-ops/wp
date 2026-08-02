#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🍯 HoneyPot Prompt Bridge — 로컬 프록시 서버 (Python 3 표준 라이브러리만 사용, 설치 불필요)

실행:  python proxy.py            (기본 포트 8787)
종료:  Ctrl+C

역할:
  /health        → 상태 확인
  /autocomplete  → Google 자동완성 연관 키워드 (무료, API 키 불필요)
  /news          → 네이버 뉴스 검색 (경쟁 분석 + 팩트체크용 최신 뉴스)
  /wp            → 워드프레스 REST API 예약 발행 (애플리케이션 패스워드)
  /wp-test       → 워드프레스 연결 테스트

※ 구글/네이버에 과도한 요청을 보내지 않도록 요청 간 최소 간격(기본 0.7초)을 두고,
   결과를 메모리에 캐시합니다. 개인 로컬 용도로만 사용하세요.
"""
import base64
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = "127.0.0.1", 8787
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
CACHE = {}          # key -> (expire_ts, value)
POLL = 0.7          # 외부 요청 간 최소 간격(초)
_last_req = 0.0


def polite_wait():
    global _last_req
    wait = POLL - (time.time() - _last_req)
    if wait > 0:
        time.sleep(wait)
    _last_req = time.time()


def http_get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def cached(key, ttl, fn):
    now = time.time()
    hit = CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    val = fn()
    CACHE[key] = (now + ttl, val)
    return val


# ---------------------------------------------------------------- Google 자동완성
def google_autocomplete(q):
    url = ("https://suggestqueries.google.com/complete/search"
           "?client=firefox&hl=ko&gl=kr&q=" + urllib.parse.quote(q))
    polite_wait()
    _, body = http_get(url)
    data = json.loads(body.decode("utf-8", "ignore"))
    kws = [k for k in (data[1] or []) if k.strip()]
    return kws[:12]


# ---------------------------------------------------------------- 네이버 뉴스
def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).replace("새 창 열림", "").strip()


def naver_news(q):
    url = ("https://search.naver.com/search.naver?where=news&query="
           + urllib.parse.quote(q) + "&sm=tab_opt&sort=0")
    polite_wait()
    _, body = http_get(url)
    html = body.decode("utf-8", "ignore")
    items, seen = [], set()

    # 신형(fender) 레이아웃 — href가 data-heatmap-target보다 앞에 옴
    for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*data-heatmap-target="\.tit"[^>]*>(.*?)</a>', html, re.S):
        title = strip_html(m.group(2))
        link = m.group(1)
        if not title or link in seen:
            continue
        seen.add(link)
        items.append({"title": title, "link": link})

    # 구형 레이아웃 대비
    if not items:
        for m in re.finditer(r'class="news_tit"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            title = strip_html(m.group(2))
            link = m.group(1)
            if not title or link in seen:
                continue
            seen.add(link)
            items.append({"title": title, "link": link})

    presses = [p for p in (strip_html(m.group(1)) for m in
                           re.finditer(r'data-heatmap-target="\.prof"[^>]*>(.*?)</a>', html, re.S)) if p]
    dates = re.findall(r'(?:\d+일 전|\d+시간 전|\d+분 전|\d{4}\.\d{2}\.\d{2})', html)

    for i, it in enumerate(items[:12]):
        if i < len(presses):
            it["press"] = presses[i]
        if i < len(dates):
            it["date"] = dates[i]

    total = len(items) if len(items) < 10 else "10+"
    return {"total": total, "items": items[:8]}


# ---------------------------------------------------------------- 워드프레스
def _auth_header(cfg):
    token = base64.b64encode(
        f"{cfg.get('wpUser','')}:{cfg.get('wpPass','')}".encode()).decode()
    return {"Authorization": "Basic " + token, "User-Agent": UA}


# 로컬 WP(Local by Flywheel 등)는 자체서명 인증서를 쓰므로, SSL 검증 실패 시
# 인증서 검증 없이 1회 재시도한다. (개인 로컬 테스트 전용 — 실서버는 검증 유지)
_SSL_INSECURE = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
_SSL_INSECURE.check_hostname = False
_SSL_INSECURE.verify_mode = ssl.CERT_NONE


def wp_request(url, data=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=data,
                                 method="POST" if data is not None else "GET",
                                 headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # 기본: 인증서 검증
            return r.status, r.read()
    except urllib.error.URLError as e:
        if isinstance(getattr(e, "reason", None), ssl.SSLError):
            sys.stderr.write("[honeypot] 자체서명 SSL 감지 — 인증서 검증 없이 재시도 (로컬 WP 테스트 전용)\n")
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL_INSECURE) as r:
                return r.status, r.read()
        raise


def wp_publish(cfg):
    base = cfg.get("wpUrl", "").rstrip("/")
    body = json.dumps({
        "title": cfg.get("title", ""),
        "content": cfg.get("content", ""),
        "slug": cfg.get("slug") or None,
        "status": cfg.get("status", "future"),
        "date": cfg.get("date"),
        "comment_status": "closed",
    }, ensure_ascii=False).encode("utf-8")
    headers = {**_auth_header(cfg), "Content-Type": "application/json; charset=utf-8"}
    try:
        status, raw = wp_request(base + "/wp-json/wp/v2/posts", data=body,
                                 headers=headers, timeout=30)
        return status, json.loads(raw.decode("utf-8", "ignore"))
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", "ignore")[:400]
        try:
            msg = json.loads(msg)
        except Exception:
            pass
        return e.code, msg
    except Exception as e:
        return 0, str(e)


def wp_test(cfg):
    base = cfg.get("wpUrl", "").rstrip("/")
    try:
        status, raw = wp_request(base + "/wp-json/wp/v2/users/me",
                                 headers=_auth_header(cfg), timeout=15)
        return status, json.loads(raw.decode("utf-8", "ignore"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")[:300]
    except Exception as e:
        return 0, str(e)


# ---------------------------------------------------------------- HTTP 핸들러
class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")

    def _json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        try:
            u = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(u.query)
            if u.path == "/health":
                return self._json({"ok": True, "name": "honeypot-proxy", "version": "1.0"})
            if u.path == "/autocomplete":
                kw = (q.get("q") or [""])[0].strip()
                if not kw:
                    return self._json({"error": "q 파라미터가 필요합니다"}, 400)
                kws = cached("ac:" + kw, 600, lambda: google_autocomplete(kw))
                return self._json({"query": kw, "keywords": kws})
            if u.path == "/news":
                kw = (q.get("q") or [""])[0].strip()
                if not kw:
                    return self._json({"error": "q 파라미터가 필요합니다"}, 400)
                res = cached("news:" + kw, 900, lambda: naver_news(kw))
                return self._json(res)
            if u.path == "/wp-test":
                cfg = {k: (q.get(k) or [""])[0] for k in ("wpUrl", "wpUser", "wpPass")}
                code, res = wp_test(cfg)
                return self._json({"code": code, "result": res}, 200 if code == 200 else 502)
            return self._json({"error": "not found"}, 404)
        except Exception as e:
            return self._json({"error": str(e)}, 500)

    def do_POST(self):
        try:
            u = urllib.parse.urlparse(self.path)
            if u.path != "/wp":
                return self._json({"error": "not found"}, 404)
            ln = int(self.headers.get("Content-Length") or 0)
            cfg = json.loads(self.rfile.read(ln).decode("utf-8", "ignore"))
            code, res = wp_publish(cfg)
            return self._json({"code": code, "result": res}, 200 if code in (200, 201) else 502)
        except Exception as e:
            return self._json({"error": str(e)}, 500)

    def log_message(self, fmt, *args):
        sys.stderr.write("[honeypot-proxy] " + fmt % args + "\n")


if __name__ == "__main__":
    print(f"🍯 HoneyPot 프록시 서버 시작 → http://{HOST}:{PORT}")
    print("   index.html을 브라우저로 열면 자동으로 이 프록시를 찾습니다.")
    print("   종료: Ctrl+C")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
