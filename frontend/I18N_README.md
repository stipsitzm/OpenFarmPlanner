# i18n (Internationalization) Implementation

## Overview

The OpenFarmPlanner frontend now supports internationalization using **i18next** and **react-i18next**. The current version is configured with German (de) as the default language, with a clear path for adding additional languages in the future.

## Quick Start

### Using Translations in Components

```typescript
import { useTranslation } from '../i18n';

function MyComponent() {
  const { t } = useTranslation('myNamespace');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Using Multiple Namespaces

```typescript
const { t } = useTranslation(['myNamespace', 'common']);

return (
  <div>
    <h1>{t('myNamespace:title')}</h1>
    <button>{t('common:actions.save')}</button>
  </div>
);
```

## Current Implementation

### Supported Languages
- **German (de)** - Default and fallback language

### Available Namespaces
- `common` - Shared UI elements (buttons, messages, common fields)
- `navigation` - Navigation menu labels
- `home` - Home page content
- `locations` - Locations page
- `cultures` - Cultures page  
- `plantingPlans` - Planting Plans page
- `tasks` - Tasks page
- `fields` - Fields page
- `beds` - Beds page
- `hierarchy` - Hierarchical Fields/Beds view

### Translation Files Location

All translation files are located in:
```
frontend/src/i18n/locales/{language}/{namespace}.json
```

Currently:
```
frontend/src/i18n/
├── config.ts
├── index.ts
└── locales/
    └── de/
        ├── common.json
        ├── navigation.json
        ├── home.json
        ├── locations.json
        ├── cultures.json
        ├── plantingPlans.json
        ├── tasks.json
        ├── fields.json
        ├── beds.json
        └── hierarchy.json
```

## Adding a New Language

Follow these steps to add support for a new language (e.g., English):

### 1. Create Translation Files

```bash
# Create directory for new language
mkdir -p frontend/src/i18n/locales/en

# Copy German files as templates
cp frontend/src/i18n/locales/de/*.json frontend/src/i18n/locales/en/
```

### 2. Translate Content

Open each `.json` file in `frontend/src/i18n/locales/en/` and translate the values (not the keys) to English.

Example - `common.json`:
```json
{
  "appName": "OpenFarmPlanner",
  "actions": {
    "add": "Add",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

### 3. Update i18n Configuration

Edit `frontend/src/i18n/config.ts`:

```typescript
// 1. Import English translations
import commonEN from './locales/en/common.json';
import navigationEN from './locales/en/navigation.json';
import homeEN from './locales/en/home.json';
import locationsEN from './locales/en/locations.json';
import culturesEN from './locales/en/cultures.json';
import plantingPlansEN from './locales/en/plantingPlans.json';
import tasksEN from './locales/en/tasks.json';
import fieldsEN from './locales/en/fields.json';
import bedsEN from './locales/en/beds.json';
import hierarchyEN from './locales/en/hierarchy.json';

// 2. Add to resources
resources: {
  de: {
    // ... existing German translations
  },
  en: {
    common: commonEN,
    navigation: navigationEN,
    home: homeEN,
    locations: locationsEN,
    cultures: culturesEN,
    plantingPlans: plantingPlansEN,
    tasks: tasksEN,
    fields: fieldsEN,
    beds: bedsEN,
    hierarchy: hierarchyEN,
  },
}
```

### 4. (Optional) Add Language Switcher

Create a component to allow users to switch languages:

```typescript
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };
  
  return (
    <div>
      <button onClick={() => changeLanguage('de')}>Deutsch</button>
      <button onClick={() => changeLanguage('en')}>English</button>
    </div>
  );
}
```

### 5. Test the New Language

Run tests to ensure nothing breaks:
```bash
cd frontend
npm test
```

## Translation Best Practices

1. **Never hardcode user-facing text** - Always use translation keys
2. **Use descriptive keys** - Make keys self-documenting (e.g., `validation.nameRequired`)
3. **Keep structure consistent** - Similar pages should have similar key structures
4. **Use camelCase for keys** - Consistent with JavaScript conventions
5. **Avoid deep nesting** - Maximum 3 levels recommended
6. **Test missing keys** - Check console in development for missing translations

## Key Structure Convention

Standard structure for page translations:

```json
{
  "title": "Page Title",
  "columns": {
    "fieldName": "Column Label"
  },
  "errors": {
    "load": "Error message",
    "save": "Error message",
    "delete": "Error message"
  },
  "validation": {
    "fieldRequired": "Validation message"
  },
  "confirmDelete": "Confirmation message",
  "addButton": "Button label"
}
```

## Features

### ✅ Implemented
- i18next integration with React
- German language support (complete)
- Namespace-based organization
- Translation of all UI text in main components
- Comprehensive documentation
- Unit tests for i18n functionality
- Support for interpolation (dynamic values)

### 🔮 Future Enhancements
- Language persistence (localStorage)
- Lazy loading of translation files
- Additional languages (English, French, etc.)
- Pluralization support
- Date and number localization
- Translation management service integration

## Documentation

For detailed documentation, see:
- **[I18N_DOCUMENTATION.md](./I18N_DOCUMENTATION.md)** - Complete technical documentation

## Testing

Run i18n tests:
```bash
cd frontend
npm test i18n.test.ts
```

Run all tests:
```bash
cd frontend
npm test
```

## Troubleshooting

### Missing Translation Keys

If you see missing translation warnings in the console:

1. Check the translation file for the key
2. Verify the namespace is loaded in `config.ts`
3. Ensure you're using the correct namespace in `useTranslation()`

### Translation Not Updating

1. Clear browser cache
2. Restart the development server
3. Check that the JSON files are properly formatted

## Support

For questions or issues with i18n:
1. Check the [I18N_DOCUMENTATION.md](./I18N_DOCUMENTATION.md)
2. Review existing translation files for examples
3. Open an issue in the repository
