export type Language = 'en' | 'fa';

export const messages = {
  en: {
    title: 'VoIP Monitor',
    stage: 'Application foundation',
    description: 'Monitoring is not configured yet.',
    switchLanguage: 'فارسی',
  },
  fa: {
    title: 'پایش VoIP',
    stage: 'زیرساخت برنامه',
    description: 'پایش هنوز پیکربندی نشده است.',
    switchLanguage: 'English',
  },
} as const;
