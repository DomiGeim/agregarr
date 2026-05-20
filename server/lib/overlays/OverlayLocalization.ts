import { getSettings } from '@server/lib/settings';

export function getOverlayLocale(): 'de' | 'en' {
  return getSettings().main.locale?.toLowerCase().startsWith('de')
    ? 'de'
    : 'en';
}

export function getOverlayLabel(key: 'comingSoon'): string {
  const labels: Record<'de' | 'en', Record<'comingSoon', string>> = {
    de: {
      comingSoon: 'BALD VERFÜGBAR',
    },
    en: {
      comingSoon: 'COMING SOON',
    },
  };

  return labels[getOverlayLocale()][key];
}

export function localizeOverlayStatus(status: string): string {
  const normalized = status.trim().toUpperCase();

  if (getOverlayLocale() !== 'de') {
    return normalized;
  }

  const germanStatusLabels: Record<string, string> = {
    AIRING: 'LÄUFT',
    CANCELLED: 'ABGESETZT',
    CANCELED: 'ABGESETZT',
    ENDED: 'BEENDET',
    'IN PRODUCTION': 'IN PRODUKTION',
    PILOT: 'PILOT',
    PLANNED: 'GEPLANT',
    RETURNING: 'KEHRT ZURÜCK',
  };

  return germanStatusLabels[normalized] ?? normalized;
}
