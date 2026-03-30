import { Box, Container, Stack, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';

export default function ImprintPage(): React.ReactElement {
  const { t } = useTranslation('home');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={3}>
        <Typography variant="h3" component="h1">{t('legal.imprint.title')}</Typography>
        <Typography color="text.secondary">{t('legal.imprint.disclaimer')}</Typography>

        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('legal.imprint.sections.provider.title')}</Typography>
          <Typography color="text.secondary">{t('legal.imprint.sections.provider.content')}</Typography>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('legal.imprint.sections.contact.title')}</Typography>
          <Typography color="text.secondary">{t('legal.imprint.sections.contact.content')}</Typography>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('legal.imprint.sections.responsibility.title')}</Typography>
          <Typography color="text.secondary">{t('legal.imprint.sections.responsibility.content')}</Typography>
        </Box>
      </Stack>
    </Container>
  );
}
