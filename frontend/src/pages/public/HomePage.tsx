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
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useTranslation } from '../../i18n';
import LegalLinks from '../../components/legal/LegalLinks';

const PRODUCT_TOUR_ITEMS = [
  {
    key: 'areas',
    image: '/landing/screenshots/demo-areas.webp',
  },
  {
    key: 'cultures',
    image: '/landing/screenshots/demo-cultures.webp',
  },
  {
    key: 'plantingPlans',
    image: '/landing/screenshots/demo-planting-plans.webp',
  },
  {
    key: 'calendar',
    image: '/landing/screenshots/demo-calendar.webp',
  },
  {
    key: 'yieldOverview',
    image: '/landing/screenshots/demo-yield-overview.webp',
  },
  {
    key: 'seedDemand',
    image: '/landing/screenshots/demo-seed-demand.webp',
  },
] as const;

type ProductTourKey = (typeof PRODUCT_TOUR_ITEMS)[number]['key'];

const HERO_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.7), 0 2px 12px rgba(0,0,0,0.5)';

// Single glassmorphism card behind all hero content (heading, description,
// buttons, beta note, GitHub link) - one clearly-bounded, semi-transparent
// panel instead of separate backgrounds per line/element, so there's no risk
// of overlapping panels double-darkening the gaps between them.
const HERO_CARD_SX = {
  position: 'relative' as const,
  zIndex: 1,
  width: '100%',
  maxWidth: 640,
  mx: 'auto',
  px: { xs: 3, sm: 4, md: 5 },
  py: { xs: 3.5, sm: 4, md: 5 },
  borderRadius: { xs: 4, md: 6 },
  border: '1px solid rgba(255,255,255,0.28)',
  backgroundColor: 'rgba(8,24,14,0.5)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
};

/**
 * Public landing page with refined spacing and modern visual hierarchy.
 *
 * @returns Landing page UI.
 */
export default function HomePage() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const { startGuestDemo } = useAuth();
  const [isStartingDemo, setIsStartingDemo] = useState(false);
  const [activeTourKey, setActiveTourKey] = useState<ProductTourKey>('areas');
  const activeTourItem = PRODUCT_TOUR_ITEMS.find((item) => item.key === activeTourKey) ?? PRODUCT_TOUR_ITEMS[0];

  const handleTourChange = (_event: SyntheticEvent, value: ProductTourKey): void => {
    setActiveTourKey(value);
  };

  
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="main" sx={{ flex: 1 }}>
        <Container maxWidth="lg" sx={{ width: '100%', pt: { xs: 2.5, md: 3.5 }, pb: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1.4} alignItems="center" justifyContent="center">
            <Box
              component="img"
              src="/favicon.png"
              alt=""
              aria-hidden
              sx={{
                width: { xs: 40, md: 48 },
                height: 'auto',
                opacity: 0.95,
              }}
            />
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontSize: { xs: '1.9rem', md: '2.5rem' },
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {t('landing.title')}
            </Typography>
          </Stack>
        </Container>

        <Box
          component="section"
          role="img"
          aria-label={t('landing.heroImageAlt')}
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            px: 2,
            py: { xs: 4.5, md: 6 },
            overflow: 'hidden',
            backgroundImage: 'url(/landing/hero-field.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <Box sx={HERO_CARD_SX}>
            <Stack spacing={2.4} alignItems="center">
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: '#fff',
                  textShadow: HERO_TEXT_SHADOW,
                }}
              >
                {t('landing.subtitle')}
              </Typography>
              <Typography
                sx={{
                  maxWidth: 560,
                  fontSize: { xs: '0.98rem', md: '1rem' },
                  lineHeight: 1.65,
                  color: 'rgba(255,255,255,0.94)',
                  textShadow: HERO_TEXT_SHADOW,
                }}
              >
                {t('landing.description')}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: '100%', maxWidth: 500, pt: 0.5 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  disabled={isStartingDemo}
                  onClick={() => {
                    setIsStartingDemo(true);
                    void startGuestDemo().then(() => navigate('/app/fields-beds')).finally(() => setIsStartingDemo(false));
                  }}
                  sx={{ flex: 1, minHeight: 46, borderRadius: 2.5 }}
                >
                  {isStartingDemo ? t('landing.actions.startingDemo') : t('landing.actions.demo')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  size="large"
                  sx={{
                    flex: 1,
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
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 2.5,
                    bgcolor: '#fff',
                    boxShadow: (theme) => theme.shadows[2],
                    transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                    '&:hover': {
                      bgcolor: '#fff',
                      transform: 'translateY(-1px)',
                      boxShadow: (theme) => theme.shadows[5],
                    },
                  }}
                >
                  {t('landing.actions.register')}
                </Button>
              </Stack>

              <Stack spacing={0.8} alignItems="center" textAlign="center" sx={{ pt: { xs: 0.6, md: 0.9 } }}>
                <Typography sx={{ lineHeight: 1.5, color: '#fff', textShadow: HERO_TEXT_SHADOW }}>
                  {t('statusNote')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: '0.84rem', md: '0.9rem' },
                    lineHeight: 1.45,
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: HERO_TEXT_SHADOW,
                  }}
                >
                  {t('statusOpenSource.text')}
                </Typography>
                <Link
                  href={t('statusOpenSource.githubUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  color="primary"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.55,
                    px: 1.1,
                    py: 0.5,
                    mt: 0.5,
                    borderRadius: 1,
                    border: 2,
                    borderColor: 'primary.main',
                    bgcolor: '#fff',
                    cursor: 'pointer',
                    fontSize: { xs: '0.86rem', md: '0.92rem' },
                    fontWeight: 600,
                    lineHeight: 1.4,
                    boxShadow: (theme) => theme.shadows[1],
                    transition: 'color 180ms ease, border-color 180ms ease, background-color 180ms ease',
                    '&:hover': {
                      color: 'primary.dark',
                      borderColor: 'primary.dark',
                      bgcolor: '#fff',
                    },
                  }}
                >
                  <GitHubIcon sx={{ fontSize: { xs: '0.95rem', md: '1rem' }, flexShrink: 0 }} />
                  {t('statusOpenSource.linkLabel')}
                </Link>
              </Stack>
            </Stack>
          </Box>
        </Box>

        <Container maxWidth="xl" sx={{ width: '100%', py: { xs: 5, md: 7 } }}>
          <Stack spacing={{ xs: 5.5, md: 7 }} alignItems="center">
            <Box
              component="section"
              aria-labelledby="product-tour-title"
              sx={{ width: '100%' }}
            >
              <Stack spacing={{ xs: 2.5, md: 3.5 }}>
                <Stack spacing={1.25} alignItems="center" textAlign="center">
                  <Typography
                    id="product-tour-title"
                    variant="h4"
                    component="h2"
                    sx={{
                      fontSize: { xs: '1.8rem', md: '2.125rem' },
                      fontWeight: 600,
                      lineHeight: 1.18,
                    }}
                  >
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
                      '& .MuiTabs-indicator': {
                        transition: 'none',
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
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
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
