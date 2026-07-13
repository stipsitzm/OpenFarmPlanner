export const DEV_ONBOARDING_PREVIEW_STORAGE_KEY = 'ofp.devOnboardingPreview';

export function enableDevOnboardingPreview(): void {
  window.localStorage.setItem(DEV_ONBOARDING_PREVIEW_STORAGE_KEY, '1');
}

export function clearDevOnboardingPreview(): void {
  window.localStorage.removeItem(DEV_ONBOARDING_PREVIEW_STORAGE_KEY);
}

export function isDevOnboardingPreviewEnabled(): boolean {
  return import.meta.env.DEV && window.localStorage.getItem(DEV_ONBOARDING_PREVIEW_STORAGE_KEY) === '1';
}
