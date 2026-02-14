"""전국 보건소 임산부 혜택 페이지 자동 탐색 스크립트

전략:
1. 행정안전부 공공데이터 기반 전국 지자체 목록 활용
2. 지자체별 도메인 패턴으로 보건소 홈페이지 접근
3. 6가지 CMS 패턴으로 임산부/모자보건 메뉴 자동 탐색
4. 결과를 url_registry.json에 저장

사용법:
  python discover_health_urls.py              # 전체 140개 스캔 (depth 2)
  python discover_health_urls.py --depth 3    # 전체 140개 스캔 (depth 3)
  python discover_health_urls.py --rescan     # accessible 사이트만 재스캔 (depth 3)
"""
import json
import sys
import time
import re
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# 세션 설정 (커넥션 재사용)
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
})

# === 전국 지자체 보건소 도메인 목록 ===
# 광역시는 구 단위, 도는 시/군 단위
HEALTH_CENTERS = {
    # === 서울특별시 (25개 구) ===
    "서울 종로구": {"domain": "www.jongno.go.kr", "health_path": "/health"},
    "서울 중구": {"domain": "www.junggu.go.kr", "health_path": "/health"},
    "서울 용산구": {"domain": "www.yongsan.go.kr", "health_path": "/health"},
    "서울 성동구": {"domain": "www.sd.go.kr", "health_path": "/health"},
    "서울 광진구": {"domain": "www.gwangjin.go.kr", "health_path": "/health"},
    "서울 동대문구": {"domain": "www.ddm.go.kr", "health_path": "/health"},
    "서울 중랑구": {"domain": "www.jungnang.go.kr", "health_path": "/health"},
    "서울 성북구": {"domain": "www.sb.go.kr", "health_path": "/health"},
    "서울 강북구": {"domain": "www.gangbuk.go.kr", "health_path": "/health"},
    "서울 도봉구": {"domain": "www.dobong.go.kr", "health_path": "/health"},
    "서울 노원구": {"domain": "www.nowon.kr", "health_path": "/health"},
    "서울 은평구": {"domain": "www.ep.go.kr", "health_path": "/health"},
    "서울 서대문구": {"domain": "www.sdm.go.kr", "health_path": "/health"},
    "서울 마포구": {"domain": "www.mapo.go.kr", "health_path": "/health"},
    "서울 양천구": {"domain": "www.yangcheon.go.kr", "health_path": "/health"},
    "서울 강서구": {"domain": "www.gangseo.seoul.kr", "health_path": "/health"},
    "서울 구로구": {"domain": "www.guro.go.kr", "health_path": "/health"},
    "서울 금천구": {"domain": "www.geumcheon.go.kr", "health_path": "/health"},
    "서울 영등포구": {"domain": "www.ydp.go.kr", "health_path": "/health"},
    "서울 동작구": {"domain": "www.dongjak.go.kr", "health_path": "/health"},
    "서울 관악구": {"domain": "www.gwanak.go.kr", "health_path": "/health"},
    "서울 서초구": {"domain": "www.seocho.go.kr", "health_path": "/site/sh"},
    "서울 강남구": {"domain": "www.gangnam.go.kr", "health_path": "/health"},
    "서울 송파구": {"domain": "www.songpa.go.kr", "health_path": "/health"},
    "서울 강동구": {"domain": "www.gangdong.go.kr", "health_path": "/health"},

    # === 부산광역시 (16개 구/군) ===
    "부산 중구": {"domain": "www.bsjunggu.go.kr", "health_path": "/health"},
    "부산 서구": {"domain": "www.bsseogu.go.kr", "health_path": "/health"},
    "부산 동구": {"domain": "www.bsdonggu.go.kr", "health_path": "/health"},
    "부산 영도구": {"domain": "www.yeongdo.go.kr", "health_path": "/health"},
    "부산 부산진구": {"domain": "www.busanjin.go.kr", "health_path": "/health"},
    "부산 동래구": {"domain": "www.dongnae.go.kr", "health_path": "/health"},
    "부산 남구": {"domain": "www.bsnamgu.go.kr", "health_path": "/health"},
    "부산 북구": {"domain": "www.bsbukgu.go.kr", "health_path": "/health"},
    "부산 해운대구": {"domain": "www.haeundae.go.kr", "health_path": "/health"},
    "부산 사하구": {"domain": "www.saha.go.kr", "health_path": "/health"},
    "부산 금정구": {"domain": "www.geumjeong.go.kr", "health_path": "/health"},
    "부산 강서구": {"domain": "www.bsgangseo.go.kr", "health_path": "/health"},
    "부산 연제구": {"domain": "www.yeonje.go.kr", "health_path": "/health"},
    "부산 수영구": {"domain": "www.suyeong.go.kr", "health_path": "/health"},
    "부산 사상구": {"domain": "www.sasang.go.kr", "health_path": "/health"},
    "부산 기장군": {"domain": "www.gijang.go.kr", "health_path": "/health"},

    # === 대구광역시 (8개 구/군) ===
    "대구 중구": {"domain": "jung.daegu.kr", "health_path": "/health"},
    "대구 동구": {"domain": "dong.daegu.kr", "health_path": "/health"},
    "대구 서구": {"domain": "seogu.daegu.kr", "health_path": "/health"},
    "대구 남구": {"domain": "nam.daegu.kr", "health_path": "/health"},
    "대구 북구": {"domain": "buk.daegu.kr", "health_path": "/health"},
    "대구 수성구": {"domain": "suseong.kr", "health_path": "/health"},
    "대구 달서구": {"domain": "dalseo.daegu.kr", "health_path": "/health"},
    "대구 달성군": {"domain": "dalseong.daegu.kr", "health_path": "/health"},

    # === 인천광역시 (10개 구/군) ===
    "인천 중구": {"domain": "www.icjg.go.kr", "health_path": "/health"},
    "인천 동구": {"domain": "www.icdonggu.go.kr", "health_path": "/health"},
    "인천 미추홀구": {"domain": "www.michuhol.go.kr", "health_path": "/health"},
    "인천 연수구": {"domain": "www.yeonsu.go.kr", "health_path": "/clinic"},
    "인천 남동구": {"domain": "www.namdong.go.kr", "health_path": "/health"},
    "인천 부평구": {"domain": "www.icbp.go.kr", "health_path": "/clinic"},
    "인천 계양구": {"domain": "www.gyeyang.go.kr", "health_path": "/health"},
    "인천 서구": {"domain": "www.seo.incheon.kr", "health_path": "/open_content/clinic"},
    "인천 강화군": {"domain": "www.ganghwa.go.kr", "health_path": "/health"},
    "인천 옹진군": {"domain": "www.ongjin.go.kr", "health_path": "/health"},

    # === 광주광역시 (5개 구) ===
    "광주 동구": {"domain": "www.donggu.kr", "health_path": "/health"},
    "광주 서구": {"domain": "www.seogu.gwangju.kr", "health_path": "/health"},
    "광주 남구": {"domain": "www.namgu.gwangju.kr", "health_path": ""},
    "광주 북구": {"domain": "www.bukgu.gwangju.kr", "health_path": ""},
    "광주 광산구": {"domain": "www.gwangsan.go.kr", "health_path": "/health"},

    # === 대전광역시 (통합) ===
    "대전시": {"domain": "www.daejeon.go.kr", "health_path": "/drh"},

    # === 울산광역시 (5개 구/군) ===
    "울산 중구": {"domain": "www.junggu.ulsan.kr", "health_path": "/health"},
    "울산 남구": {"domain": "www.ulsannamgu.go.kr", "health_path": "/health"},
    "울산 동구": {"domain": "www.donggu.ulsan.kr", "health_path": "/health"},
    "울산 북구": {"domain": "www.bukgu.ulsan.kr", "health_path": "/health"},
    "울산 울주군": {"domain": "www.ulju.ulsan.kr", "health_path": "/health"},

    # === 세종특별자치시 ===
    "세종시": {"domain": "www.sejong.go.kr", "health_path": "/health"},

    # === 경기도 주요 시 ===
    "수원시": {"domain": "www.suwon.go.kr", "health_path": "/sw-health"},
    "성남시": {"domain": "www.seongnam.go.kr", "health_path": "/health"},
    "고양시": {"domain": "www.goyang.go.kr", "health_path": "/health"},
    "용인시": {"domain": "www.yongin.go.kr", "health_path": "/health"},
    "부천시": {"domain": "www.bucheon.go.kr", "health_path": "/health"},
    "안양시": {"domain": "www.anyang.go.kr", "health_path": "/health"},
    "안산시": {"domain": "www.ansan.go.kr", "health_path": "/health"},
    "남양주시": {"domain": "www.nyj.go.kr", "health_path": "/health"},
    "화성시": {"domain": "www.hscity.go.kr", "health_path": "/health"},
    "평택시": {"domain": "www.pyeongtaek.go.kr", "health_path": "/health"},
    "의정부시": {"domain": "www.ui4u.go.kr", "health_path": "/health"},
    "시흥시": {"domain": "www.siheung.go.kr", "health_path": "/health"},
    "파주시": {"domain": "www.paju.go.kr", "health_path": "/health"},
    "김포시": {"domain": "www.gimpo.go.kr", "health_path": "/health"},
    "광명시": {"domain": "www.gm.go.kr", "health_path": "/health"},
    "광주시(경기)": {"domain": "www.gjcity.go.kr", "health_path": "/health"},
    "군포시": {"domain": "www.gunpo.go.kr", "health_path": "/health"},
    "하남시": {"domain": "www.hanam.go.kr", "health_path": "/health"},
    "오산시": {"domain": "www.osan.go.kr", "health_path": "/health"},
    "이천시": {"domain": "www.icheon.go.kr", "health_path": "/health"},
    "구리시": {"domain": "www.guri.go.kr", "health_path": "/health"},
    "양주시": {"domain": "www.yangju.go.kr", "health_path": "/health"},
    "안성시": {"domain": "www.anseong.go.kr", "health_path": "/health"},
    "포천시": {"domain": "www.pocheon.go.kr", "health_path": "/health"},
    "의왕시": {"domain": "www.uiwang.go.kr", "health_path": "/health"},
    "여주시": {"domain": "www.yeoju.go.kr", "health_path": "/health"},
    "양평군": {"domain": "www.yangpyeong.go.kr", "health_path": "/health"},
    "동두천시": {"domain": "www.ddc.go.kr", "health_path": "/health"},
    "과천시": {"domain": "www.gcity.go.kr", "health_path": "/health"},
    "가평군": {"domain": "www.gp.go.kr", "health_path": "/health"},
    "연천군": {"domain": "www.yeoncheon.go.kr", "health_path": "/health"},

    # === 강원특별자치도 주요 시 ===
    "춘천시": {"domain": "www.chuncheon.go.kr", "health_path": ""},
    "원주시": {"domain": "www.wonju.go.kr", "health_path": "/health"},
    "강릉시": {"domain": "www.gangneung.go.kr", "health_path": "/health"},

    # === 충청북도 주요 시 ===
    "청주시": {"domain": "www.cheongju.go.kr", "health_path": "/sdhealth"},
    "충주시": {"domain": "www.chungju.go.kr", "health_path": "/health"},
    "제천시": {"domain": "www.jecheon.go.kr", "health_path": "/health"},

    # === 충청남도 주요 시 ===
    "천안시": {"domain": "www.cheonan.go.kr", "health_path": "/shealth"},
    "아산시": {"domain": "www.asan.go.kr", "health_path": "/health"},
    "서산시": {"domain": "www.seosan.go.kr", "health_path": "/health"},
    "논산시": {"domain": "www.nonsan.go.kr", "health_path": "/health"},
    "당진시": {"domain": "www.dangjin.go.kr", "health_path": "/health"},
    "공주시": {"domain": "www.gongju.go.kr", "health_path": "/health"},
    "보령시": {"domain": "www.boryeong.go.kr", "health_path": "/health"},

    # === 전북특별자치도 주요 시 ===
    "전주시": {"domain": "www.jeonju.go.kr", "health_path": ""},
    "군산시": {"domain": "www.gunsan.go.kr", "health_path": "/health"},
    "익산시": {"domain": "www.iksan.go.kr", "health_path": "/health"},
    "정읍시": {"domain": "www.jeongeup.go.kr", "health_path": "/health"},
    "남원시": {"domain": "www.namwon.go.kr", "health_path": "/health"},

    # === 전라남도 주요 시 ===
    "목포시": {"domain": "www.mokpo.go.kr", "health_path": "/health"},
    "여수시": {"domain": "www.yeosu.go.kr", "health_path": "/health"},
    "순천시": {"domain": "www.suncheon.go.kr", "health_path": "/health"},
    "나주시": {"domain": "www.naju.go.kr", "health_path": "/health"},

    # === 경상북도 주요 시 ===
    "포항시": {"domain": "www.pohang.go.kr", "health_path": "/health"},
    "경주시": {"domain": "www.gyeongju.go.kr", "health_path": "/health"},
    "구미시": {"domain": "www.gumi.go.kr", "health_path": "/health"},
    "김천시": {"domain": "www.gc.go.kr", "health_path": "/ghc"},
    "안동시": {"domain": "www.andong.go.kr", "health_path": "/health"},
    "영주시": {"domain": "www.yeongju.go.kr", "health_path": "/health"},
    "상주시": {"domain": "www.sangju.go.kr", "health_path": "/health"},

    # === 경상남도 주요 시 ===
    "창원시": {"domain": "www.changwon.go.kr", "health_path": "/depart"},
    "진주시": {"domain": "www.jinju.go.kr", "health_path": "/health"},
    "김해시": {"domain": "www.gimhae.go.kr", "health_path": "/health"},
    "양산시": {"domain": "www.yangsan.go.kr", "health_path": "/health"},
    "거제시": {"domain": "www.geoje.go.kr", "health_path": "/health"},
    "통영시": {"domain": "www.tongyeong.go.kr", "health_path": "/health"},
    "밀양시": {"domain": "www.miryang.go.kr", "health_path": "/health"},

    # === 제주특별자치도 ===
    "제주시": {"domain": "www.jejusi.go.kr", "health_path": "/chc"},
    "서귀포시": {"domain": "www.seogwipo.go.kr", "health_path": "/health"},
}

