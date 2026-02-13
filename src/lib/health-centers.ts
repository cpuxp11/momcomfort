import registryJson from '../../data/url_registry.json';
import type { HealthCenter } from '@/types/health-center';

interface RegistryRegion {
  type: string;
  districts?: Record<string, { health_center_url: string; pattern: string; category: string; verified: boolean }>;
  cities?: Record<string, { health_center_url: string; pattern: string; category: string; verified: boolean }>;
}

interface RegistryAutoEntry {
  health_center_url: string;
  pattern: string;
  menu_text: string;
  verified: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = registryJson as any;

export function getAllHealthCenters(): HealthCenter[] {
  const centers: HealthCenter[] = [];

  // Parse regions section
  const regions = registry.regions as Record<string, RegistryRegion> | undefined;
  if (regions) {
    for (const [regionName, regionData] of Object.entries(regions)) {
      const entries = regionData.districts || regionData.cities || {};
      for (const [districtName, info] of Object.entries(entries)) {
        centers.push({
          region: regionName,
          district: districtName,
          url: info.health_center_url,
          pattern: info.pattern,
          category: info.category,
          verified: info.verified,
        });
      }
    }
  }

  // Parse auto_discovered section
  const auto = registry.auto_discovered?.entries as Record<string, RegistryAutoEntry> | undefined;
  if (auto) {
    for (const [name, info] of Object.entries(auto)) {
      // Parse "부산 영도구" → region: 부산, district: 영도구
      const parts = name.split(' ');
      const region = parts.length > 1 ? parts[0] : '';
      const district = parts.length > 1 ? parts.slice(1).join(' ') : name;

      // Skip if already exists
      const exists = centers.some(c =>
        c.district === district || c.district === name
      );
      if (exists) continue;

      centers.push({
        region: region || '기타',
        district,
        url: info.health_center_url,
        pattern: info.pattern,
        category: info.menu_text,
        verified: info.verified,
      });
    }
  }

  return centers;
}

export function getHealthCentersByRegion(): Record<string, HealthCenter[]> {
  const centers = getAllHealthCenters();
  const grouped: Record<string, HealthCenter[]> = {};

  for (const center of centers) {
    const key = center.region || '기타';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(center);
  }

  // Sort districts within each region
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.district.localeCompare(b.district, 'ko'));
  }

  return grouped;
}
