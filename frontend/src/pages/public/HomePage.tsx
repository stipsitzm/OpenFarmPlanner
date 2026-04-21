import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Box,
  Button,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

/**
 * Public landing page with refined spacing and modern visual hierarchy.
 *
 * @returns Landing page UI.
 */
export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="main" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Container maxWidth="md" sx={{ width: '100%', py: { xs: 5, md: 7 } }}>
          <Stack spacing={{ xs: 3.5, md: 4.5 }}>
            <Stack spacing={{ xs: 2.25, md: 2.6 }} alignItems={{ xs: 'flex-start', sm: 'center' }} textAlign={{ xs: 'left', sm: 'center' }}>
              <Stack spacing={1.1} sx={{ width: '100%' }}>
              <Box
                component="img"
                src="/favicon.png"
                alt=""
                aria-hidden
                sx={{
                  width: { xs: 46, md: 56 },
                  height: 'auto',
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                  opacity: 0.95,
                }}
              />
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontSize: { xs: '2rem', md: '2.75rem' },
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                }}
              >
                {t('landing.title')}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500, lineHeight: 1.35 }}>
                {t('landing.subtitle')}
              </Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ maxWidth: 700, fontSize: { xs: '0.98rem', md: '1rem' }, lineHeight: 1.65 }}>
              {t('landing.description')}
            </Typography>

            <Stack spacing={1.2} sx={{ width: '100%', maxWidth: 320 }}>
              <Button
                component={RouterLink}
                to="/app"
                variant="contained"
                size="large"
                sx={{
                  width: '100%',
                  minHeight: 46,
                  borderRadius: 2.5,
                  boxShadow: (theme) => theme.shadows[2],
                  transition: 'transform 160ms ease, box-shadow 160ms ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: (theme) => theme.shadows[5],
                  },
                }}
              >
                {t('landing.actions.openApp')}
              </Button>

              <Button
                component={RouterLink}
                to="/register"
                variant="outlined"
                size="large"
                sx={{
                  width: '100%',
                  minHeight: 46,
                  borderRadius: 2.5,
                  borderColor: 'divider',
                  color: 'text.primary',
                  transition: 'transform 160ms ease, border-color 160ms ease, background-color 160ms ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    borderColor: 'text.secondary',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                {t('landing.actions.register')}
              </Button>
            </Stack>

            <Stack spacing={0.4} alignItems={{ xs: 'flex-start', sm: 'center' }} textAlign={{ xs: 'left', sm: 'center' }} sx={{ pt: { xs: 0.2, md: 0.4 } }}>
              <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
                {t('statusNote')}
              </Typography>
              <Link
                href={t('statusOpenSource.githubUrl')}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                color="text.secondary"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: { xs: 'flex-start', sm: 'center' },
                  gap: 0.65,
                  fontSize: { xs: '0.84rem', md: '0.9rem' },
                  lineHeight: 1.45,
                  textDecorationColor: 'rgba(0, 0, 0, 0.26)',
                  '&:hover': {
                    color: 'text.primary',
                    textDecorationColor: 'currentColor',
                  },
                }}
              >
                <GitHubIcon sx={{ fontSize: { xs: '0.95rem', md: '1rem' }, flexShrink: 0 }} />
                {t('statusOpenSource.text')}
              </Link>
            </Stack>
          </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: { xs: 2.5, md: 2.75 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.25, sm: 3 }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Link component={RouterLink} to="/impressum" underline="hover" color="text.secondary" sx={{ fontSize: '0.92rem' }}>
                {t('footer.imprint')}
              </Link>
              <Link component={RouterLink} to="/datenschutz" underline="hover" color="text.secondary" sx={{ fontSize: '0.92rem' }}>
                {t('footer.privacy')}
              </Link>
            </Stack>
            <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover" color="text.secondary" sx={{ fontSize: '0.92rem' }}>
              {t('footer.contactLabel', { email: t('footer.contactEmail') })}
            </Link>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
