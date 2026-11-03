/**
 * Bukaake Localization Manifest & Registry
 * Supported language codes, international names, and native display labels (< 35 lines)
 */

export const LOCALES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'jv-ngoko', name: 'Javanese (Ngoko)', nativeName: 'Basa Jawa (Ngoko)' },
  { code: 'jv-krama', name: 'Javanese (Krama)', nativeName: 'Basa Jawa (Krama)' },
];

export const DEFAULT_LOCALE = 'en';

export function getLocaleMeta(code) {
  return LOCALES.find((l) => l.code === code) || LOCALES[0];
}

