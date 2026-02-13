import type { Category } from '@/types/benefit';

export const STAGE_CONFIG: Record<Category, { label: string; color: string; bgColor: string; icon: string }> = {
  '임신': {
    label: '임신',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50 border-pink-200',
    icon: '🤰',
  },
  '출산': {
    label: '출산',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: '👶',
  },
  '양육': {
    label: '양육',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: '👨‍👩‍👧',
  },
};

export const ITEMS_PER_PAGE = 20;
