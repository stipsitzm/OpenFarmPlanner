import { Button, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from '../../i18n';

export default function HomePage(): React.ReactElement {
  const { t } = useTranslation('auth');

  return (
    <Container sx={{ py: 8 }}>
      <Typography variant="h3" gutterBottom>OpenFarmPlanner</Typography>
      <Typography sx={{ mb: 3 }}>{t('home.publicPlaceholder')}</Typography>
      <Stack direction="row" spacing={2}>
        <Button component={RouterLink} to="/app" variant="contained">{t('home.openApp')}</Button>
        <Button component={RouterLink} to="/login" variant="outlined">{t('home.login')}</Button>
        <Button component={RouterLink} to="/register" variant="outlined">{t('home.register')}</Button>
      </Stack>
    </Container>
  );
}
