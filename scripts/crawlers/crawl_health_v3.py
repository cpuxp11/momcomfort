"""보건소 임산부 프로그램 크롤러 v3.

requests + BeautifulSoup 기반. 빠르고 안정적.
Playwright 없이 대부분의 보건소 CMS에서 프로그램 정보 추출.
"""
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

# 임산부 관련 키워드
PROGRAM_KEYWORDS = [
    "임산부", "임신", "출산", "산모", "난임", "엽산", "철분",
    "기형아", "산전", "산후", "태교", "모유수유", "유축기",
    "신생아", "영유아", "출산축하", "첫만남", "모자보건",
    "산모신생아", "출산준비", "출산지원", "행복출산",
    "임신확인", "고위험", "산후조리", "모성건강",
]

# 노이즈 패턴 (제외할 것)
NOISE_PATTERNS = re.compile(
    r"(전화번호|문의처|상담전화|팩스|FAX|주소|오시는|찾아오|"
    r"개인정보|저작권|copyright|footer|사이트맵|"
    r"\d{2,3}-\d{3,4}-\d{4}|"  # phone numbers
    r"^\d+$|"  # just numbers
    r"^[가-힣]{1,2}$)",  # 1-2 char Korean
    re.IGNORECASE,
)


def load_urls():
    """url_registry.json에서 모든 보건소 URL 수집"""
    reg = json.loads((DATA_DIR / "url_registry.json").read_text(encoding="utf-8"))
    targets = []

    for rname, rdata in reg.get("regions", {}).items():
        entries = rdata.get("districts", rdata.get("cities", {}))
        for dname, info in entries.items():
            targets.append({
                "region": rname,
                "district": dname,
                "url": info["health_center_url"],
                "pattern": info["pattern"],
            })

    auto = reg.get("auto_discovered", {}).get("entries", {})
    for name, info in auto.items():
        parts = name.split(" ")
        region = parts[0] if len(parts) > 1 else "기타"
        district = " ".join(parts[1:]) if len(parts) > 1 else name
        # Skip if already exists
        exists = any(t["district"] == district for t in targets)
        if exists:
            continue
        targets.append({
            "region": region,
            "district": district,
            "url": info["health_center_url"],
            "pattern": info["pattern"],
        })

    return targets


