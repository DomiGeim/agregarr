const fs = require('fs');
const path = require('path');

const localePath = path.join(
  __dirname,
  '..',
  'src',
  'i18n',
  'locale',
  'en.json'
);
const englishMessages = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
const germanPatterns = [
  /\b(und|oder|nicht|keine|kein|fehlgeschlagen|sammlung|sammlungen|quelle|quellen|wartung|zurueck|zurück|pruefen|prüfen|fuer|für|verfuegbar|verfügbar|fehler|anzeigen|konfigurieren)\b/i,
  /[äöüÄÖÜß]/,
];
const allowed = new Set([
  'components.Settings.tautulliSettingsDescription',
  'components.Settings.watchlistsyncDescription',
]);

const failures = Object.entries(englishMessages).filter(([key, value]) => {
  if (allowed.has(key) || typeof value !== 'string') {
    return false;
  }

  return germanPatterns.some((pattern) => pattern.test(value));
});

if (failures.length > 0) {
  console.error('German text found in English locale:');
  failures.slice(0, 25).forEach(([key, value]) => {
    console.error(`- ${key}: ${value}`);
  });
  process.exit(1);
}

console.log('✓ English locale language audit passed');
