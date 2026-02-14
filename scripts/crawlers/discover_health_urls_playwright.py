"""SPA 사이트용 Playwright headless 스캐너

기존 discover_health_urls.py에서 BeautifulSoup로 못 잡은 26개 SPA 사이트를
Playwright headless 브라우저로 재스캔.

사용법:
  python discover_health_urls_playwright.py          # 26개 accessible 사이트 스캔
  python discover_health_urls_playwright.py --all     # 전체 140개 스캔 (오래 걸림)

패턴 참조: .claude/skills/web-crawler-ocr/scripts/web-crawler-v2.py
"""
import asyncio
import json
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"

# === 키워드 (discover_health_urls.py와 동일) ===
MENU_KEYWORDS = [
    "모자보건", "임산부", "임신출산", "출산지원", "산모",
    "모자건강", "임신·출산", "임신 출산", "임신ㆍ출산",
    "난임", "산전", "출산축하", "모성건강",
    "행복출산", "출산장려", "출산정보", "출산양육",
    "영유아", "신생아", "아이조아",
]

MID_MENU_KEYWORDS = [
    "보건사업", "사업안내", "건강증진", "보건서비스",
    "건강관리", "보건의료", "가족건강", "생애주기",
    "여성건강", "주민건강", "건강지원", "건강생활",
    "보건복지", "복지서비스", "주요사업", "분야별",
    "보건소", "보건센터",
    "맞춤형복지", "출산양육", "복지안내",
]


def classify_pattern(url):
    if "contents.do" in url or "contentsView.do" in url:
        return "A"
    elif "ContentsHtmlView.do" in url:
        return "B"
    elif "menuCd=DOM_" in url:
        return "C"
    elif ".asp" in url and "page_code" in url:
        return "D"
    elif ".jsp" in url:
        return "E"
    elif "menu.es" in url:
        return "F"
    elif ".do" in url:
        return "A_variant"
    return "unknown"


