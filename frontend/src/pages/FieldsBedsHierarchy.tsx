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
} from "@mui/x-data-grid";
import { Box, Alert } from "@mui/material";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EmptyStateCard from '../components/project/EmptyStateCard';
import { dataGridSx } from "../components/data-grid/styles";
import {
  DeleteUndoSnackbar,
  DELETE_UNDO_DURATION_MS,
} from "../components/data-grid";
import {
  handleRowEditStop,
  handleEditableCellClick,
} from "../components/data-grid/handlers";
import { useNavigationBlocker } from "../hooks/autosave";
import { useHierarchyData } from "../components/hierarchy/hooks/useHierarchyData";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { useFieldOperations } from "../components/hierarchy/hooks/useFieldOperations";
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
import { useNotesEditor, NotesDrawer } from "../components/data-grid";
import { extractApiErrorMessage } from "../api/errors";
import type { HierarchyRow } from "../components/hierarchy/utils/types";
import {
  useCommandContextTag,
  useRegisterCommands,
} from "../commands/useCommandContext";
import type { CommandSpec } from "../commands/types";
import { isTypingInEditableElement } from "../hooks/useKeyboardShortcuts";

interface FieldsBedsHierarchyProps {
  showTitle?: boolean;
}

interface HierarchyRowAction {
  id: string;
  label: string;
  group: "create" | "edit" | "destructive";
  color?: "default" | "error";
  onClick: () => void;
}

type PendingHierarchyDeletionType = "location" | "field" | "bed";

interface PendingHierarchyDeletion {
  id: string;
  type: PendingHierarchyDeletionType;
  targetId: number;
  message: string;
  locations: FarmLocation[];
  fields: Field[];
  beds: Bed[];
  allLocationsBeforeDelete: FarmLocation[];
  allFieldsBeforeDelete: Field[];
  allBedsBeforeDelete: Bed[];
  expandedRowsBeforeDelete: Set<string | number>;
  visible: boolean;
}

export type HierarchyNameMeasureEntry = {
  name: string;
  level: number;
  type: HierarchyRow["type"];
};

const isEmptyHierarchyDraftValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  return false;
};

export const isCompletelyEmptyNewHierarchyRow = (row: HierarchyRow): boolean => {
  if (!row.isNew) {
    return false;
  }

  return (
    isEmptyHierarchyDraftValue(row.name) &&
    isEmptyHierarchyDraftValue(row.area_sqm) &&
    isEmptyHierarchyDraftValue(row.length_m) &&
    isEmptyHierarchyDraftValue(row.width_m) &&
    isEmptyHierarchyDraftValue(row.notes)
  );
};

export const isPartiallyFilledNamelessNewHierarchyRow = (row: HierarchyRow): boolean => (
  Boolean(row.isNew) &&
  isEmptyHierarchyDraftValue(row.name) &&
  !isCompletelyEmptyNewHierarchyRow(row)
);

const NAME_COLUMN_MIN_WIDTH = 220;
const NAME_COLUMN_MAX_WIDTH = 520;
const NAME_COLUMN_CHAR_WIDTH_FALLBACK_PX = 8;
const NAME_COLUMN_INDENT_PER_LEVEL_PX = 24;
const NAME_COLUMN_EXPAND_CHROME_PX = 44;
const NAME_COLUMN_CELL_HORIZONTAL_PADDING_PX = 20;
const NAME_COLUMN_BED_TEXT_PADDING_PX = 8;
const NAME_COLUMN_WIDTH_BUFFER_PX = 2;
export const NAME_COLUMN_MEASUREMENT_RESERVE_PX = 14;
export const calculateHierarchyNameColumnWidth = (
  entries: HierarchyNameMeasureEntry[],
  getTextWidth: (entry: HierarchyNameMeasureEntry) => number,
): number => {
  const measuredWidth = entries.reduce((maxWidth, row) => {
    const textWidth = getTextWidth(row);
    const hierarchyChromeWidth =
      row.level * NAME_COLUMN_INDENT_PER_LEVEL_PX +
      NAME_COLUMN_EXPAND_CHROME_PX +
      NAME_COLUMN_CELL_HORIZONTAL_PADDING_PX +
      (row.type === "bed" ? NAME_COLUMN_BED_TEXT_PADDING_PX : 0) +
      NAME_COLUMN_WIDTH_BUFFER_PX;

    return Math.max(
      maxWidth,
      hierarchyChromeWidth + textWidth + NAME_COLUMN_MEASUREMENT_RESERVE_PX,
    );
  }, NAME_COLUMN_MIN_WIDTH);

  return Math.min(NAME_COLUMN_MAX_WIDTH, Math.max(NAME_COLUMN_MIN_WIDTH, measuredWidth));
};

