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

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 7, md: 10 } }}>
        <Stack spacing={{ xs: 6, md: 8 }}>
          <Stack spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} textAlign={{ xs: 'left', sm: 'center' }}>
            <Stack spacing={1.5}>
              <Box
                component="img"
                src="/favicon.png"
                alt=""
                aria-hidden
                sx={{
                  width: { xs: 42, md: 52 },
                  height: 'auto',
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                  opacity: 0.92,
                }}
              />
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '2rem', md: '2.75rem' } }}>
                {t('landing.title')}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t('landing.subtitle')}
              </Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
              {t('landing.description')}
            </Typography>
            <Stack spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 } }}>
              <Button component={RouterLink} to="/app" variant="contained" size="large" sx={{ minWidth: 220 }}>
                {t('landing.actions.openApp')}
              </Button>
              <Button component={RouterLink} to="/register" variant="outlined" size="large" sx={{ minWidth: 220 }}>
                {t('landing.actions.register')}
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={0.6} alignItems="center" textAlign="center" sx={{ pt: { xs: 0.5, md: 1 }, pb: { xs: 0.5, md: 1 } }}>
            <Typography color="text.secondary">
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
                justifyContent: 'center',
                gap: 0.7,
                lineHeight: 1.5,
              }}
            >
              <GitHubIcon sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }} />
              {t('statusOpenSource.text')}
            </Link>
          </Stack>
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