# 임산부/모자보건 관련 키워드
PREGNANCY_KEYWORDS = [
    "모자보건", "임산부", "임신", "출산", "산모", "신생아",
    "난임", "불임", "태아", "산전", "엽산", "철분",
    "모성", "영유아", "maternal", "pregnancy",
]

# 메뉴 링크에서 임산부 관련 URL 찾기 (최종 목표)
MENU_KEYWORDS = [
    "모자보건", "임산부", "임신출산", "출산지원", "산모",
    "모자건강", "임신·출산", "임신 출산", "임신ㆍ출산",
    "난임", "산전", "출산축하", "모성건강",
    # 2차 재스캔에서 발견한 추가 키워드
    "행복출산", "출산장려", "출산정보", "출산양육",
    "영유아", "신생아", "아이조아",
]

# 중간 메뉴 키워드 (depth 2~3에서 하위 메뉴를 따라가기 위한 키워드)
MID_MENU_KEYWORDS = [
    "보건사업", "사업안내", "건강증진", "보건서비스",
    "건강관리", "보건의료", "가족건강", "생애주기",
    "여성건강", "주민건강", "건강지원", "건강생활",
    "보건복지", "복지서비스", "주요사업", "분야별",
    # 보건소 별도 진입점 (시청 메인에서 보건소로 점프)
    "보건소", "보건센터",
    # 복지 포털 메뉴
    "맞춤형복지", "출산양육", "복지안내",
]


