"""보건소 홈페이지에서 실제 임산부 프로그램 내용을 크롤링 (v2).

기존 discover_health_urls_playwright.py의 패턴을 재사용.
url_registry.json + health_center_scan.json의 URL을 방문하여
프로그램명과 내용을 추출한 뒤, 보조금24와 비교.

사용법:
  python crawl_health_programs.py
"""
import asyncio
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.async_api import async_playwright

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"

# 임산부 관련 키워드 (기존 discover 스크립트에서 가져옴)
MENU_KEYWORDS = [
    "모자보건", "임산부", "임신출산", "출산지원", "산모",
    "모자건강", "임신·출산", "임신 출산", "임신ㆍ출산",
    "난임", "산전", "출산축하", "모성건강",
    "행복출산", "출산장려", "출산정보", "출산양육",
    "영유아", "신생아", "아이조아", "모유수유",
    "산후", "태교", "유축기", "철분", "엽산",
]

# 노이즈 필터
NOISE_PATTERNS = [
    r"^\d+$",           # 숫자만
    r"^[\d\-]+$",       # 전화번호
    r"^http",           # URL
    r"^※",              # 주석
    r"^[\(\[]",         # 괄호 시작
    r"^\*",             # 별표 시작
    r"^준비물",         # 준비물
    r"^이용방법",
    r"^접종장소",
    r"^검진비용",
    r"예방접종.{0,5}주의",
    r"^구강검진",
    r"^\d+차\s+건강검진",
    r"^\d+차\s+구강검진",
]


def is_noise(title: str) -> bool:
    """노이즈 항목인지 판별"""
    if len(title) < 4 or len(title) > 80:
        return True
    for pat in NOISE_PATTERNS:
        if re.search(pat, title):
            return True
    return False


def extract_programs_from_text(text: str, source_url: str, region: str) -> list[dict]:
    """페이지 텍스트에서 프로그램 항목을 추출"""
    programs = []
    seen_titles = set()

    # 방법1: 테이블 형태 (제목\t내용 or 제목 : 내용)
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # "사업명: xxx" 또는 "프로그램명: xxx" 패턴
        m = re.match(r"(?:사업명|프로그램명|서비스명|지원사업)\s*[:：]\s*(.+)", line)
        if m:
            title = m.group(1).strip()
            if not is_noise(title) and title not in seen_titles:
                seen_titles.add(title)
                programs.append({"title": title, "content": "", "source_url": source_url, "region": region})
            continue

    # 방법2: 키워드 포함 짧은 라인 = 프로그램 제목 후보
    lines = text.split("\n")
    for i, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 5 or len(line) > 60:
            continue
        if is_noise(line):
            continue

        # 키워드 포함 여부
        has_keyword = any(kw in line for kw in MENU_KEYWORDS)
        if not has_keyword:
            continue

        # 다음 몇 줄을 내용으로 가져옴
        content_lines = []
        for j in range(i + 1, min(i + 5, len(lines))):
            next_line = lines[j].strip()
            if not next_line:
                break
            content_lines.append(next_line)

        content = " ".join(content_lines)[:300]

        if line not in seen_titles:
            seen_titles.add(line)
            programs.append({"title": line, "content": content, "source_url": source_url, "region": region})

    return programs


async def goto_safe(page, url: str, timeout: int = 30000):
    """안전한 페이지 이동 (networkidle → domcontentloaded 폴백)"""
    try:
        await page.goto(url, wait_until="networkidle", timeout=timeout)
        return True
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            await page.wait_for_timeout(2000)
            return True
        except Exception:
            return False


async def get_page_text(page) -> str:
    """페이지에서 본문 텍스트 추출"""
    return await page.evaluate("""() => {
        const remove = document.querySelectorAll('script, style, nav, footer, header, .gnb, .lnb, #header, #footer, #gnb');
        remove.forEach(el => el.remove());
        return document.body ? document.body.innerText : '';
    }""")


async def find_sub_links(page, base_url: str) -> list[dict]:
    """임산부 관련 하위 링크 찾기"""
    links = await page.evaluate("""() => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => ({
            href: a.href,
            text: (a.innerText || '').trim().substring(0, 100)
        })).filter(l => l.href && l.text && !l.href.startsWith('javascript'));
    }""")

    sub_keywords = ["임산부", "임신", "출산", "산모", "모자보건", "난임", "산전", "산후",
                    "모유", "신생아", "영유아", "엽산", "철분", "태교"]
    result = []
    seen = set()
    for link in links:
        if any(kw in link["text"] for kw in sub_keywords):
            href = link["href"] if link["href"].startswith("http") else urljoin(base_url, link["href"])
            if href not in seen:
                seen.add(href)
                result.append({"text": link["text"], "url": href})
    return result


