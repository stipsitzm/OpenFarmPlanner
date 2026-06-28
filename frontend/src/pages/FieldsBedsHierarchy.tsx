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
  MuiEvent,
} from "@mui/x-data-grid";
import { Box, Alert, useMediaQuery } from "@mui/material";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EmptyStateCard from '../components/project/EmptyStateCard';
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
  handleEditableCellClick,
} from "../components/data-grid/handlers";
import { useNavigationBlocker } from "../hooks/autosave";
import { useHierarchyData, type HierarchyDataState } from "../components/hierarchy/hooks/useHierarchyData";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { useHierarchyDelete } from "../components/hierarchy/hooks/useHierarchyDelete";
import { useHierarchyRowUpdate } from "../components/hierarchy/hooks/useHierarchyRowUpdate";
import { useHierarchyContextMenu } from "../components/hierarchy/hooks/useHierarchyContextMenu";
import { useHierarchyKeyboard } from "../components/hierarchy/hooks/useHierarchyKeyboard";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { fieldAPI, bedAPI, type Field } from "../api/api";
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
  "& .ofp-hierarchy-cell-missing-dimension": {
    backgroundColor: "#fbf2d5",
    color: "text.primary",
  },
  "& .MuiDataGrid-row:hover .ofp-hierarchy-cell-missing-dimension": {
    backgroundColor: "surface.surfaceHoverBackground",
    boxShadow: "inset 0 0 0 9999px rgba(237, 108, 2, 0.14)",
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
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(
    null,
  );
  const [treeActive, setTreeActive] = useState(false);
  const prevRowModesModelRef = useRef<GridRowModesModel>({});
  const [draftValidationWarning, setDraftValidationWarning] = useState("");
  const hasInitiallyExpandedRef = useRef(false);
  const handledCreateFieldRequestRef = useRef(0);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);

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

  // Refs so keyboard handlers always read latest values without re-registering listeners on every navigation press.
  const selectedRowIdRef = useRef(selectedRowId);
  selectedRowIdRef.current = selectedRowId;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const expandedRowsRef = useRef(expandedRows);
  expandedRowsRef.current = expandedRows;
  // Tracks the previous rows list so we can detect when the selected row
  // becomes hidden (parent collapsed) and re-select the nearest visible ancestor.
  const prevRowsRef = useRef(rows);

  const shouldShowHierarchyTable = fields.length > 0 || createFieldRequest > 0;
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
    preservePartialNewBedDraft,
    discardRowEdit,
    discardActiveRowEdit,
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
      }
      // Note: locations don't have notes in this hierarchy
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

  const handleHierarchyRowEditStop = useCallback<GridEventListener<"rowEditStop">>((params, event): void => {
    if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
      event.defaultMuiPrevented = true;
      discardRowEdit(params.id);
      return;
    }

  }, [discardRowEdit]);

  // After any row edit stops, MUI DataGrid v8 moves cell focus to the next row
  // ('cellToFocusAfter = below' for enterKeyDown). Re-sync focus back to
  // selectedRowId so the highlight and the focus box always match.
  useEffect(() => {
    const prevModel = prevRowModesModelRef.current;
    prevRowModesModelRef.current = rowModesModel;

    const wasEditing = Object.values(prevModel).some(
      (mode) => mode.mode === GridRowModes.Edit,
    );
    const isNowEditing = Object.values(rowModesModel).some(
      (mode) => mode.mode === GridRowModes.Edit,
    );

    if (wasEditing && !isNowEditing && selectedRowId) {
      gridApiRef.current?.setCellFocus?.(selectedRowId, "name");
    }
  }, [rowModesModel, selectedRowId, gridApiRef]);

  // Sync DataGrid cell focus after navigation (ArrowDown/Up) or table focus (Alt+T).
  // useLayoutEffect runs after React commits to DOM but before the browser paints,
  // so the highlight and the focus box update in the same frame with no visible lag,
  // and without blocking the main thread like flushSync would.
  useLayoutEffect(() => {
    if (treeActive && selectedRowId != null) {
      gridApiRef.current?.setCellFocus?.(selectedRowId, "name");
    }
    // Imperative selection avoids O(n) re-render of every row that the controlled
    // rowSelectionModel prop triggers. selectRow(..., true, true) deselects all
    // other rows and selects this one via DataGrid's internal state — only the 2
    // affected rows re-render instead of the entire list.
    if (selectedRowId != null) {
      gridApiRef.current?.selectRow?.(selectedRowId, true, true);
    }
  }, [selectedRowId, treeActive, gridApiRef]);

  // When rows change (expand/collapse) and the selected row is no longer visible,
  // move selection to the nearest still-visible ancestor instead of leaving the
  // selection pointing at a hidden row (which silently breaks ArrowDown/Up).
  useLayoutEffect(() => {
    const prevRows = prevRowsRef.current;
    prevRowsRef.current = rows;

    if (!selectedRowId || !treeActive) return;
    if (rows.some((r) => r.id === selectedRowId)) return; // still visible

    // Scan backward from the selected row's previous position to find the
    // closest ancestor that is still visible (i.e. the row that was just collapsed).
    const prevIndex = prevRows.findIndex((r) => r.id === selectedRowId);
    let targetRow: HierarchyRow | undefined;
    if (prevIndex > -1) {
      for (let i = prevIndex - 1; i >= 0; i--) {
        const candidate = prevRows[i] as HierarchyRow;
        if (rows.some((r) => r.id === candidate.id)) {
          targetRow = candidate;
          break;
        }
      }
    }
    if (!targetRow) {
      targetRow = rows[0] as HierarchyRow | undefined;
    }
    if (targetRow) {
      setSelectedRowId(targetRow.id);
    }
  }, [rows, selectedRowId, treeActive]);

  // Read the current row from refs at call time so these callbacks are stable
  // and don't trigger re-renders of areaCommands on every navigation keypress.
  const handleDeleteSelected = useCallback(() => {
    const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
    if (!row) return;
    if (row.type === "location" || row.type === "field" || row.type === "bed") {
      void deleteHierarchyRowWithUndo(row);
    }
  }, [deleteHierarchyRowWithUndo]);

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
  }, [handleAddBed, handleAddField]);

  const handleEditSelected = useCallback(() => {
    const row = rowsRef.current.find((r) => r.id === selectedRowIdRef.current);
    if (!row) return;
    rememberRowSnapshot(row.id);
    setRowModesModel((previous) => ({
      ...previous,
      [row.id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  }, [rememberRowSnapshot]);

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
    [handleCreateBySelection, handleDeleteSelected, handleEditSelected],
  );

  useRegisterCommands("areas-page", areaCommands);

  useHierarchyKeyboard({
    contextMenuState,
    treeActive,
    tableWrapperRef,
    rowsRef,
    selectedRowIdRef,
    expandedRowsRef,
    setSelectedRowId,
    setTreeActive,
    toggleExpand,
    discardActiveRowEdit,
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
  }, [beds, parseDimensionValue]);

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
            onTouchStart={handleGridTouchStart}
            onTouchMove={handleGridTouchEnd}
            onTouchEnd={handleGridTouchEnd}
            onTouchCancel={handleGridTouchEnd}
          >
            <Box sx={{ display: "inline-block", width: "fit-content", minWidth: 320, maxWidth: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              columnHeaderHeight={HEADER_ROW_HEIGHT}
              getRowHeight={getRowHeight}
              getRowClassName={(params) => `ofp-hierarchy-row-${params.row.type}`}
              rowModesModel={rowModesModel}
              onRowModesModelChange={setRowModesModel}
              onRowEditStop={handleHierarchyRowEditStop}
              processRowUpdate={processRowUpdate}
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
              onCellClick={(params) => {
                const editingRowId = Object.entries(rowModesModel).find(([, mode]) => mode.mode === GridRowModes.Edit)?.[0];
                if (editingRowId !== undefined && String(editingRowId) !== String(params.id)) {
                  discardRowEdit(rowsById.get(editingRowId)?.id ?? editingRowId);
                }
                rememberRowSnapshot(params.id);
                setSelectedRowId(params.id);
                setTreeActive(true);
                handleEditableCellClick(params, rowModesModel, setRowModesModel);
              }}
              onCellKeyDown={(params: GridCellParams<HierarchyRow>, event) => {
                const keyboardEvent = event as MuiEvent<React.KeyboardEvent>;
                if (
                  keyboardEvent.key === "Escape" &&
                  rowModesModel[params.id]?.mode === GridRowModes.Edit
                ) {
                  keyboardEvent.preventDefault();
                  keyboardEvent.defaultMuiPrevented = true;
                  discardRowEdit(params.id);
                  return;
                }

                if (
                  params.field === "notes" &&
                  (keyboardEvent.key === "Enter" ||
                    keyboardEvent.key === " " ||
                    keyboardEvent.key === "Spacebar")
                ) {
                  keyboardEvent.preventDefault();
                  keyboardEvent.stopPropagation();
                  keyboardEvent.defaultMuiPrevented = true;
                  notesEditor.handleOpen(params.id, "notes");
                  return;
                }

                if (
                  (keyboardEvent.key === " " || keyboardEvent.key === "Spacebar") &&
                  params.field !== "notes" &&
                  rowModesModel[params.id]?.mode !== GridRowModes.Edit
                ) {
                  const row = params.row as HierarchyRow;
                  if ((row.type === "location" || row.type === "field") && row.hasChildren) {
                    keyboardEvent.preventDefault();
                    keyboardEvent.defaultMuiPrevented = true;
                    toggleExpand(params.id);
                    return;
                  }
                }

                // Prevent DataGrid from moving cell focus on ArrowDown/Up in view mode.
                // Our window-level handleTreeNavigation handles navigation exclusively and
                // explicitly syncs both selectedRowId and DataGrid cell focus, so the
                // highlight and the focus box always move together.
                if (
                  (keyboardEvent.key === "ArrowDown" || keyboardEvent.key === "ArrowUp") &&
                  rowModesModel[params.id]?.mode !== GridRowModes.Edit
                ) {
                  keyboardEvent.defaultMuiPrevented = true;
                }

                // Prevent a printable character from triggering DataGrid's "type to start
                // editing" behaviour in view mode. Editing must be started explicitly via
                // Enter, F2, or a double-click — not by accidentally pressing a letter.
                // We also block Alt+letter (e.g. Alt+T) because MUI DataGrid v8's
                // isPrintableKey() does not exclude altKey, so Alt+T would otherwise
                // start editing rather than fire our Alt+T navigation shortcut.
                // Ctrl/Meta are already excluded by MUI's own check, but Alt is not.
                if (
                  keyboardEvent.key.length === 1 &&
                  !keyboardEvent.ctrlKey &&
                  !keyboardEvent.metaKey &&
                  rowModesModel[params.id]?.mode !== GridRowModes.Edit
                ) {
                  keyboardEvent.defaultMuiPrevented = true;
                }

                if (keyboardEvent.key === "ContextMenu" || (keyboardEvent.shiftKey && keyboardEvent.key === "F10")) {
                  keyboardEvent.preventDefault();
                  keyboardEvent.stopPropagation();
                  const targetRow = rows.find((row) => row.id === params.id);
                  if (targetRow) {
                    const targetElement = keyboardEvent.currentTarget as HTMLElement;
                    const rect = targetElement.getBoundingClientRect();
                    openContextMenuForRow(targetRow, rect.left + Math.min(240, rect.width), rect.top + 12, targetElement);
                  }
                }
              }}
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
