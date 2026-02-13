'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BenefitCard } from '@/types/benefit';
import type { RegionHierarchy } from '@/types/region';
import {
  groupBenefitsByPhase,
  filterBenefitsByRegion,
  weekToPhase,
  phaseToIndex,
  TIMELINE_PHASES,
} from '@/lib/timeline';
import ProgressBar from './ProgressBar';
import TimelinePhaseCard from './TimelinePhaseCard';

const STORAGE_KEY = 'momcomfort-checklist';

interface SavedState {
  currentWeek: number;
  sido: string;
  sigungu: string;
  checkedBenefits: string[];
  lastUpdated: string;
}

function loadSavedState(): SavedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded - ignore */ }
}

interface TimelineClientProps {
  allBenefits: BenefitCard[];
  regionMap: RegionHierarchy;
}

export default function TimelineClient({ allBenefits, regionMap }: TimelineClientProps) {
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [sido, setSido] = useState<string>('전체');
  const [sigungu, setSigungu] = useState<string>('전체');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadSavedState();
    if (saved) {
      setCurrentWeek(saved.currentWeek);
      setSido(saved.sido);
      setSigungu(saved.sigungu);
      setCheckedIds(new Set(saved.checkedBenefits));
    }
    setIsLoaded(true);
  }, []);

  // Save state when it changes
  useEffect(() => {
    if (!isLoaded) return;
    saveState({
      currentWeek,
      sido,
      sigungu,
      checkedBenefits: Array.from(checkedIds),
      lastUpdated: new Date().toISOString(),
    });
  }, [currentWeek, sido, sigungu, checkedIds, isLoaded]);

  // Available sigungus for selected sido
  const availableSigungus = useMemo(() => {
    if (sido === '전체' || !regionMap[sido]) return [];
    return regionMap[sido].districts;
  }, [sido, regionMap]);

  // Reset sigungu when sido changes
  useEffect(() => {
    if (sigungu !== '전체' && !availableSigungus.includes(sigungu)) {
      setSigungu('전체');
    }
  }, [sido, availableSigungus, sigungu]);

  // Filter by region, then group by phase
  const phasedBenefits = useMemo(() => {
    const filtered = filterBenefitsByRegion(allBenefits, sido, sigungu);
    return groupBenefitsByPhase(filtered);
  }, [allBenefits, sido, sigungu]);

  const totalBenefits = useMemo(
    () => phasedBenefits.reduce((sum, p) => sum + p.benefits.length, 0),
    [phasedBenefits],
  );

  const totalChecked = useMemo(() => {
    const allIds = new Set(phasedBenefits.flatMap(p => p.benefits.map(b => b.id)));
    return Array.from(checkedIds).filter(id => allIds.has(id)).length;
  }, [phasedBenefits, checkedIds]);

  const currentPhase = weekToPhase(currentWeek);
  const currentPhaseIndex = phaseToIndex(currentPhase);

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">임신 타임라인</h1>
        <p className="text-gray-500">임신 주차별로 받을 수 있는 혜택을 확인하세요</p>
      </div>

      {/* Controls */}
      <div className="mb-6 rounded-xl border bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Week selector */}
          <div>
            <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-1.5">
              현재 임신 주차
            </label>
            <select
              id="week"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(Number(e.target.value))}
              className="w-full h-12 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
            >
              <option value={0}>선택하세요</option>
              {Array.from({ length: 40 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>{w}주차</option>
              ))}
              <option value={41}>출산 후</option>
            </select>
          </div>

          {/* Sido selector */}
          <div>
            <label htmlFor="sido" className="block text-sm font-medium text-gray-700 mb-1.5">
              시/도
            </label>
            <select
              id="sido"
              value={sido}
              onChange={(e) => setSido(e.target.value)}
              className="w-full h-12 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
            >
              <option value="전체">전체</option>
              {Object.keys(regionMap).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sigungu selector */}
          <div>
            <label htmlFor="sigungu" className="block text-sm font-medium text-gray-700 mb-1.5">
              시/구/군
            </label>
            <select
              id="sigungu"
              value={sigungu}
              onChange={(e) => setSigungu(e.target.value)}
              disabled={sido === '전체' || availableSigungus.length === 0}
              className="w-full h-12 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="전체">전체</option>
              {availableSigungus.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {currentWeek > 0 && (
          <div className="text-center pt-2">
            <span className="inline-flex items-center gap-1.5 text-pink-600 font-medium">
              {currentWeek <= 40 ? `현재 ${currentWeek}주차` : '출산 후'} ·{' '}
              {currentPhase === '임신준비' ? '임신 준비 단계' : `${currentPhase} 단계`}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <ProgressBar checked={totalChecked} total={totalBenefits} />
      </div>

      {/* Timeline Phases */}
      <div className="space-y-4">
        {phasedBenefits.map(({ phase, benefits }) => (
          <TimelinePhaseCard
            key={phase}
            phase={phase}
            benefits={benefits}
            isCurrentPhase={currentWeek > 0 && phase === currentPhase}
            isPastPhase={currentWeek > 0 && phaseToIndex(phase) < currentPhaseIndex}
            checkedIds={checkedIds}
            onToggleCheck={toggleCheck}
          />
        ))}
      </div>
    </div>
  );
}
