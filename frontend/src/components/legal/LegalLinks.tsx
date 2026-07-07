import { Link, Stack } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

interface LegalLinksProps {
  sx?: SxProps<Theme>;
}

const legalLinkSx = { fontSize: '0.92rem' } as const;

export default function LegalLinks({ sx }: LegalLinksProps) {
  const { t } = useTranslation('home');

  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={sx}>
      <Link component={RouterLink} to="/impressum" underline="hover" color="text.secondary" sx={legalLinkSx}>
        {t('footer.imprint')}
      </Link>
      <Link component={RouterLink} to="/datenschutz" underline="hover" color="text.secondary" sx={legalLinkSx}>
        {t('footer.privacy')}
      </Link>
      <Link component={RouterLink} to="/nutzungsbedingungen" underline="hover" color="text.secondary" sx={legalLinkSx}>
        {t('footer.terms')}
      </Link>
    </Stack>
  );
}
