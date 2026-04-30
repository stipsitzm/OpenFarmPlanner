import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, plantingPlanAPI, type Bed, type Culture, type Field, type Location, type PlantingPlan } from '../api/api';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import { getFirstMissingRequirement } from './requirementFlow';
import { deriveLocationTasks } from './locationDerivedTasks';

const NEXT_STEP_CONFIG = {
  locations: { textKey: 'dashboard:nextStep.locations.text', actionKey: 'dashboard:nextStep.locations.action', to: '/app/locations' },
  beds: { textKey: 'dashboard:nextStep.beds.text', actionKey: 'dashboard:nextStep.beds.action', to: '/app/fields' },
  cultures: { textKey: 'dashboard:nextStep.cultures.text', actionKey: 'dashboard:nextStep.cultures.action', to: '/app/cultures' },
  plans: { textKey: 'dashboard:nextStep.plans.text', actionKey: 'dashboard:nextStep.plans.action', to: '/app/planting-plans' },
} as const;

export default function Dashboard(): React.ReactElement {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [plans, setPlans] = useState<PlantingPlan[]>([]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setLoading(false);
      setError(null);
      setLocations([]); setFields([]); setBeds([]); setCultures([]); setPlans([]);
      return;
    }
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        const [locationsRes, fieldsRes, bedsRes, culturesRes, plansRes] = await Promise.all([
          locationAPI.list(), fieldAPI.list(), bedAPI.list(), cultureAPI.list(), plantingPlanAPI.list(),
        ]);
        setLocations(locationsRes.data.results);
        setFields(fieldsRes.data.results);
        setBeds(bedsRes.data.results);
        setCultures(culturesRes.data.results);
        setPlans(plansRes.data.results);
        setError(null);
      } catch {
        setError(t('dashboard:errors.load'));
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [shouldShowProjectRequiredState, t]);

  const firstMissingRequirement = getFirstMissingRequirement({ hasLocations: locations.length > 0, hasBeds: beds.length > 0, hasCultures: cultures.length > 0, hasPlans: plans.length > 0 });
  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';

  const setupItems = [
    { label: t('dashboard:setup.location'), done: locations.length > 0 },
    { label: t('dashboard:setup.bed'), done: beds.length > 0 },
    { label: t('dashboard:setup.culture'), done: cultures.length > 0 },
    { label: t('dashboard:setup.plan'), done: plans.length > 0 },
  ];

  const upcomingTasks = useMemo(() => {
    const byLocation = deriveLocationTasks({ locations, fields, beds, cultures, plantingPlans: plans });
    return Object.values(byLocation).flat().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [beds, cultures, fields, locations, plans]);

  const locationNameById = useMemo(() => new Map(locations.filter((l) => l.id !== undefined).map((l) => [l.id as number, l.name])), [locations]);

  if (loading) return <PageContainer><Typography>{t('common:messages.loading')}</Typography></PageContainer>;
  if (shouldShowProjectRequiredState && missingProjectReason) return <PageContainer><ProjectRequiredState reason={missingProjectReason} /></PageContainer>;

  const isEmptyProject = locations.length === 0 && beds.length === 0 && cultures.length === 0 && plans.length === 0;
  const isSetupComplete = firstMissingRequirement === null;

  return (
    <PageContainer>
      <PageHeader title={t('dashboard:title')} />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {isEmptyProject ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{t('dashboard:emptyState.title')}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>{t('dashboard:emptyState.description')}</Typography>
            <Button component={RouterLink} to="/app/locations" variant="contained">{t('dashboard:emptyState.action')}</Button>
          </CardContent>
        </Card>
      ) : null}

      {!isSetupComplete ? (
        <>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('dashboard:setup.title')}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {setupItems.map((item) => <Chip key={item.label} label={`${item.label}: ${item.done ? t('dashboard:status.done') : t('dashboard:status.missing')}`} color={item.done ? 'success' : 'default'} />)}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('dashboard:nextStep.title')}</Typography>
              {firstMissingRequirement ? (
                <>
                  <Typography variant="body2" sx={{ mb: 1.5 }}>{t(NEXT_STEP_CONFIG[firstMissingRequirement].textKey)}</Typography>
                  <Button component={RouterLink} to={NEXT_STEP_CONFIG[firstMissingRequirement].to} variant="contained">{t(NEXT_STEP_CONFIG[firstMissingRequirement].actionKey)}</Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {isSetupComplete || (!isSetupComplete && upcomingTasks.length > 0) ? (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('dashboard:tasks.title')}</Typography>
          {upcomingTasks.length === 0 ? (
            <>
              <Typography variant="subtitle2">{t('dashboard:tasks.emptyTitle')}</Typography>
              <Typography variant="body2">{t('dashboard:tasks.emptyDescription')}</Typography>
            </>
          ) : (
            <Stack spacing={0.75}>
              {upcomingTasks.map((task) => (
                <Box key={`${task.locationId}-${task.type}-${task.date}-${task.planId ?? 'na'}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>
                  <Typography variant="body2">{new Date(`${task.date}T00:00:00`).toLocaleDateString(locale)} – {t(`locations:taskTitles.${task.type}`)}</Typography>
                  <Typography variant="caption" color="text.secondary">{task.cultureName ?? ''}{task.cultureName && task.locationId ? ' · ' : ''}{locationNameById.get(task.locationId) ?? ''}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
      ) : null}
    </PageContainer>
  );
}
