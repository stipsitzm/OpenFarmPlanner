import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Box,
  Button,
  Container,
  Link,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import LegalLinks from '../../components/legal/LegalLinks';

const PRODUCT_TOUR_ITEMS = [
  {
    key: 'areas',
    image: '/landing/screenshots/demo-areas.webp',
  },
  {
    key: 'calendar',
    image: '/landing/screenshots/demo-calendar.webp',
  },
  {
    key: 'seedDemand',
    image: '/landing/screenshots/demo-seed-demand.webp',
  },
  {
    key: 'cultures',
    image: '/landing/screenshots/demo-cultures.webp',
  },
] as const;

type ProductTourKey = (typeof PRODUCT_TOUR_ITEMS)[number]['key'];

/**
 * Public landing page with refined spacing and modern visual hierarchy.
 *
 * @returns Landing page UI.
 */
export default function HomePage() {
  const { t } = useTranslation('home');
  const [activeTourKey, setActiveTourKey] = useState<ProductTourKey>('areas');
  const activeTourItem = PRODUCT_TOUR_ITEMS.find((item) => item.key === activeTourKey) ?? PRODUCT_TOUR_ITEMS[0];

  const handleTourChange = (_event: SyntheticEvent, value: ProductTourKey): void => {
    setActiveTourKey(value);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="main" sx={{ flex: 1 }}>
        <Container maxWidth="lg" sx={{ width: '100%', py: { xs: 5, md: 7 } }}>
          <Stack spacing={{ xs: 5.5, md: 7 }} alignItems="center">
            <Stack spacing={{ xs: 2.25, md: 2.6 }} alignItems="center" textAlign="center">
              <Stack spacing={1.1} sx={{ width: '100%' }}>
                <Box
                  component="img"
                  src="/favicon.png"
                  alt=""
                  aria-hidden
                  sx={{
                    width: { xs: 46, md: 56 },
                    height: 'auto',
                    alignSelf: 'center',
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
                  to="/login"
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

              <Stack spacing={0.4} alignItems="center" textAlign="center" sx={{ pt: { xs: 0.2, md: 0.4 } }}>
                <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {t('statusNote')}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: { xs: '0.84rem', md: '0.9rem' }, lineHeight: 1.45 }}>
                  {t('statusOpenSource.text')}
                </Typography>
                <Link
                  href={t('statusOpenSource.githubUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  color="primary"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.55,
                    px: 0.9,
                    py: 0.45,
                    mt: 0.25,
                        borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    fontSize: { xs: '0.86rem', md: '0.92rem' },
                    fontWeight: 600,
                    lineHeight: 1.4,
                    textDecorationColor: 'rgba(25, 118, 210, 0.5)',
                    transition: 'color 180ms ease, text-decoration-color 180ms ease, background-color 180ms ease',
                    '&:hover': {
                      color: 'primary.dark',
                      textDecorationColor: 'currentColor',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <GitHubIcon sx={{ fontSize: { xs: '0.95rem', md: '1rem' }, flexShrink: 0 }} />
                  {t('statusOpenSource.linkLabel')}
                </Link>
              </Stack>
            </Stack>

            <Box
              component="section"
              aria-labelledby="product-tour-title"
              sx={{
                width: '100%',
                pt: { xs: 3.5, md: 4.5 },
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Stack spacing={{ xs: 2.5, md: 3.5 }}>
                <Stack spacing={1.25} alignItems="center" textAlign="center">
                  <Typography id="product-tour-title" variant="h4" component="h2" sx={{ fontWeight: 600 }}>
                    {t('productTour.title')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.6 }}>
                    {t('productTour.description')}
                  </Typography>
                </Stack>

                <Box>
                  <Tabs
                    value={activeTourKey}
                    onChange={handleTourChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label={t('productTour.tabsLabel')}
                    sx={{
                      minHeight: 44,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '& .MuiTab-root': {
                        minHeight: 44,
                        px: { xs: 1.25, sm: 2 },
                        textTransform: 'none',
                        fontWeight: 600,
                      },
                    }}
                  >
                    {PRODUCT_TOUR_ITEMS.map((item) => (
                      <Tab
                        key={item.key}
                        label={t(`productTour.items.${item.key}.tab`)}
                        value={item.key}
                      />
                    ))}
                  </Tabs>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
                      gap: { xs: 2, md: 4 },
                      alignItems: 'center',
                      pt: { xs: 2, md: 3 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          minWidth: 0,
                          width: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: 'background.paper',
                          boxShadow: (theme) => theme.shadows[2],
                        }}
                      >
                        <Box
                          component="img"
                          src={activeTourItem.image}
                          alt={t(`productTour.items.${activeTourItem.key}.alt`)}
                          loading="eager"
                          decoding="async"
                          width={1280}
                          height={800}
                          sx={{
                            display: 'block',
                            width: '100%',
                            height: 'auto',
                          }}
                        />
                      </Box>
                    </Box>

                    <Stack
                      spacing={1}
                      sx={{
                        minWidth: 0,
                        width: '100%',
                        alignSelf: { xs: 'start', md: 'center' },
                      }}
                    >
                      <Typography variant="h5" component="h3" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {t(`productTour.items.${activeTourItem.key}.title`)}
                      </Typography>
                      <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
                        {t(`productTour.items.${activeTourItem.key}.description`)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </Box>
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
            <LegalLinks />
            <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover" color="text.secondary" sx={{ fontSize: '0.92rem' }}>
              {t('footer.contactLabel', { email: t('footer.contactEmail') })}
            </Link>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
