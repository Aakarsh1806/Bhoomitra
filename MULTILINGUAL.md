# Multilingual Support Guide

Bhoomitra now supports **5 languages** with automatic switching:
- English (en)
- Hindi (hi)
- Marathi (mr)  
- Tamil (ta)
- Telugu (te)

## How to Use

### 1. Add Language Selector to Header/Navigation
```tsx
import LanguageSelector from "@/components/language-selector"

export function Header() {
  return (
    <header>
      {/* Your header content */}
      <LanguageSelector />
    </header>
  )
}
```

### 2. Use Translations in Components
```tsx
"use client"

import { useTranslation } from "@/lib/use-translation"

export function YourComponent() {
  const t = useTranslation()

  return (
    <div>
      <h1>{t("map.title")}</h1>
      <button>{t("action.save")}</button>
      <p>{t("zone.area")}</p>
    </div>
  )
}
```

### 3. Language Persistence
- User's language choice is automatically saved to `localStorage`
- Preference persists across sessions
- Falls back to English if language not found

## Available Translation Keys

### Navigation
- `nav.dashboard` - Dashboard
- `nav.map` - View Farm Map
- `nav.detection` - Disease Detection
- `nav.autospray` - Smart Spray
- `nav.analytics` - Analytics

### Maps & Zones
- `map.title` - View Farm Map
- `map.layout` - Farm Layout
- `map.zoneDetails` - Zone Details
- `zone.area` - Zone area
- `zone.sprayZone` - Spray Zone

### Actions
- `action.save` - Save
- `action.submit` - Submit
- `action.cancel` - Cancel
- `action.loading` - Loading...

### Status
- `status.healthy` - Healthy
- `status.warning` - Warning
- `status.critical` - Critical

*See `lib/translations.ts` for complete list of 130+ translations*

## Adding New Translations

1. Open `lib/translations.ts`
2. Add key to all language objects:
```ts
"your.new.key": {
  "en": "English text",
  "hi": "हिंदी पाठ",
  "mr": "मराठी मजकूर",
  "ta": "தமிழ் உரை",
  "te": "తెలుగు వచనం"
}
```

3. Use in component:
```tsx
const t = useTranslation()
// Usage: t("your.new.key")
```

## Example Implementation

**Before:**
```tsx
<h1>View Farm Map</h1>
<button>Save</button>
```

**After:**
```tsx
"use client"
import { useTranslation } from "@/lib/use-translation"

export function Component() {
  const t = useTranslation()
  return (
    <>
      <h1>{t("map.title")}</h1>
      <button>{t("action.save")}</button>
    </>
  )
}
```

## Features

✅ **100% Offline** - No API calls needed  
✅ **Persistent** - Saves user preference to localStorage  
✅ **Type-Safe** - TypeScript support for translation keys  
✅ **Efficient** - Minimal re-renders  
✅ **Easy to Extend** - Simple dictionary-based system  

## Supported Languages with Native Names

| Code | Name | Native |
|------|------|--------|
| en | English | English |
| hi | Hindi | हिंदी |
| mr | Marathi | मराठी |
| ta | Tamil | தமிழ் |
| te | Telugu | తెలుగు |

---

**Note**: For disease detection and ML predictions, the language is passed as form parameter to `/predict` endpoint. UI language and ML language are independent and configurable separately.
