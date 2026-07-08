import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GridRowModes, type GridRowModesModel } from "@mui/x-data-grid";
import {
  Alert,
  Box,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
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
import { handleContextMenuKeyboardNavigation } from "../components/data-grid/contextMenuFocus";
import { useNavigationBlocker } from "../hooks/autosave";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { useTranslation } from "../i18n";
import { bedAPI, fieldAPI, locationAPI, type Field } from "../api/api";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useHierarchyData, type HierarchyDataState } from "../components/hierarchy/hooks/useHierarchyData";
import { useHierarchyDelete } from "../components/hierarchy/hooks/useHierarchyDelete";
import { useHierarchyLevelToggle } from "../components/hierarchy/hooks/useHierarchyLevelToggle";
import { useHierarchyRowUpdate } from "../components/hierarchy/hooks/useHierarchyRowUpdate";
import { HierarchyAddIcon } from "../components/hierarchy/HierarchyAddIcon";
import { HierarchyLevelButtons } from "../components/hierarchy/HierarchyLevelToggle";
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
import type { TreeRowNode } from "../components/hierarchy/utils/treeRows";
import type { HierarchyRow } from "../components/hierarchy/utils/types";

interface FieldsBedsTanStackHierarchyProps {
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

type EditableField = "name" | "length_m" | "width_m";

const HIERARCHY_AUTO_EXPAND_ALL_THRESHOLD = 200;
const TABLE_BOTTOM_MARGIN_PX = 24;
const TABLE_MIN_HEIGHT_PX = 240;
const HEADER_ROW_HEIGHT = 40;
const FILTER_ROW_HEIGHT = 36;
const LOCATION_ROW_HEIGHT = 46;
const FIELD_ROW_HEIGHT = 42;
const BED_ROW_HEIGHT = 36;
const TABLE_MIN_WIDTH_PX = 760;
const FILTERABLE_FIELDS = ["name", "length_m", "width_m", "area_sqm", "notes"] as const;

const defaultColumnSizing: ColumnSizingState = {
  name: 320,
  length_m: 120,
  width_m: 120,
  area_sqm: 130,
  notes: 260,
};

const getRowHeight = (row: HierarchyRow): number => {
  if (row.type === "location") return LOCATION_ROW_HEIGHT;
  if (row.type === "field") return FIELD_ROW_HEIGHT;
  return BED_ROW_HEIGHT;
};

const getRowKey = (rowId: string | number): string => String(rowId);

const formatHierarchyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
};

const getHierarchyAreaValue = (row: HierarchyRow): string => {
  if (row.type === "location") {
    return "—";
  }
  if (typeof row.length_m === "number" && typeof row.width_m === "number") {
    return String(Math.round(row.length_m * row.width_m * 10) / 10);
  }
  return formatHierarchyValue(row.area_sqm);
};

const getFilterValue = (row: HierarchyRow, columnId: string): string => {
  if (columnId === "area_sqm") {
    return getHierarchyAreaValue(row);
  }
  const value = row[columnId];
  return value === null || value === undefined ? "" : String(value);
};

const matchesFilters = (row: HierarchyRow, filters: ColumnFiltersState): boolean =>
  filters.every((filter) => {
    const filterValue = String(filter.value ?? "").trim().toLocaleLowerCase("de");
    if (!filterValue) {
      return true;
    }
    return getFilterValue(row, filter.id).toLocaleLowerCase("de").includes(filterValue);
  });

function applyHierarchyFilters(rows: HierarchyRow[], filters: ColumnFiltersState): HierarchyRow[] {
  const activeFilters = filters.filter((filter) => String(filter.value ?? "").trim() !== "");
  if (activeFilters.length === 0) {
    return rows;
  }

  const rowsById = new Map(rows.map((row) => [getRowKey(row.id), row]));
  const visibleIds = new Set<string>();

  rows.forEach((row) => {
    if (!matchesFilters(row, activeFilters)) {
      return;
    }

    let current: HierarchyRow | undefined = row;
    while (current) {
      visibleIds.add(getRowKey(current.id));
      current = current.parentId !== undefined ? rowsById.get(getRowKey(current.parentId)) : undefined;
    }
  });

  return rows.filter((row) => visibleIds.has(getRowKey(row.id)));
}

function getHierarchyRowClipboardValues(row: HierarchyRow): string[] {
  return [
    row.name ?? "",
    row.type === "location" ? "—" : formatHierarchyValue(row.length_m),
    row.type === "location" ? "—" : formatHierarchyValue(row.width_m),
    getHierarchyAreaValue(row),
    getPlainExcerpt(row.notes ?? "", 120),
  ];
}

