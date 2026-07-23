import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import { publicCultureAPI } from '../../api/api';
import type {
  PublicCulture,
  PublicCultureChangeProposal,
  PublicCultureDiscussionComment,
} from '../../api/types';
import PageContainer from '../../components/layout/PageContainer';
import PageSurface from '../../components/layout/PageSurface';
import { useAuth } from '../../auth/useAuth';
import { useTranslation } from '../../i18n';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';

type CollaborationLoadStatus = 'idle' | 'loading' | 'success' | 'error';
type ProposalField = 'notes' | 'supplier_name' | 'growth_duration_days' | 'harvest_duration_days';

const PROPOSAL_FIELDS: ProposalField[] = ['notes', 'supplier_name', 'growth_duration_days', 'harvest_duration_days'];

const getCultureTitle = (culture: PublicCulture): string => (
  culture.variety ? `${culture.name} (${culture.variety})` : culture.name
);

const getSupplierLabel = (culture: PublicCulture): string => (
  culture.supplier_name || culture.seed_supplier || ''
);

function formatOptionalNumber(value: number | null | undefined, fallback: string): string {
  return value === null || value === undefined ? fallback : String(value);
}

function getCultivationTypeLabel(
  value: PublicCulture['cultivation_type'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'direct_sowing') {
    return t('library.page.fields.cultivationTypes.directSowing');
  }
  if (value === 'pre_cultivation') {
    return t('library.page.fields.cultivationTypes.preCultivation');
  }
  return fallback;
}

function getNutrientDemandLabel(
  value: PublicCulture['nutrient_demand'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return t(`library.page.fields.nutrientDemandValues.${value}`);
  }
  return fallback;
}

function getProposalFieldLabel(field: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (PROPOSAL_FIELDS.includes(field as ProposalField)) {
    return t(`library.page.proposals.fields.${field}`);
  }
  return field;
}

