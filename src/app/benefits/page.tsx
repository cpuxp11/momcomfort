import { Suspense } from 'react';
import { getAllBenefits, getRegionHierarchy } from '@/lib/benefits';
import BenefitsPageClient from '@/components/benefits/BenefitsPageClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: '혜택 검색 | 맘편해',
  description: '지역과 임신 단계에 맞는 정부 혜택을 검색하세요',
};

function BenefitsLoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Skeleton className="h-10 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function BenefitsPage() {
  const allBenefits = getAllBenefits();
  const regionMap = getRegionHierarchy();

  return (
    <Suspense fallback={<BenefitsLoadingSkeleton />}>
      <BenefitsPageClient initialBenefits={allBenefits} regionMap={regionMap} />
    </Suspense>
  );
}
