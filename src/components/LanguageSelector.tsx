import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {language === 'es' ? t.common.spanish : t.common.english}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLanguage('es')}>
          {t.common.spanish}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('en')}>
          {t.common.english}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}