const getHierarchyNameFont = (
  entry: HierarchyNameMeasureEntry,
  baseFontSizePx: number,
  fontFamily: string,
): string => {
  const fontWeight = entry.type === "location" ? 600 : 400;
  const fontSizePx =
    entry.type === "location"
      ? baseFontSizePx * 1.02
      : entry.type === "bed"
        ? baseFontSizePx * 0.95
        : baseFontSizePx;

  return `${fontWeight} ${fontSizePx}px ${fontFamily}`;
};

const getHierarchyNameMeasureKey = (entry: HierarchyNameMeasureEntry): string =>
  `${entry.type}\u0000${entry.name}`;

const measureHierarchyNameTextWidths = (
  entries: HierarchyNameMeasureEntry[],
): Map<string, number> => {
  const widths = new Map<string, number>();

  const setFallbackWidths = (): Map<string, number> => {
    entries.forEach((entry) => {
      widths.set(
        getHierarchyNameMeasureKey(entry),
        entry.name.length * NAME_COLUMN_CHAR_WIDTH_FALLBACK_PX,
      );
    });
    return widths;
  };

  if (typeof document === "undefined") {
    return setFallbackWidths();
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return setFallbackWidths();
  }

  const bodyStyle = window.getComputedStyle(document.body);
  const baseFontSizePx =
    Number.parseFloat(bodyStyle.fontSize) || 16;
  const fontFamily = bodyStyle.fontFamily || "Roboto, Arial, sans-serif";

  entries.forEach((entry) => {
    context.font = getHierarchyNameFont(entry, baseFontSizePx, fontFamily);
    widths.set(
      getHierarchyNameMeasureKey(entry),
      Math.ceil(context.measureText(entry.name).width),
    );
  });

  return widths;
};

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
  "& .ofp-row-actions-column": {
    position: "sticky",
    right: 0,
    zIndex: 3,
    backgroundColor: "background.paper",
    borderLeft: "1px solid",
    borderLeftColor: "divider",
    boxShadow: "-6px 0 10px -10px rgba(21, 31, 24, 0.45)",
  },
  "& .ofp-row-actions-header": {
    zIndex: 5,
  },
  "& .ofp-row-actions-cell": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    px: 0,
  },
  "& .ofp-row-actions-trigger": {
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 120ms ease-in-out, background-color 120ms ease-in-out, color 120ms ease-in-out",
  },
  "& .MuiDataGrid-row:hover .ofp-row-actions-trigger, & .MuiDataGrid-row:focus-within .ofp-row-actions-trigger, & .ofp-row-actions-trigger.Mui-focusVisible": {
    opacity: 1,
    pointerEvents: "auto",
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
  "& .ofp-hierarchy-cell-missing-dimension:hover": {
    backgroundColor: "#FAFBF7",
  },
};

