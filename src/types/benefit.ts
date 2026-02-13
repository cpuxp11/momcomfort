export type Category = '임신' | '출산' | '양육';

export type OrgType =
  | '중앙행정기관'
  | '광역시도'
  | '시군구'
  | '교육청'
  | '공공기관'
  | '지방출자_출연기관'
  | '지방공기업';

export interface Benefit {
  서비스ID: string;
  서비스명: string;
  서비스목적요약: string;
  서비스분야: string;
  지원내용: string;
  지원대상: string;
  선정기준: string;
  지원유형: string;
  신청방법: string;
  신청기한: string;
  접수기관: string | null;
  전화문의: string;
  소관기관명: string;
  소관기관유형: string;
  소관기관코드: string;
  부서명: string;
  사용자구분: string;
  상세조회URL: string;
  조회수: number;
  등록일시: string;
  수정일시: string;
  _categories: Category[];
  _region: string;
}

export interface BenefitsData {
  fetch_date: string;
  total_count: number;
  category_counts: Record<string, number>;
  data: Benefit[];
}

export interface BenefitCard {
  id: string;
  title: string;
  summary: string;
  content: string;
  target: string;
  categories: Category[];
  region: string;
  orgName: string;
  orgType: string;
  detailUrl: string;
  sido: string;
  sigungu: string;
  applyMethod: string;
  phone: string;
}
