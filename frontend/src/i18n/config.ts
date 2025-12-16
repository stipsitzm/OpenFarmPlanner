/**
 * i18n configuration for OpenFarmPlanner
 * 
 * Sets up internationalization using i18next and react-i18next.
 * Default language is German (de) for v1.
 * Structured translation keys in separate namespaces for maintainability.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import commonDE from './locales/de/common.json';
import navigationDE from './locales/de/navigation.json';
import homeDE from './locales/de/home.json';
import locationsDE from './locales/de/locations.json';
import culturesDE from './locales/de/cultures.json';
import plantingPlansDE from './locales/de/plantingPlans.json';
import tasksDE from './locales/de/tasks.json';
import fieldsDE from './locales/de/fields.json';
import bedsDE from './locales/de/beds.json';
import hierarchyDE from './locales/de/hierarchy.json';
import ganttChartDE from './locales/de/ganttChart.json';

// Configure i18next
i18n
  .use(initReactI18next)
  .init({
    // Set German as the default and fallback language
    lng: 'de',
    fallbackLng: 'de',
    
    // Enable debug mode in development
    debug: import.meta.env.DEV,
    
    // Namespaces for organizing translations
    ns: ['common', 'navigation', 'home', 'locations', 'cultures', 'plantingPlans', 'tasks', 'fields', 'beds', 'hierarchy', 'ganttChart'],
    defaultNS: 'common',
    
    // Translation resources
    resources: {
      de: {
        common: commonDE,
        navigation: navigationDE,
        home: homeDE,
        locations: locationsDE,
        cultures: culturesDE,
        plantingPlans: plantingPlansDE,
        tasks: tasksDE,
        fields: fieldsDE,
        beds: bedsDE,
        hierarchy: hierarchyDE,
        ganttChart: ganttChartDE,
      },
    },
    
    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // React-specific settings
    react: {
      useSuspense: false, // Disable suspense for easier integration
    },
  });

export default i18n;