function FieldsBedsTanStackHierarchy({
  showTitle = true,
  createFieldRequest = 0,
  onCreateFieldRequestHandled,
  hierarchyData,
  onPendingDeletionCountChange,
  suppressContextMenuHint = false,
}: FieldsBedsTanStackHierarchyProps) {
  const { t } = useTranslation(["hierarchy", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const isTouchLikePointer = useMediaQuery("(pointer: coarse)");
  const isMobileViewport = useMediaQuery("(max-width:900px)");
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const contextMenuListRef = useRef<HTMLUListElement | null>(null);
  const scrollToRowRef = useRef<(rowId: string | number) => void>(() => undefined);
  const hasInitiallyExpandedRef = useRef(false);
  const handledCreateFieldRequestRef = useRef(0);
  const highlightClearTimeoutRef = useRef<number | null>(null);
  const rowSnapshotRef = useRef<Map<string, HierarchyRow>>(new Map());

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

  const {
    expandedRows,
    hasPersistedState,
    toggleExpand,
    ensureExpanded,
    expandAll,
  } = useExpandedState("fieldsBedsHierarchyTanStack");

  const { sortModel, setSortModel } = usePersistentSortModel({
    tableKey: "fieldsBedsHierarchyTanStack",
    allowedFields: ["name", "area_sqm"],
    persistInUrl: true,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(defaultColumnSizing);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
  const [editingDraft, setEditingDraft] = useState<HierarchyRow | null>(null);
  const [draftValidationWarning, setDraftValidationWarning] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState<string | number | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    row: HierarchyRow;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [availableTableHeight, setAvailableTableHeight] = useState<number | null>(null);

  const sorting = useMemo<SortingState>(
    () => sortModel
      .filter((item) => item.sort === "asc" || item.sort === "desc")
      .map((item) => ({ id: item.field, desc: item.sort === "desc" })),
    [sortModel],
  );

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

  const hierarchyTreeNodes = useMemo<TreeRowNode[]>(() => {
    const nodes: TreeRowNode[] = [];
    const hasMultipleLocations = locations.length > 1;

    if (hasMultipleLocations) {
      locations.forEach((locationItem) => {
        if (!hasPersistedEntityId(locationItem.id)) return;
        nodes.push({ id: `location-${locationItem.id}`, parentId: null });
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
      if (!hasPersistedEntityId(bed.id) || !hasPersistedEntityId(bed.field)) return;
      nodes.push({ id: bed.id, parentId: `field-${bed.field}` });
    });

    return nodes;
  }, [beds, fields, locations]);

  const allExpandableIds = useMemo(
    () => hierarchyTreeNodes.map((node) => node.id),
    [hierarchyTreeNodes],
  );

  const rawRows = useMemo(
    () => projectRows(expandedRows),
    [expandedRows, projectRows],
  );
  const allRows = useMemo(
    () => projectRows(new Set(allExpandableIds)),
    [allExpandableIds, projectRows],
  );
  const hasActiveFilters = columnFilters.some((filter) => String(filter.value ?? "").trim() !== "");
  const rows = useMemo(
    () => applyHierarchyFilters(hasActiveFilters ? allRows : rawRows, columnFilters),
    [allRows, columnFilters, hasActiveFilters, rawRows],
  );
  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const rowsById = useMemo(() => {
    const nextRowsById = new Map<string, HierarchyRow>();
    rows.forEach((row) => nextRowsById.set(getRowKey(row.id), row));
    return nextRowsById;
  }, [rows]);

  const getDraftRow = useCallback((rowId: string | number): HierarchyRow | null => {
    if (editingDraft && getRowKey(editingDraft.id) === getRowKey(rowId)) {
      return editingDraft;
    }
    return rowsById.get(getRowKey(rowId)) ?? null;
  }, [editingDraft, rowsById]);

  const noopSetRowModesModel = useCallback((_value: React.SetStateAction<GridRowModesModel>): void => undefined, []);

  const {
    discardRowEdit,
    processRowUpdate,
    handleProcessRowUpdateError,
  } = useHierarchyRowUpdate({
    getDraftRow,
    rowModesModel: editingRowId === null ? {} : { [editingRowId]: { mode: GridRowModes.Edit } },
    rowsById,
    beds,
    fields,
    locations,
    setBeds,
    setFields,
    setLocations,
    rowSnapshotRef,
    setRowModesModel: noopSetRowModesModel,
    setError,
    setDraftValidationWarning,
    fetchData,
    saveBed,
    t,
  });

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
    setDraftValidationWarning,
  });

  const shouldShowHierarchyTable =
    hierarchyIndex.hasMultipleLocations || fields.length > 0 || createFieldRequest > 0;
  const hasUsableHierarchyRows = shouldShowHierarchyTable && (
    rows.length > 0 ||
    locations.length > 0 ||
    fields.length > 0 ||
    beds.length > 0
  );
  const { showContextMenuHint, closeContextMenuHint, markContextMenuHintUsed } = useContextMenuHint({
    enabled: !suppressContextMenuHint,
    isLoading: loading,
    hasRows: hasUsableHierarchyRows,
  });

  const hierarchyLevelToggle = useHierarchyLevelToggle(hierarchyTreeNodes, expandedRows, expandAll);

  const notesEditor = useNotesEditor<HierarchyRow>({
    rows,
    onSave: async ({ row, value }) => {
      if (!row.name) {
        throw new Error(t("validation.nameRequired"));
      }

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
        setBeds((previousBeds) =>
          previousBeds.map((bed) => (bed.id === row.bedId ? { ...bed, notes: value } : bed)),
        );
      } else if (row.type === "field" && row.fieldId) {
        await fieldAPI.update(row.fieldId, {
          name: row.name,
          location: row.locationId!,
          area_sqm: normalizeAreaValue(parsedArea),
          length_m: parseDimensionValue(row.length_m),
          width_m: parseDimensionValue(row.width_m),
          notes: value,
        });
        setFields((previousFields) =>
          previousFields.map((field) => (field.id === row.fieldId ? { ...field, notes: value } : field)),
        );
      } else if (row.type === "location" && row.locationId) {
        const locationItem = locations.find((item) => item.id === row.locationId);
        if (!locationItem) return;
        await locationAPI.update(row.locationId, { ...locationItem, notes: value });
        setLocations((previousLocations) =>
          previousLocations.map((item) => (item.id === row.locationId ? { ...item, notes: value } : item)),
        );
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
      const expandedIds = new Set<string | number>();
      locations.forEach((locationItem) => expandedIds.add(`location-${locationItem.id}`));
      if (canFullyExpand) {
        fields.forEach((field) => expandedIds.add(`field-${field.id}`));
      }
      expandAll(Array.from(expandedIds));
      hasInitiallyExpandedRef.current = true;
    }
  }, [beds.length, expandAll, fields, hasPersistedState, locations]);

  useEffect(() => {
    if (pendingEditRow === null) return;
    const row = rows.find((item) => item.id === pendingEditRow);
    if (!row) return;
    setEditingRowId(row.id);
    setEditingDraft(row);
    setSelectedRowId(row.id);
    setPendingEditRow(null);
  }, [pendingEditRow, rows, setPendingEditRow]);

  useEffect(() => {
    if (pendingFieldEditRow === null) return;
    const row = rows.find((item) => item.id === pendingFieldEditRow);
    if (!row) return;
    setEditingRowId(row.id);
    setEditingDraft(row);
    setSelectedRowId(row.id);
    setPendingFieldEditRow(null);
  }, [pendingFieldEditRow, rows]);

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
    setPendingEditRow(addBed(fieldId));
  }, [addBed, ensureExpanded, fields, setPendingEditRow]);

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
    if (!hasActiveFieldDraft && firstLocationId === undefined) {
      return;
    }

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
      setSelectedRowId(targetRowId);
      setHighlightedRowId(targetRowId);
      requestAnimationFrame(() => scrollToRowRef.current(targetRowId));

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
    if (isMobileViewport) {
      setAvailableTableHeight(null);
      return;
    }

    const measure = (): void => {
      const wrapper = tableWrapperRef.current;
      if (!wrapper) return;
      const top = wrapper.getBoundingClientRect().top;
      setAvailableTableHeight(Math.max(TABLE_MIN_HEIGHT_PX, window.innerHeight - top - TABLE_BOTTOM_MARGIN_PX));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [
    isMobileViewport,
    error,
    draftValidationWarning,
    showContextMenuHint,
    shouldShowHierarchyTable,
  ]);

  const tableContentHeight = useMemo(
    () => HEADER_ROW_HEIGHT + FILTER_ROW_HEIGHT + rows.reduce((sum, row) => sum + getRowHeight(row), 0),
    [rows],
  );
  const tableHeight = isMobileViewport
    ? tableContentHeight
    : Math.min(tableContentHeight, availableTableHeight ?? tableContentHeight);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => getRowHeight(rows[index] ?? { type: "bed" } as HierarchyRow),
    initialRect: {
      width: TABLE_MIN_WIDTH_PX,
      height: Math.max(TABLE_MIN_HEIGHT_PX, tableHeight),
    },
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const renderedVirtualItems = virtualItems.length > 0
    ? virtualItems
    : rows.slice(0, Math.min(rows.length, 80)).map((row, index) => {
      const start = rows.slice(0, index).reduce((sum, currentRow) => sum + getRowHeight(currentRow), 0);
      return {
        index,
        key: row.id,
        start,
        end: start + getRowHeight(row),
        size: getRowHeight(row),
        lane: 0,
      };
    });

  const scrollToRow = useCallback((rowId: string | number): void => {
    const index = rowsRef.current.findIndex((row) => getRowKey(row.id) === getRowKey(rowId));
    if (index >= 0) {
      rowVirtualizer.scrollToIndex(index, { align: "center" });
    }
  }, [rowVirtualizer]);

  useLayoutEffect(() => {
    scrollToRowRef.current = scrollToRow;
  }, [scrollToRow]);

  const startEdit = useCallback((row: HierarchyRow): void => {
    if (row.type === "location" || row.type === "field" || row.type === "bed") {
      rowSnapshotRef.current.set(getRowKey(row.id), row);
      setEditingRowId(row.id);
      setEditingDraft(row);
      setSelectedRowId(row.id);
    }
  }, []);

  const cancelEdit = useCallback((): void => {
    if (editingRowId !== null) {
      discardRowEdit(editingRowId);
    }
    setEditingRowId(null);
    setEditingDraft(null);
  }, [discardRowEdit, editingRowId]);

  const saveEdit = useCallback(async (): Promise<void> => {
    if (!editingDraft) return;

    try {
      const savedRow = await processRowUpdate(editingDraft);
      setSelectedRowId(savedRow.id);
      setEditingRowId(null);
      setEditingDraft(null);
      setError("");
    } catch (err) {
      handleProcessRowUpdateError(err instanceof Error ? err : new Error(t("errors.save")));
    }
  }, [editingDraft, handleProcessRowUpdateError, processRowUpdate, setError, t]);

  const handleDraftChange = useCallback((field: EditableField, value: string): void => {
    setEditingDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      return {
        ...currentDraft,
        [field]: field === "name" ? value : value === "" ? null : value,
      };
    });
  }, []);

  const handleCreatePlantingPlan = useCallback((bedId: number): void => {
    navigate(`/app/planting-plans?bedId=${bedId}`);
  }, [navigate]);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
  }, []);

  const openContextMenu = useCallback((
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    row: HierarchyRow,
  ): void => {
    event.preventDefault();
    markContextMenuHintUsed();
    setSelectedRowId(row.id);

    if ("clientX" in event && event.clientX !== 0) {
      setContextMenuState({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
      return;
    }

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    setContextMenuState({ row, mouseX: rect.left + 24, mouseY: rect.top + 24 });
  }, [markContextMenuHintUsed]);

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

    return [
      ...createActions,
      {
        id: "delete",
        label: t("common:actions.delete"),
        group: "destructive",
        color: "error",
        onClick: () => {
          void deleteHierarchyRowWithUndo(row);
        },
      },
    ];
  }, [deleteHierarchyRowWithUndo, handleAddBed, handleAddField, handleCreatePlantingPlan, t]);

  const contextMenuActions = contextMenuState ? getHierarchyRowActions(contextMenuState.row) : [];

  const updateSorting = useCallback((columnId: string): void => {
    const current = sorting[0];
    if (current?.id !== columnId) {
      setSortModel([{ field: columnId, sort: "asc" }]);
      return;
    }
    if (!current.desc) {
      setSortModel([{ field: columnId, sort: "desc" }]);
      return;
    }
    setSortModel([]);
  }, [setSortModel, sorting]);

  const handleColumnFilterChange = useCallback((columnId: string, value: string): void => {
    setColumnFilters((currentFilters) => {
      const nextFilters = currentFilters.filter((filter) => filter.id !== columnId);
      if (value.trim() !== "") {
        nextFilters.push({ id: columnId, value });
      }
      return nextFilters;
    });
  }, []);

  const columns = useMemo<ColumnDef<HierarchyRow>[]>(() => [
    {
      id: "name",
      accessorKey: "name",
      header: () => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("columns.name")}</Typography>
          {!isMobileViewport ? (
            <HierarchyLevelButtons
              canExpand={hierarchyLevelToggle.canExpand}
              canCollapse={hierarchyLevelToggle.canCollapse}
              onExpandOneLevel={hierarchyLevelToggle.expandOneLevel}
              onCollapseOneLevel={hierarchyLevelToggle.collapseOneLevel}
            />
          ) : null}
        </Box>
      ),
      size: defaultColumnSizing.name,
      minSize: 220,
      enableSorting: true,
      enableColumnFilter: true,
    },
    {
      id: "length_m",
      accessorKey: "length_m",
      header: () => t("columns.length"),
      size: defaultColumnSizing.length_m,
      minSize: 92,
      enableSorting: false,
      enableColumnFilter: true,
    },
    {
      id: "width_m",
      accessorKey: "width_m",
      header: () => t("columns.width"),
      size: defaultColumnSizing.width_m,
      minSize: 92,
      enableSorting: false,
      enableColumnFilter: true,
    },
    {
      id: "area_sqm",
      accessorFn: getHierarchyAreaValue,
      header: () => t("columns.area"),
      size: defaultColumnSizing.area_sqm,
      minSize: 112,
      enableSorting: true,
      enableColumnFilter: true,
    },
    {
      id: "notes",
      accessorKey: "notes",
      header: () => t("common:fields.notes"),
      size: defaultColumnSizing.notes,
      minSize: 180,
      enableSorting: false,
      enableColumnFilter: true,
    },
  ], [
    hierarchyLevelToggle.canCollapse,
    hierarchyLevelToggle.canExpand,
    hierarchyLevelToggle.collapseOneLevel,
    hierarchyLevelToggle.expandOneLevel,
    isMobileViewport,
    t,
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      sorting,
      columnFilters,
      columnSizing,
    },
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    manualSorting: true,
    manualFiltering: true,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const gridTemplateColumns = useMemo(() => {
    if (isMobileViewport) {
      return "minmax(140px, 1.6fr) minmax(52px, 0.58fr) minmax(52px, 0.58fr) minmax(56px, 0.62fr) minmax(40px, 0.45fr)";
    }

    const [name, length, width, area] = visibleColumns;
    const notes = visibleColumns[4];
    return [
      `${name?.getSize() ?? defaultColumnSizing.name}px`,
      `${length?.getSize() ?? defaultColumnSizing.length_m}px`,
      `${width?.getSize() ?? defaultColumnSizing.width_m}px`,
      `${area?.getSize() ?? defaultColumnSizing.area_sqm}px`,
      `minmax(${notes?.columnDef.minSize ?? 180}px, 1fr)`,
    ].join(" ");
  }, [isMobileViewport, visibleColumns]);

  const isCellEditable = useCallback((row: HierarchyRow, field: EditableField): boolean => {
    if (row.type === "location") {
      return field === "name";
    }
    return field === "name" || field === "length_m" || field === "width_m";
  }, []);

  const renderEditableValue = useCallback((row: HierarchyRow, field: EditableField): React.ReactNode => {
    const draftRow = editingRowId !== null && getRowKey(editingRowId) === getRowKey(row.id)
      ? editingDraft
      : null;
    if (draftRow && isCellEditable(row, field)) {
      return (
        <InputBase
          autoFocus={field === "name"}
          value={String(draftRow[field] ?? "")}
          inputProps={{ "aria-label": String(t(`columns.${field === "length_m" ? "length" : field === "width_m" ? "width" : "name"}`)) }}
          onChange={(event) => handleDraftChange(field, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveEdit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          sx={{
            width: "100%",
            minHeight: 30,
            px: 0.75,
            border: "1px solid",
            borderColor: "primary.main",
            borderRadius: 1,
            bgcolor: "background.paper",
            fontSize: "0.875rem",
          }}
        />
      );
    }

    if (row.type === "location" && field !== "name") {
      return "—";
    }
    return formatHierarchyValue(row[field]);
  }, [cancelEdit, editingDraft, editingRowId, handleDraftChange, isCellEditable, saveEdit, t]);

  const renderNameCell = useCallback((row: HierarchyRow): React.ReactNode => {
    const hasExpandToggle = (row.type === "location" || row.type === "field") && row.hasChildren;
    const inlineActionsHidden = isTouchLikePointer || isMobileViewport;

    return (
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, width: "100%", gap: 0.5, pl: `${row.level * 24}px` }}>
        <Box sx={{ width: 32, minWidth: 32, display: "inline-flex", justifyContent: "center" }}>
          {hasExpandToggle ? (
            <Tooltip title={row.expanded ? t("tooltips.collapse") : t("tooltips.expand")} disableInteractive>
              <IconButton
                size="small"
                aria-label={row.expanded ? t("tooltips.collapse") : t("tooltips.expand")}
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpand(row.id);
                }}
              >
                {row.expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          ) : (
            <Box aria-hidden sx={{ width: 32 }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {renderEditableValue(row, "name")}
        </Box>
        {!inlineActionsHidden && editingRowId === null ? (
          <Box
            className="ofp-tanstack-row-actions"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, opacity: 0, transition: "opacity 120ms ease" }}
          >
            {row.type === "location" && row.locationId ? (
              <Tooltip title={t("addField")} disableInteractive>
                <IconButton size="small" aria-label={t("addField")} tabIndex={-1} onClick={(event) => {
                  event.stopPropagation();
                  handleAddField(row.locationId!);
                }}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {row.type === "field" && row.fieldId ? (
              <Tooltip title={t("addBedToField")} disableInteractive>
                <IconButton size="small" aria-label={t("addBedToField")} tabIndex={-1} onClick={(event) => {
                  event.stopPropagation();
                  handleAddBed(row.fieldId!);
                }}>
                  <HierarchyAddIcon interactive={false} ariaHidden sx={{ bgcolor: "transparent" }} />
                </IconButton>
              </Tooltip>
            ) : null}
            {row.type === "bed" && row.bedId ? (
              <Tooltip title={t("createPlantingPlan")} disableInteractive>
                <IconButton size="small" color="primary" aria-label={t("createPlantingPlan")} tabIndex={-1} onClick={(event) => {
                  event.stopPropagation();
                  handleCreatePlantingPlan(row.bedId!);
                }}>
                  <AgricultureIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title={t("common:actions.delete")} disableInteractive>
              <IconButton size="small" color="error" aria-label={t("common:actions.delete")} tabIndex={-1} onClick={(event) => {
                event.stopPropagation();
                void deleteHierarchyRowWithUndo(row);
              }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("common:actions.actions")} disableInteractive>
              <IconButton size="small" aria-label={t("common:actions.actions")} tabIndex={-1} onClick={(event) => openContextMenu(event, row)}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : null}
      </Box>
    );
  }, [
    deleteHierarchyRowWithUndo,
    editingRowId,
    handleAddBed,
    handleAddField,
    handleCreatePlantingPlan,
    isMobileViewport,
    isTouchLikePointer,
    openContextMenu,
    renderEditableValue,
    t,
    toggleExpand,
  ]);

  const renderCell = useCallback((row: HierarchyRow, columnId: string): React.ReactNode => {
    if (columnId === "name") {
      return renderNameCell(row);
    }
    if (columnId === "length_m" || columnId === "width_m") {
      return renderEditableValue(row, columnId);
    }
    if (columnId === "area_sqm") {
      return getHierarchyAreaValue(row);
    }
    if (columnId === "notes") {
      const rawValue = row.notes ?? "";
      return (
        <NotesCell
          hasValue={rawValue.trim() !== ""}
          rawValue={rawValue}
          excerpt={getPlainExcerpt(rawValue, 120)}
          compactIndicator={isMobileViewport}
          onOpen={() => notesEditor.handleOpen(row.id, "notes")}
        />
      );
    }
    return formatHierarchyValue(row[columnId]);
  }, [isMobileViewport, notesEditor, renderEditableValue, renderNameCell]);

  const moveSelection = useCallback((delta: number): void => {
    if (rows.length === 0) return;
    const currentIndex = selectedRowId === null
      ? -1
      : rows.findIndex((row) => getRowKey(row.id) === getRowKey(selectedRowId));
    const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + delta));
    const nextRow = rows[nextIndex];
    if (!nextRow) return;
    setSelectedRowId(nextRow.id);
    scrollToRow(nextRow.id);
  }, [rows, scrollToRow, selectedRowId]);

  const handleGridKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    if (editingRowId !== null) {
      return;
    }

    const selectedRow = selectedRowId === null ? rows[0] : rowsById.get(getRowKey(selectedRowId));
    if (!selectedRow) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === "ArrowRight") {
      if ((selectedRow.type === "location" || selectedRow.type === "field") && selectedRow.hasChildren && !selectedRow.expanded) {
        event.preventDefault();
        toggleExpand(selectedRow.id);
      }
    } else if (event.key === "ArrowLeft") {
      if ((selectedRow.type === "location" || selectedRow.type === "field") && selectedRow.expanded) {
        event.preventDefault();
        toggleExpand(selectedRow.id);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      startEdit(selectedRow);
    } else if (event.key === "Delete") {
      event.preventDefault();
      void deleteHierarchyRowWithUndo(selectedRow);
    } else if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
      event.preventDefault();
      openContextMenu(event, selectedRow);
    }
  }, [
    deleteHierarchyRowWithUndo,
    editingRowId,
    moveSelection,
    openContextMenu,
    rows,
    rowsById,
    selectedRowId,
    startEdit,
    toggleExpand,
  ]);

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

  const shouldShowMissingDimensionsHint = useMemo(() => {
    const hasBeds = beds.length > 0;
    const allBedsMissingLengthAndWidth = beds.every((bed) => {
      const length = parseDimensionValue(bed.length_m);
      const width = parseDimensionValue(bed.width_m);
      return !Number.isFinite(length ?? NaN) && !Number.isFinite(width ?? NaN);
    });

    return hasBeds && allBedsMissingLengthAndWidth;
  }, [beds]);

  const getHierarchyTableClipboardRows = useCallback((): string[][] => [
    [
      t("columns.name"),
      t("columns.length"),
      t("columns.width"),
      t("columns.area"),
      t("common:fields.notes"),
    ],
    ...rows.map(getHierarchyRowClipboardValues),
  ], [rows, t]);

  const renderSortIcon = (columnId: string): React.ReactNode => {
    const current = sorting[0];
    if (current?.id !== columnId) {
      return <UnfoldMoreIcon fontSize="small" color="disabled" />;
    }
    return current.desc ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />;
  };

  const renderFilterInput = (columnId: string): React.ReactNode => {
    const value = columnFilters.find((filter) => filter.id === columnId)?.value ?? "";
    return (
      <InputBase
        value={String(value)}
        placeholder={t("common:actions.search")}
        inputProps={{ "aria-label": `${t("common:actions.search")} ${String(table.getColumn(columnId)?.columnDef.header ?? "")}` }}
        onChange={(event) => handleColumnFilterChange(columnId, event.target.value)}
        sx={{
          width: "100%",
          height: 28,
          px: 0.75,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
          fontSize: "0.8125rem",
        }}
      />
    );
  };

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
            title={t("messages.missingDimensionsHint")}
            description={t("messages.missingDimensionsHintOptional")}
            containerSx={{ mx: 0 }}
          />
        )}

        {shouldShowHierarchyTable ? (
          <Box
            ref={tableWrapperRef}
            sx={{
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
          >
            <Box
              ref={scrollParentRef}
              role="grid"
              aria-rowcount={rows.length}
              tabIndex={0}
              data-testid="tanstack-hierarchy-grid"
              onKeyDown={handleGridKeyDown}
              sx={{
                height: `${Math.max(TABLE_MIN_HEIGHT_PX, tableHeight)}px`,
                minWidth: isMobileViewport ? "100%" : `${TABLE_MIN_WIDTH_PX}px`,
                overflowY: isMobileViewport ? "visible" : "auto",
                outline: "none",
                position: "relative",
              }}
            >
              <Box
                role="rowgroup"
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  bgcolor: "surface.surfaceBackground",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <Box
                    key={headerGroup.id}
                    role="row"
                    sx={{
                      minHeight: HEADER_ROW_HEIGHT,
                      display: "grid",
                      gridTemplateColumns,
                    }}
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort() && (header.column.id === "name" || header.column.id === "area_sqm");
                      return (
                        <Box
                          key={header.id}
                          role="columnheader"
                          aria-sort={
                            sorting[0]?.id === header.column.id
                              ? sorting[0].desc ? "descending" : "ascending"
                              : "none"
                          }
                          sx={{
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1,
                            borderRight: "1px solid",
                            borderColor: "divider",
                            fontWeight: 600,
                            position: "relative",
                          }}
                        >
                          <Box
                            role={canSort ? "button" : undefined}
                            tabIndex={canSort ? 0 : undefined}
                            onClick={canSort ? () => updateSorting(header.column.id) : undefined}
                            onKeyDown={canSort ? (event: React.KeyboardEvent<HTMLDivElement>) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                updateSorting(header.column.id);
                              }
                            } : undefined}
                            sx={{
                              appearance: "none",
                              border: 0,
                              bgcolor: "transparent",
                              p: 0,
                              m: 0,
                              minWidth: 0,
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              color: "inherit",
                              cursor: canSort ? "pointer" : "default",
                              textAlign: "left",
                            }}
                          >
                            <Box sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </Box>
                            {canSort ? renderSortIcon(header.column.id) : null}
                          </Box>
                          {header.column.getCanResize() ? (
                            <Box
                              aria-hidden
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              sx={{
                                position: "absolute",
                                top: 0,
                                right: -3,
                                width: 6,
                                height: "100%",
                                cursor: "col-resize",
                                zIndex: 3,
                              }}
                            />
                          ) : null}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
                <Box
                  role="row"
                  sx={{
                    minHeight: FILTER_ROW_HEIGHT,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                >
                  {visibleColumns.map((column) => (
                    <Box
                      key={column.id}
                      role="columnheader"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        px: 0.75,
                        py: 0.5,
                        borderRight: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {FILTERABLE_FIELDS.includes(column.id as typeof FILTERABLE_FIELDS[number]) ? renderFilterInput(column.id) : null}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                role="rowgroup"
                sx={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  minHeight: rows.length === 0 ? 96 : 0,
                  position: "relative",
                }}
              >
                {loading ? (
                  <Box sx={{ p: 2 }}>{t("common:messages.loading")}</Box>
                ) : rows.length === 0 ? (
                  <Box sx={{ p: 2 }}>{t("common:messages.noData")}</Box>
                ) : (
                  renderedVirtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) return null;
                    const isSelected = selectedRowId !== null && getRowKey(selectedRowId) === getRowKey(row.id);
                    const isHighlighted = highlightedRowId !== null && getRowKey(highlightedRowId) === getRowKey(row.id);
                    const isEditing = editingRowId !== null && getRowKey(editingRowId) === getRowKey(row.id);

                    return (
                      <Box
                        key={row.id}
                        role="row"
                        aria-selected={isSelected}
                        data-id={row.id}
                        data-testid={`tanstack-row-${row.id}`}
                        data-row-type={row.type}
                        onClick={() => setSelectedRowId(row.id)}
                        onDoubleClick={() => startEdit(row)}
                        onContextMenu={(event) => openContextMenu(event, row)}
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: "grid",
                          gridTemplateColumns,
                          bgcolor: isSelected ? "surface.surfaceBackground" : "background.paper",
                          boxShadow: isSelected ? "inset 0 0 0 1px rgba(37, 111, 42, 0.24)" : undefined,
                          animation: isHighlighted ? "ofp-tanstack-row-highlight-flash 2.5s ease-out" : undefined,
                          "&:hover": {
                            bgcolor: "surface.surfaceHoverBackground",
                          },
                          "&:hover .ofp-tanstack-row-actions": {
                            opacity: 1,
                          },
                          "@keyframes ofp-tanstack-row-highlight-flash": {
                            "0%": { backgroundColor: "rgba(37, 111, 42, 0.22)" },
                            "70%": { backgroundColor: "rgba(37, 111, 42, 0.14)" },
                            "100%": { backgroundColor: "transparent" },
                          },
                        }}
                      >
                        {visibleColumns.map((column) => (
                          <Box
                            key={column.id}
                            role="gridcell"
                            data-field={column.id}
                            sx={{
                              minWidth: 0,
                              px: 1,
                              display: "flex",
                              alignItems: "center",
                              borderRight: "1px solid",
                              borderBottom: "1px solid",
                              borderColor: "divider",
                              overflow: "hidden",
                              color: row.type === "location" ? "text.primary" : undefined,
                              fontWeight: row.type === "location" ? 600 : row.type === "field" ? 500 : 400,
                              bgcolor: column.id === "area_sqm" ? "#F5F5F5" : undefined,
                            }}
                          >
                            <Box sx={{ minWidth: 0, width: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {renderCell(row, column.id)}
                            </Box>
                          </Box>
                        ))}
                        {isEditing ? (
                          <Box
                            sx={{
                              position: "absolute",
                              right: 8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              display: "inline-flex",
                              gap: 0.5,
                              bgcolor: "background.paper",
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                              boxShadow: 1,
                            }}
                          >
                            <Tooltip title={t("common:actions.saveRow")} disableInteractive>
                              <IconButton size="small" color="primary" aria-label={t("common:actions.saveRow")} onClick={() => { void saveEdit(); }}>
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t("common:actions.cancelRowEdit")} disableInteractive>
                              <IconButton size="small" aria-label={t("common:actions.cancelRowEdit")} onClick={cancelEdit}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
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

export default FieldsBedsTanStackHierarchy;