function FieldsBedsHierarchy({
  showTitle = true,
}: FieldsBedsHierarchyProps): React.ReactElement {
  const LOCATION_ROW_HEIGHT = 46;
  const FIELD_ROW_HEIGHT = 42;
  const BED_ROW_HEIGHT = 36;
  const HEADER_ROW_HEIGHT = 40;

  const { t } = useTranslation("hierarchy");
  const navigate = useNavigate();
  const location = useLocation();
  const gridApiRef = useGridApiRef();
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
  const [pendingDeletions, setPendingDeletions] = useState<PendingHierarchyDeletion[]>([]);
  const hasInitiallyExpandedRef = useRef(false);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());
  const pendingDeletionTimersRef = useRef<Map<string, number>>(new Map());
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const touchLongPressTimeoutRef = useRef<number | null>(null);

  useCommandContextTag("areas");

  // Data fetching
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
  } = useHierarchyData();

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
    useBedOperations(beds, setBeds, setError, t);

  // Field operations
  const { addField } = useFieldOperations(
    locations,
    setError,
    fetchData,
    t,
  );

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

  const handleCreatePlantingPlan = useCallback(
    (bedId: number): void => {
      navigate(`/app/planting-plans?bedId=${bedId}`);
    },
    [navigate],
  );

  const parseAreaExpression = useCallback((input: string): number | undefined => {
    const normalizedInput = input.trim().replace(/,/g, ".");
    if (!normalizedInput) {
      return undefined;
    }

    const factors = normalizedInput
      .split(/[*x×]/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (factors.length === 0) {
      return undefined;
    }

    let product = 1;
    for (const factor of factors) {
      if (!/^\d+(\.\d+)?$/.test(factor)) {
        return undefined;
      }
      const numeric = Number.parseFloat(factor);
      if (!Number.isFinite(numeric)) {
        return undefined;
      }
      product *= numeric;
    }

    return Number.isFinite(product) ? product : undefined;
  }, []);

  const normalizeAreaValue = (
    value: number | undefined,
  ): number | undefined => {
    if (value === undefined || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.round(value * 10) / 10;
  };

  const parseAreaValue = useCallback((
    value: number | string | undefined,
  ): number | undefined => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string" && value.trim() !== "") {
      return parseAreaExpression(value);
    }
    return undefined;
  }, [parseAreaExpression]);

  const parseDimensionValue = useCallback((
    value: number | string | null | undefined,
  ): number | null | undefined => {
    if (value === null) return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const parsed = Number.parseFloat(trimmed.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, []);

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
  }, [getDraftRow, preservePartialNewBedDraft, setBeds]);

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

    handleRowEditStop(params, event);
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
      const parsedLength = parseDimensionValue(newRow.length_m);
      const parsedWidth = parseDimensionValue(newRow.width_m);

      if (
        parsedLength !== undefined &&
        parsedLength !== null &&
        parsedLength < 0
      ) {
        setError(t('validation.lengthNonNegative'));
        throw new Error(t('validation.lengthNonNegative'));
      }
      if (
        parsedWidth !== undefined &&
        parsedWidth !== null &&
        parsedWidth < 0
      ) {
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
      const parsedLength = parseDimensionValue(newRow.length_m);
      const parsedWidth = parseDimensionValue(newRow.width_m);

      if (
        parsedLength !== undefined &&
        parsedLength !== null &&
        parsedLength < 0
      ) {
        setError(t('validation.lengthNonNegative'));
        throw new Error(t('validation.lengthNonNegative'));
      }
      if (
        parsedWidth !== undefined &&
        parsedWidth !== null &&
        parsedWidth < 0
      ) {
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
        await fetchData();
        return {
          ...newRow,
          name: updated.data.name,
          area_sqm: updated.data.area_sqm,
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
      await fetchData();
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

  const restoreDeletedItems = useCallback((deletion: PendingHierarchyDeletion): void => {
    const restoreByPreviousOrder = <T extends { id?: number }>(
      currentItems: T[],
      deletedItems: T[],
      previousItems: T[],
    ): T[] => {
      const byId = new Map<number, T>();
      currentItems.forEach((item) => {
        if (typeof item.id === "number") {
          byId.set(item.id, item);
        }
      });
      deletedItems.forEach((item) => {
        if (typeof item.id === "number" && !byId.has(item.id)) {
          byId.set(item.id, item);
        }
      });

      const previousOrder = new Map<number, number>();
      previousItems.forEach((item, index) => {
        if (typeof item.id === "number") {
          previousOrder.set(item.id, index);
        }
      });

      return Array.from(byId.values()).sort((left, right) => {
        const leftIndex = typeof left.id === "number" ? previousOrder.get(left.id) : undefined;
        const rightIndex = typeof right.id === "number" ? previousOrder.get(right.id) : undefined;
        if (leftIndex === undefined && rightIndex === undefined) return 0;
        if (leftIndex === undefined) return 1;
        if (rightIndex === undefined) return -1;
        return leftIndex - rightIndex;
      });
    };

    setLocations((currentLocations) =>
      restoreByPreviousOrder(currentLocations, deletion.locations, deletion.allLocationsBeforeDelete),
    );
    setFields((currentFields) =>
      restoreByPreviousOrder(currentFields, deletion.fields, deletion.allFieldsBeforeDelete),
    );
    setBeds((currentBeds) =>
      restoreByPreviousOrder(currentBeds, deletion.beds, deletion.allBedsBeforeDelete),
    );
    expandAll(Array.from(deletion.expandedRowsBeforeDelete));
  }, [expandAll, setBeds, setFields, setLocations]);

  const removePendingDeletion = useCallback((deletionId: string): void => {
    setPendingDeletions((currentDeletions) =>
      currentDeletions.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

  const finalizePendingDeletion = useCallback(async (deletion: PendingHierarchyDeletion): Promise<void> => {
    pendingDeletionTimersRef.current.delete(deletion.id);
    removePendingDeletion(deletion.id);

    try {
      if (deletion.type === "location") {
        await locationAPI.delete(deletion.targetId);
      } else if (deletion.type === "field") {
        await fieldAPI.delete(deletion.targetId);
      } else if (deletion.targetId > 0) {
        await bedAPI.delete(deletion.targetId);
      }
      setError("");
    } catch (err) {
      restoreDeletedItems(deletion);
      setError(extractApiErrorMessage(err, t, t("errors.delete")));
    }
  }, [removePendingDeletion, restoreDeletedItems, setError, t]);

  const undoPendingDeletion = useCallback((deletionId: string): void => {
    const deletion = pendingDeletions.find((pendingDeletion) => pendingDeletion.id === deletionId);
    if (!deletion) {
      return;
    }

    const timerId = pendingDeletionTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingDeletionTimersRef.current.delete(deletionId);
    }

    restoreDeletedItems(deletion);
    removePendingDeletion(deletionId);
  }, [pendingDeletions, removePendingDeletion, restoreDeletedItems]);

  const closePendingDeletionSnackbar = useCallback((deletionId: string): void => {
    setPendingDeletions((currentDeletions) =>
      currentDeletions.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  const getDeletionMessage = useCallback((
    rowType: PendingHierarchyDeletionType,
    deletedBedCount: number,
  ): string => {
    if (rowType === "bed") {
      return t("messages.bedDeleted");
    }
    if (rowType === "location") {
      if (deletedBedCount > 0) {
        return t("messages.locationAndBedsDeleted", { count: deletedBedCount });
      }
      return t("messages.locationDeleted");
    }
    if (deletedBedCount > 0) {
      return t("messages.fieldAndBedsDeleted", { count: deletedBedCount });
    }
    return t("messages.fieldDeleted");
  }, [t]);

  const deleteHierarchyRowWithUndo = useCallback((row: HierarchyRow): void => {
    const deletionId = `${row.type}-${String(row.id)}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let deletionType: PendingHierarchyDeletionType;
    let targetId: number | undefined;
    let deletedLocations: FarmLocation[] = [];
    let deletedFields: Field[] = [];
    let deletedBeds: Bed[] = [];

    if (row.type === "location") {
      deletionType = "location";
      targetId = row.locationId;
      deletedLocations = locations.filter((locationItem) => locationItem.id === row.locationId);
      const deletedLocationIds = new Set(deletedLocations.map((locationItem) => locationItem.id));
      deletedFields = fields.filter((field) => deletedLocationIds.has(field.location));
      const deletedFieldIds = new Set(deletedFields.map((field) => field.id));
      deletedBeds = beds.filter((bed) => deletedFieldIds.has(bed.field));
    } else if (row.type === "field") {
      deletionType = "field";
      targetId = row.fieldId;
      deletedFields = fields.filter((field) => field.id === row.fieldId);
      deletedBeds = beds.filter((bed) => bed.field === row.fieldId);
    } else {
      deletionType = "bed";
      targetId = row.bedId;
      deletedBeds = beds.filter((bed) => bed.id === row.bedId);
    }

    if (typeof targetId !== "number") {
      return;
    }

    const deletedLocationIds = new Set(deletedLocations.map((locationItem) => locationItem.id));
    const deletedFieldIds = new Set(deletedFields.map((field) => field.id));
    const deletedBedIds = new Set(deletedBeds.map((bed) => bed.id));
    const pendingDeletion: PendingHierarchyDeletion = {
      id: deletionId,
      type: deletionType,
      targetId,
      message: getDeletionMessage(deletionType, deletedBeds.length),
      locations: deletedLocations,
      fields: deletedFields,
      beds: deletedBeds,
      allLocationsBeforeDelete: locations,
      allFieldsBeforeDelete: fields,
      allBedsBeforeDelete: beds,
      expandedRowsBeforeDelete: new Set(expandedRows),
      visible: true,
    };

    setLocations((currentLocations) =>
      currentLocations.filter((locationItem) => !deletedLocationIds.has(locationItem.id)),
    );
    setFields((currentFields) =>
      currentFields.filter((field) => !deletedFieldIds.has(field.id)),
    );
    setBeds((currentBeds) =>
      currentBeds.filter((bed) => !deletedBedIds.has(bed.id)),
    );
    setSelectedRowId((currentSelectedRowId) => {
      if (currentSelectedRowId === null) {
        return null;
      }
      const deletedRowIds = new Set<string | number>([
        ...deletedLocations.map((locationItem) => `location-${locationItem.id}`),
        ...deletedFields.map((field) => `field-${field.id}`),
        ...deletedBeds.map((bed) => bed.id).filter((id): id is number => typeof id === "number"),
      ]);
      return deletedRowIds.has(currentSelectedRowId) ? null : currentSelectedRowId;
    });
    setError("");
    setPendingDeletions((currentDeletions) => [...currentDeletions, pendingDeletion]);

    const timerId = window.setTimeout(() => {
      void finalizePendingDeletion(pendingDeletion);
    }, DELETE_UNDO_DURATION_MS);
    pendingDeletionTimersRef.current.set(deletionId, timerId);
  }, [
    beds,
    expandedRows,
    fields,
    finalizePendingDeletion,
    getDeletionMessage,
    locations,
    setBeds,
    setFields,
    setLocations,
    setError,
  ]);

  useEffect(() => {
    return () => {
      pendingDeletionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingDeletionTimersRef.current.clear();
    };
  }, []);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedRow) {
      return;
    }

    if (selectedRow.type === "location" || selectedRow.type === "field" || selectedRow.type === "bed") {
      deleteHierarchyRowWithUndo(selectedRow);
    }
  }, [deleteHierarchyRowWithUndo, selectedRow]);

  const handleCreateBySelection = useCallback(() => {
    if (!selectedRow) {
      return;
    }

    if (selectedRow.type === "location" && selectedRow.locationId) {
      const fieldName = window.prompt(t("dialogs.addField.nameLabel"));
      if (fieldName !== null) {
        void addField(selectedRow.locationId, fieldName);
      }
      return;
    }

    if (selectedRow.type === "field" && selectedRow.fieldId) {
      handleAddBed(selectedRow.fieldId);
      return;
    }

    if (selectedRow.type === "bed" && selectedRow.field) {
      handleAddBed(selectedRow.field);
    }
  }, [addField, handleAddBed, selectedRow, t]);

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
        onClick: () => {
          const fieldName = window.prompt(t("dialogs.addField.nameLabel"));
          if (fieldName !== null) {
            void addField(row.locationId, fieldName);
          }
        },
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
      onClick: () => deleteHierarchyRowWithUndo(row),
    }];

    return [...createActions, ...editActions, ...destructiveActions];
  }, [
    addField,
    deleteHierarchyRowWithUndo,
    handleAddBed,
    handleCreatePlantingPlan,
    startRowEdit,
    t,
  ]);

  const openContextMenuForRow = useCallback((row: HierarchyRow, mouseX: number, mouseY: number): void => {
    setSelectedRowId(row.id);
    setTreeActive(true);
    setContextMenuState({ row, mouseX, mouseY });
  }, []);

  const handleNameCellContextMenu = useCallback((event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, row: HierarchyRow): void => {
    const hasPointerCoordinates =
      "clientX" in event &&
      "clientY" in event &&
      typeof event.clientX === "number" &&
      typeof event.clientY === "number" &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0);
    if (hasPointerCoordinates) {
      openContextMenuForRow(row, event.clientX + 2, event.clientY - 6);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenuForRow(row, rect.right - 8, rect.top + 12);
  }, [openContextMenuForRow]);

  const handleGridContextMenu = useCallback((event: React.MouseEvent<HTMLElement>): void => {
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

    event.preventDefault();
    setSelectedRowId(targetRow.id);
    setTreeActive(true);
    openContextMenuForRow(targetRow, event.clientX + 2, event.clientY - 6);
  }, [openContextMenuForRow, rows]);

  const handleGridTouchStart = useCallback((event: React.TouchEvent<HTMLElement>): void => {
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
      openContextMenuForRow(targetRow, touch.clientX, touch.clientY);
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
  }, []);

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
      if (!treeActive || !selectedRowId) {
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
  }, [discardActiveRowEdit, expandedRows, rows, selectedRowId, toggleExpand, treeActive]);

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
      const targetElement = document.querySelector(`[data-id="${String(selectedRowId)}"]`) as HTMLElement | null;
      if (!targetElement) {
        return;
      }
      const rect = targetElement.getBoundingClientRect();
      openContextMenuForRow(selectedRow, rect.left + Math.min(240, rect.width), rect.top + 12);
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
          deleteHierarchyRowWithUndo(row);
        }
      },
      (locationId) => {
        const fieldName = window.prompt(t("dialogs.addField.nameLabel"));
        if (fieldName !== null) {
          void addField(locationId, fieldName);
        }
      },
      (fieldId) => {
        const row = rowsById.get(`field-${fieldId}`);
        if (row) {
          deleteHierarchyRowWithUndo(row);
        }
      },
      (locationId) => {
        const row = rowsById.get(`location-${locationId}`);
        if (row) {
          deleteHierarchyRowWithUndo(row);
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
    );
  }, [
    toggleExpand,
    handleAddBed,
    addField,
    deleteHierarchyRowWithUndo,
    handleCreatePlantingPlan,
    handleNameCellContextMenu,
    notesEditor.handleOpen,
    rowsById,
    t,
    nameColumnWidth,
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

  useNavigationBlocker(
    hasUnsavedInvalidNewRows,
    t("messages.unsavedInvalidRowsNavigationWarning"),
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

        {shouldShowMissingDimensionsHint && (
          <Box sx={{ mb: 2 }}>
            <EmptyStateCard
              title={t('messages.missingDimensionsHint')}
              description={t('messages.missingDimensionsHintOptional')}
            />
          </Box>
        )}

        <Box
          ref={tableWrapperRef}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 1, overflowX: "auto", overflowY: "visible", display: "block" }}
          onClick={() => setTreeActive(true)}
          onContextMenu={handleGridContextMenu}
          onTouchStart={handleGridTouchStart}
          onTouchEnd={handleGridTouchEnd}
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
            onCellKeyDown={(params: GridCellParams<HierarchyRow>, event: React.KeyboardEvent) => {
              const keyboardEvent = event as React.KeyboardEvent;
              if (
                keyboardEvent.key === "Escape" &&
                rowModesModel[params.id]?.mode === GridRowModes.Edit
              ) {
                keyboardEvent.preventDefault();
                keyboardEvent.defaultMuiPrevented = true;
                discardRowEdit(params.id);
                return;
              }
              if (keyboardEvent.key === "ContextMenu" || (keyboardEvent.shiftKey && keyboardEvent.key === "F10")) {
                keyboardEvent.preventDefault();
                const targetRow = rows.find((row) => row.id === params.id);
                if (targetRow) {
                  const targetElement = keyboardEvent.currentTarget as HTMLElement;
                  const rect = targetElement.getBoundingClientRect();
                  openContextMenuForRow(targetRow, rect.left + Math.min(240, rect.width), rect.top + 12);
                }
              }
            }}
            localeText={germanDataGridLocaleText}
            apiRef={gridApiRef}
          />
          </Box>
        </Box>
      </Box>

      {/* Notes Editor Drawer */}
      <NotesDrawer
        open={notesEditor.isOpen}
        title={t("columns.notes")}
        value={notesEditor.draft}
        onChange={notesEditor.setDraft}
        onSave={notesEditor.handleSave}
        onClose={notesEditor.handleClose}
        loading={notesEditor.isSaving}
      />
      <Menu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
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
          onUndo={() => undoPendingDeletion(deletion.id)}
        />
      ))}
    </div>
  );
}

export default FieldsBedsHierarchy;
