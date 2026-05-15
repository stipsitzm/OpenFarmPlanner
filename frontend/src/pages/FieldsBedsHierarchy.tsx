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
import { DataGrid, GridRowModes } from "@mui/x-data-grid";
import { germanDataGridLocaleText } from "../components/data-grid/localeText";
import type { GridRowsProp, GridRowModesModel, GridRowHeightParams } from "@mui/x-data-grid";
import { Box, Alert } from "@mui/material";
import EmptyStateCard from '../components/project/EmptyStateCard';
import { dataGridSx } from "../components/data-grid/styles";
import {
  handleRowEditStop,
  handleEditableCellClick,
} from "../components/data-grid/handlers";
import { useHierarchyData } from "../components/hierarchy/hooks/useHierarchyData";
import { useExpandedState } from "../components/hierarchy/hooks/useExpandedState";
import { useBedOperations } from "../components/hierarchy/hooks/useBedOperations";
import { usePersistentSortModel } from "../hooks/usePersistentSortModel";
import { useFieldOperations } from "../components/hierarchy/hooks/useFieldOperations";
import { fieldAPI, bedAPI } from "../api/api";
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
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(
    null,
  );
  const [treeActive, setTreeActive] = useState(false);
  const hasInitiallyExpandedRef = useRef(false);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);

  useCommandContextTag("areas");

  // Data fetching
  const {
    loading,
    error,
    setError,
    locations,
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
  const { addBed, saveBed, deleteBed, pendingEditRow, setPendingEditRow } =
    useBedOperations(beds, setBeds, setError, t);

  // Field operations
  const { addField, deleteField } = useFieldOperations(
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
      setError(t("validation.nameRequired"));
      throw new Error(t("validation.nameRequired"));
    }

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
    return newRow;
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error("Row update error:", error);
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

    if (selectedRow.type === "bed" && selectedRow.bedId) {
      void deleteBed(selectedRow.bedId);
    }

    if (selectedRow.type === "field" && selectedRow.fieldId) {
      void deleteField(selectedRow.fieldId);
    }
  }, [deleteBed, deleteField, selectedRow]);

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

    if (selectedRow.type === "location") {
      return;
    }

    setRowModesModel((previous) => ({
      ...previous,
      [selectedRow.id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  }, [selectedRow]);

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
        isEnabled: () =>
          selectedRow !== null && selectedRow.type !== "location",
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
  }, [expandedRows, rows, selectedRowId, toggleExpand, treeActive]);

  const nameColumnWidth = useMemo(() => {
    const MIN_NAME_WIDTH = 220;
    const CHAR_WIDTH_PX = 8;
    const ICON_GROUP_PX = 120;
    const INDENT_PER_LEVEL_PX = 24;
    const EXTRA_BED_INDENT_PX = 34;

    const hierarchyEntries: Array<{ name: string; level: number; type: string }> =
      [];
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

    const measuredWidth = hierarchyEntries.reduce((maxWidth, row) => {
      const nameLength = typeof row.name === "string" ? row.name.length : 0;
      const indent =
        row.level * INDENT_PER_LEVEL_PX +
        (row.type === "bed" ? EXTRA_BED_INDENT_PX : 0);
      return Math.max(maxWidth, indent + ICON_GROUP_PX + nameLength * CHAR_WIDTH_PX);
    }, MIN_NAME_WIDTH);

    return Math.min(520, Math.max(MIN_NAME_WIDTH, measuredWidth));
  }, [hierarchyIndex]);

  /**
   * Create columns with callbacks
   */
  const columns = useMemo(() => {
    return createHierarchyColumns(
      toggleExpand,
      handleAddBed,
      (bedId) => deleteBed(bedId),
      (locationId) => {
        const fieldName = window.prompt(t("dialogs.addField.nameLabel"));
        if (fieldName !== null) {
          void addField(locationId, fieldName);
        }
      },
      (fieldId) => deleteField(fieldId),
      handleCreatePlantingPlan,
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
    deleteBed,
    addField,
    deleteField,
    handleCreatePlantingPlan,
    notesEditor.handleOpen,
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

  const rowSelectionModel = useMemo(
    () => ({
      type: "include" as const,
      ids: new Set(selectedRowId ? [selectedRowId] : []),
    }),
    [selectedRowId],
  );

  return (
    <div className={showTitle ? "page-container" : undefined}>
      <Box sx={{ width: "100%", minWidth: 0 }}>
        {showTitle && <h1>{t("title")}</h1>}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
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
            onRowEditStop={handleRowEditStop}
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
              setSelectedRowId(params.id);
              setTreeActive(true);
              handleEditableCellClick(params, rowModesModel, setRowModesModel);
            }}
            localeText={germanDataGridLocaleText}
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
    </div>
  );
}

export default FieldsBedsHierarchy;
