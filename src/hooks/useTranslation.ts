import { useLanguage } from '@/contexts/LanguageContext';

export function useTranslation() {
  const { t, language, setLanguage } = useLanguage();
  return { t, language, setLanguage };
}