import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import LegalLinks from '../../components/legal/LegalLinks';
import { useTranslation } from '../../i18n';

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  legalLinksDense?: boolean;
};

const benefits = [
  'openSource',
  'free',
  'marketGardens',
  'unlimitedProjects',
  'privacyFriendly',
] as const;

export default function AuthPageShell({ title, subtitle, children, legalLinksDense = false }: AuthPageShellProps) {
  const { t } = useTranslation('auth');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f5f7f1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-start', md: 'center' },
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 5, md: 7 },
        }}
      >
        <Stack spacing={{ xs: 2.5, md: 3.5 }} alignItems="center">
          <Stack direction="row" spacing={1.4} alignItems="center" justifyContent="center">
            <Box
              component="img"
              src="/favicon.png"
              alt=""
              aria-hidden
              sx={{ width: { xs: 40, md: 48 }, height: 'auto', opacity: 0.95 }}
            />
            <Typography
              variant="h2"
              component="div"
              sx={{
                fontSize: { xs: '1.9rem', md: '2.5rem' },
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              OpenFarmPlanner
            </Typography>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: { xs: 560, md: 920 },
              borderRadius: { xs: 3, md: 4 },
              border: '1px solid rgba(46, 125, 50, 0.12)',
              boxShadow: '0 16px 44px rgba(28, 42, 30, 0.11)',
              bgcolor: '#fff',
              p: { xs: 2.5, sm: 4, md: 4.5 },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 440px) minmax(240px, 1fr)' },
                gap: { xs: 3, md: 5 },
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1.85rem', md: '2.15rem' },
                    lineHeight: 1.18,
                    mb: 1,
                  }}
                >
                  {title}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.55 }}>
                  {subtitle}
                </Typography>
                <Box sx={{ mt: { xs: 2.75, sm: 3.25 } }}>{children}</Box>
              </Box>

              <Box
                sx={{
                  display: { xs: 'none', md: 'block' },
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                  pl: 4,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  {t('benefits.title')}
                </Typography>
                <Stack spacing={1.4}>
                  {benefits.map((benefit) => (
                    <Stack key={benefit} direction="row" spacing={1.2} alignItems="center">
                      <CheckCircleOutlineIcon color="primary" fontSize="small" aria-hidden />
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {t(`benefits.${benefit}`)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Paper>

          <LegalLinks dense={legalLinksDense} sx={{ justifyContent: 'center' }} />
        </Stack>
      </Container>
    </Box>
  );
}
