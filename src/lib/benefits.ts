import benefitsJson from '../../data/pregnancy_benefits_cleaned.json';
import type { Benefit, BenefitCard, BenefitsData, Category } from '@/types/benefit';
import type { RegionHierarchy } from '@/types/region';

const data = benefitsJson as BenefitsData;

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
] as const;

// Non-standard org names → region mapping
const REGION_NORMALIZE: Record<string, { sido: string; sigungu: string }> = {
  '용산구시설관리공단': { sido: '서울특별시', sigungu: '용산구' },
  '동작구시설관리공단': { sido: '서울특별시', sigungu: '동작구' },
  '(재)달성교육재단': { sido: '대구광역시', sigungu: '달성군' },
  '대구도시개발공사': { sido: '대구광역시', sigungu: '' },
  '재단법인화성푸드통합지원센터': { sido: '경기도', sigungu: '화성시' },
  '울산연구원': { sido: '울산광역시', sigungu: '' },
  '(재)인천인재평생교육진흥원': { sido: '인천광역시', sigungu: '' },
  '기장군도시관리공단': { sido: '부산광역시', sigungu: '기장군' },
  '남양주시복지재단': { sido: '경기도', sigungu: '남양주시' },
  '재단법인시흥시청소년청년재단': { sido: '경기도', sigungu: '시흥시' },
  '재단법인의왕시청소년재단': { sido: '경기도', sigungu: '의왕시' },
  '인천도시공사': { sido: '인천광역시', sigungu: '' },
};

function parseSidoSigungu(orgName: string, orgType: string, region: string): { sido: string; sigungu: string } {
  // National-level benefits
  if (region === '전국' || orgType === '중앙행정기관' || orgType === '공공기관') {
    return { sido: '전국', sigungu: '' };
  }

  // Check normalize map
  if (REGION_NORMALIZE[orgName]) {
    return REGION_NORMALIZE[orgName];
  }

  // Try to extract from 소관기관명
  const sido = SIDO_LIST.find(s => orgName.includes(s)) || '';
  if (sido) {
    const afterSido = orgName.replace(sido, '').trim();
    const parts = afterSido.split(/[\s]/);
    const sigungu = parts[0] || '';
    return { sido, sigungu };
  }

  // Fallback: use _region
  if (region && region !== '전국') {
    const sidoFromRegion = SIDO_LIST.find(s => region.includes(s)) || region;
    return { sido: sidoFromRegion, sigungu: '' };
  }

  return { sido: '전국', sigungu: '' };
}

function toBenefitCard(b: Benefit): BenefitCard {
  const { sido, sigungu } = parseSidoSigungu(b.소관기관명, b.소관기관유형, b._region);
  return {
    id: b.서비스ID,
    title: b.서비스명,
    summary: b.서비스목적요약,
    content: b.지원내용,
    target: b.지원대상,
    categories: b._categories,
    region: b._region,
    orgName: b.소관기관명,
    orgType: b.소관기관유형,
    detailUrl: b.상세조회URL,
    sido,
    sigungu,
    applyMethod: b.신청방법,
    phone: b.전화문의,
  };
}

let _allCards: BenefitCard[] | null = null;

export function getAllBenefits(): BenefitCard[] {
  if (!_allCards) {
    _allCards = data.data.map(toBenefitCard);
  }
  return _allCards;
}

export function getBenefitById(id: string): Benefit | undefined {
  return data.data.find(b => b.서비스ID === id);
}

export function getTotalCount(): number {
  return data.total_count;
}

export function getFetchDate(): string {
  return data.fetch_date;
}

export function getCategoryCounts(): Record<string, number> {
  return data.category_counts;
}

export interface FilterOptions {
  sido?: string;
  sigungu?: string;
  categories?: Category[];
  query?: string;
}

export function filterBenefits(opts: FilterOptions): BenefitCard[] {
  let results = getAllBenefits();

  // Region filter: show national + sido-level + sigungu-level
  if (opts.sido && opts.sido !== '전체') {
    results = results.filter(b => {
      if (b.sido === '전국') return true;
      if (b.sido !== opts.sido) return false;
      if (opts.sigungu && opts.sigungu !== '전체') {
        return b.sigungu === '' || b.sigungu === opts.sigungu;
      }
      return true;
    });
  }

  // Category filter
  if (opts.categories && opts.categories.length > 0) {
    results = results.filter(b =>
      opts.categories!.some(c => b.categories.includes(c))
    );
  }

  // Text search
  if (opts.query && opts.query.trim()) {
    const q = opts.query.trim().toLowerCase();
    results = results.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.summary.toLowerCase().includes(q) ||
      b.content.toLowerCase().includes(q)
    );
  }

  return results;
}

let _hierarchy: RegionHierarchy | null = null;

export function getRegionHierarchy(): RegionHierarchy {
  if (_hierarchy) return _hierarchy;

  const cards = getAllBenefits();
  const map: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};

  for (const card of cards) {
    if (card.sido === '전국') continue;
    if (!map[card.sido]) {
      map[card.sido] = new Set();
      counts[card.sido] = 0;
    }
    if (card.sigungu) {
      map[card.sido].add(card.sigungu);
    }
    counts[card.sido]++;
  }

  _hierarchy = {};
  for (const sido of SIDO_LIST) {
    if (map[sido]) {
      _hierarchy[sido] = {
        districts: Array.from(map[sido]).sort(),
        benefitCount: counts[sido] || 0,
      };
    }
  }

  return _hierarchy;
}

export function getAllSido(): string[] {
  return Object.keys(getRegionHierarchy());
}

export function getSigunguBySido(sido: string): string[] {
  return getRegionHierarchy()[sido]?.districts || [];
}

export function getRelatedBenefits(benefit: Benefit, limit = 4): BenefitCard[] {
  const cards = getAllBenefits();
  const { sido, sigungu } = parseSidoSigungu(benefit.소관기관명, benefit.소관기관유형, benefit._region);

  return cards
    .filter(c => c.id !== benefit.서비스ID)
    .filter(c => {
      const sameRegion = c.sido === sido || c.sido === '전국';
      const sameCategory = c.categories.some(cat => benefit._categories.includes(cat));
      return sameRegion && sameCategory;
    })
    .slice(0, limit);
}

export { SIDO_LIST };
