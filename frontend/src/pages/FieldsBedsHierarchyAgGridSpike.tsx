/**
 * Experimental AG Grid Community spike for the fields/beds hierarchy.
 *
 * This intentionally avoids AG Grid Enterprise-only features such as Tree Data
 * and the built-in context menu. The Standort > Parzelle > Beet hierarchy is
 * still projected by OpenFarmPlanner code and rendered as a flat indented row
 * list.
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
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  ValidationModule,
  themeMaterial,
  type CellClickedEvent,
  type CellContextMenuEvent,
  type CellEditRequestEvent,
  type CellEditingStartedEvent,
  type CellEditingStoppedEvent,
  type CellKeyDownEvent,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowClassParams,
  type RowHeightParams,
} from "ag-grid-community";
import {
  Alert,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import Divider from "@mui/material/Divider";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import EmptyStateCard from "../components/project/EmptyStateCard";
import {
  ContextMenuHint,
  DeleteUndoSnackbar,
  NotesCell,
  NotesDrawer,
  TableCopyMenuItems,
  getPlainExcerpt,
  useContextMenuHint,
  useNotesEditor,
} from "../components/data-grid";
import { CALCULATED_COLUMN_CELL_CLASS } from "../components/data-grid/calculatedColumns";
import { handleContextMenuKeyboardNavigation } from "../components/data-grid/contextMenuFocus";
import { ContextMenuIndicator } from "../components/contextMenu/ContextMenuIndicator";
import { contextMenuActionsOverlaySx } from "../components/contextMenu/contextMenuIndicatorStyles";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useHierarchyData, type HierarchyDataState } from "../components/hierarchy/hooks/useHierarchyData";
import { useHierarchyDelete } from "../components/hierarchy/hooks/useHierarchyDelete";
import { useHierarchyLevelToggle } from "../components/hierarchy/hooks/useHierarchyLevelToggle";
import { useHierarchyRowUpdate } from "../components/hierarchy/hooks/useHierarchyRowUpdate";
import { HierarchyAddIcon } from "../components/hierarchy/HierarchyAddIcon";
import { HierarchyLevelButtons } from "../components/hierarchy/HierarchyLevelToggle";
import {
  DEFAULT_HIERARCHY_COLUMN_WIDTHS,
  type HierarchyColumnWidths,
} from "../components/hierarchy/HierarchyColumns";
import {
  buildHierarchyIndex,
  createHierarchyRowsProjector,
  hasPersistedEntityId,
  type HierarchySortConfig,
} from "../components/hierarchy/utils/hierarchyUtils";
import {
  isPartiallyFilledNamelessNewHierarchyRow,
} from "../components/hierarchy/utils/hierarchyRowDraft";
import {
  normalizeAreaValue,
  parseAreaValue,
  parseDimensionValue,
} from "../components/hierarchy/utils/hierarchyAreaParsing";
import {
  calculateHierarchyNameColumnWidth,
  getHierarchyNameMeasureKey,
  measureHierarchyNameTextWidths,
  type HierarchyNameMeasureEntry,
} from "../components/hierarchy/utils/hierarchyNameColumnWidth";
import type { HierarchyRow } from "../components/hierarchy/utils/types";
import type { TreeRowNode } from "../components/hierarchy/utils/treeRows";
import { useNavigationBlocker } from "../hooks/autosave";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { useTranslation } from "../i18n";
import { bedAPI, fieldAPI, locationAPI, type Field } from "../api/api";

ModuleRegistry.registerModules([
  AllCommunityModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []),
]);

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

const HIERARCHY_AUTO_EXPAND_ALL_THRESHOLD = 200;
const TABLE_BOTTOM_MARGIN_PX = 24;
const TABLE_MIN_HEIGHT_PX = 240;
const HEADER_ROW_HEIGHT = 40;
const LOCATION_ROW_HEIGHT = 46;
const FIELD_ROW_HEIGHT = 42;
const BED_ROW_HEIGHT = 36;
const EXPAND_ICON_SLOT_SIZE = 32;

const agGridGermanLocaleText = {
  contains: "Enthält",
  notContains: "Enthält nicht",
  equals: "Gleich",
  notEqual: "Ungleich",
  startsWith: "Beginnt mit",
  endsWith: "Endet mit",
  blank: "Leer",
  notBlank: "Nicht leer",
  filterOoo: "Filtern...",
  noRowsToShow: "Keine Einträge",
  loadingOoo: "Wird geladen...",
  sortAscending: "Aufsteigend sortieren",
  sortDescending: "Absteigend sortieren",
  sortUnSort: "Sortierung entfernen",
};

const NON_BLOCKING_TOOLTIP_PROPS = {
  disableInteractive: true,
  slotProps: {
    popper: {
      style: { pointerEvents: "none" as const },
    },
  },
};

const getRowHeightForHierarchyRow = (row: HierarchyRow): number => {
  if (row.type === "location") return LOCATION_ROW_HEIGHT;
  if (row.type === "field") return FIELD_ROW_HEIGHT;
  return BED_ROW_HEIGHT;
};

const getEditableFieldsForRow = (row: HierarchyRow): string[] => (
  row.type === "location"
    ? ["name"]
    : ["name", "length_m", "width_m"]
);

const isEditableField = (row: HierarchyRow, field: string | null | undefined): boolean => (
  Boolean(field && getEditableFieldsForRow(row).includes(field))
);

const calculateAreaValue = (row: HierarchyRow): number | string | undefined => {
  if (row.type === "location") return undefined;
  const length = typeof row.length_m === "number" ? row.length_m : null;
  const width = typeof row.width_m === "number" ? row.width_m : null;
  if (length !== null && width !== null) {
    return Math.round(length * width * 10) / 10;
  }
  return row.area_sqm;
};

const parseNumericValue = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isDimensionCellIncomplete = (row: HierarchyRow, field: "length_m" | "width_m" | "area_sqm"): boolean => {
  if (row.type !== "field" && row.type !== "bed") return false;
  const hasLength = Number.isFinite(parseNumericValue(row.length_m) ?? NaN);
  const hasWidth = Number.isFinite(parseNumericValue(row.width_m) ?? NaN);
  const hasArea = Number.isFinite(parseNumericValue(row.area_sqm) ?? NaN);
  if (field === "length_m") return !hasLength;
  if (field === "width_m") return !hasWidth;
  return !(hasArea || (hasLength && hasWidth));
};

function startEditingRow(api: GridApi<HierarchyRow> | null, rowId: string | number, colKey = "name"): void {
  if (!api) return;
  let rowIndex: number | null = null;
  api.forEachNode((node) => {
    if (String(node.data?.id) === String(rowId)) {
      rowIndex = node.rowIndex;
    }
  });
  if (rowIndex === null || rowIndex < 0) return;
  api.ensureIndexVisible(rowIndex, "middle");
  window.setTimeout(() => {
    api.setFocusedCell(rowIndex!, colKey);
    api.startEditingCell({ rowIndex: rowIndex!, colKey });
  }, 0);
}

function focusGridRow(api: GridApi<HierarchyRow> | null, rowId: string | number, colKey = "name"): void {
  if (!api) return;
  api.forEachNode((node) => {
    if (String(node.data?.id) === String(rowId) && node.rowIndex !== null) {
      api.ensureIndexVisible(node.rowIndex, "middle");
      api.setFocusedCell(node.rowIndex, colKey);
    }
  });
}

function NameCellRenderer({
  data,
  value,
  context,
}: ICellRendererParams<HierarchyRow>) {
  const row = data;
  if (!row) return null;
  const {
    disableInlineHoverActions,
    onAddBed,
    onAddField,
    onCreatePlantingPlan,
    onDeleteRow,
    onOpenContextMenu,
    onToggleExpand,
    t,
  } = context as {
    disableInlineHoverActions: boolean;
    onAddBed: (fieldId: number) => void;
    onAddField: (locationId?: number) => void;
    onCreatePlantingPlan: (bedId: number) => void;
    onDeleteRow: (row: HierarchyRow) => void;
    onOpenContextMenu: (event: React.MouseEvent<HTMLElement>, row: HierarchyRow) => void;
    onToggleExpand: (rowId: string | number) => void;
    t: ReturnType<typeof useTranslation>["t"];
  };
  const hasExpandToggle = (row.type === "location" || row.type === "field") && row.hasChildren;
  const actionButtons = disableInlineHoverActions ? null : (
    <Box className="ofp-ag-hierarchy-actions" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {row.type === "location" ? (
        <Tooltip title={t("hierarchy:addField")} {...NON_BLOCKING_TOOLTIP_PROPS}>
          <span>
            <HierarchyAddIcon
              ariaLabel={t("hierarchy:addField")}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                onAddField(row.locationId);
              }}
              sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 18 } }}
            />
          </span>
        </Tooltip>
      ) : null}
      {row.type === "field" && row.fieldId ? (
        <Tooltip title={t("hierarchy:addBedToField")} {...NON_BLOCKING_TOOLTIP_PROPS}>
          <span>
            <HierarchyAddIcon
              ariaLabel={t("hierarchy:addBedToField")}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                onAddBed(row.fieldId!);
              }}
              sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 18 } }}
            />
          </span>
        </Tooltip>
      ) : null}
      {row.type === "bed" && row.bedId ? (
        <Tooltip title={t("hierarchy:createPlantingPlan")} {...NON_BLOCKING_TOOLTIP_PROPS}>
          <IconButton
            size="small"
            color="primary"
            aria-label={t("hierarchy:createPlantingPlan")}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onCreatePlantingPlan(row.bedId!);
            }}
            sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 18 } }}
          >
            <AgricultureIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={t("common:actions.delete")} {...NON_BLOCKING_TOOLTIP_PROPS}>
        <IconButton
          size="small"
          color="error"
          aria-label={t("common:actions.delete")}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteRow(row);
          }}
          sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 18 } }}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
      <ContextMenuIndicator
        label={t("common:actions.actions")}
        tabIndex={-1}
        onClick={(event) => onOpenContextMenu(event, row)}
      />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", pl: `${row.level * 24}px`, width: "100%", gap: 0.5 }}>
      <Box
        sx={{
          width: EXPAND_ICON_SLOT_SIZE,
          minWidth: EXPAND_ICON_SLOT_SIZE,
          height: EXPAND_ICON_SLOT_SIZE,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          mr: 1,
        }}
      >
        {hasExpandToggle ? (
          <Tooltip title={row.expanded ? t("tooltips.collapse") : t("tooltips.expand")} {...NON_BLOCKING_TOOLTIP_PROPS}>
            <IconButton
              size="small"
              aria-label={row.expanded ? t("tooltips.collapse") : t("tooltips.expand")}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(row.id);
              }}
            >
              {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      <Box
        sx={{ position: "relative", display: "inline-flex", alignItems: "center", width: "100%", minWidth: 0 }}
        onContextMenu={(event) => onOpenContextMenu(event, row)}
      >
        <Box
          component="span"
          data-testid="hierarchy-name-text"
          sx={{
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: row.type === "location" ? 600 : 400,
            fontSize: row.type === "location" ? "1.02rem" : row.type === "bed" ? "0.95rem" : "1rem",
          }}
        >
          {String(value ?? "")}
        </Box>
        {actionButtons ? (
          <Box
            data-testid="hierarchy-name-actions-overlay"
            sx={{
              ...contextMenuActionsOverlaySx(".ag-row-hover &"),
              ".ag-row.ag-row-focus &": { opacity: 1, pointerEvents: "auto" },
            }}
          >
            {actionButtons}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function DimensionCellRenderer({ data, value, colDef, context }: ICellRendererParams<HierarchyRow>) {
  const row = data;
  if (!row) return null;
  const field = colDef?.field as "length_m" | "width_m" | "area_sqm" | undefined;
  if (!field) return null;
  const t = (context as { t: ReturnType<typeof useTranslation>["t"] }).t;
  const displayValue = value === null || value === undefined || value === "" ? "" : String(value);

  if (!isDimensionCellIncomplete(row, field)) {
    return <Box component="span">{displayValue}</Box>;
  }

  return (
    <Tooltip title={t("hierarchy:messages.missingDimensionsCellTooltip")} enterDelay={250} {...NON_BLOCKING_TOOLTIP_PROPS}>
      <Box component="span" sx={{ color: displayValue ? "text.primary" : "text.secondary" }}>
        {displayValue || "-"}
      </Box>
    </Tooltip>
  );
}

function NotesCellRenderer({ data, value, context }: ICellRendererParams<HierarchyRow>) {
  const row = data;
  if (!row) return null;
  const onOpenNotes = (context as { onOpenNotes: (rowId: string | number, field: string) => void }).onOpenNotes;
  const rawValue = typeof value === "string" ? value : "";
  const hasValue = rawValue.trim().length > 0;
  const excerpt = hasValue ? getPlainExcerpt(rawValue, 120) : "";

  return (
    <Box
      sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}
      onClick={() => onOpenNotes(row.id, "notes")}
    >
      <NotesCell
        hasValue={hasValue}
        excerpt={excerpt}
        rawValue={rawValue}
        onOpen={() => onOpenNotes(row.id, "notes")}
      />
    </Box>
  );
}

function FieldsBedsHierarchyAgGridSpike({
  showTitle = true,
  createFieldRequest = 0,
  onCreateFieldRequestHandled,
  hierarchyData,
  onPendingDeletionCountChange,
  suppressContextMenuHint = false,
}: FieldsBedsHierarchyProps) {
  const { t } = useTranslation(["hierarchy", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const isTouchLikePointer = useMediaQuery("(pointer: coarse)");
  const isMobileViewport = useMediaQuery("(max-width:900px)");
  const internalHierarchyData = useHierarchyData(hierarchyData === undefined);
  const gridApiRef = useRef<GridApi<HierarchyRow> | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());
  const hasInitiallyExpandedRef = useRef(false);
  const handledCreateFieldRequestRef = useRef(0);
  const highlightClearTimeoutRef = useRef<number | null>(null);
  const [draftValidationWarning, setDraftValidationWarning] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
  const [pendingFieldEditRow, setPendingFieldEditRow] = useState<string | number | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | number | null>(null);
  const [availableTableHeight, setAvailableTableHeight] = useState<number | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    row: HierarchyRow;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const contextMenuListRef = useRef<HTMLUListElement | null>(null);

  const {
    loading,
    error,
    setError,
    locations,
    setLocations,
    fields,
    setFields,
    beds,
    setBeds,
    fetchData,
  } = hierarchyData ?? internalHierarchyData;

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
    if (!firstSort?.sort) return undefined;
    return { field: firstSort.field, direction: firstSort.sort };
  }, [sortModel]);

  const { addBed, saveBed, pendingEditRow, setPendingEditRow } =
    useBedOperations(setBeds, setError, t);

  const hierarchyIndex = useMemo(
    () => buildHierarchyIndex(locations, fields, beds, hierarchySortConfig),
    [locations, fields, beds, hierarchySortConfig],
  );

  const projectRows = useMemo(
    () => createHierarchyRowsProjector(hierarchyIndex),
    [hierarchyIndex],
  );

  const rows = useMemo(
    () => projectRows(expandedRows),
    [expandedRows, projectRows],
  );

  const rowsById = useMemo(() => {
    const nextRowsById = new Map<string, HierarchyRow>();
    rows.forEach((row) => nextRowsById.set(String(row.id), row));
    return nextRowsById;
  }, [rows]);

  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const getDraftRow = useCallback((rowId: string | number): HierarchyRow | null => (
    rowsById.get(String(rowId)) ?? null
  ), [rowsById]);

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
    setRowModesModel: () => undefined,
    setDraftValidationWarning,
  });

  const {
    processRowUpdate,
    handleProcessRowUpdateError,
  } = useHierarchyRowUpdate({
    getDraftRow,
    rowModesModel: {},
    rowsById,
    beds,
    fields,
    locations,
    setBeds,
    setFields,
    setLocations,
    rowSnapshotRef,
    setRowModesModel: () => undefined,
    setError,
    setDraftValidationWarning,
    fetchData,
    saveBed,
    t,
  });

  const shouldShowHierarchyTable = hierarchyIndex.hasMultipleLocations || fields.length > 0 || createFieldRequest > 0;
  const hasUsableHierarchyRows = shouldShowHierarchyTable && (
    rows.length > 0 || locations.length > 0 || fields.length > 0 || beds.length > 0
  );
  const { showContextMenuHint, closeContextMenuHint, markContextMenuHintUsed } = useContextMenuHint({
    enabled: !suppressContextMenuHint,
    isLoading: loading,
    hasRows: hasUsableHierarchyRows,
  });

  const notesEditor = useNotesEditor<HierarchyRow>({
    rows,
    onSave: async ({ row, value }) => {
      if (!row.name) throw new Error(t("validation.nameRequired"));
      const parsedArea = parseAreaValue(row.area_sqm);
      if (row.type === "bed" && row.bedId) {
        await bedAPI.update(row.bedId, {
          name: row.name,
          field: row.field!,
          area_sqm: normalizeAreaValue(parsedArea),
          length_m: parseDimensionValue(row.length_m),
          width_m: parseDimensionValue(row.width_m),
          notes: value,
        });
        setBeds((previous) => previous.map((bed) => bed.id === row.bedId ? { ...bed, notes: value } : bed));
      } else if (row.type === "field" && row.fieldId) {
        await fieldAPI.update(row.fieldId, {
          name: row.name,
          location: row.locationId!,
          area_sqm: normalizeAreaValue(parsedArea),
          length_m: parseDimensionValue(row.length_m),
          width_m: parseDimensionValue(row.width_m),
          notes: value,
        });
        setFields((previous) => previous.map((field) => field.id === row.fieldId ? { ...field, notes: value } : field));
      } else if (row.type === "location" && row.locationId) {
        const locationItem = locations.find((item) => item.id === row.locationId);
        if (!locationItem) return;
        await locationAPI.update(row.locationId, { ...locationItem, notes: value });
        setLocations((previous) => previous.map((item) => item.id === row.locationId ? { ...item, notes: value } : item));
      }
    },
    onError: setError,
  });

  useEffect(() => {
    if (
      !hasPersistedState &&
      !hasInitiallyExpandedRef.current &&
      locations.length > 0 &&
      fields.length > 0
    ) {
      const canFullyExpand =
        locations.length + fields.length + beds.length <= HIERARCHY_AUTO_EXPAND_ALL_THRESHOLD;
      const allRowIds = new Set<string | number>();
      locations.forEach((locationItem) => allRowIds.add(`location-${locationItem.id}`));
      if (canFullyExpand) {
        fields.forEach((field) => allRowIds.add(`field-${field.id}`));
      }
      expandAll(Array.from(allRowIds));
      hasInitiallyExpandedRef.current = true;
    }
  }, [beds.length, expandAll, fields, hasPersistedState, locations]);

  const hasMultipleLocations = locations.length > 1;
  const hierarchyTreeNodes = useMemo<TreeRowNode[]>(() => {
    const nodes: TreeRowNode[] = [];
    if (hasMultipleLocations) {
      locations.forEach((locationItem) => {
        if (hasPersistedEntityId(locationItem.id)) {
          nodes.push({ id: `location-${locationItem.id}`, parentId: null });
        }
      });
    }
    fields.forEach((field) => {
      if (!hasPersistedEntityId(field.id)) return;
      nodes.push({
        id: `field-${field.id}`,
        parentId: hasMultipleLocations ? `location-${field.location}` : null,
      });
    });
    beds.forEach((bed) => {
      if (hasPersistedEntityId(bed.id) && hasPersistedEntityId(bed.field)) {
        nodes.push({ id: bed.id, parentId: `field-${bed.field}` });
      }
    });
    return nodes;
  }, [beds, fields, hasMultipleLocations, locations]);
  const hierarchyLevelToggle = useHierarchyLevelToggle(hierarchyTreeNodes, expandedRows, expandAll);

  const handleAddField = useCallback((locationId: number): void => {
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
  }, [ensureExpanded, locations, setFields]);

  const handleAddBed = useCallback((fieldId: number): void => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    ensureExpanded(`field-${fieldId}`);
    const newBedId = addBed(fieldId);
    setPendingEditRow(newBedId);
  }, [addBed, ensureExpanded, fields, setPendingEditRow]);

  useEffect(() => {
    if (pendingEditRow !== null && rows.some((row) => row.id === pendingEditRow)) {
      startEditingRow(gridApiRef.current, pendingEditRow);
      setPendingEditRow(null);
    }
  }, [pendingEditRow, rows, setPendingEditRow]);

  useEffect(() => {
    if (pendingFieldEditRow !== null && rows.some((row) => row.id === pendingFieldEditRow)) {
      startEditingRow(gridApiRef.current, pendingFieldEditRow);
      setPendingFieldEditRow(null);
    }
  }, [pendingFieldEditRow, rows]);

  useEffect(() => {
    if (!location.pathname.startsWith("/app/fields-beds")) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("createBed") !== "true" || loading) return;
    const firstField = fields.find((field) => field.id !== undefined);
    if (firstField?.id !== undefined) {
      handleAddBed(firstField.id);
    }
    searchParams.delete("createBed");
    const nextSearch = searchParams.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
  }, [fields, handleAddBed, loading, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (
      createFieldRequest <= 0 ||
      loading ||
      createFieldRequest <= handledCreateFieldRequestRef.current
    ) {
      return;
    }
    const hasActiveFieldDraft = fields.some((field) => typeof field.id === "number" && field.id < 0);
    const firstLocationId = locations.find((locationItem) => locationItem.id !== undefined)?.id;
    if (!hasActiveFieldDraft && firstLocationId === undefined) return;
    handledCreateFieldRequestRef.current = createFieldRequest;
    if (!hasActiveFieldDraft && firstLocationId !== undefined) {
      handleAddField(firstLocationId);
    }
    onCreateFieldRequestHandled?.();
  }, [createFieldRequest, fields, handleAddField, loading, locations, onCreateFieldRequestHandled]);

  useEffect(() => () => {
    if (highlightClearTimeoutRef.current !== null) {
      window.clearTimeout(highlightClearTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith("/app/fields-beds")) return;
    const searchParams = new URLSearchParams(location.search);
    const highlightParam = searchParams.get("highlight");
    if (!highlightParam || loading) return;
    const [highlightType, highlightIdRaw] = highlightParam.split(":");
    const highlightId = Number(highlightIdRaw);
    let targetRowId: string | number | null = null;
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
      if (locationIdToExpand !== undefined) ensureExpanded(`location-${locationIdToExpand}`);
      if (fieldIdToExpand !== undefined) ensureExpanded(`field-${fieldIdToExpand}`);
      setHighlightedRowId(targetRowId);
      requestAnimationFrame(() => focusGridRow(gridApiRef.current, targetRowId!));
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
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
  }, [beds, ensureExpanded, fields, loading, location.pathname, location.search, navigate]);

  useLayoutEffect(() => {
    if (isMobileViewport) return;
    const measure = (): void => {
      const wrapper = tableWrapperRef.current;
      if (!wrapper) return;
      const top = wrapper.getBoundingClientRect().top;
      setAvailableTableHeight(Math.max(TABLE_MIN_HEIGHT_PX, window.innerHeight - top - TABLE_BOTTOM_MARGIN_PX));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [draftValidationWarning, error, isMobileViewport, showContextMenuHint, shouldShowHierarchyTable]);

  const nameColumnWidth = useMemo(() => {
    const hierarchyEntries: HierarchyNameMeasureEntry[] = [];
    if (hierarchyIndex.hasMultipleLocations) {
      hierarchyIndex.sortedLocations.forEach((locationItem) => {
        hierarchyEntries.push({ name: locationItem.name, level: 0, type: "location" });
        const locationFields = hierarchyIndex.fieldsByLocation.get(locationItem.id!) ?? [];
        locationFields.forEach((field) => {
          hierarchyEntries.push({ name: field.name, level: 1, type: "field" });
          const fieldBeds = hierarchyIndex.bedsByField.get(field.id!) ?? [];
          fieldBeds.forEach((bed) => hierarchyEntries.push({ name: bed.name, level: 2, type: "bed" }));
        });
      });
    } else {
      hierarchyIndex.sortedTopLevelFields.forEach((field) => {
        hierarchyEntries.push({ name: field.name, level: 0, type: "field" });
        const fieldBeds = hierarchyIndex.bedsByField.get(field.id!) ?? [];
        fieldBeds.forEach((bed) => hierarchyEntries.push({ name: bed.name, level: 1, type: "bed" }));
      });
    }
    const measuredTextWidths = measureHierarchyNameTextWidths(hierarchyEntries);
    return calculateHierarchyNameColumnWidth(
      hierarchyEntries,
      (row) => measuredTextWidths.get(getHierarchyNameMeasureKey(row)) ?? 0,
    );
  }, [hierarchyIndex]);

  const updateSort = useCallback((field: "name" | "area_sqm") => {
    const current = sortModel[0];
    const nextSort = current?.field !== field
      ? "asc"
      : current.sort === "asc"
        ? "desc"
        : current.sort === "desc"
          ? null
          : "asc";
    setSortModel(nextSort ? [{ field, sort: nextSort }] : []);
  }, [setSortModel, sortModel]);

  const renderSortableHeader = useCallback((label: string, field: "name" | "area_sqm", accessory?: React.ReactNode) => {
    const current = sortModel[0]?.field === field ? sortModel[0]?.sort : null;
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minWidth: 0, gap: 1 }}>
        <Box
          component="button"
          type="button"
          onClick={() => updateSort(field)}
          style={{
            border: 0,
            background: "transparent",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            font: "inherit",
            fontWeight: 600,
            minWidth: 0,
          }}
        >
          <span>{label}</span>
          <span aria-hidden="true">{current === "asc" ? "▲" : current === "desc" ? "▼" : ""}</span>
        </Box>
        {accessory}
      </Box>
    );
  }, [sortModel, updateSort]);

  const columnWidths: HierarchyColumnWidths = {
    ...DEFAULT_HIERARCHY_COLUMN_WIDTHS,
    name: nameColumnWidth,
  };

  const handleOpenContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: HierarchyRow): void => {
    event.preventDefault();
    event.stopPropagation();
    markContextMenuHintUsed();
    setSelectedRowId(row.id);
    setContextMenuState({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
  }, [markContextMenuHintUsed]);

  const handleCellContextMenu = useCallback((event: CellContextMenuEvent<HierarchyRow>): void => {
    const mouseEvent = event.event;
    if (!event.data || !(mouseEvent instanceof MouseEvent)) return;
    mouseEvent.preventDefault();
    markContextMenuHintUsed();
    setSelectedRowId(event.data.id);
    setContextMenuState({ row: event.data, mouseX: mouseEvent.clientX + 2, mouseY: mouseEvent.clientY - 6 });
  }, [markContextMenuHintUsed]);

  const handleGridContextMenu = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const rowElement = target.closest<HTMLElement>(".ag-row[row-id]");
    const rowId = rowElement?.getAttribute("row-id");
    const row = rowId ? rowsById.get(rowId) : undefined;
    if (!row) return;
    event.preventDefault();
    markContextMenuHintUsed();
    setSelectedRowId(row.id);
    setContextMenuState({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
  }, [markContextMenuHintUsed, rowsById]);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
  }, []);

  const handleDeleteRow = useCallback((row: HierarchyRow): void => {
    rowSnapshotRef.current.set(String(row.id), row);
    void deleteHierarchyRowWithUndo(row);
  }, [deleteHierarchyRowWithUndo]);

  const handleCreatePlantingPlan = useCallback((bedId: number): void => {
    navigate(`/app/planting-plans?bedId=${bedId}`);
  }, [navigate]);

  const columnDefs = useMemo<ColDef<HierarchyRow>[]>(() => [
    {
      field: "name",
      headerName: t("hierarchy:columns.name"),
      width: columnWidths.name,
      minWidth: isMobileViewport ? 220 : 260,
      flex: 1.2,
      editable: (params) => isEditableField(params.data!, "name"),
      filter: "agTextColumnFilter",
      floatingFilter: true,
      sortable: false,
      cellRenderer: NameCellRenderer,
      headerComponent: () => renderSortableHeader(
        t("hierarchy:columns.name"),
        "name",
        isMobileViewport ? null : (
          <HierarchyLevelButtons
            canExpand={hierarchyLevelToggle.canExpand}
            canCollapse={hierarchyLevelToggle.canCollapse}
            onExpandOneLevel={hierarchyLevelToggle.expandOneLevel}
            onCollapseOneLevel={hierarchyLevelToggle.collapseOneLevel}
          />
        ),
      ),
    },
    {
      field: "length_m",
      headerName: t("columns.length"),
      width: columnWidths.dimensions,
      minWidth: isMobileViewport ? 96 : 118,
      editable: (params) => isEditableField(params.data!, "length_m"),
      filter: "agNumberColumnFilter",
      floatingFilter: !isMobileViewport,
      sortable: false,
      cellRenderer: DimensionCellRenderer,
      headerComponent: () => (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
          <SwapVertIcon fontSize="small" aria-hidden="true" />
          <span>{t("columns.length")}</span>
        </Box>
      ),
    },
    {
      field: "width_m",
      headerName: t("columns.width"),
      width: columnWidths.dimensions,
      minWidth: isMobileViewport ? 96 : 118,
      editable: (params) => isEditableField(params.data!, "width_m"),
      filter: "agNumberColumnFilter",
      floatingFilter: !isMobileViewport,
      sortable: false,
      cellRenderer: DimensionCellRenderer,
      headerComponent: () => (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
          <SwapHorizIcon fontSize="small" aria-hidden="true" />
          <span>{t("columns.width")}</span>
        </Box>
      ),
    },
    {
      field: "area_sqm",
      headerName: t("hierarchy:columns.area"),
      width: columnWidths.area,
      minWidth: 108,
      editable: false,
      filter: "agNumberColumnFilter",
      floatingFilter: !isMobileViewport,
      sortable: false,
      valueGetter: (params) => params.data ? calculateAreaValue(params.data) : undefined,
      cellClass: CALCULATED_COLUMN_CELL_CLASS,
      cellRenderer: DimensionCellRenderer,
      headerComponent: () => renderSortableHeader(t("hierarchy:columns.area"), "area_sqm"),
    },
    {
      field: "notes",
      headerName: t("common:fields.notes"),
      minWidth: isMobileViewport ? 150 : columnWidths.notes,
      flex: 1,
      editable: false,
      filter: "agTextColumnFilter",
      floatingFilter: !isMobileViewport,
      sortable: false,
      cellRenderer: NotesCellRenderer,
    },
  ], [
    columnWidths.area,
    columnWidths.dimensions,
    columnWidths.name,
    columnWidths.notes,
    hierarchyLevelToggle.canCollapse,
    hierarchyLevelToggle.canExpand,
    hierarchyLevelToggle.collapseOneLevel,
    hierarchyLevelToggle.expandOneLevel,
    isMobileViewport,
    renderSortableHeader,
    t,
  ]);

  const gridContext = useMemo(() => ({
    disableInlineHoverActions: isTouchLikePointer || isMobileViewport,
    onAddBed: handleAddBed,
    onAddField: handleAddField,
    onCreatePlantingPlan: handleCreatePlantingPlan,
    onDeleteRow: handleDeleteRow,
    onOpenContextMenu: handleOpenContextMenu,
    onOpenNotes: notesEditor.handleOpen,
    onToggleExpand: toggleExpand,
    t,
  }), [
    handleAddBed,
    handleAddField,
    handleCreatePlantingPlan,
    handleDeleteRow,
    handleOpenContextMenu,
    isMobileViewport,
    isTouchLikePointer,
    notesEditor.handleOpen,
    t,
    toggleExpand,
  ]);

  const tableContentHeight = useMemo(() => (
    HEADER_ROW_HEIGHT + rows.reduce((sum, row) => sum + getRowHeightForHierarchyRow(row), 0)
  ), [rows]);

  const shouldShowMissingDimensionsHint = useMemo(() => {
    const hasBeds = beds.length > 0;
    const allBedsMissingLengthAndWidth = beds.every((bed) => {
      const length = parseDimensionValue(bed.length_m);
      const width = parseDimensionValue(bed.width_m);
      return !Number.isFinite(length ?? NaN) && !Number.isFinite(width ?? NaN);
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

  useNavigationBlocker(
    hasUnsavedInvalidNewRows || editingRowId !== null,
    hasUnsavedInvalidNewRows
      ? t("messages.unsavedInvalidRowsNavigationWarning")
      : t("messages.unsavedRowEditNavigationWarning"),
  );

  useEffect(() => {
    if (!hasUnsavedInvalidNewRows) {
      setDraftValidationWarning("");
    }
  }, [hasUnsavedInvalidNewRows]);

  const handleCellEditRequest = useCallback(async (event: CellEditRequestEvent<HierarchyRow>): Promise<void> => {
    if (!event.data || !event.colDef.field) return;
    const nextRow = {
      ...event.data,
      [event.colDef.field]: event.newValue,
    };
    try {
      await processRowUpdate(nextRow);
      setError("");
    } catch (err) {
      handleProcessRowUpdateError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [handleProcessRowUpdateError, processRowUpdate, setError]);

  const handleCellClicked = useCallback((event: CellClickedEvent<HierarchyRow>): void => {
    if (!event.data) return;
    setSelectedRowId(event.data.id);
  }, []);

  const handleCellKeyDown = useCallback((event: CellKeyDownEvent<HierarchyRow>): void => {
    if (!event.data) return;
    const keyboardEvent = event.event;
    if (!(keyboardEvent instanceof KeyboardEvent)) return;
    setSelectedRowId(event.data.id);
    if (keyboardEvent.key === "ArrowRight" && event.data.hasChildren && !event.data.expanded) {
      keyboardEvent.preventDefault();
      toggleExpand(event.data.id);
    } else if (keyboardEvent.key === "ArrowLeft" && event.data.hasChildren && event.data.expanded) {
      keyboardEvent.preventDefault();
      toggleExpand(event.data.id);
    } else if (keyboardEvent.key === "F2" && isEditableField(event.data, event.column.getColId())) {
      keyboardEvent.preventDefault();
      startEditingRow(gridApiRef.current, event.data.id, event.column.getColId());
    } else if (keyboardEvent.key === "Delete") {
      keyboardEvent.preventDefault();
      handleDeleteRow(event.data);
    } else if ((keyboardEvent.shiftKey && keyboardEvent.key === "F10") || keyboardEvent.key === "ContextMenu") {
      keyboardEvent.preventDefault();
      const focusedCell = gridApiRef.current?.getFocusedCell();
      const rowElement = focusedCell
        ? document.querySelector<HTMLElement>(`.ag-row[row-index="${focusedCell.rowIndex}"]`)
        : null;
      const rect = rowElement?.getBoundingClientRect();
      setContextMenuState({
        row: event.data,
        mouseX: rect ? rect.left + 24 : window.innerWidth / 2,
        mouseY: rect ? rect.top + 24 : window.innerHeight / 2,
      });
    }
  }, [handleDeleteRow, toggleExpand]);

  const handleEditingStarted = useCallback((event: CellEditingStartedEvent<HierarchyRow>): void => {
    if (event.data) {
      setEditingRowId(event.data.id);
      rowSnapshotRef.current.set(String(event.data.id), event.data);
    }
  }, []);

  const handleEditingStopped = useCallback((event: CellEditingStoppedEvent<HierarchyRow>): void => {
    if (event.data && String(editingRowId) === String(event.data.id)) {
      setEditingRowId(null);
    }
  }, [editingRowId]);

  const handleGridReady = useCallback((event: GridReadyEvent<HierarchyRow>): void => {
    gridApiRef.current = event.api;
  }, []);

  const getRowClass = useCallback((params: RowClassParams<HierarchyRow>): string => {
    const row = params.data;
    if (!row) return "";
    const classes = [`ofp-hierarchy-row-${row.type}`];
    if (String(row.id) === String(highlightedRowId)) {
      classes.push("ofp-hierarchy-row-highlighted");
    }
    if (String(row.id) === String(selectedRowId)) {
      classes.push("ofp-hierarchy-row-selected");
    }
    return classes.join(" ");
  }, [highlightedRowId, selectedRowId]);

  const contextMenuActions = contextMenuState ? (() => {
    const row = contextMenuState.row;
    const createActions: HierarchyRowAction[] = [];
    if (row.type === "location" && row.locationId) {
      createActions.push({ id: "add-field", label: t("actions.addField"), group: "create", onClick: () => handleAddField(row.locationId!) });
    }
    if (row.type === "field" && row.fieldId) {
      createActions.push({ id: "add-bed", label: t("actions.addBed"), group: "create", onClick: () => handleAddBed(row.fieldId!) });
    }
    if (row.type === "bed" && row.bedId) {
      createActions.push({ id: "create-planting-plan", label: t("createPlantingPlan"), group: "create", onClick: () => handleCreatePlantingPlan(row.bedId!) });
    }
    return [
      ...createActions,
      {
        id: "delete",
        label: t("common:actions.delete"),
        group: "destructive",
        color: "error",
        onClick: () => handleDeleteRow(row),
      } satisfies HierarchyRowAction,
    ];
  })() : [];
  // eslint-disable-next-line react-hooks/refs -- Derived menu actions do not read ref.current during render.
  const hasContextMenuActions = contextMenuActions.length > 0;

  const formatHierarchyValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  }, []);

  const getHierarchyAreaValue = useCallback((row: HierarchyRow): string => {
    if (row.type === "location") return "-";
    if (typeof row.length_m === "number" && typeof row.width_m === "number") {
      return String(Math.round(row.length_m * row.width_m * 10) / 10);
    }
    return formatHierarchyValue(row.area_sqm);
  }, [formatHierarchyValue]);

  const getHierarchyRowClipboardValues = useCallback((row: HierarchyRow): string[] => [
    row.name ?? "",
    row.type === "location" ? "-" : formatHierarchyValue(row.length_m),
    row.type === "location" ? "-" : formatHierarchyValue(row.width_m),
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

  const gridHeight = isMobileViewport
    ? Math.min(Math.max(tableContentHeight, TABLE_MIN_HEIGHT_PX), 640)
    : Math.min(tableContentHeight, availableTableHeight ?? tableContentHeight);

  return (
    <div className={showTitle ? "page-container" : undefined}>
      <Box sx={{ width: "100%", minWidth: 0 }}>
        {showTitle && <h1>{t("title")}</h1>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {draftValidationWarning && <Alert severity="warning" sx={{ mb: 2 }}>{draftValidationWarning}</Alert>}
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
            title={t("messages.missingDimensionsHint")}
            description={t("messages.missingDimensionsHintOptional")}
            containerSx={{ mx: 0 }}
          />
        )}
        {shouldShowHierarchyTable ? (
          <Box
            ref={tableWrapperRef}
            onContextMenu={handleGridContextMenu}
            sx={{
              width: "100%",
              maxWidth: "100%",
              height: gridHeight,
              minHeight: TABLE_MIN_HEIGHT_PX,
              overflow: "hidden",
              "& .ag-root-wrapper": {
                borderColor: "divider",
                borderRadius: "4px",
              },
              "& .ag-header-cell-label": {
                fontWeight: 600,
              },
              "& .ag-cell": {
                display: "flex",
                alignItems: "center",
                lineHeight: 1.35,
              },
              "& .ofp-hierarchy-row-location .ag-cell": {
                py: 0.5,
              },
              "& .ofp-hierarchy-row-field .ag-cell": {
                py: 0.25,
              },
              "& .ofp-hierarchy-cell-missing-dimension": {
                backgroundColor: "#fbf2d5",
                color: "text.primary",
              },
              "& .ofp-hierarchy-row-selected .ag-cell-focus:not(.ag-cell-inline-editing)": {
                outlineColor: "primary.main",
              },
              "& .ofp-hierarchy-row-highlighted .ag-cell": {
                animation: "ofp-hierarchy-row-highlight-flash 2.5s ease-out",
              },
              "@keyframes ofp-hierarchy-row-highlight-flash": {
                "0%": { backgroundColor: "rgba(37, 111, 42, 0.22)" },
                "70%": { backgroundColor: "rgba(37, 111, 42, 0.14)" },
                "100%": { backgroundColor: "transparent" },
              },
            }}
          >
            <AgGridReact<HierarchyRow>
              theme={themeMaterial}
              rowData={rows}
              columnDefs={columnDefs}
              context={gridContext}
              loading={loading}
              headerHeight={HEADER_ROW_HEIGHT}
              floatingFiltersHeight={isMobileViewport ? 0 : 36}
              getRowHeight={(params: RowHeightParams<HierarchyRow>) => (
                params.data ? getRowHeightForHierarchyRow(params.data) : BED_ROW_HEIGHT
              )}
              getRowClass={getRowClass}
              getRowId={(params: GetRowIdParams<HierarchyRow>) => String(params.data.id)}
              readOnlyEdit
              suppressContextMenu
              suppressDragLeaveHidesColumns
              suppressHorizontalScroll={false}
              defaultColDef={{
                resizable: true,
                suppressMovable: true,
                filter: true,
                floatingFilter: true,
              }}
              localeText={agGridGermanLocaleText}
              onGridReady={handleGridReady}
              onCellClicked={handleCellClicked}
              onCellContextMenu={handleCellContextMenu}
              onCellEditRequest={handleCellEditRequest}
              onCellKeyDown={handleCellKeyDown}
              onCellEditingStarted={handleEditingStarted}
              onCellEditingStopped={handleEditingStopped}
            />
          </Box>
        ) : null}
      </Box>

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
        {/* eslint-disable-next-line react-hooks/refs -- Derived menu actions do not read ref.current during render. */}
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
          includeDivider={hasContextMenuActions}
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

export default FieldsBedsHierarchyAgGridSpike;