def fetch_page(url, timeout=15):
    """URL에서 HTML 가져오기"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, verify=False)
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text
    except Exception as e:
        return None


def extract_programs_from_html(html, base_url):
    """HTML에서 임산부 프로그램 정보 추출"""
    soup = BeautifulSoup(html, "html.parser")
    programs = []

    # Remove script, style, nav, footer, header
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Strategy 1: 테이블에서 추출 (가장 정확)
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # 헤더 찾기
        header_row = rows[0]
        headers = [th.get_text(strip=True) for th in header_row.find_all(["th", "td"])]

        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if not cells:
                continue

            row_text = " ".join(cells)
            # 키워드 매칭
            if any(kw in row_text for kw in PROGRAM_KEYWORDS):
                title = cells[0] if cells else ""
                content = " | ".join(cells[1:]) if len(cells) > 1 else ""
                if title and len(title) > 3 and not NOISE_PATTERNS.search(title):
                    programs.append({
                        "title": title[:200],
                        "content": content[:500],
                        "source": "table",
                    })

    # Strategy 2: 구조화된 콘텐츠 블록 (dl/dt/dd, h3+p, etc.)
    # dl > dt/dd 패턴
    for dl in soup.find_all("dl"):
        dts = dl.find_all("dt")
        dds = dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            title = dt.get_text(strip=True)
            content = dd.get_text(strip=True)
            combined = title + " " + content
            if any(kw in combined for kw in PROGRAM_KEYWORDS):
                if title and len(title) > 3 and not NOISE_PATTERNS.search(title):
                    programs.append({
                        "title": title[:200],
                        "content": content[:500],
                        "source": "dl",
                    })

    # Strategy 3: 제목+본문 패턴 (h2/h3/h4 + 다음 형제)
    for heading in soup.find_all(["h2", "h3", "h4", "strong"]):
        title = heading.get_text(strip=True)
        if not any(kw in title for kw in PROGRAM_KEYWORDS):
            continue
        if len(title) < 3 or NOISE_PATTERNS.search(title):
            continue

        # 다음 형제에서 본문 추출
        content_parts = []
        sibling = heading.find_next_sibling()
        for _ in range(5):  # max 5 siblings
            if sibling is None:
                break
            if sibling.name in ["h2", "h3", "h4"]:
                break
            text = sibling.get_text(strip=True)
            if text:
                content_parts.append(text)
            sibling = sibling.find_next_sibling()

        content = " ".join(content_parts)[:500]
        programs.append({
            "title": title[:200],
            "content": content,
            "source": "heading",
        })

    # Strategy 4: 리스트(li)에서 프로그램 추출
    for li in soup.find_all("li"):
        text = li.get_text(strip=True)
        if len(text) < 10 or len(text) > 300:
            continue
        if any(kw in text for kw in PROGRAM_KEYWORDS):
            if not NOISE_PATTERNS.search(text):
                # 첫 문장을 title로
                parts = re.split(r"[:\-–—]", text, maxsplit=1)
                title = parts[0].strip()
                content = parts[1].strip() if len(parts) > 1 else ""
                if title and len(title) > 3:
                    programs.append({
                        "title": title[:200],
                        "content": content[:500],
                        "source": "list",
                    })

    # Strategy 5: 본문 전체에서 키워드 포함 단락 추출 (fallback)
    if not programs:
        # 메인 콘텐츠 영역 찾기
        main = soup.find(["main", "article"]) or soup.find(class_=re.compile(r"content|cont|sub_cont|board"))
        if main is None:
            main = soup.find("body") or soup

        paragraphs = main.find_all(["p", "div"], recursive=False)
        if not paragraphs:
            paragraphs = main.find_all(["p", "div"])

        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) < 20 or len(text) > 1000:
                continue
            if any(kw in text for kw in PROGRAM_KEYWORDS):
                if not NOISE_PATTERNS.search(text[:50]):
                    parts = re.split(r"[:\-–—]", text, maxsplit=1)
                    title = parts[0].strip()[:200]
                    content = parts[1].strip()[:500] if len(parts) > 1 else ""
                    programs.append({
                        "title": title,
                        "content": content,
                        "source": "paragraph",
                    })

    return programs


def find_subpage_links(html, base_url):
    """서브페이지 링크 찾기 (모자보건 하위 메뉴)"""
    soup = BeautifulSoup(html, "html.parser")
    links = []
    seen = set()

    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = a["href"]

        if not text or len(text) < 2:
            continue
        # 임산부 관련 메뉴 링크만
        if not any(kw in text for kw in PROGRAM_KEYWORDS[:15]):
            continue

        full_url = urljoin(base_url, href)
        if full_url in seen or full_url == base_url:
            continue
        # 같은 도메인만
        if base_url.split("/")[2] not in full_url:
            continue

        seen.add(full_url)
        links.append({"text": text, "url": full_url})

    return links[:10]  # max 10 sub-pages


def deduplicate(programs):
    """프로그램 중복 제거"""
    seen_titles = set()
    unique = []
    for p in programs:
        title_key = re.sub(r"\s+", "", p["title"])[:30]
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)
        unique.append(p)
    return unique


def crawl_one_site(target):
    """한 보건소 사이트 크롤링"""
    url = target["url"]
    name = f"{target['region']} {target['district']}"
    all_programs = []

    # 메인 페이지
    html = fetch_page(url)
    if not html:
        return {"name": name, "url": url, "status": "fail", "programs": [], "error": "fetch failed"}

    programs = extract_programs_from_html(html, url)
    all_programs.extend(programs)

    # 서브페이지 링크 찾기
    sublinks = find_subpage_links(html, url)
    for link in sublinks[:5]:  # max 5 sub-pages
        time.sleep(0.5)
        sub_html = fetch_page(link["url"])
        if sub_html:
            sub_programs = extract_programs_from_html(sub_html, link["url"])
            for sp in sub_programs:
                sp["sub_page"] = link["text"]
            all_programs.extend(sub_programs)

    # 중복 제거
    unique_programs = deduplicate(all_programs)

    return {
        "name": name,
        "url": url,
        "status": "ok",
        "programs": unique_programs,
        "subpages_crawled": len(sublinks),
    }


def load_api_benefits():
    """보조금24 API 데이터 로드"""
    api_file = PROJECT_DIR / "momcomfort" / "data" / "pregnancy_benefits_cleaned.json"
    if not api_file.exists():
        return []
    data = json.loads(api_file.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return data.get("benefits", data.get("data", []))
    return data


def compare_with_api(crawled_programs, api_benefits):
    """크롤링 결과와 보조금24 비교 → 누락된 프로그램 식별"""
    # API 데이터의 제목 리스트
    api_titles = set()
    for b in api_benefits:
        title = b.get("서비스명", b.get("title", ""))
        api_titles.add(title)
        # 키워드도 추출
        api_titles.add(re.sub(r"\s+", "", title))

    # 크롤링 결과 중 API에 없는 것 찾기
    missing = []
    matched = []
    for prog in crawled_programs:
        prog_title_clean = re.sub(r"\s+", "", prog["title"])
        # API에 유사한 제목이 있는지 확인
        found = False
        for api_t in api_titles:
            api_clean = re.sub(r"\s+", "", api_t)
            # 부분 일치
            if (prog_title_clean in api_clean or api_clean in prog_title_clean
                    or len(set(prog_title_clean) & set(api_clean)) / max(len(prog_title_clean), 1) > 0.6):
                found = True
                break
        if found:
            matched.append(prog)
        else:
            missing.append(prog)

    return missing, matched


def main():
    import warnings
    warnings.filterwarnings("ignore")  # suppress SSL warnings

    print("=== 보건소 임산부 프로그램 크롤러 v3 ===")
    print()

    targets = load_urls()
    print(f"크롤링 대상: {len(targets)}개 보건소")
    print()

    all_programs = []
    results = []

    # 병렬 크롤링 (5 threads)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(crawl_one_site, t): t for t in targets}
        for i, future in enumerate(as_completed(futures), 1):
            target = futures[future]
            name = f"{target['region']} {target['district']}"
            try:
                result = future.result()
                results.append(result)
                prog_count = len(result["programs"])
                status = "OK" if result["status"] == "ok" else "FAIL"
                print(f"  [{i}/{len(targets)}] {name}: {status} ({prog_count}개 프로그램)")
                if result["status"] == "ok":
                    for p in result["programs"]:
                        p["region"] = name
                        p["source_url"] = result["url"]
                    all_programs.extend(result["programs"])
            except Exception as e:
                print(f"  [{i}/{len(targets)}] {name}: ERROR ({e})")
                results.append({"name": name, "status": "error", "programs": [], "error": str(e)})

    # 전체 중복 제거
    all_programs = deduplicate(all_programs)

    print()
    print(f"=== 결과 ===")
    print(f"성공: {sum(1 for r in results if r['status'] == 'ok')}/{len(targets)}")
    print(f"총 프로그램: {len(all_programs)}개")

    # 보조금24 데이터와 비교
    api_benefits = load_api_benefits()
    if api_benefits:
        missing, matched = compare_with_api(all_programs, api_benefits)
        print(f"\n보조금24에 있는 것: {len(matched)}개")
        print(f"보조금24에 없는 것 (보건소만의 프로그램): {len(missing)}개")

        if missing:
            print("\n--- 보건소만의 프로그램 (상위 30개) ---")
            for p in missing[:30]:
                print(f"  [{p['region']}] {p['title']}")
                if p.get("content"):
                    print(f"    → {p['content'][:80]}")
    else:
        missing = all_programs
        print("\n(보조금24 데이터 없음 - 비교 생략)")

    # 결과 저장
    output = {
        "crawl_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "v3",
        "total_targets": len(targets),
        "successful": sum(1 for r in results if r["status"] == "ok"),
        "total_programs_found": len(all_programs),
        "missing_from_api": len(missing) if api_benefits else -1,
        "programs": all_programs,
        "missing_programs": missing if api_benefits else [],
        "site_results": [
            {"name": r["name"], "status": r["status"], "program_count": len(r["programs"])}
            for r in results
        ],
    }

    out_path = DATA_DIR / "health_center_programs.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과 저장: {out_path}")


if __name__ == "__main__":
    main()
