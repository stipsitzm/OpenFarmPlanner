import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import { publicCultureAPI } from '../../api/api';
import type {
  Culture,
  CultivationType,
  PublicCulture,
  PublicCultureDiscussionComment,
  PublicCultureUpdatePayload,
  PublicCultureVersion,
  PublicCultureVersionCompare,
} from '../../api/types';
import PageContainer from '../../components/layout/PageContainer';
import { useTranslation } from '../../i18n';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';
import { stripCitationMarkers } from '../../components/data-grid/markdown';
import { CultureForm } from '../../cultures/CultureForm';
import { useCommandContextTag, useRegisterCommands } from '../../commands/useCommandContext';
import { createPublicCropLibraryCommandSpecs } from './publicCropLibraryCommandSpecs';

type CollaborationLoadStatus = 'idle' | 'loading' | 'success' | 'error';
type VersionLoadStatus = 'idle' | 'loading' | 'success' | 'error';

const SELECTED_PUBLIC_CULTURE_STORAGE_KEY = 'selectedPublicCultureId';

function parsePublicCultureId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsedId = Number.parseInt(value, 10);
  return Number.isFinite(parsedId) ? parsedId : null;
}

function getStoredPublicCultureId(): number | null {
  return parsePublicCultureId(window.localStorage.getItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY));
}

const getCultureTitle = (culture: PublicCulture): string => (
  culture.variety ? `${culture.name} (${culture.variety})` : culture.name
);

function formatLocalizedNumber(value: number | string | null | undefined, locale: string, fallback: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return new Intl.NumberFormat(locale, options).format(numericValue);
}

function formatDays(value: number | null | undefined, locale: string, fallback: string, dayLabel: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value, locale, fallback)} ${dayLabel}`;
}

function formatMetersAsCentimeters(value: number | null | undefined, locale: string, fallback: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value * 100, locale, fallback, { maximumFractionDigits: 1 })} cm`;
}

