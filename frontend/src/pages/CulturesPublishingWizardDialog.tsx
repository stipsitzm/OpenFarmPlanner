import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { cropSpeciesAPI, cultureAPI, type Culture } from '../api/api';
import type { CropSpecies, PublishPublicCulturePreview } from '../api/types';
import { useTranslation } from '../i18n';
import i18n from '../i18n/config';

interface CulturesPublishingWizardDialogProps {
  open: boolean;
  culture: Culture | undefined;
  termsAlreadyAccepted: boolean;
  publishing: boolean;
  onClose: () => void;
  onPublish: (data: { acceptedPublicLibraryTerms: boolean; cropSpeciesId: number; originalLanguageCode: string }) => void;
}

const LANGUAGE_CODES = ['de', 'en'] as const;
const EMPTY_LANGUAGE_CODES: string[] = [];
const EMPTY_REQUIRED_FIELDS: PublishPublicCulturePreview['missing_required_fields'] = [];
const EMPTY_DUPLICATES: PublishPublicCulturePreview['duplicates'] = [];

const getDefaultLanguageCode = (): string => {
  const language = (i18n.language || 'de').split('-')[0];
  return LANGUAGE_CODES.includes(language as (typeof LANGUAGE_CODES)[number]) ? language : 'de';
};

function StatusIcon({ status }: { status: 'complete' | 'missing' | 'optional' }) {
  if (status === 'complete') {
    return <CheckCircleIcon color="success" fontSize="small" />;
  }
  if (status === 'missing') {
    return <ErrorOutlineIcon color="warning" fontSize="small" />;
  }
  return <InfoOutlinedIcon color="info" fontSize="small" />;
}

