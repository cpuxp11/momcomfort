'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BenefitCard, Category } from '@/types/benefit';
import type { RegionHierarchy } from '@/types/region';
import { STAGE_CONFIG, ITEMS_PER_PAGE } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import BenefitCardComponent from './BenefitCardComponent';

interface BenefitsPageClientProps {
  initialBenefits: BenefitCard[];
  regionMap: RegionHierarchy;
}

export default function BenefitsPageClient({ initialBenefits, regionMap }: BenefitsPageClientProps) {
  const searchParams = useSearchParams();

  // URL state
  const [sido, setSido] = useState<string>(searchParams.get('sido') || '전체');
  const [sigungu, setSigungu] = useState<string>(searchParams.get('sigungu') || '전체');
  const [selectedStages, setSelectedStages] = useState<Category[]>(() => {
    const stageParam = searchParams.get('stage');
    return stageParam ? (stageParam.split(',') as Category[]) : [];
  });
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(searchQuery);
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10)
  );

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get available sigungus for current sido
  const availableSigungus = useMemo(() => {
    if (sido === '전체' || !regionMap[sido]) return [];
    return regionMap[sido].districts;
  }, [sido, regionMap]);

  // Filter benefits
  const filteredBenefits = useMemo(() => {
    let results = initialBenefits;

    // Region filter
    if (sido !== '전체') {
      results = results.filter(b => {
        if (b.sido === '전국') return true;
        if (b.sido !== sido) return false;
        if (sigungu !== '전체') {
          return b.sigungu === '' || b.sigungu === sigungu;
        }
        return true;
      });
    }

    // Stage filter
    if (selectedStages.length > 0) {
      results = results.filter(b =>
        selectedStages.some(stage => b.categories.includes(stage))
      );
    }

    // Text search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      results = results.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q) ||
        b.content.toLowerCase().includes(q)
      );
    }

    return results;
  }, [initialBenefits, sido, sigungu, selectedStages, debouncedQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredBenefits.length / ITEMS_PER_PAGE);
  const paginatedBenefits = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBenefits.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBenefits, currentPage]);

  // Update URL when filters change (use History API to avoid Next.js re-mount)
  useEffect(() => {
    const params = new URLSearchParams();
    if (sido !== '전체') params.set('sido', sido);
    if (sigungu !== '전체') params.set('sigungu', sigungu);
    if (selectedStages.length > 0) params.set('stage', selectedStages.join(','));
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = params.toString() ? `/benefits?${params.toString()}` : '/benefits';
    window.history.replaceState(null, '', newUrl);
  }, [sido, sigungu, selectedStages, debouncedQuery, currentPage]);

  // Toggle stage selection
  const toggleStage = (stage: Category) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
    setCurrentPage(1);
  };

  const handleSidoChange = (nextSido: string) => {
    setSido(nextSido);
    setCurrentPage(1);

    if (nextSido === '전체' || !regionMap[nextSido]) {
      if (sigungu !== '전체') setSigungu('전체');
      return;
    }

    const nextSigungus = regionMap[nextSido].districts;
    if (sigungu !== '전체' && !nextSigungus.includes(sigungu)) {
      setSigungu('전체');
    }
  };

  const handleSigunguChange = (nextSigungu: string) => {
    setSigungu(nextSigungu);
    setCurrentPage(1);
  };

  const handleSearchChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    setCurrentPage(1);
  };

  // Build results header text
  const getResultsHeader = () => {
    const parts: string[] = [];
    if (sido !== '전체') {
      parts.push(sido);
      if (sigungu !== '전체') parts.push(sigungu);
    }
    if (selectedStages.length > 0) {
      parts.push(selectedStages.map(s => STAGE_CONFIG[s].label).join('·'));
    }
    const locationText = parts.length > 0 ? parts.join(' ') + ' ' : '';
    return `${locationText}혜택 ${filteredBenefits.length}건`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Filters Section */}
      <div className="mb-8 space-y-4">
        {/* Region Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="sido" className="block text-sm font-medium mb-2">
              시/도
            </label>
            <select
              id="sido"
              value={sido}
              onChange={(e) => handleSidoChange(e.target.value)}
              className="w-full h-12 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="전체">전체</option>
              {Object.keys(regionMap).map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="sigungu" className="block text-sm font-medium mb-2">
              시/구/군
            </label>
            <select
              id="sigungu"
              value={sigungu}
              onChange={(e) => handleSigunguChange(e.target.value)}
              disabled={sido === '전체' || availableSigungus.length === 0}
              className="w-full h-12 px-3 rounded-md border border-input bg-background text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="전체">전체</option>
              {availableSigungus.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stage Filter */}
        <div>
          <label className="block text-sm font-medium mb-2">임신 단계</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STAGE_CONFIG) as Category[]).map(stage => {
              const config = STAGE_CONFIG[stage];
              const isSelected = selectedStages.includes(stage);
              return (
                <Button
                  key={stage}
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => toggleStage(stage)}
                  className={`min-h-[44px] px-4 ${isSelected ? '' : 'hover:bg-accent'}`}
                >
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium mb-2">
            검색
          </label>
          <Input
            id="search"
            type="text"
            placeholder="혜택명, 지원내용으로 검색"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Results Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{getResultsHeader()}</h1>
      </div>

      {/* Results Grid */}
      {paginatedBenefits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          조건에 맞는 혜택이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {paginatedBenefits.map(benefit => (
            <BenefitCardComponent key={benefit.id} benefit={benefit} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="min-h-[44px] px-6"
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="min-h-[44px] px-6"
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