function formatPercent(value: number | null | undefined, locale: string, fallback: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value, locale, fallback, { maximumFractionDigits: 1 })} %`;
}

function formatSeedUnit(unit: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!unit) {
    return '';
  }
  return t(`library.page.seedUnits.${unit}`, { defaultValue: unit });
}

function formatSeedRate(
  value: number | null | undefined,
  unit: string | null | undefined,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (value === null || value === undefined || !unit) {
    return fallback;
  }
  return `${formatLocalizedNumber(value, locale, fallback, { maximumFractionDigits: 2 })} ${formatSeedUnit(unit, t)}`;
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

function getCultivationTypesLabel(
  culture: PublicCulture,
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  const values = culture.cultivation_types?.length
    ? culture.cultivation_types
    : culture.cultivation_type ? [culture.cultivation_type] : [];
  const labels = values
    .map((value) => getCultivationTypeLabel(value, t, ''))
    .filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : fallback;
}

function getHarvestMethodLabel(
  value: PublicCulture['harvest_method'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'per_plant') {
    return t('library.page.harvestMethods.perPlant');
  }
  if (value === 'per_sqm') {
    return t('library.page.harvestMethods.perSqm');
  }
  return fallback;
}

function getSeedingRequirementTypeLabel(value: PublicCulture['seeding_requirement_type'], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (value === 'per_sqm') {
    return t('library.page.seedingRequirementTypes.perSqm');
  }
  if (value === 'per_plant') {
    return t('library.page.seedingRequirementTypes.perPlant');
  }
  return '';
}

function getPublicCultureStatusLabel(status: PublicCulture['status'], t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`library.page.statusValues.${status}`);
}

function getLanguageLabel(code: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string, fallback: string): string {
  if (!code) {
    return fallback;
  }
  return t(`library.publishWizard.languages.${code}`, { defaultValue: code });
}

function formatSeedPackages(
  culture: PublicCulture,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const packages = culture.seed_packages ?? [];
  if (packages.length === 0) {
    return fallback;
  }
  return packages
    .map((entry) => `${formatLocalizedNumber(entry.size_value, locale, fallback, { maximumFractionDigits: 1 })} ${t(`library.page.packageUnits.${entry.size_unit}`, { defaultValue: entry.size_unit })}`)
    .join(', ');
}

function formatSeedRateByCultivation(
  culture: PublicCulture,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const entries = Object.entries(culture.seed_rate_by_cultivation ?? {});
  if (entries.length === 0) {
    return fallback;
  }
  return entries
    .map(([type, rate]) => {
      const methodLabel = type === 'pre_cultivation'
        ? t('library.page.fields.cultivationTypes.preCultivation')
        : t('library.page.fields.cultivationTypes.directSowing');
      return `${methodLabel}: ${formatSeedRate(rate?.value, rate?.unit, locale, fallback, t)}`;
    })
    .join(', ');
}

function getPublicCultureFieldLabel(field: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const fieldLabelKeyByName: Record<string, string> = {
    name: 'library.page.fields.name',
    variety: 'library.page.fields.variety',
    notes: 'library.page.fields.notes',
    crop_species: 'library.page.fields.cropSpecies',
    original_language_code: 'library.page.fields.originalLanguage',
    crop_family: 'library.page.fields.cropFamily',
    nutrient_demand: 'library.page.fields.nutrientDemand',
    cultivation_type: 'library.page.fields.cultivationType',
    cultivation_types: 'library.page.fields.cultivationType',
    growth_duration_days: 'library.page.fields.growthDurationDays',
    harvest_duration_days: 'library.page.fields.harvestDurationDays',
    propagation_duration_days: 'library.page.fields.propagationDurationDays',
    distance_within_row_m: 'library.page.fields.distanceWithinRow',
    row_spacing_m: 'library.page.fields.rowSpacing',
    sowing_depth_m: 'library.page.fields.sowingDepth',
    seed_rate_value: 'library.page.fields.seedRate',
    seed_rate_unit: 'library.page.fields.seedRate',
    sowing_calculation_safety_percent: 'library.page.fields.sowingSafetyPercent',
    thousand_kernel_weight_g: 'library.page.fields.thousandKernelWeight',
    expected_yield: 'library.page.fields.expectedYield',
    display_color: 'library.page.fields.displayColor',
    seed_packages: 'library.page.fields.seedPackages',
  };
  return fieldLabelKeyByName[field] ? t(fieldLabelKeyByName[field]) : field;
}

function getVersionValueLabel(value: unknown, fallback: string): string {
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
      <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface DetailSectionProps {
  title: string;
  children: ReactNode;
  outlined?: boolean;
}

function DetailSection({ title, children, outlined = false }: DetailSectionProps) {
  return (
    <Box sx={outlined ? { p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2 } : undefined}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      {children}
    </Box>
  );
}

function metersToCentimeters(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value * 100;
}

function centimetersToMeters(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value / 100;
}

function getPublicCultureCultivationTypes(culture: PublicCulture): CultivationType[] {
  if (culture.cultivation_types?.length) {
    return culture.cultivation_types;
  }
  return culture.cultivation_type ? [culture.cultivation_type] : ['pre_cultivation'];
}

function buildCultureFormDataFromPublicCulture(culture: PublicCulture): Culture {
  const cultivationTypes = getPublicCultureCultivationTypes(culture);
  const primaryCultivationType = cultivationTypes[0] ?? 'pre_cultivation';
  const usesDirectSowing = cultivationTypes.includes('direct_sowing');
  const usesPreCultivation = cultivationTypes.includes('pre_cultivation');
  return {
    id: culture.id,
    name: culture.name,
    variety: culture.variety ?? '',
    crop_species: culture.crop_species ?? null,
    crop_family: culture.crop_family ?? '',
    nutrient_demand: culture.nutrient_demand ?? '',
    cultivation_type: primaryCultivationType,
    cultivation_types: cultivationTypes,
    growth_duration_days: culture.growth_duration_days ?? undefined,
    harvest_duration_days: culture.harvest_duration_days ?? undefined,
    propagation_duration_days: culture.propagation_duration_days ?? undefined,
    harvest_method: culture.harvest_method ?? '',
    expected_yield: culture.expected_yield ?? undefined,
    allow_deviation_delivery_weeks: culture.allow_deviation_delivery_weeks ?? false,
    distance_within_row_cm: metersToCentimeters(culture.distance_within_row_m),
    row_spacing_cm: metersToCentimeters(culture.row_spacing_m),
    sowing_depth_cm: metersToCentimeters(culture.sowing_depth_m),
    seed_rate_direct_value: usesDirectSowing ? culture.seed_rate_value ?? null : null,
    seed_rate_direct_unit: usesDirectSowing ? culture.seed_rate_unit ?? null : null,
    seed_rate_pre_cultivation_value: usesPreCultivation ? culture.seed_rate_value ?? null : null,
    seed_rate_pre_cultivation_unit: usesPreCultivation ? culture.seed_rate_unit ?? null : null,
    sowing_calculation_safety_percent_direct: usesDirectSowing ? culture.sowing_calculation_safety_percent ?? null : null,
    sowing_calculation_safety_percent_pre_cultivation: usesPreCultivation ? culture.sowing_calculation_safety_percent ?? null : null,
    seed_rate_value: culture.seed_rate_value ?? null,
    seed_rate_unit: culture.seed_rate_unit ?? null,
    seed_rate_by_cultivation: culture.seed_rate_by_cultivation ?? null,
    sowing_calculation_safety_percent: culture.sowing_calculation_safety_percent ?? undefined,
    thousand_kernel_weight_g: culture.thousand_kernel_weight_g ?? undefined,
    seeding_requirement: culture.seeding_requirement ?? undefined,
    seeding_requirement_type: culture.seeding_requirement_type ?? '',
    seed_packages: culture.seed_packages ?? [],
    display_color: culture.display_color ?? '',
    notes: culture.notes ?? '',
  };
}

function buildPublicCultureUpdatePayload(formData: Culture, changeComment: string): PublicCultureUpdatePayload {
  const cultivationTypes = formData.cultivation_types?.length
    ? formData.cultivation_types
    : formData.cultivation_type ? [formData.cultivation_type] : [];
  const primarySeedRateSource = cultivationTypes.includes('direct_sowing')
    ? {
      value: formData.seed_rate_direct_value,
      unit: formData.seed_rate_direct_unit,
      safety: formData.sowing_calculation_safety_percent_direct,
    }
    : {
      value: formData.seed_rate_pre_cultivation_value,
      unit: formData.seed_rate_pre_cultivation_unit,
      safety: formData.sowing_calculation_safety_percent_pre_cultivation,
    };

  return {
    name: formData.name.trim(),
    variety: formData.variety?.trim() ?? '',
    notes: formData.notes ?? '',
    crop_family: formData.crop_family?.trim() ?? '',
    nutrient_demand: formData.nutrient_demand ?? '',
    cultivation_type: formData.cultivation_type ?? '',
    cultivation_types: cultivationTypes,
    growth_duration_days: formData.growth_duration_days ?? null,
    harvest_duration_days: formData.harvest_duration_days ?? null,
    propagation_duration_days: formData.propagation_duration_days ?? null,
    harvest_method: formData.harvest_method ?? '',
    expected_yield: formData.expected_yield ?? null,
    allow_deviation_delivery_weeks: formData.allow_deviation_delivery_weeks ?? false,
    distance_within_row_m: centimetersToMeters(formData.distance_within_row_cm),
    row_spacing_m: centimetersToMeters(formData.row_spacing_cm),
    sowing_depth_m: centimetersToMeters(formData.sowing_depth_cm),
    seed_rate_value: primarySeedRateSource.value ?? null,
    seed_rate_unit: primarySeedRateSource.unit ?? null,
    sowing_calculation_safety_percent: primarySeedRateSource.safety ?? null,
    thousand_kernel_weight_g: formData.thousand_kernel_weight_g ?? null,
    seeding_requirement: formData.seeding_requirement ?? null,
    seeding_requirement_type: formData.seeding_requirement_type ?? '',
    display_color: formData.display_color ?? '',
    seed_packages: formData.seed_packages ?? [],
    change_comment: changeComment.trim(),
  };
}

export default function PublicCropLibraryPage() {
  const { t, i18n } = useTranslation('cultures');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromUrl = parsePublicCultureId(selectedCultureParam);
  const [query, setQuery] = useState('');
  const [cultures, setCultures] = useState<PublicCulture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(() => selectedCultureIdFromUrl ?? getStoredPublicCultureId());
  const selectedCultureIdRef = useRef<number | null>(selectedCultureId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [comments, setComments] = useState<PublicCultureDiscussionComment[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationLoadStatus>('idle');
  const [versions, setVersions] = useState<PublicCultureVersion[]>([]);
  const [versionsStatus, setVersionsStatus] = useState<VersionLoadStatus>('idle');
  const [compareFromVersion, setCompareFromVersion] = useState<number | ''>('');
  const [compareToVersion, setCompareToVersion] = useState<number | ''>('');
  const [versionCompare, setVersionCompare] = useState<PublicCultureVersionCompare | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [editingPublicCulture, setEditingPublicCulture] = useState(false);
  const [editChangeComment, setEditChangeComment] = useState('');
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width:600px)');

  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
  const anonymousLabel = t('library.anonymousAuthor');

  useCommandContextTag('cropLibrary');

  const focusSearch = useCallback((): void => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const replaceSelectedCultureSearchParam = useCallback((cultureId: number | null): void => {
    const nextParams = new URLSearchParams(location.search);
    if (cultureId === null) {
      nextParams.delete('cultureId');
    } else {
      nextParams.set('cultureId', String(cultureId));
    }
    const nextSearch = nextParams.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch === currentSearch) {
      return;
    }
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const updateSelectedCultureId = useCallback((cultureId: number | null): void => {
    setSelectedCultureId(cultureId);
    selectedCultureIdRef.current = cultureId;
    if (cultureId === null) {
      window.localStorage.removeItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(cultureId));
    }
    replaceSelectedCultureSearchParam(cultureId);
  }, [replaceSelectedCultureSearchParam]);

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
  const selectedCultureFormData = useMemo(
    () => selectedCulture ? buildCultureFormDataFromPublicCulture(selectedCulture) : null,
    [selectedCulture],
  );

  useEffect(() => {
    selectedCultureIdRef.current = selectedCultureId;
  }, [selectedCultureId]);

  useEffect(() => {
    if (selectedCultureIdFromUrl !== null) {
      if (selectedCultureId !== selectedCultureIdFromUrl) {
        setSelectedCultureId(selectedCultureIdFromUrl);
        selectedCultureIdRef.current = selectedCultureIdFromUrl;
        window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(selectedCultureIdFromUrl));
      }
      return;
    }

    const storedCultureId = getStoredPublicCultureId();
    if (storedCultureId !== null) {
      if (selectedCultureId !== storedCultureId) {
        setSelectedCultureId(storedCultureId);
        selectedCultureIdRef.current = storedCultureId;
      }
      replaceSelectedCultureSearchParam(storedCultureId);
    }
  }, [replaceSelectedCultureSearchParam, selectedCultureId, selectedCultureIdFromUrl]);

  const loadCultures = useCallback(async (searchQuery: string): Promise<void> => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await publicCultureAPI.list(searchQuery.trim() ? { q: searchQuery.trim() } : undefined);
      let results = response.data.results;
      const currentSelectedCultureId = selectedCultureIdRef.current;
      if (currentSelectedCultureId !== null && !results.some((culture) => culture.id === currentSelectedCultureId)) {
        try {
          const selectedCultureResponse = await publicCultureAPI.get(currentSelectedCultureId);
          results = [selectedCultureResponse.data, ...results];
        } catch {
          updateSelectedCultureId(null);
        }
      }
      setCultures(results);
    } catch {
      setLoadError(t('library.loadError'));
      setCultures([]);
      updateSelectedCultureId(null);
    } finally {
      setLoading(false);
    }
  }, [t, updateSelectedCultureId]);

  const loadCollaboration = useCallback(async (cultureId: number): Promise<void> => {
    setCollaborationStatus('loading');
    try {
      const commentsResponse = await publicCultureAPI.comments(cultureId);
      setComments(commentsResponse.data);
      setCollaborationStatus('success');
    } catch {
      setComments([]);
      setCollaborationStatus('error');
    }
  }, []);

  const loadVersions = useCallback(async (cultureId: number): Promise<void> => {
    setVersionsStatus('loading');
    try {
      const response = await publicCultureAPI.versions(cultureId);
      setVersions(response.data);
      setVersionsStatus('success');
      if (response.data.length >= 2) {
        setCompareToVersion((current) => current || response.data[0].version_number);
        setCompareFromVersion((current) => current || response.data[1].version_number);
      } else if (response.data.length === 1) {
        setCompareFromVersion(response.data[0].version_number);
        setCompareToVersion(response.data[0].version_number);
      } else {
        setCompareFromVersion('');
        setCompareToVersion('');
      }
    } catch {
      setVersions([]);
      setVersionCompare(null);
      setVersionsStatus('error');
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
      setCollaborationStatus('idle');
      setVersions([]);
      setVersionsStatus('idle');
      setVersionCompare(null);
      return;
    }
    void loadCollaboration(selectedCultureId);
  }, [loadCollaboration, selectedCultureId]);

  useEffect(() => {
    setCommentBody('');
    setVersionCompare(null);
    setCompareFromVersion('');
    setCompareToVersion('');
    setActiveTab(0);
  }, [selectedCultureId]);

  useEffect(() => {
    if (!selectedCulture || activeTab !== 1) {
      return;
    }
    void loadVersions(selectedCulture.id);
  }, [activeTab, loadVersions, selectedCulture]);

  useEffect(() => {
    if (!selectedCulture || compareFromVersion === '' || compareToVersion === '' || compareFromVersion === compareToVersion) {
      setVersionCompare(null);
      return;
    }
    let ignore = false;
    void publicCultureAPI.compareVersions(selectedCulture.id, Number(compareFromVersion), Number(compareToVersion))
      .then((response) => {
        if (!ignore) {
          setVersionCompare(response.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setVersionCompare(null);
          showGlobalSnackbar({ message: t('library.page.versions.compareError'), severity: 'error' });
        }
      });
    return () => {
      ignore = true;
    };
  }, [compareFromVersion, compareToVersion, selectedCulture, t]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadCultures(query);
  };

  const handleImport = useCallback(async (): Promise<void> => {
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
  }, [selectedCulture, t]);

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

  const openEditDialog = useCallback((): void => {
    if (!selectedCulture) {
      return;
    }
    setEditChangeComment('');
    setEditingPublicCulture(true);
  }, [selectedCulture]);

  const handleEditSave = async (formData: Culture): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    const payload = buildPublicCultureUpdatePayload(formData, editChangeComment);
    try {
      const response = await publicCultureAPI.update(selectedCulture.id, payload);
      setCultures((currentCultures) => currentCultures.map((culture) => (culture.id === response.data.id ? response.data : culture)));
      setEditingPublicCulture(false);
      setEditChangeComment('');
      if (activeTab === 1) {
        await loadVersions(response.data.id);
      }
      showGlobalSnackbar({ message: t('library.page.edit.success'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.edit.error'), severity: 'error' });
    }
  };

  const handleRestoreVersion = async (versionNumber: number): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    setRestoringVersion(versionNumber);
    try {
      const response = await publicCultureAPI.restoreVersion(
        selectedCulture.id,
        versionNumber,
        t('library.page.versions.restoreComment', { version: versionNumber }),
      );
      setCultures((currentCultures) => currentCultures.map((culture) => (culture.id === response.data.id ? response.data : culture)));
      await loadVersions(response.data.id);
      showGlobalSnackbar({ message: t('library.page.versions.restoreSuccess'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.versions.restoreError'), severity: 'error' });
    } finally {
      setRestoringVersion(null);
    }
  };

  const goToRelativeCulture = useCallback((direction: 'next' | 'previous'): void => {
    if (!selectedCultureId || cultures.length === 0) {
      return;
    }

    const currentIndex = cultures.findIndex((culture) => culture.id === selectedCultureId);
    if (currentIndex === -1) {
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + cultures.length) % cultures.length;
    const nextCulture = cultures[nextIndex];
    if (nextCulture) {
      updateSelectedCultureId(nextCulture.id);
    }
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  const publicLibraryCommands = useMemo(() => createPublicCropLibraryCommandSpecs({
    cultures,
    focusSearch,
    goToRelativeCulture,
    importSelectedCulture: handleImport,
    openEditDialog,
    selectTab: setActiveTab,
    selectedCulture,
    selectedCultureId,
    labels: {
      focusSearch: t('library.page.commands.focusSearch'),
      edit: t('library.page.commands.edit'),
      importToProject: t('library.page.commands.importToProject'),
      showDetails: t('library.page.commands.showDetails'),
      showVersions: t('library.page.commands.showVersions'),
      showDiscussion: t('library.page.commands.showDiscussion'),
      previous: t('library.page.commands.previous'),
      next: t('library.page.commands.next'),
    },
  }), [
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleImport,
    openEditDialog,
    selectedCulture,
    selectedCultureId,
    t,
  ]);

  useRegisterCommands('public-crop-library-page', publicLibraryCommands);

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
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2}>
          {loadError ? <Alert severity="error">{loadError}</Alert> : null}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '220px minmax(0, 1fr)',
                md: '230px minmax(0, 1fr)',
                lg: '300px minmax(0, 1fr)',
                xl: '330px minmax(0, 1fr)',
              },
              gap: { xs: 1.25, lg: 1.1, xl: 1.25 },
              alignItems: 'start',
              minHeight: { md: 560 },
            }}
          >
            <Card variant="outlined" sx={{ ...libraryCardSx, minHeight: 280, maxHeight: { md: 'calc(100vh - 210px)' } }}>
              <Box component="form" onSubmit={handleSearchSubmit} sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <TextField
                  inputRef={searchInputRef}
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
                <List disablePadding sx={{ maxHeight: { xs: 280, sm: 'calc(100vh - 290px)' }, overflow: 'auto' }}>
                  {cultures.map((culture) => (
                    <ListItemButton
                      key={culture.id}
                      selected={culture.id === selectedCultureId}
                      onClick={() => updateSelectedCultureId(culture.id)}
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
                        secondary={culture.crop_species_name || culture.name}
                        primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Card>

            <Box sx={{ minWidth: 0, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              <Card variant="outlined" sx={{ ...libraryCardSx, width: '100%', maxWidth: { sm: 920, lg: 980, xl: 1040 }, minHeight: 420 }}>
                {!selectedCulture ? (
                <Box sx={{ height: '100%', minHeight: { xs: 360, md: 520 }, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: { xs: 3, sm: 4 }, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'center', sm: 'flex-start' }} sx={{ maxWidth: 780 }}>
                      <Box
                        sx={{
                          width: 64,
                          minWidth: 64,
                          height: 64,
                          borderRadius: '50%',
                          bgcolor: 'success.50',
                          color: 'success.main',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <SpaOutlinedIcon sx={{ fontSize: 36 }} />
                      </Box>
                      <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {t('library.emptyState.noSelectionTitle')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, maxWidth: 560, lineHeight: 1.65 }}>
                          {t('library.emptyState.noSelectionDescription')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, p: { xs: 3, sm: 4 } }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 2.5, sm: 3 }, width: '100%', maxWidth: 780 }}>
                      <Stack spacing={0.75} alignItems="center">
                        <SearchOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {t('library.emptyState.discoverTitle')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {t('library.emptyState.discoverDescription')}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.75} alignItems="center">
                        <DownloadOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {t('library.emptyState.importTitle')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {t('library.emptyState.importDescription')}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.75} alignItems="center">
                        <EditOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {t('library.emptyState.improveTitle')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {t('library.emptyState.improveDescription')}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Box>
                ) : (
                <Stack sx={{ minHeight: '100%' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'stretch', gap: 1.75 }}>
                        {selectedCulture.display_color ? (
                          <Box
                            sx={{
                              width: 4,
                              borderRadius: 1,
                              backgroundColor: selectedCulture.display_color,
                              opacity: 0.75,
                              my: 0.5,
                              alignSelf: 'stretch',
                              flexShrink: 0,
                            }}
                            aria-label={t('library.page.fields.displayColor')}
                            title={selectedCulture.display_color}
                          />
                        ) : null}
                        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', py: 0.25 }}>
                          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
                            {selectedCulture.name}
                          </Typography>
                          {selectedCulture.variety ? (
                            <Typography variant="body2" color="text.secondary">
                              {selectedCulture.variety}
                            </Typography>
                          ) : null}
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            <Chip size="small" label={t('library.versionLabel', { defaultValue: 'Version' }) + ` ${selectedCulture.version}`} />
                            <Chip size="small" label={selectedCulture.crop_species_name || selectedCulture.name} variant="outlined" />
                            <Chip size="small" label={t('library.page.byAuthor', { author: selectedCulture.created_by_label || anonymousLabel })} variant="outlined" />
                          </Stack>
                        </Box>
                      </Box>
                      {isMobile ? (
                        <Stack direction="row" spacing={0.5} sx={{ mt: -0.5 }}>
                          <Tooltip title={t('library.page.edit.open')}>
                            <span>
                              <IconButton
                                color="primary"
                                aria-label={t('library.page.edit.open')}
                                onClick={openEditDialog}
                              >
                                <EditOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t('library.importButton')}>
                            <span>
                              <IconButton
                                color="primary"
                                aria-label={t('library.importButton')}
                                disabled={importingId !== null}
                                onClick={() => void handleImport()}
                              >
                                <DownloadOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditOutlinedIcon />}
                            onClick={openEditDialog}
                          >
                            {t('library.page.edit.open')}
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<DownloadOutlinedIcon />}
                            disabled={importingId !== null}
                            onClick={() => void handleImport()}
                          >
                            {importingId ? t('library.importing') : t('library.importButton')}
                          </Button>
                        </Stack>
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
                    <Tab icon={isMobile ? undefined : <HistoryOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.versions')} />
                    <Tab icon={isMobile ? undefined : <ForumOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.discussion')} />
                  </Tabs>
                  <Divider />

                  {activeTab === 0 ? (
                    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <DetailSection title={t('library.page.sections.general')} outlined>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.cropSpecies')} value={selectedCulture.crop_species_name || selectedCulture.name || t('library.page.notSpecified')} />
                          <DetailRow label={t('library.page.fields.variety')} value={selectedCulture.variety || t('library.page.notSpecified')} />
                          <DetailRow label={t('library.page.fields.cropFamily')} value={selectedCulture.crop_family || t('library.page.notSpecified')} />
                          <DetailRow
                            label={t('library.page.fields.nutrientDemand')}
                            value={getNutrientDemandLabel(selectedCulture.nutrient_demand, t, t('library.page.notSpecified'))}
                          />
                          <DetailRow
                            label={t('library.page.fields.cultivationType')}
                            value={getCultivationTypesLabel(selectedCulture, t, t('library.page.notSpecified'))}
                          />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.timing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.growthDurationDays')} value={formatDays(selectedCulture.growth_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                          <DetailRow label={t('library.page.fields.harvestDurationDays')} value={formatDays(selectedCulture.harvest_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                          <DetailRow label={t('library.page.fields.propagationDurationDays')} value={formatDays(selectedCulture.propagation_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.spacing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.distanceWithinRow')} value={formatMetersAsCentimeters(selectedCulture.distance_within_row_m, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.rowSpacing')} value={formatMetersAsCentimeters(selectedCulture.row_spacing_m, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingDepth')} value={formatMetersAsCentimeters(selectedCulture.sowing_depth_m, locale, t('library.page.notSpecified'))} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.seed')}>
                        <DetailGrid>
                          <DetailRow
                            label={t('library.page.fields.seedRate')}
                            value={formatSeedRate(selectedCulture.seed_rate_value, selectedCulture.seed_rate_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRateByCultivation')}
                            value={formatSeedRateByCultivation(selectedCulture, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRateDirect')}
                            value={formatSeedRate(selectedCulture.seed_rate_direct_value, selectedCulture.seed_rate_direct_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRatePreCultivation')}
                            value={formatSeedRate(selectedCulture.seed_rate_pre_cultivation_value, selectedCulture.seed_rate_pre_cultivation_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercent')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercentDirect')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent_direct, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercentPreCultivation')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent_pre_cultivation, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.thousandKernelWeight')} value={selectedCulture.thousand_kernel_weight_g === null || selectedCulture.thousand_kernel_weight_g === undefined ? t('library.page.notSpecified') : `${formatLocalizedNumber(selectedCulture.thousand_kernel_weight_g, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })} g`} />
                          <DetailRow
                            label={t('library.page.fields.seedingRequirement')}
                            value={selectedCulture.seeding_requirement === null || selectedCulture.seeding_requirement === undefined
                              ? t('library.page.notSpecified')
                              : `${formatLocalizedNumber(selectedCulture.seeding_requirement, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })}${getSeedingRequirementTypeLabel(selectedCulture.seeding_requirement_type, t) ? ` ${getSeedingRequirementTypeLabel(selectedCulture.seeding_requirement_type, t)}` : ''}`}
                          />
                          <DetailRow label={t('library.page.fields.seedPackages')} value={formatSeedPackages(selectedCulture, locale, t('library.page.notSpecified'), t)} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.harvest')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.harvestMethod')} value={getHarvestMethodLabel(selectedCulture.harvest_method, t, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.expectedYield')} value={selectedCulture.expected_yield === null || selectedCulture.expected_yield === undefined ? t('library.page.notSpecified') : `${formatLocalizedNumber(selectedCulture.expected_yield, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })} kg`} />
                          <DetailRow label={t('library.page.fields.allowDeviationDeliveryWeeks')} value={selectedCulture.allow_deviation_delivery_weeks ? t('library.page.boolean.yes') : t('library.page.boolean.no')} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.metadata')}>
                        <DetailGrid>
                          <DetailRow label={t('library.versionLabel')} value={String(selectedCulture.version)} />
                          <DetailRow label={t('library.page.fields.originalLanguage')} value={getLanguageLabel(selectedCulture.original_language_code, t, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.createdAt')} value={formatDate(selectedCulture.created_at)} />
                          <DetailRow label={t('library.page.fields.publishedAt')} value={formatDate(selectedCulture.published_at)} />
                          <DetailRow label={t('library.page.fields.updatedAt')} value={formatDate(selectedCulture.updated_at)} />
                          <DetailRow label={t('library.page.fields.status')} value={getPublicCultureStatusLabel(selectedCulture.status, t)} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.notes')} outlined>
                        {selectedCulture.notes ? (
                          <Box
                            sx={{
                              '& h3': { mt: 2, mb: 1, fontSize: '1.05rem' },
                              '& h3:first-of-type': { mt: 0.25 },
                              '& p': { mb: 1, maxWidth: '95ch' },
                              '& ul': { pl: 3, mb: 1 },
                              '& li': { mb: 0.5 },
                              '& a': { color: 'primary.main' },
                              '& em': { color: 'text.secondary' },
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {stripCitationMarkers(selectedCulture.notes)}
                            </ReactMarkdown>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('library.page.noNotes')}
                          </Typography>
                        )}
                      </DetailSection>
                    </Stack>
                  ) : null}

                  {activeTab === 1 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {versionsStatus === 'loading' ? <CircularProgress size={24} /> : null}
                      {versionsStatus === 'error' ? <Alert severity="error">{t('library.page.versions.loadError')}</Alert> : null}
                      {versions.length === 0 && versionsStatus !== 'loading' ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('library.page.versions.empty')}
                        </Typography>
                      ) : (
                        <Stack spacing={2}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 180px)) minmax(0, 1fr)' }, gap: 1.25, alignItems: 'center' }}>
                            <FormControl size="small" fullWidth>
                              <InputLabel>{t('library.page.versions.compareFrom')}</InputLabel>
                              <Select
                                value={compareFromVersion}
                                label={t('library.page.versions.compareFrom')}
                                onChange={(event) => setCompareFromVersion(Number(event.target.value))}
                              >
                                {versions.map((version) => (
                                  <MenuItem key={version.version_number} value={version.version_number}>
                                    {t('library.page.versions.versionNumber', { version: version.version_number })}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl size="small" fullWidth>
                              <InputLabel>{t('library.page.versions.compareTo')}</InputLabel>
                              <Select
                                value={compareToVersion}
                                label={t('library.page.versions.compareTo')}
                                onChange={(event) => setCompareToVersion(Number(event.target.value))}
                              >
                                {versions.map((version) => (
                                  <MenuItem key={version.version_number} value={version.version_number}>
                                    {t('library.page.versions.versionNumber', { version: version.version_number })}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {versionCompare ? (
                              <Typography variant="body2" color="text.secondary">
                                {t('library.page.versions.compareCount', { count: versionCompare.changes.length })}
                              </Typography>
                            ) : null}
                          </Box>

                          {versionCompare ? (
                            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                                {t('library.page.versions.compareTitle')}
                              </Typography>
                              {versionCompare.changes.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  {t('library.page.versions.noChanges')}
                                </Typography>
                              ) : (
                                <Stack spacing={1}>
                                  {versionCompare.changes.map((change) => (
                                    <Box key={change.field} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr)' }, gap: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {getPublicCultureFieldLabel(change.field, t)}
                                      </Typography>
                                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                        <Box component="span" color="text.secondary">{getVersionValueLabel(change.old_value, t('library.page.notSpecified'))}</Box>
                                        {' '}
                                        →
                                        {' '}
                                        <Box component="span" sx={{ fontWeight: 700 }}>{getVersionValueLabel(change.new_value, t('library.page.notSpecified'))}</Box>
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          ) : null}

                          <Stack spacing={1.25}>
                            {versions.map((version) => (
                              <Box key={version.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                      {t('library.page.versions.versionNumber', { version: version.version_number })}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {t('library.page.metaByDate', {
                                        author: version.created_by_label || anonymousLabel,
                                        date: formatDate(version.created_at),
                                      })}
                                    </Typography>
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={restoringVersion !== null || version.version_number === selectedCulture.version}
                                    onClick={() => void handleRestoreVersion(version.version_number)}
                                  >
                                    {restoringVersion === version.version_number ? t('library.page.versions.restoring') : t('library.page.versions.restore')}
                                  </Button>
                                </Stack>
                                {version.change_comment ? (
                                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                                    {version.change_comment}
                                  </Typography>
                                ) : null}
                                {version.change_summary.length > 0 ? (
                                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                                    {version.change_summary.slice(0, 4).map((change) => (
                                      <Typography key={change.field} variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                                        {getPublicCultureFieldLabel(change.field, t)}: {getVersionValueLabel(change.old_value, t('library.page.notSpecified'))} → {getVersionValueLabel(change.new_value, t('library.page.notSpecified'))}
                                      </Typography>
                                    ))}
                                  </Stack>
                                ) : (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    {t('library.page.versions.initialVersion')}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </Stack>
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
          </Box>
        </Stack>
      </Box>
      {editingPublicCulture && selectedCulture && selectedCultureFormData ? (
        <CultureForm
          culture={selectedCultureFormData}
          title={t('library.page.edit.title')}
          saveLabel={t('library.page.edit.save')}
          showSupplierSection={false}
          enableDuplicateCheck={false}
          enablePublicLibraryMatchHint={false}
          extraAfterNotes={(
            <TextField
              value={editChangeComment}
              onChange={(event) => setEditChangeComment(event.target.value)}
              label={t('library.page.edit.changeComment')}
              placeholder={t('library.page.edit.changeCommentPlaceholder')}
              size="small"
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
          onSave={handleEditSave}
          onCancel={() => {
            setEditingPublicCulture(false);
            setEditChangeComment('');
          }}
        />
      ) : null}
    </PageContainer>
  );
}
