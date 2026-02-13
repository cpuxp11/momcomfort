'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BenefitCard } from '@/types/benefit';
import { PHASE_CONFIG, type TimelinePhase } from '@/lib/timeline';

interface TimelinePhaseCardProps {
  phase: TimelinePhase;
  benefits: BenefitCard[];
  isCurrentPhase: boolean;
  isPastPhase: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
}

export default function TimelinePhaseCard({
  phase,
  benefits,
  isCurrentPhase,
  isPastPhase,
  checkedIds,
  onToggleCheck,
}: TimelinePhaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentPhase);
  const config = PHASE_CONFIG[phase];
  const checkedCount = benefits.filter(b => checkedIds.has(b.id)).length;

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-300 ${
        isCurrentPhase
          ? `${config.borderColor} ${config.bgColor} shadow-lg ring-2 ring-pink-200`
          : isPastPhase
            ? 'border-gray-200 bg-gray-50/50'
            : 'border-gray-200 bg-white'
      }`}
    >
      {/* Phase Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left min-h-[56px]"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold text-lg ${isCurrentPhase ? config.color : isPastPhase ? 'text-gray-500' : 'text-gray-800'}`}>
                {config.label}
              </h3>
              {isCurrentPhase && (
                <span className="text-xs font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">
                  현재
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{config.weekRange} · {config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {checkedCount}/{benefits.length}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Benefits List */}
      {isExpanded && benefits.length > 0 && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2">
          {benefits.map(benefit => {
            const isChecked = checkedIds.has(benefit.id);
            return (
              <div
                key={benefit.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isChecked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <button
                  onClick={() => onToggleCheck(benefit.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-pink-400'
                  }`}
                  aria-label={isChecked ? '체크 해제' : '체크'}
                >
                  {isChecked && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/benefits/${benefit.id}`}
                    className={`font-medium text-sm hover:text-pink-600 transition-colors ${
                      isChecked ? 'text-gray-500 line-through' : 'text-gray-800'
                    }`}
                  >
                    {benefit.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {benefit.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{benefit.orgName}</span>
                    {benefit.sido !== '전국' && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {benefit.sido}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {isExpanded && benefits.length === 0 && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <p className="text-sm text-gray-400 text-center py-4">
            해당 지역에 이 단계의 혜택이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
