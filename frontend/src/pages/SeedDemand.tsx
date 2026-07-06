import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, plantingPlanAPI, seedDemandAPI } from '../api/api';
import type { SeedDemand } from '../api/types';
import { useTranslation } from '../i18n';
import { ContextMenuIndicator } from '../components/contextMenu/ContextMenuIndicator';
import { contextMenuActionsOverlaySx } from '../components/contextMenu/contextMenuIndicatorStyles';
import { useCommandContextTag } from '../commands/useCommandContext';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import TableSurface from '../components/layout/TableSurface';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { ContextMenuHint, TableCopyMenuItems, useContextMenuHint } from '../components/data-grid';
import { focusContextMenuOrigin, handleContextMenuKeyboardNavigation, useContextMenuFocus } from '../components/data-grid/contextMenuFocus';
import { getFirstMissingProjectSetupStep, getProjectSetupAction, getProjectSetupActions } from './requirementFlow';
import { formatLocalizedNumber } from '../utils/numberLocalization';
import { shouldOpenCustomContextMenu, suppressNativeContextMenu, useCloseCustomContextMenuOnNativeContextMenu } from '../utils/contextMenu';

const formatUnit = (unit: 'g' | 'seeds', t: (key: string) => string): string => (
  unit === 'seeds' ? t('seedDemand.unitSeeds') : t('seedDemand.unitGrams')
);

const formatSeedAmount = (value: number, options?: Intl.NumberFormatOptions): string => (
  formatLocalizedNumber(value, 'de-DE', options)
);