def classify_pattern(url):
    """URL 패턴 분류"""
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
    else:
        return "unknown"


def find_pregnancy_links(html, base_url):
    """HTML에서 임산부/모자보건 관련 링크 추출"""
    soup = BeautifulSoup(html, "html.parser")
    found = []

    for link in soup.find_all("a", href=True):
        text = link.get_text(strip=True)
        href = link.get("href", "")

        # 키워드 매칭
        if any(kw in text for kw in MENU_KEYWORDS):
            full_url = urljoin(base_url, href)
            found.append({
                "text": text,
                "url": full_url,
                "pattern": classify_pattern(full_url),
            })

    return found


def find_mid_menu_links(html, base_url):
    """HTML에서 중간 메뉴 링크 추출 (보건사업, 건강증진 등)"""
    soup = BeautifulSoup(html, "html.parser")
    found = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        text = link.get_text(strip=True)
        href = link.get("href", "")
        if not href or href.startswith("#") or href.startswith("javascript"):
            continue

        if any(kw in text for kw in MID_MENU_KEYWORDS):
            full_url = urljoin(base_url, href)
            if full_url not in seen_urls:
                seen_urls.add(full_url)
                found.append({"text": text, "url": full_url})

    return found


def try_health_page(name, info, timeout=10, max_depth=3):
    """보건소 페이지 접근 시도 및 임산부 관련 링크 탐색 (depth 조절 가능)"""
    domain = info["domain"]
    health_path = info["health_path"]
    results = {"name": name, "domain": domain, "status": "failed", "urls": [], "search_depth": max_depth}

    # 시도할 URL 목록
    base_urls = []

    # 1순위: https 보건소 경로
    if health_path:
        base_urls.append(f"https://{domain}{health_path}/main.do")
        base_urls.append(f"https://{domain}{health_path}/index.do")
        base_urls.append(f"https://{domain}{health_path}")
    # 2순위: 메인 사이트
    base_urls.append(f"https://{domain}")
    # 3순위: http fallback
    if health_path:
        base_urls.append(f"http://{domain}{health_path}/main.do")
        base_urls.append(f"http://{domain}{health_path}")

    for url in base_urls:
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True, verify=False)
            if resp.status_code == 200 and len(resp.text) > 500:
                # depth 1: 메인 페이지에서 임산부 링크 검색
                links = find_pregnancy_links(resp.text, resp.url)
                if links:
                    results["status"] = "found"
                    results["accessed_url"] = resp.url
                    results["urls"] = links
                    results["found_at_depth"] = 1
                    return results

                # 페이지 접근 가능하지만 임산부 링크 미발견
                results["status"] = "accessible"
                results["accessed_url"] = resp.url

                if max_depth < 2:
                    return results

                # depth 2: 중간 메뉴 따라가기
                mid_links = find_mid_menu_links(resp.text, resp.url)

                for mid in mid_links[:5]:
                    try:
                        mid_resp = session.get(mid["url"], timeout=timeout, allow_redirects=True, verify=False)
                        if mid_resp.status_code != 200:
                            continue

                        # depth 2에서 임산부 링크 검색
                        found = find_pregnancy_links(mid_resp.text, mid_resp.url)
                        if found:
                            results["status"] = "found"
                            results["accessed_url"] = mid_resp.url
                            results["urls"] = found
                            results["found_at_depth"] = 2
                            results["via_menu"] = mid["text"]
                            return results

                        if max_depth < 3:
                            continue

                        # depth 3: 중간 메뉴의 하위 메뉴 탐색
                        sub_mid_links = find_mid_menu_links(mid_resp.text, mid_resp.url)

                        # 하위 중간 메뉴 따라가기
                        for sub_mid in sub_mid_links[:3]:
                            try:
                                sub_resp = session.get(sub_mid["url"], timeout=timeout, allow_redirects=True, verify=False)
                                if sub_resp.status_code != 200:
                                    continue

                                found = find_pregnancy_links(sub_resp.text, sub_resp.url)
                                if found:
                                    results["status"] = "found"
                                    results["accessed_url"] = sub_resp.url
                                    results["urls"] = found
                                    results["found_at_depth"] = 3
                                    results["via_menu"] = f"{mid['text']} → {sub_mid['text']}"
                                    return results
                            except Exception:
                                continue

                    except Exception:
                        continue

                return results
        except Exception:
            continue

    return results


