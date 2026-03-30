import { Box, Container, Stack, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';

const sectionKeys = [
  'controller',
  'processingOverview',
  'dataSubjects',
  'contact',
] as const;

export default function PrivacyPolicyPage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={3}>
        <Typography variant="h3" component="h1">{t('legal.privacy.title')}</Typography>
        <Typography color="text.secondary">{t('legal.privacy.disclaimer')}</Typography>

        {sectionKeys.map((sectionKey) => (
          <Box key={sectionKey}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t(`legal.privacy.sections.${sectionKey}.title`)}
            </Typography>
            <Typography color="text.secondary">
              {t(`legal.privacy.sections.${sectionKey}.content`)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Container>
  );
}
