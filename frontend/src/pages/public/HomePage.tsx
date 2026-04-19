import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

const featureItems = [
  'cultureManagement',
  'fieldOrganization',
  'planningPeriods',
  'structuredDocumentation',
  'projectCollaboration',
] as const;

const audienceItems = [
  'smallVegetableFarms',
  'csaOperations',
  'digitalPlanningProjects',
] as const;

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={{ xs: 6, md: 8 }}>
          <Stack spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} textAlign={{ xs: 'left', sm: 'center' }}>
            <Stack spacing={1.5}>
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '2rem', md: '2.75rem' } }}>
                {t('landing.title')}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'center' }}>
                <Typography
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 10,
                    bgcolor: 'warning.light',
                    color: 'warning.contrastText',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('landing.betaBadge')}
                </Typography>
              </Stack>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t('landing.subtitle')}
              </Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
              {t('landing.description')}
            </Typography>
            <Alert severity="info" variant="outlined" sx={{ width: '100%', maxWidth: 720, textAlign: 'left' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t('betaNote.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('betaNote.description')}
              </Typography>
            </Alert>
            <Stack spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
              <Button component={RouterLink} to="/app" variant="contained" size="large" sx={{ minWidth: 220 }}>
                {t('landing.actions.openApp')}
              </Button>
              <Button component={RouterLink} to="/register" variant="outlined" size="large" sx={{ minWidth: 220 }}>
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
                sx={{ minWidth: 220 }}
              >
                {t('landing.actions.github')}
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h5">{t('featureOverview.title')}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 3, display: 'grid', gap: 1.2 }}>
              {featureItems.map((itemKey) => (
                <Typography component="li" key={itemKey} color="text.secondary">
                  {t(`featureOverview.items.${itemKey}`)}
                </Typography>
              ))}
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h5">{t('audiences.title')}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 3, display: 'grid', gap: 1.2 }}>
              {audienceItems.map((itemKey) => (
                <Typography component="li" key={itemKey} color="text.secondary">
                  {t(`audiences.items.${itemKey}`)}
                </Typography>
              ))}
            </Box>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="h5">{t('feedback.title')}</Typography>
            <Typography color="text.secondary">{t('feedback.description')}</Typography>
            <Typography color="text.secondary">{t('feedback.contactHint')}</Typography>
            <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover" sx={{ width: 'fit-content' }}>
              {t('feedback.contactCta', { email: t('footer.contactEmail') })}
            </Link>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="h5">{t('openSource.title')}</Typography>
            <Typography color="text.secondary">{t('openSource.description')}</Typography>
            <Button
              component={Link}
              href={t('openSource.githubUrl')}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              variant="outlined"
              sx={{ width: 'fit-content' }}
            >
              {t('openSource.cta')}
            </Button>
          </Stack>

          <Typography color="text.secondary">{t('statusNote')}</Typography>
        </Stack>
      </Container>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 3 }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 3 }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Link component={RouterLink} to="/impressum" underline="hover">
                {t('footer.imprint')}
              </Link>
              <Link component={RouterLink} to="/datenschutz" underline="hover">
                {t('footer.privacy')}
              </Link>
              <Link href={t('footer.githubUrl')} target="_blank" rel="noopener noreferrer" underline="hover">
                {t('footer.github')}
              </Link>
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
