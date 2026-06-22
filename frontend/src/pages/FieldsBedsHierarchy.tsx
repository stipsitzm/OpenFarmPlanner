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
import { focusContextMenuOrigin, handleContextMenuKeyboardNavigation, useContextMenuFocus } from "../components/data-grid/contextMenuFocus";
import {
  handleEditableCellClick,
} from "../components/data-grid/handlers";
import { useNavigationBlocker } from "../hooks/autosave";
import { useHierarchyData, type HierarchyDataState } from "../components/hierarchy/hooks/useHierarchyData";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { useHierarchyDelete } from "../components/hierarchy/hooks/useHierarchyDelete";
import type { PendingHierarchyDeletion } from "../components/hierarchy/hooks/useHierarchyDelete";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { fieldAPI, bedAPI, locationAPI, type Bed, type Field, type Location as FarmLocation } from "../api/api";
import {
  buildHierarchyIndex,
  createHierarchyRowsProjector,
  type HierarchySortConfig,
} from "../components/hierarchy/utils/hierarchyUtils";
import {
  createHierarchyColumns,
  DEFAULT_HIERARCHY_COLUMN_WIDTHS,
} from "../components/hierarchy/HierarchyColumns";
import { extractApiErrorMessage } from "../api/errors";
import { shouldOpenCustomContextMenu, suppressNativeContextMenu } from "../utils/contextMenu";
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
  parseAreaExpression,
  normalizeAreaValue,
  parseAreaValue,
  parseDimensionValue,
} from "../components/hierarchy/utils/hierarchyAreaParsing";
import {
  useCommandContextTag,
  useRegisterCommands,
} from "../commands/useCommandContext";
import type { CommandSpec } from "../commands/types";
import { isTypingInEditableElement } from "../hooks/useKeyboardShortcuts";

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
  group: "create" | "edit" | "destructive";
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
  const [contextMenuState, setContextMenuState] = useState<{
    row: HierarchyRow;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [draftValidationWarning, setDraftValidationWarning] = useState("");
  const hasInitiallyExpandedRef = useRef(false);
  const handledCreateFieldRequestRef = useRef(0);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const touchLongPressTimeoutRef = useRef<number | null>(null);
  const contextMenuOriginRef = useRef<HTMLElement | null>(null);

  useCommandContextTag("areas");


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


  const preservePartialNewBedDraft = useCallback((draftRow: HierarchyRow): void => {
    if (draftRow.type !== "bed" || typeof draftRow.bedId !== "number") {
      return;
    }

    if (isPartiallyFilledNamelessNewHierarchyRow(draftRow)) {
      setDraftValidationWarning(t("messages.unsavedMissingName"));
      setError("");
    } else {
      setDraftValidationWarning("");
    }

    setBeds((previousBeds) =>
      previousBeds.map((bed) =>
        bed.id === draftRow.bedId
          ? {
              ...bed,
              name: draftRow.name ?? "",
              area_sqm: parseAreaValue(draftRow.area_sqm),
              length_m: parseDimensionValue(draftRow.length_m),
              width_m: parseDimensionValue(draftRow.width_m),
              notes: draftRow.notes ?? "",
            }
          : bed,
      ),
    );
  }, [parseAreaValue, parseDimensionValue, setBeds, setError, t]);

  const discardRowEdit = useCallback((rowId: GridRowId): void => {
    const draftRow = getDraftRow(rowId);

    if (draftRow?.isNew) {
      if (draftRow.type === "field") {
        setFields((previousFields) => previousFields.filter((field) => `field-${field.id}` !== String(rowId)));
        setDraftValidationWarning("");
        rowSnapshotRef.current.delete(String(rowId));
        setRowModesModel((previousModel) => ({
          ...previousModel,
          [rowId]: { mode: GridRowModes.View, ignoreModifications: true },
        }));
        return;
      }

      if (isCompletelyEmptyNewHierarchyRow(draftRow)) {
        setBeds((previousBeds) => previousBeds.filter((bed) => String(bed.id) !== String(rowId)));
        setDraftValidationWarning("");
      } else {
        preservePartialNewBedDraft(draftRow);
      }
    }

    rowSnapshotRef.current.delete(String(rowId));
    setRowModesModel((previousModel) => ({
      ...previousModel,
      [rowId]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
  }, [getDraftRow, preservePartialNewBedDraft, setBeds, setFields]);

  const discardActiveRowEdit = useCallback((): void => {
    const editingRowId = Object.entries(rowModesModel).find(([, mode]) => mode.mode === GridRowModes.Edit)?.[0];
    if (editingRowId === undefined) {
      return;
    }

    discardRowEdit(rowsById.get(editingRowId)?.id ?? editingRowId);
  }, [discardRowEdit, rowModesModel, rowsById]);

  const handleHierarchyRowEditStop = useCallback<GridEventListener<"rowEditStop">>((params, event): void => {
    if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
      event.defaultMuiPrevented = true;
      discardRowEdit(params.id);
      return;
    }

  }, [discardRowEdit]);

  const getBedAreaSum = (
    fieldId: number,
    excludeBedId?: number,
    overrideArea?: number,
  ) => {
    const filteredBeds = beds.filter(
      (b) => b.field === fieldId && b.id !== excludeBedId,
    );
    const bedAreas = filteredBeds.map((b) => {
      return parseAreaValue(b.area_sqm) ?? NaN;
    });
    const sum =
      bedAreas.reduce(
        (sum, area) => sum + (Number.isFinite(area) ? area : 0),
        0,
      ) + (typeof overrideArea === "number" ? overrideArea : 0);
    return sum;
  };

  const hasDuplicateFieldName = useCallback((row: HierarchyRow): boolean => {
    const normalizedName = (row.name ?? "").trim();
    if (!normalizedName) {
      return false;
    }
    return fields.some((field) =>
      field.id !== row.fieldId &&
      field.location === row.locationId &&
      field.name.trim() === normalizedName,
    );
  }, [fields]);

  const hasDuplicateBedName = useCallback((row: HierarchyRow): boolean => {
    const normalizedName = (row.name ?? "").trim();
    if (!normalizedName) {
      return false;
    }
    return beds.some((bed) =>
      bed.id !== row.bedId &&
      bed.field === row.field &&
      bed.name.trim() === normalizedName,
    );
  }, [beds]);

  const processRowUpdate = async (
    newRow: HierarchyRow,
  ): Promise<HierarchyRow> => {
    if (!newRow.name || newRow.name.trim() === "") {
      if (isPartiallyFilledNamelessNewHierarchyRow(newRow)) {
        preservePartialNewBedDraft(newRow);
        throw new Error(t("messages.unsavedMissingName"));
      }
      setError(t("validation.nameRequired"));
      throw new Error(t("validation.nameRequired"));
    }

    setDraftValidationWarning("");

    if (newRow.type === "bed") {
      if (hasDuplicateBedName(newRow)) {
        setError(t("validation.duplicateBedName"));
        throw new Error(t("validation.duplicateBedName"));
      }

      const parsedLength = parseDimensionValue(newRow.length_m);
      const parsedWidth = parseDimensionValue(newRow.width_m);

      if (newRow.length_m != null && parsedLength === undefined) {
        setError(t('validation.lengthNotANumber'));
        throw new Error(t('validation.lengthNotANumber'));
      }
      if (newRow.width_m != null && parsedWidth === undefined) {
        setError(t('validation.widthNotANumber'));
        throw new Error(t('validation.widthNotANumber'));
      }
      if (parsedLength !== null && parsedLength !== undefined && parsedLength < 0) {
        setError(t('validation.lengthNonNegative'));
        throw new Error(t('validation.lengthNonNegative'));
      }
      if (parsedWidth !== null && parsedWidth !== undefined && parsedWidth < 0) {
        setError(t('validation.widthNonNegative'));
        throw new Error(t('validation.widthNonNegative'));
      }

      const computedBedArea =
        parsedLength !== null &&
        parsedLength !== undefined &&
        parsedWidth !== null &&
        parsedWidth !== undefined
          ? normalizeAreaValue(parsedLength * parsedWidth)
          : normalizeAreaValue(parseAreaValue(newRow.area_sqm));

      const field = fields.find((f) => f.id === newRow.field);
      if (field && typeof computedBedArea === "number") {
        const fieldArea = parseAreaValue(field.area_sqm) ?? NaN;
        const sum = getBedAreaSum(field.id!, newRow.bedId, computedBedArea);
        if (sum > fieldArea) {
          const sumStr = sum.toFixed(2);
          const maxStr = fieldArea.toFixed(2);
          setError(
            t("validation.bedAreaExceedsField", { sum: sumStr, max: maxStr }),
          );
          throw new Error(
            t("validation.bedAreaExceedsField", { sum: sumStr, max: maxStr }),
          );
        }
      }

      const savedBed = await saveBed({
        id: newRow.bedId!,
        name: newRow.name,
        field: newRow.field!,
        area_sqm: computedBedArea,
        length_m: parsedLength,
        width_m: parsedWidth,
        notes: newRow.notes,
      });
      return {
        ...newRow,
        id: savedBed.id!,
        bedId: savedBed.id!,
        area_sqm: savedBed.area_sqm,
        length_m: savedBed.length_m,
        width_m: savedBed.width_m,
        isNew: false,
      };
    }

    if (newRow.type === "field") {
      if (hasDuplicateFieldName(newRow)) {
        setError(t("validation.duplicateFieldName"));
        throw new Error(t("validation.duplicateFieldName"));
      }

      const isNewField = typeof newRow.fieldId === "number" && newRow.fieldId < 0;
      const parsedLength = parseDimensionValue(newRow.length_m);
      const parsedWidth = parseDimensionValue(newRow.width_m);

      if (newRow.length_m != null && parsedLength === undefined) {
        setError(t('validation.lengthNotANumber'));
        throw new Error(t('validation.lengthNotANumber'));
      }
      if (newRow.width_m != null && parsedWidth === undefined) {
        setError(t('validation.widthNotANumber'));
        throw new Error(t('validation.widthNotANumber'));
      }
      if (parsedLength !== null && parsedLength !== undefined && parsedLength < 0) {
        setError(t('validation.lengthNonNegative'));
        throw new Error(t('validation.lengthNonNegative'));
      }
      if (parsedWidth !== null && parsedWidth !== undefined && parsedWidth < 0) {
        setError(t('validation.widthNonNegative'));
        throw new Error(t('validation.widthNonNegative'));
      }

      const fieldArea =
        parsedLength !== null &&
        parsedLength !== undefined &&
        parsedWidth !== null &&
        parsedWidth !== undefined
          ? normalizeAreaValue(parsedLength * parsedWidth)
          : normalizeAreaValue(parseAreaValue(newRow.area_sqm));

      if (isNewField) {
        if (
          fieldArea !== undefined &&
          (typeof fieldArea !== "number" || fieldArea <= 0 || Number.isNaN(fieldArea))
        ) {
          setError(t("validation.areaMustBePositive"));
          throw new Error(t("validation.areaMustBePositive"));
        }

        try {
          const created = await fieldAPI.create({
            name: newRow.name,
            location: newRow.locationId!,
            area_sqm: fieldArea,
            length_m: parsedLength,
            width_m: parsedWidth,
            notes: newRow.notes,
          });

          setFields((prevFields) => {
            const filteredFields = prevFields.filter((field) => field.id !== newRow.fieldId);
            return [{ ...created.data }, ...filteredFields];
          });
          void fetchData({ showLoading: false });
          setError("");
          return {
            ...newRow,
            id: `field-${created.data.id}`,
            fieldId: created.data.id,
            name: created.data.name,
            area_sqm: created.data.area_sqm,
            length_m: created.data.length_m,
            width_m: created.data.width_m,
            notes: created.data.notes,
            isNew: false,
          };
        } catch (err) {
          const extractedError = extractApiErrorMessage(err, t, t("errors.createField"));
          setError(extractedError);
          throw new Error(extractedError);
        }
      }

      if (
        typeof fieldArea !== "number" ||
        fieldArea <= 0 ||
        Number.isNaN(fieldArea)
      ) {
        setError(t("validation.areaMustBePositive"));
        throw new Error(t("validation.areaMustBePositive"));
      }

      if (fieldArea > 1000000) {
        setError(t("validation.areaTooLarge"));
        throw new Error(t("validation.areaTooLarge"));
      }

      const sum = getBedAreaSum(newRow.fieldId!);
      if (sum > fieldArea) {
        const sumStr = sum.toFixed(2);
        const maxStr = fieldArea.toFixed(2);
        setError(
          t("validation.bedAreaExceedsField", { sum: sumStr, max: maxStr }),
        );
        throw new Error(
          t("validation.bedAreaExceedsField", { sum: sumStr, max: maxStr }),
        );
      }
      try {
        const updated = await fieldAPI.update(newRow.fieldId!, {
          name: newRow.name,
          location: newRow.locationId!,
          area_sqm: fieldArea,
          length_m: parsedLength,
          width_m: parsedWidth,
          notes: newRow.notes,
        });
        const updatedArea = normalizeAreaValue(
          parseAreaValue(updated.data.area_sqm),
        );

        setFields((prevFields) =>
          prevFields.map((f) => {
            if (f.id === newRow.fieldId) {
              return {
                ...f,
                ...updated.data,
                id: updated.data.id,
                fieldId: updated.data.id,
                area_sqm: updatedArea,
                length_m: updated.data.length_m,
                width_m: updated.data.width_m,
              };
            }
            return f;
          }),
        );
        return {
          ...newRow,
          name: updated.data.name,
          area_sqm: updatedArea,
          length_m: updated.data.length_m,
          width_m: updated.data.width_m,
          notes: updated.data.notes,
        };
      } catch (err) {
        const extractedError = extractApiErrorMessage(err, t, t("errors.save"));
        const requiresLocationSelection =
          locations.length > 1 &&
          extractedError.toLowerCase().includes("standort") &&
          extractedError.toLowerCase().includes(t("validation.required").toLowerCase());
        const errorMessage =
          requiresLocationSelection
            ? t("messages.invalidLocationSelection")
            :
          extractedError.includes("max_digits") ||
          extractedError.toLowerCase().includes("digits")
            ? t("validation.areaTooLarge")
            : extractedError;

        setError(errorMessage);
        throw new Error(errorMessage);
      }
    }
    if (newRow.type === "location") {
      const existingLocation = locations.find((locationItem) => locationItem.id === newRow.locationId);
      const updated = await locationAPI.update(newRow.locationId!, {
        ...(existingLocation ?? {}),
        id: newRow.locationId!,
        name: newRow.name,
      });

      setLocations((previousLocations) =>
        previousLocations.map((locationItem) =>
          locationItem.id === newRow.locationId
            ? { ...locationItem, ...updated.data, id: updated.data.id }
            : locationItem,
        ),
      );
      return {
        ...newRow,
        name: updated.data.name,
      };
    }
    return newRow;
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error("Row update error:", error);
    if (error.message === t("messages.unsavedMissingName")) {
      setDraftValidationWarning(error.message);
      setError("");
      return;
    }
    setError(error.message || t("errors.save"));
  };

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedRow) {
      return;
    }

    if (selectedRow.type === "location" || selectedRow.type === "field" || selectedRow.type === "bed") {
      void deleteHierarchyRowWithUndo(selectedRow);
    }
  }, [deleteHierarchyRowWithUndo, selectedRow]);

  const handleCreateBySelection = useCallback(() => {
    if (!selectedRow) {
      return;
    }

    if (selectedRow.type === "location" && selectedRow.locationId) {
      handleAddField(selectedRow.locationId);
      return;
    }

    if (selectedRow.type === "field" && selectedRow.fieldId) {
      handleAddBed(selectedRow.fieldId);
      return;
    }

    if (selectedRow.type === "bed" && selectedRow.field) {
      handleAddBed(selectedRow.field);
    }
  }, [handleAddBed, handleAddField, selectedRow]);

  const handleEditSelected = useCallback(() => {
    if (!selectedRow) {
      return;
    }

    rememberRowSnapshot(selectedRow.id);
    setRowModesModel((previous) => ({
      ...previous,
      [selectedRow.id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  }, [rememberRowSnapshot, selectedRow]);

  const startRowEdit = useCallback((row: HierarchyRow): void => {
    rememberRowSnapshot(row.id);
    setSelectedRowId(row.id);
    setTreeActive(true);
    setRowModesModel((previous) => ({
      ...previous,
      [row.id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  }, [rememberRowSnapshot]);

  const getHierarchyRowActions = useCallback((row: HierarchyRow): HierarchyRowAction[] => {
    const createActions: HierarchyRowAction[] = [];
    const editActions: HierarchyRowAction[] = [];

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

    editActions.push({
      id: "edit",
      label: t("common:actions.edit"),
      group: "edit",
      onClick: () => startRowEdit(row),
    });

    const destructiveActions: HierarchyRowAction[] = [{
      id: "delete",
      label: t("common:actions.delete"),
      group: "destructive",
      color: "error",
      onClick: () => {
        void deleteHierarchyRowWithUndo(row);
      },
    }];

    return [...createActions, ...editActions, ...destructiveActions];
  }, [
    deleteHierarchyRowWithUndo,
    handleAddBed,
    handleAddField,
    handleCreatePlantingPlan,
    startRowEdit,
    t,
  ]);

  const openContextMenuForRow = useCallback((
    row: HierarchyRow,
    mouseX: number,
    mouseY: number,
    origin?: HTMLElement | null,
    options?: { markHintUsed?: boolean },
  ): void => {
    if (options?.markHintUsed !== false) {
      markContextMenuHintUsed();
    }
    setSelectedRowId(row.id);
    setTreeActive(true);
    contextMenuOriginRef.current = origin ?? null;
    setContextMenuState({ row, mouseX, mouseY });
  }, [markContextMenuHintUsed]);

  const handleNameCellContextMenu = useCallback((event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, row: HierarchyRow): void => {
    suppressNativeContextMenu(event);
    const hasPointerCoordinates =
      "clientX" in event &&
      "clientY" in event &&
      typeof event.clientX === "number" &&
      typeof event.clientY === "number" &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0);
    if (hasPointerCoordinates) {
      openContextMenuForRow(row, event.clientX + 2, event.clientY - 6, event.currentTarget);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenuForRow(row, rect.right - 8, rect.top + 12, event.currentTarget);
  }, [openContextMenuForRow]);

  const handleGridContextMenu = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    if (!shouldOpenCustomContextMenu(event.target)) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    const rowId = rowElement?.dataset.id;
    if (!rowId) {
      return;
    }
    const targetRow = rows.find((row) => String(row.id) === rowId);
    if (!targetRow) {
      return;
    }

    suppressNativeContextMenu(event);
    setSelectedRowId(targetRow.id);
    setTreeActive(true);
    openContextMenuForRow(targetRow, event.clientX + 2, event.clientY - 6, rowElement);
  }, [openContextMenuForRow, rows]);

  const handleGridTouchStart = useCallback((event: React.TouchEvent<HTMLElement>): void => {
    if (!shouldOpenCustomContextMenu(event.target)) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    const rowId = rowElement?.dataset.id;
    if (!rowId) {
      return;
    }
    const targetRow = rows.find((row) => String(row.id) === rowId);
    const touch = event.touches[0];
    if (!targetRow || !touch) {
      return;
    }

    touchLongPressTimeoutRef.current = window.setTimeout(() => {
      openContextMenuForRow(targetRow, touch.clientX, touch.clientY, rowElement, { markHintUsed: false });
    }, 550);
  }, [openContextMenuForRow, rows]);

  const handleGridTouchEnd = useCallback((): void => {
    if (touchLongPressTimeoutRef.current !== null) {
      window.clearTimeout(touchLongPressTimeoutRef.current);
      touchLongPressTimeoutRef.current = null;
    }
  }, []);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
    focusContextMenuOrigin(contextMenuOriginRef.current);
  }, []);
  const contextMenuListRef = useContextMenuFocus(contextMenuState !== null, closeContextMenu);

  const areaCommands = useMemo<CommandSpec[]>(
    () => [
      {
        id: "areas.create",
        label: "Neu erstellen",
        group: 'navigation',
      keywords: ["neu", "anbauflächen", "create"],
                        contextTags: ["areas"],
        isEnabled: () => selectedRow !== null,
        action: handleCreateBySelection,
      },
      {
        id: "areas.edit",
        label: "Bearbeiten (Alt+E)",
        group: 'navigation',
      keywords: ["bearbeiten", "edit"],
                keys: { key: "Enter" },
        contextTags: ["areas"],
        isEnabled: () =>
          selectedRow !== null && selectedRow.type !== "location",
        action: handleEditSelected,
      },
      {
        id: "areas.delete",
        label: "Löschen (Alt+Shift+D)",
        group: 'navigation',
      keywords: ["löschen", "delete"],
                keys: { key: "Delete" },
        contextTags: ["areas"],
        isEnabled: () => selectedRow !== null,
        action: handleDeleteSelected,
      },
    ],
    [
      handleCreateBySelection,
      handleDeleteSelected,
      handleEditSelected,
      selectedRow,
    ],
  );

  useRegisterCommands("areas-page", areaCommands);

  useEffect(() => {
    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!tableWrapperRef.current?.contains(event.target as Node)) {
        discardActiveRowEdit();
        setTreeActive(false);
      }
    };

    const handleTreeNavigation = (event: KeyboardEvent) => {
      if (contextMenuState !== null || !treeActive || !selectedRowId) {
        return;
      }

      if (isTypingInEditableElement(document.activeElement)) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const currentIndex = rows.findIndex((row) => row.id === selectedRowId);
      if (currentIndex === -1) {
        return;
      }

      let performedAction = false;
      let targetRowId: string | number | null = selectedRowId;

      if (event.key === "ArrowDown") {
        const nextRow = rows[currentIndex + 1];
        if (nextRow) {
          targetRowId = nextRow.id;
          setSelectedRowId(nextRow.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowUp") {
        const previousRow = rows[currentIndex - 1];
        if (previousRow) {
          targetRowId = previousRow.id;
          setSelectedRowId(previousRow.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowRight") {
        const row = rows[currentIndex];
        if (
          row &&
          (row.type === "location" || row.type === "field") &&
          row.hasChildren === true &&
          !expandedRows.has(row.id)
        ) {
          toggleExpand(row.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowLeft") {
        const row = rows[currentIndex];
        if (row && expandedRows.has(row.id)) {
          toggleExpand(row.id);
          performedAction = true;
        }
      }

      if (!performedAction) {
        return;
      }

      event.preventDefault();

      const selectedElement = document.querySelector(
        `[data-id="${String(targetRowId ?? selectedRowId)}"]`,
      );
      if (selectedElement instanceof HTMLElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    window.addEventListener("keydown", handleTreeNavigation);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      window.removeEventListener("keydown", handleTreeNavigation);
    };
  }, [contextMenuState, discardActiveRowEdit, expandedRows, rows, selectedRowId, toggleExpand, treeActive]);

  useEffect(() => {
    const handleContextMenuKeyboard = (event: KeyboardEvent) => {
      const shouldOpen =
        event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
      if (!shouldOpen || !treeActive || !selectedRowId || isTypingInEditableElement(document.activeElement)) {
        return;
      }

      const selectedRow = rows.find((row) => row.id === selectedRowId);
      if (!selectedRow) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const targetElement = document.querySelector(`[data-id="${String(selectedRowId)}"]`) as HTMLElement | null;
      if (!targetElement) {
        return;
      }
      const rect = targetElement.getBoundingClientRect();
      openContextMenuForRow(selectedRow, rect.left + Math.min(240, rect.width), rect.top + 12, targetElement);
    };

    window.addEventListener("keydown", handleContextMenuKeyboard);
    return () => window.removeEventListener("keydown", handleContextMenuKeyboard);
  }, [openContextMenuForRow, rows, selectedRowId, treeActive]);

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

  const rowSelectionModel = useMemo(
    () => ({
      type: "include" as const,
      ids: new Set(selectedRowId ? [selectedRowId] : []),
    }),
    [selectedRowId],
  );

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
            sx={{ mb: 1.25 }}
          />
        )}

        {shouldShowMissingDimensionsHint && (
          <Box sx={{ mb: 2 }}>
            <EmptyStateCard
              title={t('messages.missingDimensionsHint')}
              description={t('messages.missingDimensionsHintOptional')}
            />
          </Box>
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
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={(nextModel) =>
                setSelectedRowId(Array.from(nextModel.ids)[0] ?? null)
              }
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
        autoFocus
        disableAutoFocusItem={false}
        slotProps={{
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
