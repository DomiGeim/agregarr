import { getSettings } from '@server/lib/settings';

export function getOverlayLocale(): 'de' | 'en' {
  return getSettings().main.locale?.toLowerCase().startsWith('de')
    ? 'de'
    : 'en';
}

export function getOverlayLabel(key: 'comingSoon'): string {
  const labels: Record<'de' | 'en', Record<'comingSoon', string>> = {
    de: {
      comingSoon: 'BALD VERF\u00dcGBAR',
    },
    en: {
      comingSoon: 'COMING SOON',
    },
  };

  return labels[getOverlayLocale()][key];
}

export function normalizeOverlayStatus(status: string): string {
  const normalized = status
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

  const statusAliases: Record<string, string> = {
    AIRING: 'AIRING',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
    CONTINUING: 'RETURNING',
    ENDED: 'ENDED',
    FINISHED: 'ENDED',
    'IN PRODUCTION': 'IN PRODUCTION',
    PILOT: 'PILOT',
    PLANNED: 'PLANNED',
    RETURNING: 'RETURNING',
    'RETURNING SERIES': 'RETURNING',
    UPCOMING: 'PLANNED',
  };

  return statusAliases[normalized] ?? normalized;
}

export function localizeOverlayStatus(status: string): string {
  const normalized = normalizeOverlayStatus(status);

  if (getOverlayLocale() !== 'de') {
    return normalized;
  }

  const germanStatusLabels: Record<string, string> = {
    AIRING: 'L\u00c4UFT',
    CANCELLED: 'ABGESETZT',
    CANCELED: 'ABGESETZT',
    ENDED: 'BEENDET',
    'IN PRODUCTION': 'IN PRODUKTION',
    PILOT: 'PILOT',
    PLANNED: 'GEPLANT',
    RETURNING: 'KEHRT ZUR\u00dcCK',
  };

  return germanStatusLabels[normalized] ?? normalized;
}