function getProposalValueLabel(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface ProposalCardProps {
  cultureId: number;
  proposal: PublicCultureChangeProposal;
  canModerate: boolean;
  statusLabel: string;
  anonymousLabel: string;
  formatDate: (value?: string | null) => string;
  onReviewed: () => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ProposalCard({
  cultureId,
  proposal,
  canModerate,
  statusLabel,
  anonymousLabel,
  formatDate,
  onReviewed,
  t,
}: ProposalCardProps) {
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null);
  const changedFields = Object.entries(proposal.proposed_data);

  const reviewProposal = async (decision: 'approve' | 'reject'): Promise<void> => {
    setReviewing(decision);
    try {
      if (decision === 'approve') {
        await publicCultureAPI.approveChangeProposal(cultureId, proposal.id);
        showGlobalSnackbar({ message: t('library.page.proposals.approveSuccess'), severity: 'success' });
      } else {
        await publicCultureAPI.rejectChangeProposal(cultureId, proposal.id);
        showGlobalSnackbar({ message: t('library.page.proposals.rejectSuccess'), severity: 'success' });
      }
      await onReviewed();
    } catch {
      showGlobalSnackbar({ message: t('library.page.proposals.reviewError'), severity: 'error' });
    } finally {
      setReviewing(null);
    }
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {proposal.summary}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('library.page.metaByDate', {
              author: proposal.proposed_by_label || anonymousLabel,
              date: formatDate(proposal.created_at),
            })}
          </Typography>
        </Box>
        <Chip size="small" label={statusLabel} color={proposal.status === 'pending' ? 'warning' : proposal.status === 'approved' ? 'success' : 'default'} />
      </Stack>
      {changedFields.length > 0 ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {changedFields.map(([field, value]) => (
            <Box key={field}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {getProposalFieldLabel(field, t)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {getProposalValueLabel(value, t('library.page.notSpecified'))}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
      {proposal.review_note ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {proposal.review_note}
        </Typography>
      ) : null}
      {canModerate && proposal.status === 'pending' ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="contained"
            disabled={reviewing !== null}
            onClick={() => void reviewProposal('approve')}
          >
            {reviewing === 'approve' ? t('library.page.proposals.approving') : t('library.page.proposals.approve')}
          </Button>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            disabled={reviewing !== null}
            onClick={() => void reviewProposal('reject')}
          >
            {reviewing === 'reject' ? t('library.page.proposals.rejecting') : t('library.page.proposals.reject')}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}

export default function PublicCropLibraryPage() {
  const { t, i18n } = useTranslation('cultures');
  const { user } = useAuth();
  const canModerate = Boolean(user?.is_staff || user?.is_superuser);
  const [query, setQuery] = useState('');
  const [cultures, setCultures] = useState<PublicCulture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [comments, setComments] = useState<PublicCultureDiscussionComment[]>([]);
  const [proposals, setProposals] = useState<PublicCultureChangeProposal[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationLoadStatus>('idle');
  const [commentBody, setCommentBody] = useState('');
  const [proposalSummary, setProposalSummary] = useState('');
  const [proposalField, setProposalField] = useState<ProposalField>('notes');
  const [proposalValue, setProposalValue] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');

  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
  const anonymousLabel = t('library.anonymousAuthor');

  const formatDate = useCallback((value?: string | null): string => {
    if (!value) {
      return t('library.page.unknownDate');
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  }, [locale, t]);

  const selectedCulture = useMemo(
    () => cultures.find((culture) => culture.id === selectedCultureId) ?? null,
    [cultures, selectedCultureId],
  );

  const loadCultures = useCallback(async (searchQuery: string): Promise<void> => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await publicCultureAPI.list(searchQuery.trim() ? { q: searchQuery.trim() } : undefined);
      const results = response.data.results;
      setCultures(results);
      setSelectedCultureId((currentId) => (
        currentId && results.some((culture) => culture.id === currentId)
          ? currentId
          : results[0]?.id ?? null
      ));
    } catch {
      setLoadError(t('library.loadError'));
      setCultures([]);
      setSelectedCultureId(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadCollaboration = useCallback(async (cultureId: number): Promise<void> => {
    setCollaborationStatus('loading');
    try {
      const [commentsResponse, proposalsResponse] = await Promise.all([
        publicCultureAPI.comments(cultureId),
        publicCultureAPI.changeProposals(cultureId),
      ]);
      setComments(commentsResponse.data);
      setProposals(proposalsResponse.data);
      setCollaborationStatus('success');
    } catch {
      setComments([]);
      setProposals([]);
      setCollaborationStatus('error');
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCultures(query);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadCultures, query]);

  useEffect(() => {
    if (selectedCultureId === null) {
      setComments([]);
      setProposals([]);
      setCollaborationStatus('idle');
      return;
    }
    void loadCollaboration(selectedCultureId);
  }, [loadCollaboration, selectedCultureId]);

  useEffect(() => {
    setCommentBody('');
    setProposalSummary('');
    setProposalField('notes');
    setProposalValue('');
  }, [selectedCultureId]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadCultures(query);
  };

  const handleImport = async (): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    setImportingId(selectedCulture.id);
    try {
      await publicCultureAPI.importToProject(selectedCulture.id);
      showGlobalSnackbar({ message: t('library.importSuccess', { name: getCultureTitle(selectedCulture) }), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.importError'), severity: 'error' });
    } finally {
      setImportingId(null);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCulture || !commentBody.trim()) {
      return;
    }
    setSubmittingComment(true);
    try {
      await publicCultureAPI.createComment(selectedCulture.id, commentBody.trim());
      setCommentBody('');
      await loadCollaboration(selectedCulture.id);
      showGlobalSnackbar({ message: t('library.page.discussion.commentSuccess'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.discussion.commentError'), severity: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleProposalSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCulture || !proposalSummary.trim() || !proposalValue.trim()) {
      return;
    }
    const proposedValue = proposalField === 'growth_duration_days' || proposalField === 'harvest_duration_days'
      ? Number(proposalValue)
      : proposalValue.trim();
    if (typeof proposedValue === 'number' && (!Number.isFinite(proposedValue) || proposedValue < 0)) {
      showGlobalSnackbar({ message: t('library.page.proposals.invalidNumber'), severity: 'error' });
      return;
    }
    setSubmittingProposal(true);
    try {
      await publicCultureAPI.createChangeProposal(selectedCulture.id, {
        summary: proposalSummary.trim(),
        proposed_data: { [proposalField]: proposedValue },
      });
      setProposalSummary('');
      setProposalField('notes');
      setProposalValue('');
      await loadCollaboration(selectedCulture.id);
      showGlobalSnackbar({ message: t('library.page.proposals.createSuccess'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.proposals.createError'), severity: 'error' });
    } finally {
      setSubmittingProposal(false);
    }
  };

  const libraryCardSx = {
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    bgcolor: 'background.paper',
  } as const;

  return (
    <PageContainer variant="xwide">
      <PageSurface variant="contentFit" sx={{ width: '100%', maxWidth: 1180 }}>
        <Stack spacing={2.25}>
          {loadError ? <Alert severity="error">{loadError}</Alert> : null}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 360px) minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'stretch',
              minHeight: { md: 560 },
            }}
          >
            <Card variant="outlined" sx={{ ...libraryCardSx, minHeight: 280 }}>
              <Box component="form" onSubmit={handleSearchSubmit} sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <TextField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  label={t('library.searchLabel')}
                  size="small"
                  fullWidth
                />
              </Box>
              {loading ? (
                <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : cultures.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t('library.emptyState.noResultsTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {t('library.empty')}
                  </Typography>
                </Box>
              ) : (
                <List disablePadding sx={{ maxHeight: { xs: 280, sm: 340, md: 640 }, overflow: 'auto' }}>
                  {cultures.map((culture) => (
                    <ListItemButton
                      key={culture.id}
                      selected={culture.id === selectedCultureId}
                      onClick={() => setSelectedCultureId(culture.id)}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                        px: 1.5,
                        py: 1.25,
                        '&.Mui-selected': {
                          bgcolor: 'success.50',
                          borderLeft: '3px solid',
                          borderLeftColor: 'success.main',
                          pl: 1.125,
                        },
                        '&.Mui-selected:hover': {
                          bgcolor: 'success.100',
                        },
                      }}
                    >
                      <ListItemText
                        primary={getCultureTitle(culture)}
                        secondary={getSupplierLabel(culture) || culture.crop_species_name || t('library.page.noSupplier')}
                        primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Card>

            <Card variant="outlined" sx={{ ...libraryCardSx, minHeight: 420 }}>
              {!selectedCulture ? (
                <Box sx={{ height: '100%', minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
                  <SpaOutlinedIcon sx={{ color: 'success.main', fontSize: 44, mb: 1.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t('library.emptyState.noSelectionTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 520, lineHeight: 1.6 }}>
                    {t('library.emptyState.noSelectionDescription')}
                  </Typography>
                </Box>
              ) : (
                <Stack sx={{ minHeight: '100%' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, bgcolor: 'action.hover' }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h5" component="h2" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
                          {getCultureTitle(selectedCulture)}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          <Chip size="small" label={t('library.versionLabel', { defaultValue: 'Version' }) + ` ${selectedCulture.version}`} />
                          <Chip size="small" label={selectedCulture.crop_species_name || selectedCulture.name} variant="outlined" />
                          <Chip size="small" label={t('library.page.byAuthor', { author: selectedCulture.created_by_label || anonymousLabel })} variant="outlined" />
                        </Stack>
                      </Box>
                      {isMobile ? (
                        <Tooltip title={t('library.importButton')}>
                          <span>
                            <IconButton
                              color="primary"
                              aria-label={t('library.importButton')}
                              disabled={importingId !== null}
                              onClick={() => void handleImport()}
                              sx={{ mt: -0.5 }}
                            >
                              <DownloadOutlinedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DownloadOutlinedIcon />}
                          disabled={importingId !== null}
                          onClick={() => void handleImport()}
                          sx={{ flexShrink: 0 }}
                        >
                          {importingId ? t('library.importing') : t('library.importButton')}
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                  <Divider />
                  <Tabs
                    value={activeTab}
                    onChange={(_, value: number) => setActiveTab(value)}
                    variant={isMobile ? 'fullWidth' : 'scrollable'}
                    allowScrollButtonsMobile
                    sx={{ px: { xs: 1, sm: 2 } }}
                  >
                    <Tab icon={isMobile ? undefined : <SpaOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.details')} />
                    <Tab icon={isMobile ? undefined : <RateReviewOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.proposals')} />
                    <Tab icon={isMobile ? undefined : <ForumOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.discussion')} />
                  </Tabs>
                  <Divider />

                  {activeTab === 0 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                        <DetailRow label={t('library.page.fields.supplier')} value={getSupplierLabel(selectedCulture) || t('library.page.notSpecified')} />
                        <DetailRow label={t('library.page.fields.growthDurationDays')} value={formatOptionalNumber(selectedCulture.growth_duration_days, t('library.page.notSpecified'))} />
                        <DetailRow label={t('library.page.fields.harvestDurationDays')} value={formatOptionalNumber(selectedCulture.harvest_duration_days, t('library.page.notSpecified'))} />
                        <DetailRow label={t('library.page.fields.cropFamily')} value={selectedCulture.crop_family || t('library.page.notSpecified')} />
                        <DetailRow
                          label={t('library.page.fields.nutrientDemand')}
                          value={getNutrientDemandLabel(selectedCulture.nutrient_demand, t, t('library.page.notSpecified'))}
                        />
                        <DetailRow
                          label={t('library.page.fields.cultivationType')}
                          value={getCultivationTypeLabel(selectedCulture.cultivation_type, t, t('library.page.notSpecified'))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                          {t('library.page.fields.notes')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                          {selectedCulture.notes || t('library.page.noNotes')}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : null}

                  {activeTab === 1 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Alert severity="info" icon={<RateReviewOutlinedIcon />}>
                        {t('library.page.proposals.intro')}
                      </Alert>
                      <Box component="form" onSubmit={(event) => void handleProposalSubmit(event)} sx={{ display: 'grid', gap: 1.25 }}>
                        <TextField
                          value={proposalSummary}
                          onChange={(event) => setProposalSummary(event.target.value)}
                          label={t('library.page.proposals.summaryLabel')}
                          size="small"
                          fullWidth
                        />
                        <FormControl size="small" fullWidth>
                          <InputLabel>{t('library.page.proposals.fieldLabel')}</InputLabel>
                          <Select
                            value={proposalField}
                            label={t('library.page.proposals.fieldLabel')}
                            inputProps={{ 'aria-label': t('library.page.proposals.fieldLabel') }}
                            onChange={(event) => {
                              setProposalField(event.target.value as ProposalField);
                              setProposalValue('');
                            }}
                          >
                            {PROPOSAL_FIELDS.map((field) => (
                              <MenuItem key={field} value={field}>
                                {t(`library.page.proposals.fields.${field}`)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          value={proposalValue}
                          onChange={(event) => setProposalValue(event.target.value)}
                          label={t('library.page.proposals.valueLabel')}
                          type={proposalField === 'growth_duration_days' || proposalField === 'harvest_duration_days' ? 'number' : 'text'}
                          multiline={proposalField === 'notes'}
                          minRows={proposalField === 'notes' ? 4 : undefined}
                          fullWidth
                        />
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={submittingProposal || !proposalSummary.trim() || !proposalValue.trim()}
                          sx={{ justifySelf: { xs: 'stretch', sm: 'start' } }}
                        >
                          {submittingProposal ? t('library.page.proposals.creating') : t('library.page.proposals.create')}
                        </Button>
                      </Box>
                      <Divider />
                      {collaborationStatus === 'loading' ? <CircularProgress size={24} /> : null}
                      {collaborationStatus === 'error' ? <Alert severity="error">{t('library.page.collaborationLoadError')}</Alert> : null}
                      {proposals.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('library.page.proposals.empty')}
                        </Typography>
                      ) : (
                        <Stack spacing={1.25}>
                          {proposals.map((proposal) => (
                            <ProposalCard
                              key={proposal.id}
                              cultureId={selectedCulture.id}
                              proposal={proposal}
                              canModerate={canModerate}
                              statusLabel={t(`library.page.proposals.status.${proposal.status}`)}
                              anonymousLabel={anonymousLabel}
                              formatDate={formatDate}
                              onReviewed={async () => {
                                await Promise.all([loadCultures(query), loadCollaboration(selectedCulture.id)]);
                              }}
                              t={t}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  ) : null}

                  {activeTab === 2 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box component="form" onSubmit={(event) => void handleCommentSubmit(event)} sx={{ display: 'grid', gap: 1.25 }}>
                        <TextField
                          value={commentBody}
                          onChange={(event) => setCommentBody(event.target.value)}
                          label={t('library.page.discussion.commentLabel')}
                          multiline
                          minRows={3}
                          fullWidth
                        />
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={submittingComment || !commentBody.trim()}
                          sx={{ justifySelf: { xs: 'stretch', sm: 'start' } }}
                        >
                          {submittingComment ? t('library.page.discussion.commenting') : t('library.page.discussion.comment')}
                        </Button>
                      </Box>
                      <Divider />
                      {collaborationStatus === 'loading' ? <CircularProgress size={24} /> : null}
                      {collaborationStatus === 'error' ? <Alert severity="error">{t('library.page.collaborationLoadError')}</Alert> : null}
                      {comments.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('library.page.discussion.empty')}
                        </Typography>
                      ) : (
                        <Stack spacing={1.25}>
                          {comments.map((comment) => (
                            <Box key={comment.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t('library.page.metaByDate', {
                                  author: comment.created_by_label || anonymousLabel,
                                  date: formatDate(comment.created_at),
                                })}
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.75, lineHeight: 1.6 }}>
                                {comment.body}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  ) : null}
                </Stack>
              )}
            </Card>
          </Box>
        </Stack>
      </PageSurface>
    </PageContainer>
  );
}
