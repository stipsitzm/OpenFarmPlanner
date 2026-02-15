
/**
 * Re-export translations for synchronous use in tests
 * 
 * This file provides a synchronous import of translation keys for use in test files,
 * avoiding the need for async i18next initialization in tests.
 */

import translations from '../../public/locales/de/translation.json';

export default translations;
