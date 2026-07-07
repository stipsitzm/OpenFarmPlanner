import { Link, Stack } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

interface LegalLinksProps {
  sx?: SxProps<Theme>;
  /** Renders smaller, quieter links so the surrounding content (e.g. a form) keeps visual priority. */
  dense?: boolean;
}

const legalLinkSx = { fontSize: '0.92rem' } as const;
const denseLegalLinkSx = { fontSize: '0.78rem' } as const;

export default function LegalLinks({ sx, dense = false }: LegalLinksProps) {
  const { t } = useTranslation('home');
  const linkSx = dense ? denseLegalLinkSx : legalLinkSx;

  return (
    <Stack direction="row" spacing={dense ? 1.5 : 2} alignItems="center" flexWrap="wrap" sx={sx}>
      <Link component={RouterLink} to="/impressum" underline="hover" color="text.secondary" sx={linkSx}>
        {t('footer.imprint')}
      </Link>
      <Link component={RouterLink} to="/datenschutz" underline="hover" color="text.secondary" sx={linkSx}>
        {t('footer.privacy')}
      </Link>
      <Link component={RouterLink} to="/nutzungsbedingungen" underline="hover" color="text.secondary" sx={linkSx}>
        {t('footer.terms')}
      </Link>
    </Stack>
  );
}
