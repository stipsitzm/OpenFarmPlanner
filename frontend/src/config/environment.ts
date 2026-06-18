export type AppEnvironment = 'development' | 'staging' | 'production';

const VALID_APP_ENVIRONMENTS: AppEnvironment[] = [
  'development',
  'staging',
  'production',
];

function resolveAppEnvironment(value: string | undefined): AppEnvironment {
  if (VALID_APP_ENVIRONMENTS.includes(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  return import.meta.env.PROD ? 'production' : 'development';
}

export const appEnvironment = resolveAppEnvironment(import.meta.env.VITE_APP_ENV);

export const isDevelopmentEnvironment = appEnvironment === 'development';
export const isStagingEnvironment = appEnvironment === 'staging';
export const isProductionEnvironment = appEnvironment === 'production';
export const showsDetailedRuntimeErrors =
  isDevelopmentEnvironment || isStagingEnvironment;
