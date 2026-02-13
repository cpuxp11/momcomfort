export interface RegionInfo {
  districts: string[];
  benefitCount: number;
}

export type RegionHierarchy = Record<string, RegionInfo>;
