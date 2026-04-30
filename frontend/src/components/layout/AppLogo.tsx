import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

interface AppLogoProps {
  to?: string;
  size?: number;
  showText?: boolean;
}

export default function AppLogo({ to = '/app/locations', size = 28, showText = true }: AppLogoProps): React.ReactElement {
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
