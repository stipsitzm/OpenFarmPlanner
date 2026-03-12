import { Button, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function HomePage(): React.ReactElement {
  return (
    <Container sx={{ py: 8 }}>
      <Typography variant="h3" gutterBottom>OpenFarmPlanner</Typography>
      <Typography sx={{ mb: 3 }}>Public landing page placeholder.</Typography>
      <Button component={RouterLink} to="/app" variant="contained">Open App</Button>
    </Container>
  );
}