const formatRequiredSeedAmount = (value: number): string => (
  formatSeedAmount(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
);

type Translator = (key: string, options?: Record<string, unknown>) => string;

const formatPackageSelection = (row: SeedDemand, t: Translator): string => (
  (row.package_suggestion?.selection ?? [])
    .map((item) => `${formatSeedAmount(item.size_value)} ${formatUnit(item.size_unit, t)}${item.count > 1 ? ` × ${item.count}` : ''}`)
    .join(' + ')
);

type PackageCellState = 'computed' | 'chooseSupplier' | 'notConfigured' | 'calculationError';

const getPackageCellState = (row: SeedDemand): PackageCellState => {
  const supplierOptions = row.supplier_options ?? [];
  const hasSelectedSupplier = supplierOptions.length === 1
    || (row.selected_supplier_id !== null && row.selected_supplier_id !== undefined);
  const hasSuggestion = (row.package_suggestion?.selection ?? []).length > 0;

  if (hasSuggestion) {
    return 'computed';
  }
  if (supplierOptions.length === 0 || !hasSelectedSupplier) {
    return 'chooseSupplier';
  }
  if ((row.seed_packages ?? []).length === 0) {
    return 'notConfigured';
  }
  return 'calculationError';
};

export default function SeedDemandPage() {
  useCommandContextTag('seedDemand');
  const { t } = useTranslation(['cultures', 'common']);
  const navigate = useNavigate();
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cultureCount, setCultureCount] = useState(0);
  const [planCount, setPlanCount] = useState(0);
  const [hasCulturesWithSeedData, setHasCulturesWithSeedData] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [fieldCount, setFieldCount] = useState(0);
  const [bedCount, setBedCount] = useState(0);
  const [contextMenuState, setContextMenuState] = useState<{
    row: SeedDemand;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const contextMenuOriginRef = useRef<HTMLElement | null>(null);
  const hasPlans = planCount > 0;
  const hasSeedData = hasCulturesWithSeedData;
  const canCalculateSeedDemand = locationCount > 0 && fieldCount > 0 && bedCount > 0 && cultureCount > 0 && hasPlans && hasSeedData;
  const { showContextMenuHint, closeContextMenuHint, markContextMenuHintUsed } = useContextMenuHint({
    enabled: !shouldShowProjectRequiredState && canCalculateSeedDemand,
    isLoading,
    hasRows: rows.length > 0,
  });
  const firstMissingSetupStep = getFirstMissingProjectSetupStep({
    hasFields: fieldCount > 0,
    hasBeds: bedCount > 0,
    hasCultures: cultureCount > 0,
    hasPlans,
  });
  const getTranslatedSetupActions = useCallback((step: NonNullable<typeof firstMissingSetupStep>) => (
    getProjectSetupActions(step).map((action) => ({ label: t(action.labelKey), to: action.to }))
  ), [t]);
  const missingRequirement = useMemo(() => {
    if (firstMissingSetupStep === 'fields') {
      return {
        title: t('seedDemand.progressive.fields.title'),
        description: t('seedDemand.progressive.fields.description'),
        actions: getTranslatedSetupActions(firstMissingSetupStep),
      };
    }
    if (firstMissingSetupStep === 'beds') {
      return {
        title: t('seedDemand.progressive.beds.title'),
        description: t('seedDemand.progressive.beds.description'),
        actions: getTranslatedSetupActions(firstMissingSetupStep),
      };
    }
    if (firstMissingSetupStep === 'cultures') {
      return {
        title: t('seedDemand.progressive.cultures.title'),
        description: t('seedDemand.progressive.cultures.description'),
        actions: getTranslatedSetupActions(firstMissingSetupStep),
      };
    }
    if (firstMissingSetupStep === 'plans') {
      const action = getProjectSetupAction(firstMissingSetupStep);
      return {
        title: t('seedDemand.progressive.plans.title'),
        description: t('seedDemand.progressive.plans.description'),
        actions: [{ label: t(action.labelKey), to: action.to }],
      };
    }
    if (!hasSeedData) {
      return {
        title: t('seedDemand.progressive.seedData.title'),
        description: (
          <>
            <Typography variant="body2">{t('seedDemand.progressive.seedData.description')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('seedDemand.progressive.seedData.hint')}
            </Typography>
          </>
        ),
        actions: [{ label: t('seedDemand.progressive.seedData.action'), to: '/app/cultures' }],
      };
    }
    return null;
  }, [firstMissingSetupStep, getTranslatedSetupActions, hasSeedData, t]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await seedDemandAPI.list();
      setRows(response.data.results ?? []);
      const [culturesResponse, plansResponse, locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
        cultureAPI.list(),
        plantingPlanAPI.list(),
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      const cultures = culturesResponse.data.results;
      setCultureCount(cultures.length);
      setPlanCount(plansResponse.data.results.length);
      setLocationCount(locationsResponse.data.results.length);
      setFieldCount(fieldsResponse.data.results.length);
      setBedCount(bedsResponse.data.results.length);
      setHasCulturesWithSeedData(cultures.some((culture) => (
        culture.seed_rate_value !== null
        || culture.seed_rate_direct_value !== null
        || culture.seed_rate_pre_cultivation_value !== null
      )));
    } catch {
      setError(t('seedDemand.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupplierChange = async (cultureId: number, supplierId: number | null) => {
    setIsLoading(true);
    setError(null);
    try {
      await seedDemandAPI.saveSupplierSelection(cultureId, supplierId);
      await loadRows();
    } catch {
      setError(t('seedDemand.saveError'));
      setIsLoading(false);
    }
  };

  const getCultureLabel = useCallback((row: SeedDemand): string => (
    row.variety ? `${row.culture_name} (${row.variety})` : row.culture_name
  ), []);

  const getSupplierLabel = useCallback((row: SeedDemand): string => {
    const supplierOptions = row.supplier_options ?? [];
    if (supplierOptions.length === 0) {
      return t('seedDemand.noSupplierAvailable');
    }
    const selectedSupplier = supplierOptions.find((option) => option.supplier_id === row.selected_supplier_id);
    if (selectedSupplier) {
      return selectedSupplier.supplier_name;
    }
    if (supplierOptions.length > 1) {
      return t('seedDemand.selectSupplier');
    }
    return supplierOptions[0]?.supplier_name ?? row.supplier ?? '';
  }, [t]);

  const getRequiredAmountLabel = useCallback((row: SeedDemand): string => {
    if (row.required_amount_value === null || row.required_amount_unit === null) {
      return row.required_amount_warning === 'missing_tkg'
        ? t('seedDemand.requiredAmountMissingTkg')
        : '-';
    }
    return `${formatRequiredSeedAmount(row.required_amount_value)} ${formatUnit('g', t)}`;
  }, [t]);

  const getPackageLabel = useCallback((row: SeedDemand): string => {
    switch (getPackageCellState(row)) {
      case 'computed':
        return formatPackageSelection(row, t);
      case 'chooseSupplier':
        return '—';
      case 'notConfigured':
        return t('seedDemand.noPackagesAvailable');
      case 'calculationError':
      default:
        return t('seedDemand.noPackageCalculationPossible');
    }
  }, [t]);

  const renderPackageCell = useCallback((row: SeedDemand) => {
    const editHref = `/app/cultures?cultureId=${row.culture_id}&action=edit`;
    const state = getPackageCellState(row);

    switch (state) {
      case 'computed':
        return <Typography variant="body2">{formatPackageSelection(row, t)}</Typography>;
      case 'chooseSupplier': {
        const tooltipKey = (row.supplier_options ?? []).length === 0
          ? 'seedDemand.noSupplierConfiguredTooltip'
          : 'seedDemand.supplierNotSelectedTooltip';
        return (
          <Tooltip title={t(tooltipKey)} describeChild>
            <Typography variant="body2" color="text.secondary">—</Typography>
          </Tooltip>
        );
      }
      case 'notConfigured':
        return (
          <Tooltip title={t('seedDemand.noPackagesAvailableTooltip')} describeChild>
            <Link
              component={RouterLink}
              to={editHref}
              underline="hover"
              variant="body2"
              color="textSecondary"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Inventory2OutlinedIcon fontSize="inherit" />
              {t('seedDemand.noPackagesAvailable')}
            </Link>
          </Tooltip>
        );
      case 'calculationError':
      default:
        return (
          <Tooltip title={t('seedDemand.noPackageCalculationPossibleTooltip')} describeChild>
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <WarningAmberOutlinedIcon fontSize="inherit" />
              {t('seedDemand.noPackageCalculationPossible')}
            </Typography>
          </Tooltip>
        );
    }
  }, [t]);

  const getRowClipboardValues = useCallback((row: SeedDemand): string[] => [
    getCultureLabel(row),
    getSupplierLabel(row),
    getRequiredAmountLabel(row),
    getPackageLabel(row),
  ], [getCultureLabel, getPackageLabel, getRequiredAmountLabel, getSupplierLabel]);

  const getTableClipboardRows = useCallback((): string[][] => [
    [
      t('seedDemand.columns.culture'),
      t('seedDemand.columns.supplier'),
      t('seedDemand.columns.requiredAmount'),
      t('seedDemand.columns.packages'),
    ],
    ...rows.map(getRowClipboardValues),
  ], [getRowClipboardValues, rows, t]);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
    focusContextMenuOrigin(contextMenuOriginRef.current);
  }, []);
  const contextMenuListRef = useContextMenuFocus(contextMenuState !== null, closeContextMenu);

  const isSeedDemandContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    shouldOpenCustomContextMenu(target) &&
    target instanceof HTMLElement &&
    target.closest('tr[data-seed-demand-culture-id]') !== null
  ), []);
  const repositionOpenContextMenu = useCallback((event: globalThis.MouseEvent): void => {
    setContextMenuState((currentState) => (
      currentState
        ? { row: currentState.row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 }
        : currentState
    ));
  }, []);
  useCloseCustomContextMenuOnNativeContextMenu(
    contextMenuState !== null,
    closeContextMenu,
    isSeedDemandContextMenuTarget,
    repositionOpenContextMenu,
  );

  const openContextMenu = useCallback((
    event: MouseEvent<HTMLTableRowElement>,
    row: SeedDemand,
  ): void => {
    if (!isSeedDemandContextMenuTarget(event.target)) {
      return;
    }
    suppressNativeContextMenu(event);
    markContextMenuHintUsed();
    contextMenuOriginRef.current = event.currentTarget;
    setContextMenuState({
      row,
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    });
  }, [isSeedDemandContextMenuTarget, markContextMenuHintUsed]);

  const openKeyboardContextMenu = useCallback((
    event: KeyboardEvent<HTMLTableRowElement>,
    row: SeedDemand,
  ): void => {
    const shouldOpenContextMenu = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!shouldOpenContextMenu) {
      return;
    }

    suppressNativeContextMenu(event);
    markContextMenuHintUsed();
    contextMenuOriginRef.current = event.currentTarget;
    const rowRect = event.currentTarget.getBoundingClientRect();
    setContextMenuState({
      row,
      mouseX: rowRect.left + Math.min(240, rowRect.width),
      mouseY: rowRect.top + 12,
    });
  }, [markContextMenuHintUsed]);

  const openInlineActionMenu = useCallback((event: MouseEvent<HTMLButtonElement>, row: SeedDemand): void => {
    event.preventDefault();
    event.stopPropagation();
    markContextMenuHintUsed();
    contextMenuOriginRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenuState({
      row,
      mouseX: rect.right - 8,
      mouseY: rect.top + 12,
    });
  }, [markContextMenuHintUsed]);

  const openCulture = useCallback((row: SeedDemand): void => {
    navigate(`/app/cultures?cultureId=${row.culture_id}`);
  }, [navigate]);

  const editCulture = useCallback((row: SeedDemand): void => {
    navigate(`/app/cultures?cultureId=${row.culture_id}&action=edit`);
  }, [navigate]);

  const handleContextMenuOpenCulture = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { row } = contextMenuState;
    closeContextMenu();
    openCulture(row);
  }, [closeContextMenu, contextMenuState, openCulture]);

  const handleContextMenuEditCulture = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { row } = contextMenuState;
    closeContextMenu();
    editCulture(row);
  }, [closeContextMenu, contextMenuState, editCulture]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setRows([]);
      setIsLoading(false);
      setError(null);
      setHasCulturesWithSeedData(false);
      setFieldCount(0);
      return;
    }
    void loadRows();
  }, [shouldShowProjectRequiredState]);

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="standardCenteredPage">
        <PageSurface variant="contentFit">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="standardCenteredPage">
      <PageSurface variant="contentFit">

        {isLoading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}

        {!isLoading && !error && !canCalculateSeedDemand && (
          <EmptyStateCard
            title={missingRequirement?.title ?? t('seedDemand.emptyStates.requirementsTitle')}
            description={missingRequirement?.description ?? t('seedDemand.emptyStates.requirementsDescription')}
            actions={missingRequirement?.actions ?? []}
          />
        )}

        {!isLoading && !error && canCalculateSeedDemand && showContextMenuHint ? (
          <ContextMenuHint
            message={t('common:messages.contextMenuTableHint')}
            onClose={closeContextMenuHint}
            sx={{ mb: 1.25 }}
          />
        ) : null}

        {!isLoading && !error && canCalculateSeedDemand && (
          <TableSurface sizingMode="contentFit">
          <TableContainer>
            <Table
              sx={{
                '& .MuiTableCell-root': { py: 1 },
              }}
            >
            <TableHead>
              <TableRow>
                <TableCell>{t('seedDemand.columns.culture')}</TableCell>
                <TableCell>{t('seedDemand.columns.supplier')}</TableCell>
                <TableCell align="right">{t('seedDemand.columns.requiredAmount')}</TableCell>
                <TableCell>{t('seedDemand.columns.packages')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const supplierOptions = row.supplier_options ?? [];
                const supplierCount = supplierOptions.length;
                const supplierOptionValues = new Set(supplierOptions.map((option) => String(option.supplier_id)));
                const selectedSupplierValue = row.selected_supplier_id !== null && row.selected_supplier_id !== undefined
                  ? String(row.selected_supplier_id)
                  : '';
                const selectValue = supplierOptionValues.has(selectedSupplierValue) ? selectedSupplierValue : '';
                const singleSupplierOption = supplierCount === 1 ? supplierOptions[0] : null;
                const singleSupplierValue = singleSupplierOption ? String(singleSupplierOption.supplier_id) : '';

                return (
                  <TableRow
                    key={row.culture_id}
                    data-seed-demand-culture-id={row.culture_id}
                    hover
                    tabIndex={0}
                    onContextMenu={(event) => openContextMenu(event, row)}
                    onKeyDown={(event) => openKeyboardContextMenu(event, row)}
                    sx={{
                      WebkitTouchCallout: 'none',
                    }}
                  >
                    <TableCell sx={{ maxWidth: { xs: 180, sm: 240 } }}>
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                          width: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'block',
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}`} underline="hover">
                            {getCultureLabel(row)}
                          </Link>
                        </Box>
                        <Box
                          className="seed-demand-row-actions"
                          sx={contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &')}
                        >
                          <ContextMenuIndicator
                            label={t('common:actions.actions')}
                            onClick={(event) => openInlineActionMenu(event, row)}
                          />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {supplierCount > 1 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                              value={selectValue}
                              sx={{
                                '& .MuiSelect-select': { py: 0.75 },
                              }}
                              onChange={(event) => {
                                const selectedValue = String(event.target.value ?? '');
                                void handleSupplierChange(
                                  row.culture_id,
                                  selectedValue ? Number(selectedValue) : null,
                                );
                              }}
                              displayEmpty
                            >
                              {selectValue === '' ? <MenuItem value="">{t('seedDemand.selectSupplier')}</MenuItem> : null}
                              {supplierOptions.map((option) => (
                                <MenuItem key={option.supplier_id} value={String(option.supplier_id)}>
                                  {option.supplier_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ) : supplierCount === 1 && singleSupplierOption ? (
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <Select
                            value={singleSupplierValue}
                            disabled
                            sx={{
                              '& .MuiSelect-select': { py: 0.75 },
                            }}
                          >
                            <MenuItem value={singleSupplierValue}>
                              {singleSupplierOption.supplier_name}
                            </MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('seedDemand.noSupplierAvailable')}
                          </Typography>
                          <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}&action=edit`} underline="hover" variant="caption">
                            {t('seedDemand.editCultureAction')}
                          </Link>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {getRequiredAmountLabel(row)}
                    </TableCell>
                    <TableCell>{renderPackageCell(row)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
            {rows.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <EmptyStateCard
                  title={t('seedDemand.emptyStates.noResultsTitle')}
                  description={t('seedDemand.emptyStates.noResultsDescription')}
                />
              </Box>
            ) : null}
          </TableContainer>
          </TableSurface>
        )}
      </PageSurface>

      <Menu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        hideBackdrop
        sx={{ pointerEvents: 'none' }}
        autoFocus
        disableAutoFocusItem={false}
        slotProps={{
          paper: {
            className: 'ofp-custom-context-menu',
            sx: { pointerEvents: 'auto' },
          },
          list: {
            autoFocus: true,
            ref: contextMenuListRef,
            onKeyDown: (event: KeyboardEvent<HTMLUListElement>) => handleContextMenuKeyboardNavigation(event, closeContextMenu),
          },
        }}
        onKeyDown={(event) => handleContextMenuKeyboardNavigation(event, closeContextMenu)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuState !== null
            ? { top: contextMenuState.mouseY, left: contextMenuState.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleContextMenuOpenCulture}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('seedDemand.contextMenu.openCulture')} />
        </MenuItem>
        <MenuItem onClick={handleContextMenuEditCulture}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('seedDemand.contextMenu.editCulture')} />
        </MenuItem>
        <TableCopyMenuItems
          rowValues={contextMenuState ? getRowClipboardValues(contextMenuState.row) : null}
          tableRows={getTableClipboardRows()}
          copyRowLabel={t('common:actions.copyRow')}
          copyTableLabel={t('common:actions.copyTable')}
          rowCopiedMessage={t('common:messages.rowCopied')}
          tableCopiedMessage={t('common:messages.tableCopied')}
          copyErrorMessage={t('common:messages.copyError')}
          includeDivider
          onClose={closeContextMenu}
        />
      </Menu>
    </PageContainer>
  );
}
