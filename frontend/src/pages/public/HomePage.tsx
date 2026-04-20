import AgricultureOutlinedIcon from '@mui/icons-material/AgricultureOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
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

const benefitItems = ['clarity', 'collaboration', 'continuousImprovement'] as const;

const featureItems = [
  { key: 'cultures', icon: AgricultureOutlinedIcon },
  { key: 'areas', icon: GridViewOutlinedIcon },
  { key: 'timelines', icon: CalendarMonthOutlinedIcon },
  { key: 'teams', icon: Groups2OutlinedIcon },
] as const;

const trustItems = [
  { key: 'feedback', icon: ForumOutlinedIcon },
  { key: 'openSource', icon: CodeOutlinedIcon },
] as const;

const audienceItems = ['smallVegetableFarms', 'csaOperations', 'digitalPlanningProjects'] as const;

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box
        component="section"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: (theme) => `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 80%)`,
          borderBottom: 1,
          borderColor: 'divider',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 82% 20%, rgba(25, 118, 210, 0.12), transparent 44%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="xl" sx={{ position: 'relative', py: { xs: 7, md: 9, lg: 11 } }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 5, md: 6 },
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' },
              alignItems: 'center',
            }}
          >
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={t('landing.betaBadge')} color="warning" size="small" />
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {t('landing.statusLine')}
                </Typography>
              </Stack>

              <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.1rem', md: '3rem', lg: '3.4rem' }, lineHeight: 1.08, maxWidth: 760 }}>
                {t('landing.headline')}
              </Typography>

              <Typography variant="h5" color="text.primary" sx={{ fontSize: { xs: '1.05rem', md: '1.28rem' }, fontWeight: 500, maxWidth: 720 }}>
                {t('landing.subtitle')}
              </Typography>

              <Typography color="text.secondary" sx={{ maxWidth: 690 }}>
                {t('landing.description')}
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
                  variant="text"
                  color="inherit"
                  size="large"
                >
                  {t('landing.actions.github')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.5 }}>
                {audienceItems.map((itemKey) => (
                  <Chip key={itemKey} label={t(`audiences.items.${itemKey}`)} variant="outlined" sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            </Stack>

            <Box
              sx={{
                borderRadius: 4,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: { xs: 2.5, md: 3 },
                boxShadow: '0 24px 40px rgba(15, 23, 42, 0.08)',
              }}
            >
              <Stack spacing={2}>
                <Typography variant="subtitle2" sx={{ letterSpacing: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
                  {t('preview.title')}
                </Typography>
                <Typography variant="h6">{t('preview.subtitle')}</Typography>

                <Box sx={{ borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.default' }}>
                  <Box sx={{ px: 2, py: 1.1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
                    <Chip label={t('preview.tabs.cultures')} size="small" color="primary" />
                    <Chip label={t('preview.tabs.areas')} size="small" variant="outlined" />
                    <Chip label={t('preview.tabs.timeline')} size="small" variant="outlined" />
                  </Box>
                  <Stack spacing={1} sx={{ p: 2 }}>
                    {[1, 2, 3, 4].map((row) => (
                      <Box key={row} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, bgcolor: 'background.paper' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">{t(`preview.rows.row${row}`)}</Typography>
                          <Chip label={t(`preview.status.row${row}`)} size="small" variant="outlined" />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {t('preview.note')}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              mt: { xs: 5, md: 6 },
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {benefitItems.map((itemKey) => (
              <Box key={itemKey} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t(`benefits.items.${itemKey}.title`)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`benefits.items.${itemKey}.description`)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 9 } }}>
        <Container maxWidth="xl">
          <Stack spacing={3.5}>
            <Stack spacing={1}>
              <Typography variant="h3" sx={{ fontSize: { xs: '1.7rem', md: '2.2rem' } }}>
                {t('features.title')}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
                {t('features.subtitle')}
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {featureItems.map(({ key, icon: Icon }) => (
                <Box
                  key={key}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 1.5,
                    alignItems: 'start',
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'primary.light', color: 'primary.contrastText', display: 'grid', placeItems: 'center' }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Stack spacing={0.8}>
                    <Typography variant="h6">{t(`features.items.${key}.title`)}</Typography>
                    <Typography color="text.secondary">{t(`features.items.${key}.description`)}</Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 8 }, bgcolor: 'grey.100', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {trustItems.map(({ key, icon: Icon }, index) => (
              <Box
                key={key}
                sx={{
                  p: { xs: 2.5, md: 3.2 },
                  borderRadius: 3,
                  bgcolor: index === 1 ? 'background.paper' : 'rgba(25, 118, 210, 0.06)',
                  border: 1,
                  borderColor: index === 1 ? 'divider' : 'rgba(25, 118, 210, 0.28)',
                }}
              >
                <Stack spacing={1.3}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', display: 'grid', placeItems: 'center' }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Typography variant="h5">{t(`${key}.title`)}</Typography>
                  </Stack>
                  <Typography color="text.secondary">{t(`${key}.description`)}</Typography>
                  <Stack component="ul" spacing={0.8} sx={{ m: 0, pl: 2 }}>
                    {(['item1', 'item2', 'item3'] as const).map((itemKey) => (
                      <Typography component="li" key={itemKey} color="text.secondary">
                        {t(`${key}.items.${itemKey}`)}
                      </Typography>
                    ))}
                  </Stack>
                  {key === 'feedback' ? (
                    <Button component={Link} href={`mailto:${t('footer.contactEmail')}`} underline="none" variant="outlined" sx={{ width: 'fit-content' }}>
                      {t('feedback.cta', { email: t('footer.contactEmail') })}
                    </Button>
                  ) : (
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
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 7, md: 9 } }}>
        <Container maxWidth="xl">
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.12), rgba(25, 118, 210, 0.04))',
              border: 1,
              borderColor: 'rgba(25, 118, 210, 0.25)',
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2rem' } }}>
                {t('finalCta.title')}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
                {t('finalCta.description')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button component={RouterLink} to="/app" variant="contained" size="large">
                  {t('finalCta.openApp')}
                </Button>
                <Button component={RouterLink} to="/register" variant="outlined" size="large">
                  {t('finalCta.register')}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="xl" sx={{ py: { xs: 4, md: 5 } }}>
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 1fr' } }}>
            <Stack spacing={1.2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('footer.brandTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                {t('footer.brandText')}
              </Typography>
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