def get_rescan_targets():
    """이전 스캔에서 'accessible' 상태였던 사이트 목록 반환"""
    scan_file = DATA_DIR / "health_center_scan.json"
    if not scan_file.exists():
        print("이전 스캔 결과 없음. 전체 스캔을 실행하세요.")
        return {}

    with open(scan_file, "r", encoding="utf-8") as f:
        prev = json.load(f)

    targets = {}
    for name, result in prev.get("results", {}).items():
        if result.get("status") == "accessible" and name in HEALTH_CENTERS:
            targets[name] = HEALTH_CENTERS[name]

    return targets


def main():
    # CLI 옵션 파싱
    rescan_mode = "--rescan" in sys.argv
    depth = 3 if rescan_mode else 2  # rescan은 기본 depth 3
    for arg in sys.argv:
        if arg.startswith("--depth"):
            idx = sys.argv.index(arg)
            if idx + 1 < len(sys.argv):
                depth = int(sys.argv[idx + 1])

    if rescan_mode:
        targets = get_rescan_targets()
        if not targets:
            return
        print(f"=== 재스캔 모드 (depth {depth}) ===")
        print(f"대상: {len(targets)}개 (이전 'accessible' 사이트)\n")
    else:
        targets = HEALTH_CENTERS
        print(f"=== 전국 보건소 임산부 혜택 URL 자동 탐색 (depth {depth}) ===")
        print(f"대상: {len(targets)}개 지자체\n")

    # suppress SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    all_results = {}
    found_count = 0
    accessible_count = 0
    failed_count = 0

    # 병렬 실행 (동시 5개)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(try_health_page, name, info, 10, depth): name
            for name, info in targets.items()
        }

        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result()
                all_results[name] = result

                if result["status"] == "found":
                    found_count += 1
                    top = result["urls"][0]
                    d = result.get("found_at_depth", "?")
                    via = result.get("via_menu", "")
                    via_str = f" (via: {via})" if via else ""
                    print(f"  [O] {name}: {top['text']} → {top['url']} (패턴 {top['pattern']}, depth {d}{via_str})")
                elif result["status"] == "accessible":
                    accessible_count += 1
                    print(f"  [△] {name}: depth {depth}까지 탐색했지만 임산부 메뉴 미발견")
                else:
                    failed_count += 1
                    print(f"  [X] {name}: 접근 실패")
            except Exception as e:
                failed_count += 1
                all_results[name] = {"name": name, "status": "error", "error": str(e)}
                print(f"  [!] {name}: 오류 - {str(e)[:50]}")

    # 통계
    print(f"\n=== 결과 ===")
    print(f"발견 (URL 확인): {found_count}개")
    print(f"접근만 가능: {accessible_count}개")
    print(f"실패: {failed_count}개")
    print(f"총: {len(all_results)}개")

    # 패턴별 통계
    pattern_counts = {}
    for r in all_results.values():
        if r["status"] == "found":
            for u in r["urls"]:
                p = u["pattern"]
                pattern_counts[p] = pattern_counts.get(p, 0) + 1

    print(f"\n--- 패턴별 분포 ---")
    for p, c in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        print(f"  패턴 {p}: {c}건")

    # JSON 저장
    output_file = DATA_DIR / "health_center_scan.json"

    if rescan_mode and output_file.exists():
        # rescan: 기존 결과에 머지
        with open(output_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing["results"].update(all_results)
        # 새로 found된 것 반영하여 통계 재계산
        new_found = sum(1 for r in existing["results"].values() if r.get("status") == "found")
        new_acc = sum(1 for r in existing["results"].values() if r.get("status") == "accessible")
        new_fail = len(existing["results"]) - new_found - new_acc
        existing["rescan_date"] = time.strftime("%Y-%m-%d %H:%M:%S")
        existing["rescan_depth"] = depth
        existing["found"] = new_found
        existing["accessible"] = new_acc
        existing["failed"] = new_fail
        existing["pattern_counts"] = pattern_counts
        output = existing
        print(f"\n이번 재스캔으로 {found_count}개 신규 발견! (전체: {new_found}개 found)")
    else:
        output = {
            "scan_date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "scan_depth": depth,
            "total_scanned": len(all_results),
            "found": found_count,
            "accessible": accessible_count,
            "failed": failed_count,
            "pattern_counts": pattern_counts,
            "results": all_results,
        }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"결과 저장: {output_file}")

    # url_registry.json 업데이트
    update_registry(all_results)


def update_registry(scan_results):
    """스캔 결과를 url_registry.json에 반영"""
    registry_file = DATA_DIR / "url_registry.json"

    if registry_file.exists():
        with open(registry_file, "r", encoding="utf-8") as f:
            registry = json.load(f)
    else:
        registry = {"meta": {}, "regions": {}}

    # auto_discovered 섹션 추가
    registry["auto_discovered"] = {
        "scan_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "entries": {},
    }

    for name, result in scan_results.items():
        if result["status"] == "found" and result["urls"]:
            top = result["urls"][0]
            registry["auto_discovered"]["entries"][name] = {
                "health_center_url": top["url"],
                "pattern": top["pattern"],
                "menu_text": top["text"],
                "verified": False,
                "all_matches": [
                    {"text": u["text"], "url": u["url"], "pattern": u["pattern"]}
                    for u in result["urls"]
                ],
            }

    with open(registry_file, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

    found = len(registry.get("auto_discovered", {}).get("entries", {}))
    print(f"url_registry.json 업데이트: {found}개 자동 발견 항목 추가")


if __name__ == "__main__":
    main()
