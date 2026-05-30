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

export function localizeOverlayText(text: string): string {
  if (getOverlayLocale() !== 'de') {
    return text;
  }

  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = text.match(/\s*$/)?.[0] ?? '';
  const trimmed = text.trim();

  const exactLabels: Record<string, string> = {
    'REQUEST NEEDED': 'ANFRAGE NÖTIG',
    'AWAITING DOWNLOAD': 'WARTET AUF DOWNLOAD',
    'RELEASING TOMORROW': 'ERSCHEINT MORGEN',
    'RELEASING TODAY': 'ERSCHEINT HEUTE',
    'JUST RELEASED': 'GERADE ERSCHIENEN',
    'RELEASED YESTERDAY': 'GESTERN ERSCHIENEN',
  };

  if (exactLabels[trimmed]) {
    return `${leadingWhitespace}${exactLabels[trimmed]}${trailingWhitespace}`;
  }

  const segmentLabels: Record<string, string> = {
    SEASON: 'STAFFEL',
    IN: 'IN',
    DAYS: 'TAGEN',
    TOMORROW: 'MORGEN',
    TODAY: 'HEUTE',
    RELEASING: 'ERSCHEINT',
    RELEASED: 'ERSCHIENEN VOR',
    'DAYS AGO': 'TAGEN',
    'DELETING IN': 'LÖSCHUNG IN',
  };

  return text.replace(
    /\b(DELETING IN|DAYS AGO|REQUEST NEEDED|AWAITING DOWNLOAD|RELEASING TOMORROW|RELEASING TODAY|JUST RELEASED|RELEASED YESTERDAY|RELEASING|RELEASED|SEASON|TOMORROW|TODAY|DAYS|IN)\b/g,
    (match) => segmentLabels[match] ?? match
  );
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
