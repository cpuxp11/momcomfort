import type { BenefitCard } from '@/types/benefit';

export type TimelinePhase = '임신준비' | '임신초기' | '임신중기' | '임신후기' | '출산' | '양육';

export const TIMELINE_PHASES: TimelinePhase[] = [
  '임신준비', '임신초기', '임신중기', '임신후기', '출산', '양육',
];

export interface PhaseConfig {
  label: string;
  weekRange: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const PHASE_CONFIG: Record<TimelinePhase, PhaseConfig> = {
  '임신준비': {
    label: '임신 준비',
    weekRange: '임신 전',
    icon: '💝',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    description: '난임 치료, 건강검진 등',
  },
  '임신초기': {
    label: '임신 초기',
    weekRange: '1~12주',
    icon: '🌱',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    description: '엽산·철분 수령, 진료비 바우처 등',
  },
  '임신중기': {
    label: '임신 중기',
    weekRange: '13~27주',
    icon: '🤰',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300',
    description: '교통비, 건강관리 바우처, 산전검사 등',
  },
  '임신후기': {
    label: '임신 후기',
    weekRange: '28~40주',
    icon: '🍼',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    description: '출산 준비, 산후조리 예약 등',
  },
  '출산': {
    label: '출산',
    weekRange: '출산 시점',
    icon: '👶',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    description: '출산축하금, 첫만남이용권, 출생신고 등',
  },
  '양육': {
    label: '양육',
    weekRange: '출산 후',
    icon: '👨‍👩‍👧',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    description: '아동수당, 육아휴직, 보육료 지원 등',
  },
};

const PHASE_KEYWORDS: Record<TimelinePhase, string[]> = {
  '임신준비': ['난임', '시술비', '인공수정', '체외수정', '난임휴가', '가임'],
  '임신초기': ['엽산', '철분', '기형아', '임신확인', '임산부등록', '진료비', '임신바우처'],
  '임신중기': ['교통비', '건강관리', '산전검사', '정밀초음파', '바우처'],
  '임신후기': ['산모', '산후조리', '출산준비', '산모신생아', '산후'],
  '출산': ['출산축하', '출생', '신생아', '첫만남', '출산지원', '행복출산', '분만', '출산장려'],
  '양육': ['아동수당', '어린이집', '보육', '육아휴직', '영유아', '양육수당', '돌봄'],
};

export function assignPhase(benefit: BenefitCard): TimelinePhase {
  const text = (benefit.title + ' ' + benefit.summary + ' ' + benefit.content).toLowerCase();

  let bestPhase: TimelinePhase | null = null;
  let bestScore = 0;

  for (const phase of TIMELINE_PHASES) {
    const keywords = PHASE_KEYWORDS[phase];
    const score = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  if (bestPhase && bestScore > 0) return bestPhase;

  // Fallback: use existing _categories
  if (benefit.categories.includes('양육')) return '양육';
  if (benefit.categories.includes('출산')) return '출산';
  if (benefit.categories.includes('임신')) return '임신중기';

  return '출산';
}

export function weekToPhase(week: number): TimelinePhase {
  if (week <= 0) return '임신준비';
  if (week <= 12) return '임신초기';
  if (week <= 27) return '임신중기';
  if (week <= 40) return '임신후기';
  return '양육';
}

export function phaseToIndex(phase: TimelinePhase): number {
  return TIMELINE_PHASES.indexOf(phase);
}

export interface PhasedBenefits {
  phase: TimelinePhase;
  benefits: BenefitCard[];
}

export function groupBenefitsByPhase(benefits: BenefitCard[]): PhasedBenefits[] {
  const groups: Record<TimelinePhase, BenefitCard[]> = {
    '임신준비': [],
    '임신초기': [],
    '임신중기': [],
    '임신후기': [],
    '출산': [],
    '양육': [],
  };

  for (const b of benefits) {
    const phase = assignPhase(b);
    groups[phase].push(b);
  }

  return TIMELINE_PHASES.map(phase => ({
    phase,
    benefits: groups[phase],
  }));
}

export function filterBenefitsByRegion(
  benefits: BenefitCard[],
  sido?: string,
  sigungu?: string,
): BenefitCard[] {
  if (!sido || sido === '전체') return benefits;

  return benefits.filter(b => {
    if (b.sido === '전국') return true;
    if (b.sido !== sido) return false;
    if (sigungu && sigungu !== '전체') {
      return b.sigungu === '' || b.sigungu === sigungu;
    }
    return true;
  });
}