def load_targets(scan_all=False):
    """이전 스캔에서 accessible 사이트 로드"""
    scan_file = DATA_DIR / "health_center_scan.json"
    if not scan_file.exists():
        print("health_center_scan.json 없음. discover_health_urls.py를 먼저 실행하세요.")
        sys.exit(1)

    with open(scan_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    targets = {}
    for name, result in data["results"].items():
        if scan_all or result.get("status") == "accessible":
            url = result.get("accessed_url", "")
            if url and "error" not in url.lower() and "404" not in url:
                targets[name] = {"url": url, "prev": result}

    return targets, data


async def extract_links(page):
    """JS 렌더링 완료 후 모든 링크 추출"""
    return await page.evaluate('''() => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => ({
            href: a.href,
            text: (a.innerText || a.textContent || '').trim().substring(0, 200)
        })).filter(l => l.href && l.text && !l.href.startsWith('javascript'));
    }''')


def match_pregnancy_links(links, base_url):
    """링크에서 임산부 키워드 매칭"""
    found = []
    for link in links:
        text = link["text"]
        href = link["href"]
        if any(kw in text for kw in MENU_KEYWORDS):
            full_url = href if href.startswith("http") else urljoin(base_url, href)
            found.append({
                "text": text[:80],
                "url": full_url,
                "pattern": classify_pattern(full_url),
            })
    return found


def match_mid_menu_links(links, base_url):
    """중간 메뉴 키워드 매칭"""
    found = []
    seen = set()
    for link in links:
        text = link["text"]
        href = link["href"]
        if not href or href.startswith("javascript"):
            continue
        if any(kw in text for kw in MID_MENU_KEYWORDS):
            full_url = href if href.startswith("http") else urljoin(base_url, href)
            if full_url not in seen:
                seen.add(full_url)
                found.append({"text": text[:80], "url": full_url})
    return found


async def scan_site(page, name, url, max_depth=3):
    """단일 사이트 Playwright 스캔 (depth 1~3)"""
    result = {"name": name, "status": "accessible", "urls": [], "method": "playwright"}

    try:
        await page.goto(url, wait_until="networkidle", timeout=20000)
        await asyncio.sleep(1.5)
    except Exception as e:
        # domcontentloaded로 폴백
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(2)
        except Exception:
            result["status"] = "failed"
            result["error"] = str(e)[:100]
            return result

    # depth 1: 메인 페이지에서 임산부 링크 검색
    links = await extract_links(page)
    result["total_links"] = len(links)

    preg_links = match_pregnancy_links(links, url)
    if preg_links:
        result["status"] = "found"
        result["urls"] = preg_links
        result["found_at_depth"] = 1
        return result

    if max_depth < 2:
        return result

    # depth 2: 중간 메뉴 따라가기
    mid_links = match_mid_menu_links(links, url)

    for mid in mid_links[:5]:
        try:
            await page.goto(mid["url"], wait_until="networkidle", timeout=15000)
            await asyncio.sleep(1)
        except Exception:
            try:
                await page.goto(mid["url"], wait_until="domcontentloaded", timeout=10000)
                await asyncio.sleep(1.5)
            except Exception:
                continue

        sub_links = await extract_links(page)
        preg_found = match_pregnancy_links(sub_links, mid["url"])
        if preg_found:
            result["status"] = "found"
            result["urls"] = preg_found
            result["found_at_depth"] = 2
            result["via_menu"] = mid["text"]
            return result

        if max_depth < 3:
            continue

        # depth 3: 한 단계 더
        sub_mid = match_mid_menu_links(sub_links, mid["url"])
        for sm in sub_mid[:3]:
            try:
                await page.goto(sm["url"], wait_until="networkidle", timeout=12000)
                await asyncio.sleep(1)
            except Exception:
                continue

            deep_links = await extract_links(page)
            preg_found = match_pregnancy_links(deep_links, sm["url"])
            if preg_found:
                result["status"] = "found"
                result["urls"] = preg_found
                result["found_at_depth"] = 3
                result["via_menu"] = f"{mid['text']} → {sm['text']}"
                return result

    return result


async def main():
    scan_all = "--all" in sys.argv

    targets, prev_data = load_targets(scan_all)
    if not targets:
        print("스캔 대상이 없습니다.")
        return

    mode = "전체" if scan_all else "accessible"
    print(f"=== Playwright Headless 스캔 ({mode}) ===")
    print(f"대상: {len(targets)}개\n")

    found_count = 0
    still_accessible = 0
    failed_count = 0
    results = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )

        for name, info in sorted(targets.items()):
            url = info["url"]
            page = await context.new_page()

            try:
                result = await scan_site(page, name, url, max_depth=3)
                results[name] = result

                if result["status"] == "found":
                    found_count += 1
                    top = result["urls"][0]
                    d = result.get("found_at_depth", "?")
                    via = result.get("via_menu", "")
                    via_str = f" (via: {via})" if via else ""
                    print(f"  [O] {name}: {top['text']} → {top['url'][:80]} (depth {d}{via_str})")
                elif result["status"] == "accessible":
                    still_accessible += 1
                    links = result.get("total_links", 0)
                    print(f"  [△] {name}: {links}개 링크 발견, 임산부 메뉴 없음")
                else:
                    failed_count += 1
                    print(f"  [X] {name}: {result.get('error', '실패')[:60]}")
            except Exception as e:
                failed_count += 1
                results[name] = {"name": name, "status": "failed", "error": str(e)[:100]}
                print(f"  [!] {name}: 오류 - {str(e)[:60]}")
            finally:
                await page.close()

        await browser.close()

    # 통계
    print(f"\n=== 결과 ===")
    print(f"신규 발견: {found_count}개")
    print(f"여전히 미발견: {still_accessible}개")
    print(f"실패: {failed_count}개")

    # 기존 scan JSON에 머지
    for name, result in results.items():
        if result["status"] == "found":
            prev_data["results"][name] = result

    new_found = sum(1 for r in prev_data["results"].values() if r.get("status") == "found")
    new_acc = sum(1 for r in prev_data["results"].values() if r.get("status") == "accessible")
    prev_data["playwright_scan_date"] = time.strftime("%Y-%m-%d %H:%M:%S")
    prev_data["found"] = new_found
    prev_data["accessible"] = new_acc
    prev_data["failed"] = len(prev_data["results"]) - new_found - new_acc

    scan_file = DATA_DIR / "health_center_scan.json"
    with open(scan_file, "w", encoding="utf-8") as f:
        json.dump(prev_data, f, ensure_ascii=False, indent=2)
    print(f"\n결과 저장: {scan_file}")
    print(f"전체: {new_found}개 found / {new_acc}개 accessible / {prev_data['failed']}개 failed")

    # url_registry.json 업데이트
    update_registry(results)


def update_registry(pw_results):
    """Playwright 결과를 url_registry.json에 반영"""
    registry_file = DATA_DIR / "url_registry.json"
    if not registry_file.exists():
        return

    with open(registry_file, "r", encoding="utf-8") as f:
        registry = json.load(f)

    ad = registry.get("auto_discovered", {}).get("entries", {})

    added = 0
    for name, result in pw_results.items():
        if result["status"] == "found" and result["urls"]:
            top = result["urls"][0]
            ad[name] = {
                "health_center_url": top["url"],
                "pattern": top["pattern"],
                "menu_text": top["text"],
                "verified": False,
                "method": "playwright",
                "all_matches": [
                    {"text": u["text"], "url": u["url"], "pattern": u["pattern"]}
                    for u in result["urls"]
                ],
            }
            added += 1

    registry["auto_discovered"]["entries"] = ad
    registry["auto_discovered"]["playwright_scan_date"] = time.strftime("%Y-%m-%d %H:%M:%S")

    with open(registry_file, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

    print(f"url_registry.json: {added}개 Playwright 발견 항목 추가 (전체: {len(ad)}개)")


if __name__ == "__main__":
    asyncio.run(main())