async def crawl_single(page, url: str, name: str) -> dict:
    """단일 사이트 크롤링 - 메인 + 하위 페이지"""
    result = {"name": name, "url": url, "status": "error", "programs": []}

    ok = await goto_safe(page, url)
    if not ok:
        result["status"] = "timeout"
        return result

    # 메인 페이지 텍스트
    text = await get_page_text(page)
    programs = extract_programs_from_text(text, url, name)

    # 하위 페이지 탐색 (최대 8개)
    sub_links = await find_sub_links(page, url)
    for sub in sub_links[:8]:
        ok = await goto_safe(page, sub["url"], timeout=20000)
        if not ok:
            continue
        sub_text = await get_page_text(page)
        sub_programs = extract_programs_from_text(sub_text, sub["url"], name)
        programs.extend(sub_programs)

    # 중복 제거
    seen = set()
    unique = []
    for p in programs:
        if p["title"] not in seen:
            seen.add(p["title"])
            unique.append(p)

    result["status"] = "ok"
    result["programs"] = unique
    return result


def collect_all_urls() -> list[dict]:
    """url_registry.json + health_center_scan.json에서 모든 URL 수집"""
    targets = []
    seen_urls = set()

    # 1) url_registry.json
    reg_file = DATA_DIR / "url_registry.json"
    if reg_file.exists():
        reg = json.loads(reg_file.read_text(encoding="utf-8"))
        if "regions" in reg:
            for region, data in reg["regions"].items():
                entries = data.get("districts") or data.get("cities") or {}
                for district, info in entries.items():
                    url = info["health_center_url"]
                    if url not in seen_urls:
                        seen_urls.add(url)
                        targets.append({"name": f"{region} {district}", "url": url})

        if "auto_discovered" in reg and "entries" in reg["auto_discovered"]:
            for name, info in reg["auto_discovered"]["entries"].items():
                url = info["health_center_url"]
                if url not in seen_urls:
                    seen_urls.add(url)
                    targets.append({"name": name, "url": url})

    # 2) health_center_scan.json - found 상태인 것 중 registry에 없는 것
    scan_file = DATA_DIR / "health_center_scan.json"
    if scan_file.exists():
        scan = json.loads(scan_file.read_text(encoding="utf-8"))
        for name, result in scan.get("results", {}).items():
            if result.get("status") == "found":
                for u in result.get("urls", []):
                    url = u.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        targets.append({"name": name, "url": url})

    return targets


async def main():
    targets = collect_all_urls()
    print(f"Total targets: {len(targets)}")

    all_programs = []
    raw_results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            locale="ko-KR",
        )

        for i, target in enumerate(targets):
            print(f"[{i+1}/{len(targets)}] {target['name']}")
            page = await context.new_page()
            try:
                result = await crawl_single(page, target["url"], target["name"])
                raw_results.append({
                    "name": result["name"],
                    "url": result["url"],
                    "status": result["status"],
                    "program_count": len(result["programs"]),
                })
                if result["programs"]:
                    all_programs.extend(result["programs"])
                    print(f"  -> {len(result['programs'])} programs")
                else:
                    print(f"  -> {result['status']}")
            except Exception as e:
                print(f"  -> FATAL: {str(e)[:80]}")
                raw_results.append({"name": target["name"], "url": target["url"], "status": "fatal", "program_count": 0})
            finally:
                await page.close()
            await asyncio.sleep(0.5)

        await browser.close()

    # Save
    output = {
        "crawl_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_targets": len(targets),
        "successful": sum(1 for r in raw_results if r["status"] == "ok"),
        "total_programs_found": len(all_programs),
        "programs": all_programs,
        "raw_results": raw_results,
    }

    out_path = DATA_DIR / "health_center_programs.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved: {out_path}")
    print(f"Programs: {len(all_programs)}")

    # Compare with 보조금24
    compare_with_api(all_programs)


def compare_with_api(programs: list[dict]):
    """보조금24 데이터와 비교"""
    api_file = PROJECT_DIR / "momcomfort" / "data" / "pregnancy_benefits_cleaned.json"
    if not api_file.exists():
        print("보조금24 데이터 없음")
        return

    api_data = json.loads(api_file.read_text(encoding="utf-8"))
    api_titles = [b["서비스명"] for b in api_data["data"]]
    api_set = set(t.lower() for t in api_titles)

    # 유사도 비교: 부분 일치
    new_programs = []
    for prog in programs:
        title_lower = prog["title"].lower()
        found = False
        for api_t in api_set:
            # 양방향 부분 일치
            if title_lower in api_t or api_t in title_lower:
                found = True
                break
            # 핵심 단어 겹침
            prog_words = set(title_lower.replace(" ", ""))
            api_words = set(api_t.replace(" ", ""))
            if len(prog_words & api_words) > max(len(prog_words), len(api_words)) * 0.6:
                found = True
                break
        if not found:
            new_programs.append(prog)

    print(f"\n=== 비교 결과 ===")
    print(f"보조금24: {len(api_titles)}건")
    print(f"보건소 크롤링 (유니크): {len(programs)}건")
    print(f"보조금24에 없는 프로그램: {len(new_programs)}건")

    # 지역별 분류
    by_region = {}
    for p in new_programs:
        r = p["region"]
        if r not in by_region:
            by_region[r] = []
        by_region[r].append(p)

    print(f"\n=== 지역별 신규 프로그램 ===")
    for region, progs in sorted(by_region.items()):
        print(f"\n[{region}] ({len(progs)}건)")
        for p in progs[:5]:
            print(f"  - {p['title']}")
            if p["content"]:
                print(f"    {p['content'][:100]}")


if __name__ == "__main__":
    asyncio.run(main())
