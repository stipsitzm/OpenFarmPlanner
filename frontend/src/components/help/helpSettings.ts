import type { HelpPageKey } from './PageHelp';

const HELP_STORAGE_PREFIX = 'help_';
const PAGE_HELP_STORAGE_PREFIX = 'pageHelpHidden:';
export const HELP_FIRST_LOGIN_DONE_KEY = 'help_first_login_done';

const AUTO_HELP_PAGES: HelpPageKey[] = ['dashboard', 'cultures', 'plantingPlans'];

export function resetHelpSettings(): void {
  Object.keys(window.localStorage)
    .filter(
      (key) =>
        key.startsWith(HELP_STORAGE_PREFIX) ||
        key.startsWith(PAGE_HELP_STORAGE_PREFIX),
    )
    .forEach((key) => window.localStorage.removeItem(key));

  window.localStorage.removeItem(HELP_FIRST_LOGIN_DONE_KEY);
}

export function shouldAutoOpenHelp(pageKey: HelpPageKey): boolean {
  if (window.localStorage.getItem(HELP_FIRST_LOGIN_DONE_KEY) === '1') {
    return false;
  }

  return AUTO_HELP_PAGES.includes(pageKey);
}

export function markFirstLoginHelpAsShown(): void {
  window.localStorage.setItem(HELP_FIRST_LOGIN_DONE_KEY, '1');
}
