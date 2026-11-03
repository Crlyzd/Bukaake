# Contributing Translations to Bukaake

Thank you for helping make **Bukaake** accessible to people all over the world!

Adding a new language is completely frictionless: **you only need to create one JSON file**. You do not need to install Rust or edit any application code.

---

## 3 Simple Steps to Add a Language

### Step 1: Copy the Base English File
Navigate to `src/locales/` and duplicate `en.json`. Rename your copy using the ISO language code:
- French: `src/locales/fr.json`
- Spanish: `src/locales/es.json`
- German: `src/locales/de.json`
- Japanese: `src/locales/ja.json`

### Step 2: Translate the Values
Open your new file in any text editor. Translate the text values **on the right side of the colon**, keeping all keys and `{placeholders}` unchanged:

```json
// Example: src/locales/es.json
{
  "common": {
    "ok": "Aceptar",
    "cancel": "Cancelar",
    "apply": "Aplicar"
  },
  "titlebar": {
    "openFile": "Abrir archivo de imagen (Ctrl+O)",
    "capture": "Captura de pantalla ({hotkey})",
    "themeToggle": "Cambiar tema oscuro / claro"
  }
}
```

> **Note on Placeholders**: Variables wrapped in curly braces like `{hotkey}` or `{lang}` are dynamically replaced by Bukaake at runtime. Keep them exactly as they appear in `en.json`.

### Step 3: Register Your Language in `manifest.js`
Open `src/locales/manifest.js` and add your language to the `LOCALES` list:

```js
export const LOCALES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'jv-ngoko', name: 'Javanese (Ngoko)', nativeName: 'Basa Jawa (Ngoko)' },
  { code: 'jv-krama', name: 'Javanese (Krama)', nativeName: 'Basa Jawa (Krama)' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' }, // <--- Add your language here
];
```

And in `src/services/platform/i18n-service.js`, add your import:
```js
import es from '../../locales/es.json';
// and add to this.dictionaries = { ..., es };
```

---

## Testing Your Translation Locally

1. Run the local dev server:
   ```bash
   npm run dev
   ```
2. Open Bukaake Settings (`Ctrl+,` or click the gear icon in the titlebar).
3. Under **General > Display Language**, choose your language. The entire UI will translate instantly!

## Submitting Your Translation
Submit a Pull Request on GitHub with your new `[lang].json` file. The maintainers will review and merge it.