export function CulturesPublishingWizardDialog({
  open,
  culture,
  termsAlreadyAccepted,
  publishing,
  onClose,
  onPublish,
}: CulturesPublishingWizardDialogProps) {
  const { t } = useTranslation(['cultures', 'common']);
  const [species, setSpecies] = useState<CropSpecies[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<CropSpecies | null>(null);
  const [originalLanguageCode, setOriginalLanguageCode] = useState(getDefaultLanguageCode());
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [preview, setPreview] = useState<PublishPublicCulturePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [proposalName, setProposalName] = useState('');
  const [proposalSent, setProposalSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAcceptedLicense(false);
      setProposalName('');
      setProposalSent(false);
      setOriginalLanguageCode(getDefaultLanguageCode());
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSpeciesLoading(true);
    });
    cropSpeciesAPI.list()
      .then((response) => {
        if (cancelled) return;
        setSpecies(response.data.results);
        const cultureSpeciesId = culture?.crop_species ?? null;
        setSelectedSpecies(response.data.results.find((item) => item.id === cultureSpeciesId) ?? null);
      })
      .catch((error) => {
        console.error('Error loading crop species:', error);
      })
      .finally(() => {
        if (!cancelled) setSpeciesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [culture?.crop_species, open]);

  useEffect(() => {
    if (!open || !culture?.id) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPreviewLoading(true);
    });
    cultureAPI.publishPreview(culture.id, {
      crop_species_id: selectedSpecies?.id,
      original_language_code: originalLanguageCode,
    })
      .then((response) => {
        if (!cancelled) setPreview(response.data);
      })
      .catch((error) => {
        console.error('Error loading publishing preview:', error);
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [culture?.id, open, originalLanguageCode, selectedSpecies?.id]);

  const availableLanguageCodes = preview?.available_language_codes ?? EMPTY_LANGUAGE_CODES;
  const missingRequiredFields = preview?.missing_required_fields ?? EMPTY_REQUIRED_FIELDS;
  const duplicates = preview?.duplicates ?? EMPTY_DUPLICATES;
  const licenseAccepted = termsAlreadyAccepted || acceptedLicense;
  const canPublish = Boolean(preview?.can_publish && selectedSpecies && licenseAccepted && !publishing);

  const summaryItems = useMemo(() => [
    {
      label: t('library.publishWizard.steps.species'),
      status: selectedSpecies ? 'complete' : 'missing',
      detail: selectedSpecies?.name ?? t('library.publishWizard.speciesMissing'),
    },
    {
      label: t('library.publishWizard.steps.language'),
      status: originalLanguageCode ? 'complete' : 'missing',
      detail: t(`library.publishWizard.languages.${originalLanguageCode || 'de'}`),
    },
    {
      label: t('library.publishWizard.steps.translations'),
      status: 'optional',
      detail: t('library.publishWizard.translationsOptional'),
    },
    {
      label: t('library.publishWizard.steps.requiredFields'),
      status: missingRequiredFields.length ? 'missing' : 'complete',
      detail: missingRequiredFields.length
        ? missingRequiredFields.map((item) => t(item.label_key)).join(', ')
        : t('library.publishWizard.requiredComplete'),
    },
    {
      label: t('library.publishWizard.steps.duplicates'),
      status: duplicates.length ? 'missing' : 'complete',
      detail: duplicates.length
        ? duplicates.map((item) => item.variety ? `${item.name} (${item.variety})` : item.name).join(', ')
        : t('library.publishWizard.noDuplicates'),
    },
    {
      label: t('library.publishWizard.steps.license'),
      status: licenseAccepted ? 'complete' : 'missing',
      detail: licenseAccepted ? t('library.publishWizard.licenseComplete') : t('library.publishWizard.licenseMissing'),
    },
  ] as const, [duplicates, licenseAccepted, missingRequiredFields, originalLanguageCode, selectedSpecies, t]);
  const firstMissingStep = summaryItems.findIndex((item) => item.status === 'missing');
  const activeStep = firstMissingStep === -1 ? summaryItems.length : firstMissingStep;

  const handleProposeSpecies = useCallback(async () => {
    const trimmedName = proposalName.trim();
    if (!trimmedName) return;
    await cropSpeciesAPI.propose(trimmedName);
    setProposalName('');
    setProposalSent(true);
  }, [proposalName]);

  const handlePublish = useCallback(() => {
    if (!selectedSpecies) return;
    onPublish({
      acceptedPublicLibraryTerms: !termsAlreadyAccepted && acceptedLicense,
      cropSpeciesId: selectedSpecies.id,
      originalLanguageCode,
    });
  }, [acceptedLicense, onPublish, originalLanguageCode, selectedSpecies, termsAlreadyAccepted]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('library.publishWizard.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {summaryItems.map((item) => (
              <Step key={item.label} completed={item.status === 'complete'}>
                <StepLabel error={item.status === 'missing'}>{item.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Alert severity="info">{t('library.publishWizard.intro', { name: culture?.name ?? '' })}</Alert>

          <Box>
            <Typography variant="subtitle1" gutterBottom>{t('library.publishWizard.steps.species')}</Typography>
            <Autocomplete
              options={species}
              value={selectedSpecies}
              loading={speciesLoading}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => setSelectedSpecies(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('library.publishWizard.speciesLabel')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {speciesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
              <TextField
                value={proposalName}
                onChange={(event) => setProposalName(event.target.value)}
                label={t('library.publishWizard.proposeSpeciesLabel')}
                size="small"
                fullWidth
              />
              <Button variant="outlined" onClick={() => void handleProposeSpecies()} disabled={!proposalName.trim()}>
                {t('library.publishWizard.proposeSpeciesButton')}
              </Button>
            </Stack>
            {proposalSent ? <Typography sx={{ mt: 1 }} variant="body2" color="success.main">{t('library.publishWizard.proposalSent')}</Typography> : null}
          </Box>

          <Box>
            <Typography variant="subtitle1" gutterBottom>{t('library.publishWizard.steps.language')}</Typography>
            <FormControl fullWidth>
              <InputLabel id="publishing-original-language-label">{t('library.publishWizard.originalLanguageLabel')}</InputLabel>
              <Select
                labelId="publishing-original-language-label"
                label={t('library.publishWizard.originalLanguageLabel')}
                value={originalLanguageCode}
                onChange={(event) => setOriginalLanguageCode(event.target.value)}
              >
                {LANGUAGE_CODES.map((code) => (
                  <MenuItem key={code} value={code}>{t(`library.publishWizard.languages.${code}`)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography variant="subtitle1" gutterBottom>{t('library.publishWizard.steps.translations')}</Typography>
            <List dense>
              {LANGUAGE_CODES.map((code) => {
                const available = availableLanguageCodes.includes(code);
                return (
                  <ListItem key={code} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <StatusIcon status={available ? 'complete' : 'optional'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={t(`library.publishWizard.languages.${code}`)}
                      secondary={available ? t('library.publishWizard.translationAvailable') : t('library.publishWizard.translationMissingOptional')}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>

          <Box>
            <Typography variant="subtitle1" gutterBottom>{t('library.publishWizard.summaryTitle')}</Typography>
            {previewLoading ? <CircularProgress size={24} /> : (
              <List dense>
                {summaryItems.map((item) => (
                  <ListItem key={item.label} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <StatusIcon status={item.status} />
                    </ListItemIcon>
                    <ListItemText primary={item.label} secondary={item.detail} />
                  </ListItem>
                ))}
              </List>
            )}
            {duplicates.length ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t('library.publishWizard.duplicateBlocking')}
              </Alert>
            ) : null}
          </Box>

          <Divider />

          {termsAlreadyAccepted ? (
            <Alert severity="success">{t('library.publishWizard.licenseAlreadyAccepted')}</Alert>
          ) : (
            <FormControlLabel
              control={<Checkbox checked={acceptedLicense} onChange={(event) => setAcceptedLicense(event.target.checked)} />}
              label={t('library.publishConfirm.acceptLicense')}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {t('library.publishConfirm.linkPrefix')}
            <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener">{t('library.publishConfirm.privacyLinkLabel')}</Link>
            {t('library.publishConfirm.linkMiddle')}
            <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener">{t('library.publishConfirm.termsLinkLabel')}</Link>
            {t('library.publishConfirm.linkSuffix')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">{t('common:actions.cancel')}</Button>
        <Button onClick={handlePublish} variant="contained" disabled={!canPublish}>
          {publishing ? t('library.publishing') : t('library.publishWizard.publishNow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
