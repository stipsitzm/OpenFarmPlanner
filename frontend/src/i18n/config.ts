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
import commonEN from './locales/en/common.json';
import navigationDE from './locales/de/navigation.json';
import navigationEN from './locales/en/navigation.json';
import homeDE from './locales/de/home.json';
import homeEN from './locales/en/home.json';
import dashboardDE from './locales/de/dashboard.json';
import locationsDE from './locales/de/locations.json';
import culturesDE from './locales/de/cultures.json';
import culturesEN from './locales/en/cultures.json';
import plantingPlansDE from './locales/de/plantingPlans.json';
import fieldsDE from './locales/de/fields.json';
import fieldsEN from './locales/en/fields.json';
import bedsDE from './locales/de/beds.json';
import hierarchyDE from './locales/de/hierarchy.json';
import ganttChartDE from './locales/de/ganttChart.json';
import suppliersDE from './locales/de/suppliers.json';
import helpDE from './locales/de/help.json';
import authDE from './locales/de/auth.json';
import accountDE from './locales/de/account.json';
import projectInvitationsDE from './locales/de/projectInvitations.json';
import projectInvitationsEN from './locales/en/projectInvitations.json';
import helpEN from './locales/en/help.json';

// Configure i18next
i18n
  .use(initReactI18next)
  .init({
    // Set German as the default and fallback language
    lng: 'de',
    fallbackLng: 'de',
    
    // Enable debug mode in development
    debug: import.meta.env.DEV && import.meta.env.MODE !== 'test',
    
    // Namespaces for organizing translations
    ns: ['common', 'navigation', 'home', 'dashboard', 'locations', 'cultures', 'plantingPlans', 'fields', 'beds', 'hierarchy', 'ganttChart', 'suppliers', 'help', 'auth', 'account', 'projectInvitations'],
    defaultNS: 'common',
    
    // Translation resources
    resources: {
      de: {
        common: commonDE,
        navigation: navigationDE,
        home: homeDE,
        dashboard: dashboardDE,
        locations: locationsDE,
        cultures: culturesDE,
        plantingPlans: plantingPlansDE,
        fields: fieldsDE,
        beds: bedsDE,
        hierarchy: hierarchyDE,
        ganttChart: ganttChartDE,
        suppliers: suppliersDE,
        help: helpDE,
        auth: authDE,
        account: accountDE,
        projectInvitations: projectInvitationsDE,
      },
      en: {
        common: commonEN,
        navigation: navigationEN,
        home: homeEN,
        cultures: culturesEN,
        fields: fieldsEN,
        help: helpEN,
        projectInvitations: projectInvitationsEN,
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
