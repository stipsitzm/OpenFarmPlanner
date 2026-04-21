import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  Box,
  Button,
  Chip,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

const featureItems = ['cultures', 'areas', 'timelines', 'teams'] as const;

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box
        component="section"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          background: (theme) => `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={3.5} sx={{ maxWidth: 860 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip label={t('landing.betaBadge')} size="small" color="warning" />
              <Typography variant="body2" color="text.secondary">
                {t('landing.statusLine')}
              </Typography>
            </Stack>

            <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.1rem', md: '3.1rem' }, lineHeight: 1.1 }}>
              {t('landing.headline')}
            </Typography>

            <Typography variant="h5" color="text.primary" sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' }, fontWeight: 500 }}>
              {t('landing.subtitle')}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button component={RouterLink} to="/app" variant="contained" size="large">
                {t('landing.actions.openApp')}
              </Button>
              <Button component={RouterLink} to="/register" variant="outlined" size="large">
                {t('landing.actions.register')}
              </Button>
              <Button
                component={Link}
                href={t('landing.actions.githubUrl')}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                color="inherit"
                variant="text"
                size="large"
              >
                {t('landing.actions.github')}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 7 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2.5}>
            <Typography variant="h3" sx={{ fontSize: { xs: '1.5rem', md: '1.95rem' } }}>
              {t('features.title')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {featureItems.map((itemKey) => (
                <Stack key={itemKey} direction="row" spacing={1.1} alignItems="center">
                  <CheckCircleOutlineIcon color="primary" fontSize="small" />
                  <Typography>{t(`features.items.${itemKey}`)}</Typography>
                </Stack>
              ))}
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 6 }, borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Stack spacing={0.7}>
              <Typography variant="h5">{t('openSource.title')}</Typography>
              <Typography color="text.secondary">{t('openSource.description')}</Typography>
            </Stack>
            <Button
              component={Link}
              href={t('openSource.githubUrl')}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              variant="outlined"
            >
              {t('openSource.cta')}
            </Button>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 7 } }}>
        <Container maxWidth="lg">
          <Stack spacing={1.5}>
            <Typography variant="h5">{t('finalCta.title')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button component={RouterLink} to="/app" variant="contained">
                {t('finalCta.openApp')}
              </Button>
              <Button component={RouterLink} to="/register" variant="outlined">
                {t('finalCta.register')}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 3.5, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 1.2, md: 3 }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Link component={RouterLink} to="/impressum" underline="hover">{t('footer.imprint')}</Link>
              <Link component={RouterLink} to="/datenschutz" underline="hover">{t('footer.privacy')}</Link>
              <Link href={t('footer.githubUrl')} target="_blank" rel="noopener noreferrer" underline="hover">{t('footer.github')}</Link>
            </Stack>
            <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover">
              {t('footer.contactLabel', { email: t('footer.contactEmail') })}
            </Link>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
