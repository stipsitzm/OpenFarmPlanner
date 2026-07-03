/**
 * Hierarchical Fields and Beds page component.
 *
 * Displays Locations > Fields > Beds in a tree structure with inline editing.
 * Uses MUI Data Grid with custom row grouping logic.
 * UI text is in German, code comments remain in English.
 *
 * @returns The hierarchical Fields/Beds page component
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import {
  DataGrid,
  GridRowEditStopReasons,
  GridRowModes,
  useGridApiRef,
} from "@mui/x-data-grid";
import { germanDataGridLocaleText } from "../components/data-grid/localeText";
import type {
  GridCellParams,
  GridEventListener,
  GridRowHeightParams,
  GridRowId,
  GridRowsProp,
  GridRowModesModel,
} from "@mui/x-data-grid";
import { Box, Alert, useMediaQuery } from "@mui/material";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EmptyStateCard from '../components/project/EmptyStateCard';
import { CALCULATED_COLUMN_CELL_CLASS } from "../components/data-grid/calculatedColumns";
import { dataGridSx } from "../components/data-grid/styles";
import {
  DeleteUndoSnackbar,
  ContextMenuHint,
  TableCopyMenuItems,
  useNotesEditor,
  NotesDrawer,
  getPlainExcerpt,
  useContextMenuHint,
} from "../components/data-grid";
import { handleContextMenuKeyboardNavigation } from "../components/data-grid/contextMenuFocus";
import {
  isInteractiveCellTarget,
  preventReadOnlyCellMouseFocus,
} from "../components/data-grid/keyboardNavigation";
import { useNavigationBlocker } from "../hooks/autosave";
import { useHierarchyData, type HierarchyDataState } from "../components/hierarchy/hooks/useHierarchyData";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { useHierarchyDelete } from "../components/hierarchy/hooks/useHierarchyDelete";
import { useHierarchyGridFocus } from "../components/hierarchy/hooks/useHierarchyGridFocus";
import { useHierarchyNavigationState } from "../components/hierarchy/hooks/useHierarchyNavigationState";
import { useHierarchyRowUpdate } from "../components/hierarchy/hooks/useHierarchyRowUpdate";
import { useHierarchyContextMenu } from "../components/hierarchy/hooks/useHierarchyContextMenu";
import { useHierarchyKeyboard } from "../components/hierarchy/hooks/useHierarchyKeyboard";
import { useHierarchyGridKeyboard } from "../components/hierarchy/hooks/useHierarchyGridKeyboard";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { fieldAPI, bedAPI, locationAPI, type Field } from "../api/api";
import {
  buildHierarchyIndex,
  createHierarchyRowsProjector,
  type HierarchySortConfig,
} from "../components/hierarchy/utils/hierarchyUtils";
import {
  createHierarchyColumns,
  DEFAULT_HIERARCHY_COLUMN_WIDTHS,
} from "../components/hierarchy/HierarchyColumns";
import type { HierarchyRow } from "../components/hierarchy/utils/types";
import {
  calculateHierarchyNameColumnWidth,
  getHierarchyNameMeasureKey,
  measureHierarchyNameTextWidths,
  type HierarchyNameMeasureEntry,
} from "../components/hierarchy/utils/hierarchyNameColumnWidth";
import {
  isCompletelyEmptyNewHierarchyRow,
  isPartiallyFilledNamelessNewHierarchyRow,
} from "../components/hierarchy/utils/hierarchyRowDraft";
import {
  normalizeAreaValue,
  parseAreaValue,
  parseDimensionValue,
} from "../components/hierarchy/utils/hierarchyAreaParsing";
import {
  useRegisterCommands,
} from "../commands/useCommandContext";
import type { CommandSpec } from "../commands/types";

interface FieldsBedsHierarchyProps {
  showTitle?: boolean;
  createFieldRequest?: number;
  onCreateFieldRequestHandled?: () => void;
  hierarchyData?: HierarchyDataState;
  onPendingDeletionCountChange?: (count: number) => void;
  suppressContextMenuHint?: boolean;
}

interface HierarchyRowAction {
  id: string;
  label: string;
  group: "create" | "destructive";
  color?: "default" | "error";
  onClick: () => void;
}

const HIERARCHY_SELECTED_VIEW_ROW_SELECTOR =
  "& .MuiDataGrid-row.Mui-selected:not(.MuiDataGrid-row--editing)";

const HIERARCHY_DATA_GRID_SX = {
  ...dataGridSx,
  width: "fit-content",
  minWidth: 0,
  "& .MuiDataGrid-filler": {
    display: "none",
  },
  "& .MuiDataGrid-scrollbarFiller": {
    display: "none",
  },
  "& .MuiDataGrid-main": {
    width: "fit-content",
  },
  "& .MuiDataGrid-virtualScrollerContent": {
    width: "fit-content !important",
  },
  "& .MuiDataGrid-columnHeaders": {
    width: "fit-content !important",
  },
  "& .MuiDataGrid-columnHeader": {
    py: 0.25,
  },
  "& .MuiDataGrid-cell": {
    py: 0,
  },
  "& .ofp-hierarchy-row-location .MuiDataGrid-cell": {
    py: 0.5,
  },
  "& .ofp-hierarchy-row-field .MuiDataGrid-cell": {
    py: 0.25,
  },
  "& .ofp-hierarchy-row-bed .MuiDataGrid-cell": {
    py: 0,
  },
  "& .MuiDataGrid-row--editing .MuiDataGrid-cell": {
    py: 0,
  },
  "& .MuiDataGrid-row--editing .MuiInputBase-root": {
    minHeight: "30px",
    height: "30px",
    fontSize: "0.875rem",
  },
  "& .MuiDataGrid-row--editing .MuiInputBase-input": {
    py: 0.5,
  },
  "& .MuiDataGrid-row--editing .MuiSelect-select": {
    minHeight: "unset !important",
    py: 0.5,
  },
  "& .MuiDataGrid-row--editing .MuiIconButton-root": {
    width: 28,
    height: 28,
  },
  "& .MuiDataGrid-row--editing .MuiDataGrid-cell[data-field='name'] .MuiInputBase-root":
    {
      minHeight: "32px",
      height: "32px",
    },
  [HIERARCHY_SELECTED_VIEW_ROW_SELECTOR]: {
    backgroundColor: "transparent",
  },
  [`${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell`]: {
    backgroundColor: "transparent",
  },
  [`${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell.MuiDataGrid-cell--editable`]:
    {
      backgroundColor: "surface.surfaceBackground",
    },
  [`${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell.${CALCULATED_COLUMN_CELL_CLASS}`]:
    {
      backgroundColor: "#F5F5F5",
    },
  [`${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell.ofp-hierarchy-cell-missing-dimension`]:
    {
      backgroundColor: "#fbf2d5",
    },
  [`${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell:focus, ${HIERARCHY_SELECTED_VIEW_ROW_SELECTOR} .MuiDataGrid-cell:focus-within`]:
    {
      backgroundColor: "transparent",
    },
  "& .ofp-hierarchy-cell-missing-dimension": {
    backgroundColor: "#fbf2d5",
    color: "text.primary",
  },
  "& .MuiDataGrid-row:hover .ofp-hierarchy-cell-missing-dimension": {
    backgroundColor: "surface.surfaceHoverBackground",
    boxShadow: "inset 0 0 0 9999px rgba(237, 108, 2, 0.14)",
  },
  "& .ofp-hierarchy-row-highlighted .MuiDataGrid-cell": {
    animation: "ofp-hierarchy-row-highlight-flash 2.5s ease-out",
  },
  // Matches the app's established green "selected" look (e.g. CultureDetail's
  // selected list item) instead of an unrelated yellow flash.
  "@keyframes ofp-hierarchy-row-highlight-flash": {
    "0%": { backgroundColor: "rgba(37, 111, 42, 0.22)" },
    "70%": { backgroundColor: "rgba(37, 111, 42, 0.14)" },
    "100%": { backgroundColor: "transparent" },
  },
};

function FieldsBedsHierarchy({
  showTitle = true,
  createFieldRequest = 0,
  onCreateFieldRequestHandled,
  hierarchyData,
  onPendingDeletionCountChange,
  suppressContextMenuHint = false,
}: FieldsBedsHierarchyProps) {
  const LOCATION_ROW_HEIGHT = 46;
  const FIELD_ROW_HEIGHT = 42;
  const BED_ROW_HEIGHT = 36;
  const HEADER_ROW_HEIGHT = 40;

  const { t } = useTranslation(["hierarchy", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const gridApiRef = useGridApiRef();
  const isTouchLikePointer = useMediaQuery("(pointer: coarse)");
  const isMobileViewport = useMediaQuery("(max-width:900px)");
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [draftValidationWarning, setDraftValidationWarning] = useState("");
  const hasInitiallyExpandedRef = useRef(false);
  const handledCreateFieldRequestRef = useRef(0);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<GridRowId | null>(null);
  const highlightClearTimeoutRef = useRef<number | null>(null);

  // Data fetching
  const internalHierarchyData = useHierarchyData(hierarchyData === undefined);
  const {
    loading,
    error,
    setError,
    locations,
    setLocations,
    fields,
    beds,
    setBeds,
    setFields,
    fetchData,
  } = hierarchyData ?? internalHierarchyData;

  // Expansion state
  const {
    expandedRows,
    hasPersistedState,
    toggleExpand,
    ensureExpanded,
    expandAll,
  } = useExpandedState("fieldsBedsHierarchy");
  const { sortModel, setSortModel } = usePersistentSortModel({
    tableKey: "fieldsBedsHierarchy",
    allowedFields: ["name", "area_sqm"],
    persistInUrl: true,
  });
  const hierarchySortConfig = useMemo<HierarchySortConfig | undefined>(() => {
    const [firstSort] = sortModel;
    if (!firstSort || !firstSort.sort) {
      return undefined;
    }

    return {
      field: firstSort.field,
      direction: firstSort.sort,
    };
  }, [sortModel]);

  // Bed operations
  const { addBed, saveBed, pendingEditRow, setPendingEditRow } =
    useBedOperations(setBeds, setError, t);
  const [pendingFieldEditRow, setPendingFieldEditRow] = useState<string | number | null>(null);

  const hierarchyIndex = useMemo(
    () => buildHierarchyIndex(locations, fields, beds, hierarchySortConfig),
    [locations, fields, beds, hierarchySortConfig],
  );

  const projectRows = useMemo(
    () => createHierarchyRowsProjector(hierarchyIndex),
    [hierarchyIndex],
  );

  const rows = useMemo<GridRowsProp<HierarchyRow>>(
    () => projectRows(expandedRows),
    [projectRows, expandedRows],
  );

  const {
    expandedRowsRef,
    rowsRef,
    selectRow,
    selectRowTransient,
    selectedRowId,
    selectedRowIdRef,
    setSelectedRowId,
    setTreeActive,
    treeActive,
    treeActiveRef,
  } = useHierarchyNavigationState({
    expandedRows,
    rows,
  });

  // Delete with undo
  const {
    pendingDeletions,
    deleteHierarchyRowWithUndo,
    undoPendingDeletion,
    closePendingDeletionSnackbar,
  } = useHierarchyDelete({
    locations,
    fields,
    beds,
    expandedRows,
    fetchData,
    expandAll,
    setLocations,
    setFields,
    setBeds,
    setSelectedRowId,
    setError,
    onPendingDeletionCountChange,
    t,
    rowSnapshotRef,
    setRowModesModel,
    setDraftValidationWarning,
  });

  const shouldShowHierarchyTable = hierarchyIndex.hasMultipleLocations || fields.length > 0 || createFieldRequest > 0;
  const hasUsableHierarchyRows = shouldShowHierarchyTable && (
    rows.length > 0
    || locations.length > 0
    || fields.length > 0
    || beds.length > 0
  );
  const { showContextMenuHint, closeContextMenuHint, markContextMenuHintUsed } = useContextMenuHint({
    enabled: !suppressContextMenuHint,
    isLoading: loading,
    hasRows: hasUsableHierarchyRows,
  });

  const {
    contextMenuState,
    openContextMenuForRow,
    handleNameCellContextMenu,
    handleGridContextMenu,
    handleGridTouchStart,
    handleGridTouchEnd,
    closeContextMenu,
    contextMenuListRef,
  } = useHierarchyContextMenu({
    rows: rows as HierarchyRow[],
    markContextMenuHintUsed,
    setSelectedRowId,
    setTreeActive,
  });

  const rowsById = useMemo(() => {
    const nextRowsById = new Map<string, HierarchyRow>();
    rows.forEach((row) => nextRowsById.set(String(row.id), row));
    return nextRowsById;
  }, [rows]);

  const rememberRowSnapshot = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    if (rowSnapshotRef.current.has(rowKey)) {
      return;
    }

    const row = rowsById.get(rowKey);
    if (row) {
      rowSnapshotRef.current.set(rowKey, row);
    }
  }, [rowsById]);

  const getDraftRow = useCallback((rowId: GridRowId): HierarchyRow | null => {
    const api = gridApiRef.current;
    const draftRow = api?.getRowWithUpdatedValues?.(rowId, "") as HierarchyRow | null | undefined;
    return draftRow ?? rowsById.get(String(rowId)) ?? null;
  }, [gridApiRef, rowsById]);

  const {
    discardRowEdit,
    processRowUpdate,
    handleProcessRowUpdateError,
  } = useHierarchyRowUpdate({
    getDraftRow,
    rowModesModel,
    rowsById,
    beds,
    fields,
    locations,
    setBeds,
    setFields,
    setLocations,
    rowSnapshotRef,
    setRowModesModel,
    setError,
    setDraftValidationWarning,
    fetchData,
    saveBed,
    t,
  });

  // Notes editor - must be after rows definition
  const notesEditor = useNotesEditor<HierarchyRow>({
    rows,
    onSave: async ({ row, value }) => {
      if (!row.name) {
        throw new Error(t("validation.nameRequired"));
      }

      const parsedArea = parseAreaValue(row.area_sqm);

      if (row.type === "bed" && row.bedId) {
        // Save bed with notes
        await bedAPI.update(row.bedId, {
          name: row.name,
          field: row.field!,
          area_sqm: normalizeAreaValue(parsedArea),
          length_m: parseDimensionValue(row.length_m),
          width_m: parseDimensionValue(row.width_m),
          notes: value,
        });

        // Update local state
        setBeds((prev) =>
          prev.map((b) => (b.id === row.bedId ? { ...b, notes: value } : b)),
        );
      } else if (row.type === "field" && row.fieldId) {
        // Save field with notes
        await fieldAPI.update(row.fieldId, {
          name: row.name,
          location: row.locationId!,
          area_sqm: normalizeAreaValue(parsedArea),
          length_m: parseDimensionValue(row.length_m),
          width_m: parseDimensionValue(row.width_m),
          notes: value,
        });

        // Update local state
        setFields((prev) =>
          prev.map((f) => (f.id === row.fieldId ? { ...f, notes: value } : f)),
        );
      } else if (row.type === "location" && row.locationId) {
        const locationItem = locations.find((l) => l.id === row.locationId);
        if (!locationItem) return;

        await locationAPI.update(row.locationId, { ...locationItem, notes: value });

        setLocations((prev) =>
          prev.map((l) => (l.id === row.locationId ? { ...l, notes: value } : l)),
        );
      }
    },
    onError: setError,
  });

  /**
   * Expand all rows when data is loaded (only once on initial load)
   */
  useEffect(() => {
    if (
      !hasPersistedState &&
      !hasInitiallyExpandedRef.current &&
      locations.length > 0 &&
      fields.length > 0
    ) {
      const allRowIds = new Set<string | number>();

      // Add all location IDs
      locations.forEach((location) => {
        allRowIds.add(`location-${location.id}`);
      });

      // Add all field IDs
      fields.forEach((field) => {
        allRowIds.add(`field-${field.id}`);
      });

      expandAll(Array.from(allRowIds));
      hasInitiallyExpandedRef.current = true;
    }
  }, [expandAll, fields, hasPersistedState, locations]);

  /**
   * Handle pending edit mode after rows are updated
   */
  useEffect(() => {
    if (pendingEditRow !== null) {
      // Check if the row exists in the current rows
      const rowExists = rows.some((r) => r.id === pendingEditRow);
      if (rowExists) {
        const rowId = pendingEditRow;
        setTimeout(() => {
          setRowModesModel((oldModel) => ({
            ...oldModel,
            [rowId]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
          }));
          setPendingEditRow(null);
        }, 0);
      }
    }
  }, [rows, pendingEditRow, setPendingEditRow]);

  useEffect(() => {
    if (pendingFieldEditRow === null) {
      return;
    }

    const rowExists = rows.some((row) => row.id === pendingFieldEditRow);
    if (!rowExists) {
      return;
    }

    const rowId = pendingFieldEditRow;
    setTimeout(() => {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [rowId]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
      }));
      setPendingFieldEditRow(null);
    }, 0);
  }, [pendingFieldEditRow, rows]);

  const handleAddField = useCallback(
    (locationId: number): void => {
      const locationItem = locations.find((item) => item.id === locationId);
      if (!locationItem) return;

      const newFieldId = -Date.now();
      const newField: Field = {
        id: newFieldId,
        name: "",
        location: locationId,
        area_sqm: undefined,
        length_m: null,
        width_m: null,
        notes: "",
      };

      ensureExpanded(`location-${locationId}`);
      setFields((previousFields) => [newField, ...previousFields]);
      setPendingFieldEditRow(`field-${newFieldId}`);
    },
    [ensureExpanded, locations, setFields],
  );

  const handleAddBed = useCallback(
    (fieldId: number): void => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      const fieldKey = `field-${fieldId}`;
      ensureExpanded(fieldKey);

      const newBedId = addBed(fieldId);

      setPendingEditRow(newBedId); //will be applied after re-render
    },
    [addBed, ensureExpanded, fields, setPendingEditRow],
  );

  useEffect(() => {
    if (!location.pathname.startsWith("/app/fields-beds")) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("createBed") !== "true" || loading) {
      return;
    }

    const firstField = fields.find((field) => field.id !== undefined);
    if (firstField?.id !== undefined) {
      handleAddBed(firstField.id);
    }

    searchParams.delete("createBed");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [fields, handleAddBed, loading, location.pathname, location.search, navigate]);

  useEffect(() => () => {
    if (highlightClearTimeoutRef.current !== null) {
      window.clearTimeout(highlightClearTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (
      createFieldRequest <= 0
      || loading
      || createFieldRequest <= handledCreateFieldRequestRef.current
    ) {
      return;
    }

    const hasActiveFieldDraft = fields.some((field) => typeof field.id === "number" && field.id < 0);
    const firstLocation = locations.find((locationItem) => locationItem.id !== undefined);
    const firstLocationId = firstLocation?.id;
    if (!hasActiveFieldDraft && firstLocationId === undefined) {
      return;
    }

    handledCreateFieldRequestRef.current = createFieldRequest;
    if (!hasActiveFieldDraft && firstLocationId !== undefined) {
      handleAddField(firstLocationId);
    }
    onCreateFieldRequestHandled?.();
  }, [createFieldRequest, fields, handleAddField, loading, locations, onCreateFieldRequestHandled]);

  const handleCreatePlantingPlan = useCallback(
    (bedId: number): void => {
      navigate(`/app/planting-plans?bedId=${bedId}`);
    },
    [navigate],
  );

  const isHierarchyCellAction = useCallback((params: GridCellParams<HierarchyRow>): boolean => (
    params.field === "notes"
  ), []);

  const isCellEditable = useCallback((params: { row: HierarchyRow; field: string }) => {
    if (params.row.type === "location") {
      return params.field === "name";
    }
    if (params.row.type === "field" || params.row.type === "bed") {
      return (
        params.field === "name" ||
        params.field === "length_m" ||
        params.field === "width_m"
      );
    }
    return false;
  }, []);

  const isHierarchyCellFocusable = useCallback((row: HierarchyRow, field: string): boolean => (
    field === "notes"
    || isCellEditable({ row, field })
  ), [isCellEditable]);

  // Stable ref so getHierarchyFocusableField doesn't change on every expand/collapse.
  // If it did, focusRow → focusSelectedCell → useLayoutEffect would re-fire after each
  // rows update and re-focus selectedRowId STATE instead of the arrow-navigated row.
  const rowsByIdRef = useRef(rowsById);
  useLayoutEffect(() => {
    rowsByIdRef.current = rowsById;
  }, [rowsById]);

  const getHierarchyFocusableField = useCallback((rowId: GridRowId, preferredField: string): string | null => {
    const row = rowsByIdRef.current.get(String(rowId));
    if (!row) {
      return null;
    }

    const focusableFields = row.type === "location"
      ? ["name", "notes"]
      : ["name", "length_m", "width_m", "notes"];
    return focusableFields.includes(preferredField) ? preferredField : focusableFields[0] ?? null;
  }, []);

  const { focusRow, preFocusEditCell, rememberFocusedField } = useHierarchyGridFocus({
    getFocusableField: getHierarchyFocusableField,
    gridApiRef,
    rowModesModel,
    rows,
    selectedRowId,
    setSelectedRowId,
    treeActive,
  });

  const handleHierarchyRowEditStop = useCallback<GridEventListener<"rowEditStop">>((params, event): void => {
    if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
      event.defaultMuiPrevented = true;
      discardRowEdit(params.id);
      return;
    }

    if (
      params.reason === GridRowEditStopReasons.enterKeyDown ||
      params.reason === GridRowEditStopReasons.tabKeyDown ||
      params.reason === GridRowEditStopReasons.shiftTabKeyDown
    ) {
      preFocusEditCell(params.id);
    }
  }, [discardRowEdit, preFocusEditCell]);

  const activateFirstRowForKeyboard = useCallback((rowId: GridRowId): void => {
    selectedRowIdRef.current = rowId;
    treeActiveRef.current = true;
    setSelectedRowId(rowId);
    setTreeActive(true);
    focusRow(rowId, "name");
  }, [focusRow, selectedRowIdRef, setSelectedRowId, setTreeActive, treeActiveRef]);

  const selectRowForKeyboard = useCallback((rowId: GridRowId): void => {
    selectRowTransient(rowId);
    focusRow(rowId);
  }, [focusRow, selectRowTransient]);

  // Consumes a `?highlight=location:<id>|field:<id>|bed:<id>` deep link (e.g.
  // from the Gantt calendar's "Standort/Parzelle/Beet öffnen" context menu
  // actions): expands the ancestor chain so the target row is visible,
  // scrolls it into view, makes it the active row for keyboard nav (reusing
  // activateFirstRowForKeyboard/focusRow above instead of touching the grid
  // API directly), and flashes it briefly so the user can find it.
  useEffect(() => {
    if (!location.pathname.startsWith("/app/fields-beds")) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const highlightParam = searchParams.get("highlight");
    if (!highlightParam || loading) {
      return;
    }

    const [highlightType, highlightIdRaw] = highlightParam.split(":");
    const highlightId = Number(highlightIdRaw);

    let targetRowId: GridRowId | null = null;
    let locationIdToExpand: number | undefined;
    let fieldIdToExpand: number | undefined;

    if (Number.isFinite(highlightId)) {
      if (highlightType === "location") {
        targetRowId = `location-${highlightId}`;
      } else if (highlightType === "field") {
        const field = fields.find((entry) => entry.id === highlightId);
        targetRowId = `field-${highlightId}`;
        locationIdToExpand = field?.location;
      } else if (highlightType === "bed") {
        const bed = beds.find((entry) => entry.id === highlightId);
        const field = bed ? fields.find((entry) => entry.id === bed.field) : undefined;
        targetRowId = highlightId;
        fieldIdToExpand = bed?.field;
        locationIdToExpand = field?.location;
      }
    }

    if (targetRowId !== null) {
      if (locationIdToExpand !== undefined) {
        ensureExpanded(`location-${locationIdToExpand}`);
      }
      if (fieldIdToExpand !== undefined) {
        ensureExpanded(`field-${fieldIdToExpand}`);
      }

      setHighlightedRowId(targetRowId);

      // Expansion needs a render pass before the target row exists in the
      // DataGrid's virtualized viewport.
      requestAnimationFrame(() => {
        const api = gridApiRef.current;
        if (!api) return;
        const rowIndex = api.getRowIndexRelativeToVisibleRows(targetRowId!);
        if (typeof rowIndex === "number" && rowIndex >= 0) {
          api.scrollToIndexes({ rowIndex });
          activateFirstRowForKeyboard(targetRowId!);
        }
      });

      if (highlightClearTimeoutRef.current !== null) {
        window.clearTimeout(highlightClearTimeoutRef.current);
      }
      highlightClearTimeoutRef.current = window.setTimeout(() => {
        setHighlightedRowId(null);
        highlightClearTimeoutRef.current = null;
      }, 2500);
    }

    searchParams.delete("highlight");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [activateFirstRowForKeyboard, beds, ensureExpanded, fields, gridApiRef, loading, location.pathname, location.search, navigate]);

  const handleHierarchyProcessRowUpdate = useCallback(
    async (newRow: HierarchyRow): Promise<HierarchyRow> => {
      const savedRow = await processRowUpdate(newRow);
      preFocusEditCell(newRow.id);
      setRowModesModel((previousModel) => ({
        ...previousModel,
        [newRow.id]: { mode: GridRowModes.View, ignoreModifications: true },
      }));
      return savedRow;
    },
    [preFocusEditCell, processRowUpdate],
  );

  const handleReadOnlyHierarchyCellMouseDown = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (isInteractiveCellTarget(target)) {
      return;
    }

    const cellElement = target.closest<HTMLElement>('[role="gridcell"][data-field]');
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    const field = cellElement?.dataset.field;
    const rowId = rowElement?.dataset.id;
    if (!field || rowId === undefined) {
      return;
    }

    const row = rowsById.get(String(rowId));
    if (!row || isHierarchyCellFocusable(row, field)) {
      return;
    }

    preventReadOnlyCellMouseFocus(event);
  }, [isHierarchyCellFocusable, rowsById]);

  // Read the current row from refs at call time so these callbacks are stable
  // and don't trigger re-renders of areaCommands on every navigation keypress.
  const handleDeleteSelected = useCallback(() => {
    const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
    if (!row) return;
    if (row.type === "location" || row.type === "field" || row.type === "bed") {
      void deleteHierarchyRowWithUndo(row);
    }
  }, [deleteHierarchyRowWithUndo, rowsRef, selectedRowIdRef]);

  const handleCreateBySelection = useCallback(() => {
    const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
    if (!row) return;
    if (row.type === "location" && row.locationId) {
      handleAddField(row.locationId);
      return;
    }
    if (row.type === "field" && row.fieldId) {
      handleAddBed(row.fieldId);
      return;
    }
    if (row.type === "bed" && row.field) {
      handleAddBed(row.field);
    }
  }, [handleAddBed, handleAddField, rowsRef, selectedRowIdRef]);

  const handleEditSelected = useCallback(() => {
    const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
    if (!row) return;
    rememberRowSnapshot(row.id);
    setRowModesModel((previous) => ({
      ...previous,
      [row.id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  }, [rememberRowSnapshot, rowsRef, selectedRowIdRef]);

  const getHierarchyRowActions = useCallback((row: HierarchyRow): HierarchyRowAction[] => {
    const createActions: HierarchyRowAction[] = [];

    if (row.type === "location" && row.locationId) {
      createActions.push({
        id: "add-field",
        label: t("actions.addField"),
        group: "create",
        onClick: () => handleAddField(row.locationId!),
      });
    }

    if (row.type === "field" && row.fieldId) {
      createActions.push({
        id: "add-bed",
        label: t("actions.addBed"),
        group: "create",
        onClick: () => handleAddBed(row.fieldId!),
      });
    }

    if (row.type === "bed" && row.bedId) {
      createActions.push({
        id: "create-planting-plan",
        label: t("createPlantingPlan"),
        group: "create",
        onClick: () => handleCreatePlantingPlan(row.bedId!),
      });
    }

    const destructiveActions: HierarchyRowAction[] = [{
      id: "delete",
      label: t("common:actions.delete"),
      group: "destructive",
      color: "error",
      onClick: () => {
        void deleteHierarchyRowWithUndo(row);
      },
    }];

    return [...createActions, ...destructiveActions];
  }, [
    deleteHierarchyRowWithUndo,
    handleAddBed,
    handleAddField,
    handleCreatePlantingPlan,
    t,
  ]);

  const areaCommands = useMemo<CommandSpec[]>(
    () => [
      {
        id: "areas.create",
        label: "Neu erstellen",
        group: 'navigation',
      keywords: ["neu", "anbauflächen", "create"],
                        contextTags: ["areas"],
        isEnabled: () => selectedRowIdRef.current !== null,
        action: handleCreateBySelection,
      },
      {
        id: "areas.edit",
        label: "Bearbeiten",
        group: 'navigation',
      keywords: ["bearbeiten", "edit"],
        contextTags: ["areas"],
        isEnabled: () => {
          const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
          return row !== undefined && row.type !== "location";
        },
        action: handleEditSelected,
      },
      {
        id: "areas.delete",
        label: "Löschen (Alt+Shift+D)",
        group: 'navigation',
      keywords: ["löschen", "delete"],
                keys: { key: "Delete" },
        contextTags: ["areas"],
        isEnabled: () => selectedRowIdRef.current !== null,
        action: handleDeleteSelected,
      },
    ],
    [handleCreateBySelection, handleDeleteSelected, handleEditSelected, rowsRef, selectedRowIdRef],
  );

  useRegisterCommands("areas-page", areaCommands);

  // Clicking outside the grid while a row is being edited doesn't go through MUI's
  // own cell-focus-out handling (that only fires when focus moves to another grid
  // cell), so the row is neither saved nor discarded by default. A still-blank
  // draft is discarded, a nameless-but-partially-filled draft is preserved
  // locally the same way Escape does (attempting a real save would just reject
  // for the missing name and strand the row in edit mode), and anything else is
  // committed for real (matching normal click-away-to-save UX and avoiding
  // silent data loss).
  const handleClickOutsideGrid = useCallback((): void => {
    const editingRowId = Object.entries(rowModesModel).find(
      ([, mode]) => mode.mode === GridRowModes.Edit,
    )?.[0];
    if (editingRowId === undefined) return;
    const rowId = rowsById.get(editingRowId)?.id ?? editingRowId;
    const draftRow = getDraftRow(rowId);
    if (
      draftRow &&
      (isCompletelyEmptyNewHierarchyRow(draftRow) || isPartiallyFilledNamelessNewHierarchyRow(draftRow))
    ) {
      discardRowEdit(rowId);
      return;
    }
    gridApiRef.current?.stopRowEditMode({ id: rowId });
  }, [discardRowEdit, getDraftRow, gridApiRef, rowModesModel, rowsById]);

  useHierarchyKeyboard({
    contextMenuState,
    treeActiveRef,
    tableWrapperRef,
    rowsRef,
    selectedRowIdRef,
    expandedRowsRef,
    activateFirstRow: activateFirstRowForKeyboard,
    selectRow: selectRowForKeyboard,
    setTreeActive,
    toggleExpand,
    discardActiveRowEdit: handleClickOutsideGrid,
    openContextMenuForRow,
  });

  const nameColumnWidth = useMemo(() => {
    const hierarchyEntries: HierarchyNameMeasureEntry[] = [];
    if (hierarchyIndex.hasMultipleLocations) {
      hierarchyIndex.sortedLocations.forEach((location) => {
        hierarchyEntries.push({ name: location.name, level: 0, type: "location" });
        const locationFields =
          hierarchyIndex.fieldsByLocation.get(location.id!) ?? [];
        locationFields.forEach((field) => {
          hierarchyEntries.push({ name: field.name, level: 1, type: "field" });
          const fieldBeds = hierarchyIndex.bedsByField.get(field.id!) ?? [];
          fieldBeds.forEach((bed) => {
            hierarchyEntries.push({ name: bed.name, level: 2, type: "bed" });
          });
        });
      });
    } else {
      hierarchyIndex.sortedTopLevelFields.forEach((field) => {
        hierarchyEntries.push({ name: field.name, level: 0, type: "field" });
        const fieldBeds = hierarchyIndex.bedsByField.get(field.id!) ?? [];
        fieldBeds.forEach((bed) => {
          hierarchyEntries.push({ name: bed.name, level: 1, type: "bed" });
        });
      });
    }

    const measuredTextWidths = measureHierarchyNameTextWidths(hierarchyEntries);
    return calculateHierarchyNameColumnWidth(
      hierarchyEntries,
      (row) => measuredTextWidths.get(getHierarchyNameMeasureKey(row)) ?? 0,
    );
  }, [hierarchyIndex]);

  /**
   * Create columns with callbacks
   */
  const columns = useMemo(() => {
    return createHierarchyColumns(
      toggleExpand,
      handleAddBed,
      (bedId) => {
        const row = rowsById.get(String(bedId));
        if (row) {
          void deleteHierarchyRowWithUndo(row);
        }
      },
      (locationId) => {
        if (locationId === undefined) {
          return;
        }
        handleAddField(locationId);
      },
      (fieldId) => {
        const row = rowsById.get(`field-${fieldId}`);
        if (row) {
          void deleteHierarchyRowWithUndo(row);
        }
      },
      (locationId) => {
        const row = rowsById.get(`location-${locationId}`);
        if (row) {
          void deleteHierarchyRowWithUndo(row);
        }
      },
      handleCreatePlantingPlan,
      handleNameCellContextMenu,
      notesEditor.handleOpen,
      t,
      {
        ...DEFAULT_HIERARCHY_COLUMN_WIDTHS,
        name: nameColumnWidth,
      },
      {
        disableInlineHoverActions: isTouchLikePointer || isMobileViewport,
      },
    );
  }, [
    toggleExpand,
    handleAddBed,
    handleAddField,
    deleteHierarchyRowWithUndo,
    handleCreatePlantingPlan,
    handleNameCellContextMenu,
    notesEditor.handleOpen,
    rowsById,
    t,
    nameColumnWidth,
    isTouchLikePointer,
    isMobileViewport,
  ]);

  const {
    handleCellClick: handleHierarchyCellClick,
    handleCellKeyDown: handleHierarchyCellKeyDown,
  } = useHierarchyGridKeyboard({
    columns,
    discardRowEdit,
    gridApiRef,
    isCellFocusable: isHierarchyCellFocusable,
    isHierarchyCellAction,
    notesEditor,
    openContextMenuForRow,
    rememberFocusedField,
    rememberRowSnapshot,
    rowModesModel,
    rows: rows as HierarchyRow[],
    rowsById,
    selectRow,
    setRowModesModel,
    setTreeActive,
    toggleExpand,
  });

  const getRowHeight = useCallback((params: GridRowHeightParams) => {
    const row = params.model as HierarchyRow;
    if (row.type === "location") {
      return LOCATION_ROW_HEIGHT;
    }
    if (row.type === "field") {
      return FIELD_ROW_HEIGHT;
    }
    return BED_ROW_HEIGHT;
  }, []);

  const shouldShowMissingDimensionsHint = useMemo(() => {
    const hasBeds = beds.length > 0;
    const allBedsMissingLengthAndWidth = beds.every((bed) => {
      const length = parseDimensionValue(bed.length_m);
      const width = parseDimensionValue(bed.width_m);
      const hasLength = Number.isFinite(length ?? NaN);
      const hasWidth = Number.isFinite(width ?? NaN);

      return !hasLength && !hasWidth;
    });

    return hasBeds && allBedsMissingLengthAndWidth;
  }, [beds]);

  const hasUnsavedInvalidNewRows = useMemo(() => (
    beds.some((bed) => isPartiallyFilledNamelessNewHierarchyRow({
      id: bed.id ?? "",
      type: "bed",
      level: 0,
      isNew: typeof bed.id === "number" && bed.id < 0,
      name: bed.name,
      field: bed.field,
      bedId: bed.id,
      area_sqm: bed.area_sqm,
      length_m: bed.length_m,
      width_m: bed.width_m,
      notes: bed.notes,
    }))
  ), [beds]);

  const isAnyRowInEditMode = useMemo(
    () => Object.values(rowModesModel).some((mode) => mode.mode === GridRowModes.Edit),
    [rowModesModel],
  );

  useNavigationBlocker(
    hasUnsavedInvalidNewRows || isAnyRowInEditMode,
    hasUnsavedInvalidNewRows
      ? t("messages.unsavedInvalidRowsNavigationWarning")
      : t("messages.unsavedRowEditNavigationWarning"),
  );

  useEffect(() => {
    if (!hasUnsavedInvalidNewRows) {
      setDraftValidationWarning("");
    }
  }, [hasUnsavedInvalidNewRows]);

  const contextMenuActions = contextMenuState
    ? getHierarchyRowActions(contextMenuState.row)
    : [];
  const formatHierarchyValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return String(value);
  }, []);

  const getHierarchyAreaValue = useCallback((row: HierarchyRow): string => {
    if (row.type === "location") {
      return "—";
    }
    if (typeof row.length_m === "number" && typeof row.width_m === "number") {
      return String(Math.round(row.length_m * row.width_m * 10) / 10);
    }
    return formatHierarchyValue(row.area_sqm);
  }, [formatHierarchyValue]);

  const getHierarchyRowClipboardValues = useCallback((row: HierarchyRow): string[] => [
    row.name ?? "",
    row.type === "location" ? "—" : formatHierarchyValue(row.length_m),
    row.type === "location" ? "—" : formatHierarchyValue(row.width_m),
    getHierarchyAreaValue(row),
    getPlainExcerpt(row.notes ?? "", 120),
  ], [formatHierarchyValue, getHierarchyAreaValue]);

  const getHierarchyTableClipboardRows = useCallback((): string[][] => [
    [
      t("hierarchy:columns.name"),
      t("columns.length"),
      t("columns.width"),
      t("hierarchy:columns.area"),
      t("common:fields.notes"),
    ],
    ...rows.map(getHierarchyRowClipboardValues),
  ], [getHierarchyRowClipboardValues, rows, t]);

  return (
    <div className={showTitle ? "page-container" : undefined}>
      <Box sx={{ width: "100%", minWidth: 0 }}>
        {showTitle && <h1>{t("title")}</h1>}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {draftValidationWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {draftValidationWarning}
          </Alert>
        )}

        {showContextMenuHint && (
          <ContextMenuHint
            message={t("common:messages.contextMenuTableHint")}
            onClose={closeContextMenuHint}
            prominent
            sx={{ mb: 1.5, maxWidth: 560 }}
          />
        )}

        {shouldShowMissingDimensionsHint && (
          <EmptyStateCard
            title={t('messages.missingDimensionsHint')}
            description={t('messages.missingDimensionsHintOptional')}
            containerSx={{ mx: 0 }}
          />
        )}

        {shouldShowHierarchyTable ? (
          <Box
            ref={tableWrapperRef}
            sx={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 1,
              overflowX: "auto",
              overflowY: "visible",
              display: "block",
              '& [role="row"][data-id]': {
                WebkitTouchCallout: "none",
              },
            }}
            onClick={() => setTreeActive(true)}
            onContextMenu={handleGridContextMenu}
            onMouseDownCapture={handleReadOnlyHierarchyCellMouseDown}
            onTouchStart={handleGridTouchStart}
            onTouchMove={handleGridTouchEnd}
            onTouchEnd={handleGridTouchEnd}
            onTouchCancel={handleGridTouchEnd}
          >
            <Box sx={{ display: "inline-block", minWidth: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              columnHeaderHeight={HEADER_ROW_HEIGHT}
              getRowHeight={getRowHeight}
              getRowClassName={(params) => (
                params.id === highlightedRowId
                  ? `ofp-hierarchy-row-${params.row.type} ofp-hierarchy-row-highlighted`
                  : `ofp-hierarchy-row-${params.row.type}`
              )}
              rowModesModel={rowModesModel}
              onRowModesModelChange={setRowModesModel}
              onRowEditStop={handleHierarchyRowEditStop}
              processRowUpdate={handleHierarchyProcessRowUpdate}
              onProcessRowUpdateError={handleProcessRowUpdateError}
              loading={loading}
              editMode="row"
              autoHeight
              hideFooter={true}
              sortingMode="server"
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              isRowSelectable={() => true}
              isCellEditable={isCellEditable}
              sx={HIERARCHY_DATA_GRID_SX}
              disableRowSelectionOnClick
              onCellClick={handleHierarchyCellClick}
              onCellKeyDown={handleHierarchyCellKeyDown}
              localeText={germanDataGridLocaleText}
              apiRef={gridApiRef}
            />
            </Box>
          </Box>
        ) : null}
      </Box>

      {/* Notes Editor Drawer */}
      <NotesDrawer
        open={notesEditor.isOpen}
        title={t("columns.notes")}
        value={notesEditor.draft}
        onChange={notesEditor.setDraft}
        onSave={notesEditor.handleSave}
        onClose={notesEditor.handleClose}
        hasUnsavedChanges={Boolean(
          notesEditor.currentRow &&
            notesEditor.field &&
            notesEditor.draft !== ((notesEditor.currentRow[notesEditor.field] as string) || ""),
        )}
        loading={notesEditor.isSaving}
      />
      <Menu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        hideBackdrop
        sx={{ pointerEvents: "none" }}
        autoFocus
        disableAutoFocusItem={false}
        slotProps={{
          paper: {
            className: "ofp-custom-context-menu",
            sx: { pointerEvents: "auto" },
          },
          list: {
            autoFocus: true,
            ref: contextMenuListRef,
            onKeyDown: (event: React.KeyboardEvent<HTMLUListElement>) => handleContextMenuKeyboardNavigation(event, closeContextMenu),
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
        {contextMenuActions.flatMap((action, index) => {
          const previousAction = contextMenuActions[index - 1];
          const shouldSeparateGroup = previousAction !== undefined && previousAction.group !== action.group;
          const menuItem = (
            <MenuItem
              key={action.id}
              onClick={() => {
                closeContextMenu();
                action.onClick();
              }}
              sx={{ color: action.color === "error" ? "error.main" : undefined }}
            >
              {action.label}
            </MenuItem>
          );

          return shouldSeparateGroup
            ? [<Divider key={`${action.id}-divider`} role="separator" />, menuItem]
            : [menuItem];
        })}
        <TableCopyMenuItems
          rowValues={contextMenuState ? getHierarchyRowClipboardValues(contextMenuState.row) : null}
          tableRows={getHierarchyTableClipboardRows()}
          copyRowLabel={t("common:actions.copyRow")}
          copyTableLabel={t("common:actions.copyTable")}
          rowCopiedMessage={t("common:messages.rowCopied")}
          tableCopiedMessage={t("common:messages.tableCopied")}
          copyErrorMessage={t("common:messages.copyError")}
          includeDivider={contextMenuActions.length > 0}
          onClose={closeContextMenu}
        />
      </Menu>
      {pendingDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={deletion.message}
          undoLabel={t("actions.undo")}
          offsetIndex={index}
          testId="hierarchy-delete-snackbar"
          onClose={() => closePendingDeletionSnackbar(deletion.id)}
          onUndo={() => {
            void undoPendingDeletion(deletion.id);
          }}
        />
      ))}
    </div>
  );
}

export default FieldsBedsHierarchy;
