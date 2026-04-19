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

const heroHighlightItems = [
  'cultureManagement',
  'fieldOrganization',
  'planningPeriods',
  'projectCollaboration',
] as const;

const featureCardItems = [
  'cultureManagement',
  'fieldPlanning',
  'timePlanning',
  'projectCollaboration',
] as const;

const audienceItems = [
  'smallVegetableFarms',
  'csaOperations',
  'digitalPlanningProjects',
] as const;

const feedbackItems = ['feedback', 'ideas', 'bugReports'] as const;
const openSourceItems = ['publicCode', 'issues', 'contributions'] as const;

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box
        component="section"
        sx={{
          background: (theme) => `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
          <Stack spacing={{ xs: 4, md: 6 }}>
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                p: { xs: 3, md: 5 },
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: { xs: 4, md: 5 },
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' },
                  alignItems: 'start',
                }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={t('landing.betaBadge')} color="warning" size="small" />
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      {t('landing.statusLine')}
                    </Typography>
                  </Stack>
                  <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, lineHeight: 1.15 }}>
                    {t('landing.headline')}
                  </Typography>
                  <Typography variant="h5" color="text.primary" sx={{ fontWeight: 500, fontSize: { xs: '1.1rem', md: '1.35rem' } }}>
                    {t('landing.subtitle')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 720, fontSize: { xs: '1rem', md: '1.05rem' } }}>
                    {t('landing.description')}
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
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

                <Stack spacing={1.2}>
                  <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary' }}>
                    {t('heroHighlights.title')}
                  </Typography>
                  {heroHighlightItems.map((itemKey) => (
                    <Box
                      key={itemKey}
                      sx={{
                        px: 2,
                        py: 1.6,
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography>{t(`heroHighlights.items.${itemKey}`)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>

            <Stack spacing={1.5}>
              <Typography variant="h6">{t('audiences.title')}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {audienceItems.map((itemKey) => (
                  <Chip key={itemKey} label={t(`audiences.items.${itemKey}`)} variant="outlined" sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 9 } }}>
        <Container maxWidth="lg">
          <Stack spacing={3.5}>
            <Stack spacing={1}>
              <Typography variant="h3" sx={{ fontSize: { xs: '1.75rem', md: '2.15rem' } }}>{t('featureOverview.title')}</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 760 }}>{t('featureOverview.subtitle')}</Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {featureCardItems.map((itemKey) => (
                <Box
                  key={itemKey}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 3,
                    p: { xs: 2.5, md: 3 },
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{t(`featureOverview.cards.${itemKey}.title`)}</Typography>
                    <Typography color="text.secondary">{t(`featureOverview.cards.${itemKey}.description`)}</Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 9 }, bgcolor: 'background.paper', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="h5">{t('feedback.title')}</Typography>
                <Typography color="text.secondary">{t('feedback.description')}</Typography>
                <Stack component="ul" spacing={1} sx={{ pl: 2, m: 0 }}>
                  {feedbackItems.map((itemKey) => (
                    <Typography component="li" key={itemKey} color="text.secondary">
                      {t(`feedback.items.${itemKey}`)}
                    </Typography>
                  ))}
                </Stack>
                <Button
                  component={Link}
                  href={`mailto:${t('footer.contactEmail')}`}
                  underline="none"
                  variant="outlined"
                  sx={{ width: 'fit-content' }}
                >
                  {t('feedback.cta', { email: t('footer.contactEmail') })}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="h5">{t('openSource.title')}</Typography>
                <Typography color="text.secondary">{t('openSource.description')}</Typography>
                <Stack component="ul" spacing={1} sx={{ pl: 2, m: 0 }}>
                  {openSourceItems.map((itemKey) => (
                    <Typography component="li" key={itemKey} color="text.secondary">
                      {t(`openSource.items.${itemKey}`)}
                    </Typography>
                  ))}
                </Stack>
                <Button
                  component={Link}
                  href={t('openSource.githubUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  variant="contained"
                  sx={{ width: 'fit-content' }}
                >
                  {t('openSource.cta')}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 3.5 }, bgcolor: 'background.paper' }}>
            <Stack spacing={1.5}>
              <Typography variant="h5">{t('finalCta.title')}</Typography>
              <Typography color="text.secondary">{t('finalCta.description')}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Button component={RouterLink} to="/app" variant="contained">
                  {t('finalCta.openApp')}
                </Button>
                <Button component={RouterLink} to="/register" variant="outlined">
                  {t('finalCta.register')}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: { xs: 4, md: 5 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('footer.brandTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('footer.brandText')}</Typography>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">{t('footer.linksTitle')}</Typography>
              <Link component={RouterLink} to="/impressum" underline="hover">{t('footer.imprint')}</Link>
              <Link component={RouterLink} to="/datenschutz" underline="hover">{t('footer.privacy')}</Link>
              <Link href={t('footer.githubUrl')} target="_blank" rel="noopener noreferrer" underline="hover">{t('footer.github')}</Link>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">{t('footer.contactTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('footer.contactText')}</Typography>
              <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover">
                {t('footer.contactLabel', { email: t('footer.contactEmail') })}
              </Link>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
