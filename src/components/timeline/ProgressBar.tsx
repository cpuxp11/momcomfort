'use client';

interface ProgressBarProps {
  checked: number;
  total: number;
}

export default function ProgressBar({ checked, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          혜택 확인 진행률
        </span>
        <span className="text-sm font-bold text-pink-600">
          {checked}/{total}건 완료 ({percent}%)
        </span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-pink-400 to-pink-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
