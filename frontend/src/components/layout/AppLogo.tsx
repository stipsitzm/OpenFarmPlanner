import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

interface AppLogoProps {
  to?: string;
  size?: number;
  showText?: boolean;
  subtleActive?: boolean;
}

export default function AppLogo({ to = '/app/dashboard', size = 28, showText = true, subtleActive = false }: AppLogoProps): React.ReactElement {
  const { t } = useTranslation('common');

  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
        px: 0.75,
        py: 0.35,
        borderRadius: 1,
        backgroundColor: subtleActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
        border: subtleActive ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&:hover': {
          backgroundColor: subtleActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
          borderColor: subtleActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        },
      }}
      aria-label={t('appName')}
    >
      <Box
        component="img"
        src="/favicon.png"
        alt={t('appName')}
        sx={{ height: size, width: size, borderRadius: 0.5, flexShrink: 0 }}
      />
      {showText ? (
        <Box component="span" sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          {t('appName')}
        </Box>
      ) : null}
    </Box>
  );
}
