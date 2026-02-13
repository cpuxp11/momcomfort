import { Suspense } from 'react';
import { getAllBenefits, getRegionHierarchy } from '@/lib/benefits';
import TimelineClient from '@/components/timeline/TimelineClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: '임신 타임라인 | 맘편해',
  description: '임신 주차별 혜택을 타임라인으로 확인하고, 체크리스트로 관리하세요',
};

function TimelineLoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Skeleton className="h-10 w-48 mx-auto mb-8" />
      <Skeleton className="h-32 mb-6" />
      <Skeleton className="h-16 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const allBenefits = getAllBenefits();
  const regionMap = getRegionHierarchy();

  return (
    <Suspense fallback={<TimelineLoadingSkeleton />}>
      <TimelineClient allBenefits={allBenefits} regionMap={regionMap} />
    </Suspense>
  );
}
