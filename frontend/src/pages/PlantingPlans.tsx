/**
 * Planting Plans (Anbaupläne) page component.
 *
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 *
 * @returns The Planting Plans page component
 */

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type {
  GridCellParams,
  GridColDef,
  GridRenderEditCellParams,
  GridValueOptionsParams,
} from "@mui/x-data-grid";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { useTranslation } from "../i18n";
import {
  getAllowedCultivationTypesForCulture,
  normalizeCultivationType,
  resolveCultivationTypeForAllowedOptions,
} from "./plantingPlansUtils";
import PageContainer from "../components/layout/PageContainer";
import PageSurface from "../components/layout/PageSurface";
import {
  plantingPlanAPI,
  cultureAPI,
  bedAPI,
  fieldAPI,
  locationAPI,
  type PlantingPlan,
  type Culture,
  type Bed,
} from "../api/api";
import type { CultivationType, Field, Location } from "../api/types";
import { extractApiErrorMessage } from "../api/errors";
import {
  formatLocalizedNumber,
  parseLocalizedNumber,
  resolveLocaleFromLanguage,
} from "../utils/numberLocalization";
import { AreaM2EditCell } from "../components/data-grid/AreaM2EditCell";
import {
  EditableDataGrid,
  createSingleSelectColumn,
  getCalculatedColumnProps,
  ContextMenuHint,
  type EditableRow,
  type DataGridAPI,
  type SearchableSelectOption,
  type EditableDataGridCommandApi,
  getPlainExcerpt,
} from "../components/data-grid";
import { MobileCardList } from "../components/mobile/MobileCardList";
import { NotesDrawer } from "../components/data-grid/NotesDrawer";
import ProjectRequiredState from "../components/project/ProjectRequiredState";
import {
  useCommandContextTag,
  useRegisterCommands,
  useRegisterCreateActions,
} from "../commands/useCommandContext";
import type { CommandSpec } from "../commands/types";
import { useProjectRequirement } from "../hooks/useProjectRequirement";
import { getFirstMissingCultivationPlanRequirement, getProjectSetupAction, getProjectSetupActions } from "./requirementFlow";
import { AreaAssignmentDialog } from "../components/planting-plans/AreaAssignmentDialog";
import { CompactAreaCell } from "../components/planting-plans/CompactAreaCell";
import EmptyStateCard from "../components/project/EmptyStateCard";

const AREA_LABEL_SEPARATOR = " | ";
const DATA_GRID_HEADER_LABEL_SX = { fontWeight: 600 };

export const buildAreaColumnHeaderLabel = (
  includeLocation: boolean,
  locationLabel: string,
  fieldLabel: string,
  bedLabel: string,
): string =>
  includeLocation
    ? `${locationLabel}${AREA_LABEL_SEPARATOR}${fieldLabel}${AREA_LABEL_SEPARATOR}${bedLabel}`
    : `${fieldLabel}${AREA_LABEL_SEPARATOR}${bedLabel}`;

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
  location_id?: number;
  field_id?: number;
  area_m2?: number;
  plants_count?: number | null; // UI-only derived field
  note_attachment_count?: number;
}

interface MobileCreateFormState {
  culture: string;
  bed: string;
  cultivation_type: CultivationType | "";
  planting_date: string;
  area_m2: string;
  plants_count: string;
  notes: string;
}
interface AreaValidationDialogState {
  rowId: number;
  requestedArea: number;
  availableArea: number;
  bedArea: number;
  occupiedArea: number;
  cultureId?: number;
  plantsCount?: number | null;
  mode: "bedLimit" | "remainingLimit" | "noRemainingArea";
}

const AREA_VALIDATION_CLOSE_SUPPRESSION_MS = 250;

const CULTIVATION_TYPE_OPTIONS = [
  {
    value: "direct_sowing",
    labelKey: "plantingPlans:cultivationTypes.directSowing",
  },
  {
    value: "pre_cultivation",
    labelKey: "plantingPlans:cultivationTypes.preCultivation",
  },
] as const;

const CULTURE_COLUMN_MAX_WIDTH = 280;
const BED_COLUMN_MAX_WIDTH = 220;
const PLANTING_PLANS_CONTEXT_MENU_HINT_STORAGE_KEY = "ofp.plantingPlansContextMenuHintSeen";

const estimateColumnWidth = (
  values: string[],
  min: number,
  max: number,
): number => {
  const longest = values.reduce(
    (length, value) => Math.max(length, value.length),
    0,
  );
  const estimated = longest * 8 + 52;
  return Math.max(min, Math.min(max, estimated));
};

const formatAreaM2 = (value: number, locale: string): string =>
  `${formatLocalizedNumber(value, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\u00a0m²`;

const toIsoDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
};

function PlantingDateEditCell(params: GridRenderEditCellParams): React.ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputValue = toIsoDateString(params.value) ?? "";

  useEffect(() => {
    if (!params.hasFocus) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [params.hasFocus]);

  return (
    <TextField
      type="date"
      fullWidth
      size="small"
      inputRef={inputRef}
      value={inputValue}
      slotProps={{
        htmlInput: {
          tabIndex: params.hasFocus ? 0 : -1,
        },
      }}
      onChange={async (event) => {
        const nextValue = event.target.value
          ? new Date(`${event.target.value}T00:00:00`)
          : null;
        await params.api.setEditCellValue({
          id: params.id,
          field: params.field,
          value: nextValue,
        });
      }}
    />
  );
}

const toDateKey = (value: unknown): number | null => {
  const buildDateKey = (year: number, month: number, day: number): number | null => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.getTime();
  };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildDateKey(Number(year), Number(month), Number(day));
  }
  const germanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    return buildDateKey(Number(year), Number(month), Number(day));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};
const toAreaNumericValue = (value: unknown, locale: string): number | null => {
  const directNumeric = toNumericValue(value);
  if (directNumeric !== null) {
    return directNumeric;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace("m²", "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return null;
  }
  const localized = parseLocalizedNumber(normalized, locale);
  return localized === null ? null : localized;
};

const isAutoAreaRequest = (value: unknown, maxKeyword: string): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === maxKeyword.trim().toLowerCase() || normalized === "maximum";
};

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
};

interface HierarchySelectionRow {
  location_id?: number;
  field_id?: number;
  bed?: number | string;
}

export const normalizeSelectionAfterLocationChange = (
  row: HierarchySelectionRow,
  nextLocationId: number,
  fields: Field[],
  beds: Bed[],
): HierarchySelectionRow => {
  const selectedField =
    typeof row.field_id === "number"
      ? fields.find((field) => field.id === row.field_id)
      : undefined;
  const nextFieldId =
    selectedField && selectedField.location === nextLocationId
      ? selectedField.id
      : undefined;

  const selectedBed =
    typeof row.bed === "number"
      ? beds.find((bed) => bed.id === row.bed)
      : undefined;
  const selectedBedField =
    selectedBed && typeof selectedBed.field === "number"
      ? fields.find((field) => field.id === selectedBed.field)
      : undefined;
  const nextBedId =
    selectedBed &&
    selectedBedField &&
    selectedBedField.location === nextLocationId &&
    (!nextFieldId || selectedBed.field === nextFieldId)
      ? selectedBed.id
      : 0;

  return {
    ...row,
    location_id: nextLocationId,
    field_id: nextFieldId,
    bed: nextBedId,
  };
};

export const normalizeSelectionAfterFieldChange = (
  row: HierarchySelectionRow,
  nextFieldId: number,
  fields: Field[],
  beds: Bed[],
): HierarchySelectionRow => {
  const selectedField = fields.find((field) => field.id === nextFieldId);
  const selectedBed =
    typeof row.bed === "number"
      ? beds.find((bed) => bed.id === row.bed)
      : undefined;
  const nextBedId =
    selectedBed && selectedBed.field === nextFieldId ? selectedBed.id : 0;

  return {
    ...row,
    location_id: selectedField?.location ?? row.location_id,
    field_id: nextFieldId,
    bed: nextBedId,
  };
};

export const normalizeSelectionAfterBedChange = (
  row: HierarchySelectionRow,
  nextBedId: number,
  fields: Field[],
  beds: Bed[],
): HierarchySelectionRow => {
  const selectedBed = beds.find((bed) => bed.id === nextBedId);
  const selectedField = selectedBed
    ? fields.find((field) => field.id === selectedBed.field)
    : undefined;
  return {
    ...row,
    location_id: selectedField?.location ?? row.location_id,
    field_id: selectedBed?.field ?? row.field_id,
    bed: nextBedId,
  };
};

interface HierarchyAvailability {
  fieldIdsWithBeds: Set<number>;
  locationIdsWithBeds: Set<number>;
}

export const collectHierarchyAvailability = (
  fields: Field[],
  beds: Bed[],
): HierarchyAvailability => {
  const fieldIdsWithBeds = new Set<number>();
  beds.forEach((bed) => {
    if (typeof bed.field === "number") {
      fieldIdsWithBeds.add(bed.field);
    }
  });

  const locationIdsWithBeds = new Set<number>();
  fields.forEach((field) => {
    if (field.id !== undefined && fieldIdsWithBeds.has(field.id)) {
      locationIdsWithBeds.add(field.location);
    }
  });

  return { fieldIdsWithBeds, locationIdsWithBeds };
};

export const filterFieldOptionsByLocation = (
  rowLocationId: number | null,
  fields: Field[],
  fieldIdsWithBeds: Set<number>,
): Field[] =>
  fields.filter((field) => {
    if (field.id === undefined || !fieldIdsWithBeds.has(field.id)) {
      return false;
    }
    return rowLocationId ? field.location === rowLocationId : true;
  });

export const filterBedOptionsBySelection = (
  rowLocationId: number | null,
  rowFieldId: number | null,
  fields: Field[],
  beds: Bed[],
  fieldIdsWithBeds: Set<number>,
): Bed[] =>
  beds.filter((bed) => {
    if (bed.id === undefined || !fieldIdsWithBeds.has(bed.field)) {
      return false;
    }
    if (rowFieldId) {
      return bed.field === rowFieldId;
    }
    if (rowLocationId) {
      const linkedField = fields.find((field) => field.id === bed.field);
      return linkedField?.location === rowLocationId;
    }
    return true;
  });

export const buildBedDisplayLabel = (
  locationName: string | null | undefined,
  fieldName: string | null | undefined,
  bedName: string | null | undefined,
  areaSqm: number | null,
  includeLocation: boolean,
  locale: string,
): string => {
  const normalizedLocationName = (locationName ?? "").trim();
  const normalizedBedName = (bedName ?? "").trim();
  const normalizedFieldName = (fieldName ?? "").trim();
  const combinedName = [
    includeLocation ? normalizedLocationName : "",
    normalizedFieldName,
    normalizedBedName,
  ]
    .filter((part) => part.length > 0)
    .join(AREA_LABEL_SEPARATOR);

  if (!combinedName) {
    return "—";
  }

  if (areaSqm === null) {
    return combinedName;
  }

  return `${combinedName} (${formatAreaM2(areaSqm, locale)})`;
};

export const resolveBedCellValue = (
  value: unknown,
  row: HierarchySelectionRow,
): number => {
  const cellBedId = toNumericValue(value);
  if (cellBedId !== null) {
    return cellBedId;
  }

  const rowBedId = toNumericValue(row.bed);
  return rowBedId ?? 0;
};

const createEmptyMobileCreateForm = (): MobileCreateFormState => ({
  culture: "",
  bed: "",
  cultivation_type: "",
  planting_date: "",
  area_m2: "",
  plants_count: "",
  notes: "",
});

export const getVisibleMobileRows = (
  rows: PlantingPlanRow[],
): PlantingPlanRow[] => rows.filter((row) => !row.isNew);

const areRowsSemanticallyEqual = (
  previousRows: PlantingPlanRow[],
  nextRows: PlantingPlanRow[],
): boolean => {
  if (previousRows.length !== nextRows.length) {
    return false;
  }

  return previousRows.every((previousRow, index) => {
    const nextRow = nextRows[index];
    return (
      previousRow.id === nextRow.id &&
      previousRow.bed === nextRow.bed &&
      previousRow.area_m2 === nextRow.area_m2 &&
      previousRow.plants_count === nextRow.plants_count &&
      previousRow.notes === nextRow.notes &&
      previousRow.culture === nextRow.culture &&
      previousRow.cultivation_type === nextRow.cultivation_type &&
      previousRow.planting_date === nextRow.planting_date &&
      previousRow.harvest_date === nextRow.harvest_date &&
      previousRow.harvest_end_date === nextRow.harvest_end_date
    );
  });
};

export const buildMobileCreateForm = (
  locale: string,
  beds: Bed[],
  prefill?: { cultureId?: number | null; bedId?: number | null },
): MobileCreateFormState => {
  const baseForm = createEmptyMobileCreateForm();
  const prefilledBed =
    typeof prefill?.bedId === "number"
      ? beds.find((bed) => bed.id === prefill.bedId)
      : undefined;
  const prefilledArea = toNumericValue(prefilledBed?.area_sqm);

  return {
    ...baseForm,
    culture:
      typeof prefill?.cultureId === "number" ? String(prefill.cultureId) : "",
    bed: typeof prefill?.bedId === "number" ? String(prefill.bedId) : "",
    cultivation_type: "pre_cultivation",
    area_m2:
      prefilledArea !== null
        ? formatLocalizedNumber(prefilledArea, locale, {
            useGrouping: false,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })
        : "",
  };
};

function PlantingPlans(): React.ReactElement {
  const { t } = useTranslation(["plantingPlans", "common"]);
  const { i18n } = useTranslation();
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [areaNotice, setAreaNotice] = useState<{
    message: string;
    severity: "info" | "warning";
  } | null>(null);
  const [areaValidationDialog, setAreaValidationDialog] = useState<AreaValidationDialogState | null>(null);
  const urlParamProcessedRef = useRef<boolean>(false);
  const gridCommandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlantingPlanRow | null>(
    null,
  );
  const [mobileRows, setMobileRows] = useState<PlantingPlanRow[]>([]);
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(true);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<number | string>>(
    new Set(),
  );
  const [isMobileCreateOpen, setIsMobileCreateOpen] = useState(false);
  const [mobileCreateForm, setMobileCreateForm] = useState<MobileCreateFormState>(
    () => createEmptyMobileCreateForm(),
  );
  const [mobileCreateError, setMobileCreateError] = useState("");
  const [mobileEditId, setMobileEditId] = useState<number | null>(null);
  const [mobileLastEditedField, setMobileLastEditedField] = useState<
    "area_m2" | "plants_count" | null
  >(null);
  const [isMobileNotesOpen, setIsMobileNotesOpen] = useState(false);
  const [mobileNotesTarget, setMobileNotesTarget] = useState<PlantingPlanRow | null>(null);
  const [mobileNotesDraft, setMobileNotesDraft] = useState("");
  const [isMobileNotesSaving, setIsMobileNotesSaving] = useState(false);
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);
  const mobilePrefillHandledRef = useRef(false);
  const createIntentHandledRef = useRef(false);

  const replacePlantingPlanSearchParams = useCallback((nextParams: URLSearchParams): void => {
    const browserPathname = window.location.pathname;
    if (browserPathname.includes("/app/") && !browserPathname.endsWith(location.pathname)) {
      return;
    }

    const nextSearch = nextParams.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch === currentSearch) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (isMobile) {
      document.body.classList.add("hide-version-footer");
    } else {
      document.body.classList.remove("hide-version-footer");
    }
    return () => {
      document.body.classList.remove("hide-version-footer");
    };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || shouldShowProjectRequiredState) {
      return;
    }
    if (window.localStorage.getItem(PLANTING_PLANS_CONTEXT_MENU_HINT_STORAGE_KEY) === "1") {
      return;
    }
    window.localStorage.setItem(PLANTING_PLANS_CONTEXT_MENU_HINT_STORAGE_KEY, "1");
    setShowContextMenuHint(true);
  }, [isMobile, shouldShowProjectRequiredState]);

  useCommandContextTag("plans");

  // Track which field was last edited (for determining API payload)
  const lastEditedFieldRef = useRef<"area_m2" | "plants_count" | null>(null);
  const areaValidationDialogRef = useRef<AreaValidationDialogState | null>(null);
  const suppressAreaValidationSaveRef = useRef(false);
  const areaValidationCloseTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearAreaValidationCloseTimer = useCallback((): void => {
    if (areaValidationCloseTimerRef.current === null) {
      return;
    }
    window.clearTimeout(areaValidationCloseTimerRef.current);
    areaValidationCloseTimerRef.current = null;
  }, []);

  const suppressAreaValidationSaveCycle = useCallback((): void => {
    suppressAreaValidationSaveRef.current = true;
    clearAreaValidationCloseTimer();
    areaValidationCloseTimerRef.current = window.setTimeout(() => {
      suppressAreaValidationSaveRef.current = false;
      areaValidationCloseTimerRef.current = null;
    }, AREA_VALIDATION_CLOSE_SUPPRESSION_MS);
  }, [clearAreaValidationCloseTimer]);

  const openAreaValidationDialog = useCallback((dialog: AreaValidationDialogState): void => {
    clearAreaValidationCloseTimer();
    suppressAreaValidationSaveRef.current = false;
    areaValidationDialogRef.current = dialog;
    setAreaValidationDialog(dialog);
  }, [clearAreaValidationCloseTimer]);

  const closeAreaValidationDialog = useCallback((): void => {
    areaValidationDialogRef.current = null;
    suppressAreaValidationSaveCycle();
    setAreaValidationDialog(null);
  }, [suppressAreaValidationSaveCycle]);

  useEffect(() => () => {
    clearAreaValidationCloseTimer();
  }, [clearAreaValidationCloseTimer]);

  const cultureOptions: SearchableSelectOption[] = useMemo(
    () =>
      cultures
        .filter((c) => c.id !== undefined)
        .map((c) => ({
          value: c.id!,
          label: c.variety ? `${c.name} (${c.variety})` : c.name,
        })),
    [cultures],
  );

  const locationById = useMemo(
    () => new Map(locations.filter((location) => location.id !== undefined).map((location) => [location.id!, location])),
    [locations],
  );

  const fieldById = useMemo(
    () => new Map(fields.filter((field) => field.id !== undefined).map((field) => [field.id!, field])),
    [fields],
  );

  const bedById = useMemo(
    () => new Map(beds.filter((bed) => bed.id !== undefined).map((bed) => [bed.id!, bed])),
    [beds],
  );

  const hierarchyAvailability = useMemo(
    () => collectHierarchyAvailability(fields, beds),
    [fields, beds],
  );

  const bedOptions: SearchableSelectOption[] = useMemo(
    () => {
      const locationIdsWithBeds = new Set<number>();
      beds.forEach((bed) => {
        const field = fieldById.get(bed.field);
        if (field) {
          locationIdsWithBeds.add(field.location);
        }
      });
      const includeLocation = locationIdsWithBeds.size > 1;

      return beds
        .filter((b) => b.id !== undefined)
        .filter((bed) => hierarchyAvailability.fieldIdsWithBeds.has(bed.field))
        .map((b) => {
          const field = fieldById.get(b.field);
          const locationName = field
            ? locationById.get(field.location)?.name
            : null;
          const normalizedAreaSqm = toNumericValue(b.area_sqm);
          return {
            value: b.id!,
            label: buildBedDisplayLabel(
              locationName,
              b.field_name ?? field?.name,
              b.name,
              normalizedAreaSqm,
              includeLocation,
              numberLocale,
            ),
          };
        });
    },
    [beds, fieldById, hierarchyAvailability.fieldIdsWithBeds, locationById, numberLocale],
  );

  const bedLabelById = useMemo(
    () => new Map(bedOptions.map((option) => [option.value as number, option.label])),
    [bedOptions],
  );

  const cultivationTypeOptions = useMemo(
    () =>
      CULTIVATION_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const fieldBedColumnLabel = useMemo(
    () =>
      t("plantingPlans:columns.fieldBed", {
        separator: AREA_LABEL_SEPARATOR,
      }),
    [t],
  );

  const hasMultipleLocationsWithBeds = useMemo(() => {
    const fieldById = new Map(
      fields
        .filter((item) => item.id !== undefined)
        .map((item) => [item.id as number, item]),
    );
    const locationIdsWithBeds = new Set<number>();
    beds.forEach((bed) => {
      const field = fieldById.get(bed.field);
      if (field) {
        locationIdsWithBeds.add(field.location);
      }
    });
    return locationIdsWithBeds.size > 1;
  }, [beds, fields]);

  const areaColumnLabel = useMemo(
    () =>
      buildAreaColumnHeaderLabel(
        hasMultipleLocationsWithBeds,
        t("plantingPlans:columns.location"),
        t("plantingPlans:columns.field"),
        t("plantingPlans:columns.bed"),
      ),
    [hasMultipleLocationsWithBeds, t],
  );

  const getCultivationTypeOptionsForRow = useMemo(
    () => (row: PlantingPlanRow) => {
      const selectedCulture = cultures.find((culture) => culture.id === row.culture);
      const allowedTypes = getAllowedCultivationTypesForCulture(selectedCulture);

      return cultivationTypeOptions.filter((option) =>
        allowedTypes.includes(option.value as CultivationType),
      );
    },
    [cultivationTypeOptions, cultures],
  );

  const dynamicWidths = useMemo(() => {
    const cultureWidth = estimateColumnWidth(
      [
        t("plantingPlans:columns.culture"),
        ...cultureOptions.map((option) => option.label),
      ],
      170,
      240,
    );
    const hierarchyColumnValues = [
      t("plantingPlans:columns.bed"),
      ...Array.from(new Set(bedOptions.map((option) => option.label))),
    ];
    const bedWidth = estimateColumnWidth(
      hierarchyColumnValues,
      hasMultipleLocationsWithBeds ? 210 : 160,
      hasMultipleLocationsWithBeds ? 380 : 300,
    );

    return {
      culture: cultureWidth,
      bed: bedWidth,
      cultivationType: estimateColumnWidth(
        [
          t("plantingPlans:columns.cultivationType"),
          ...cultivationTypeOptions.map((option) => option.label),
        ],
        110,
        150,
      ),
      plantingDate: estimateColumnWidth(
        [t("plantingPlans:columns.plantingDate"), "2026-12-31"],
        110,
        130,
      ),
      harvestDate: estimateColumnWidth(
        [t("plantingPlans:columns.harvestStartDate"), "2026-12-31"],
        112,
        135,
      ),
      harvestEndDate: estimateColumnWidth(
        [t("plantingPlans:columns.harvestEndDate"), "2026-12-31"],
        112,
        135,
      ),
      area: estimateColumnWidth(
        [
          t("plantingPlans:columns.areaM2"),
          ...beds
            .filter((bed) => typeof bed.area_sqm === "number")
            .map((bed) => formatAreaM2(bed.area_sqm as number, numberLocale)),
        ],
        95,
        120,
      ),
      plants: estimateColumnWidth(
        [t("plantingPlans:columns.plantsCount"), "≈ 9999"],
        96,
        122,
      ),
      notes: 220,
    };
  }, [bedOptions, beds, cultivationTypeOptions, cultureOptions, hasMultipleLocationsWithBeds, numberLocale, t]);

  const getBedLabelForRow = useCallback(
    (row: PlantingPlanRow | null | undefined): string => {
      if (!row) {
        return "—";
      }

      const bedId = resolveBedCellValue(row.bed, row);
      const linkedBed = bedById.get(bedId);
      const linkedField = linkedBed ? fieldById.get(linkedBed.field) : undefined;
      const locationName = linkedField
        ? locationById.get(linkedField.location)?.name
        : toOptionalString(row.location_name);

      if (linkedBed) {
        return buildBedDisplayLabel(
          locationName,
          linkedBed.field_name ?? linkedField?.name ?? toOptionalString(row.field_name),
          linkedBed.name,
          toNumericValue(linkedBed.area_sqm),
          hasMultipleLocationsWithBeds,
          numberLocale,
        );
      }

      return buildBedDisplayLabel(
        toOptionalString(row.location_name),
        toOptionalString(row.field_name),
        toOptionalString(row.bed_name),
        null,
        hasMultipleLocationsWithBeds,
        numberLocale,
      );
    },
    [
      bedById,
      fieldById,
      hasMultipleLocationsWithBeds,
      locationById,
      numberLocale,
    ],
  );


  /**
   * Check for cultureId or bedId parameter in URL and set as initial values
   */
  const [initialSelection] = useState(() => {
    const cultureIdParam = searchParams.get("cultureId");
    const bedIdParam = searchParams.get("bedId");
    let cultureId: number | null = null;
    let bedId: number | null = null;

    if (cultureIdParam) {
      const parsedCultureId = parseInt(cultureIdParam, 10);
      if (!isNaN(parsedCultureId)) {
        cultureId = parsedCultureId;
      }
    }

    if (bedIdParam) {
      const parsedBedId = parseInt(bedIdParam, 10);
      if (!isNaN(parsedBedId)) {
        bedId = parsedBedId;
      }
    }

    return { cultureId, bedId };
  });

  useEffect(() => {
    if (urlParamProcessedRef.current) {
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    let hasChanges = false;

    if (initialSelection.cultureId !== null) {
      newParams.delete("cultureId");
      hasChanges = true;
    }

    if (initialSelection.bedId !== null) {
      newParams.delete("bedId");
      hasChanges = true;
    }

    if (hasChanges) {
      replacePlantingPlanSearchParams(newParams);
    }

    urlParamProcessedRef.current = true;
  }, [initialSelection, replacePlantingPlanSearchParams, searchParams]);

  /**
   * Fetch cultures and beds for dropdowns
   */
  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setCultures([]);
      setLocations([]);
      setFields([]);
      setBeds([]);
      setIsHierarchyLoading(false);
      return;
    }
    const fetchData = async (): Promise<void> => {
      setIsHierarchyLoading(true);
      try {
        const [culturesResponse, locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
          cultureAPI.list(),
          locationAPI.list(),
          fieldAPI.list(),
          bedAPI.list(),
        ]);
        setCultures(culturesResponse.data.results);
        setLocations(locationsResponse.data.results);
        setFields(fieldsResponse.data.results);
        setBeds(
          bedsResponse.data.results.map((bed) => ({
            ...bed,
            area_sqm: toNumericValue(bed.area_sqm) ?? undefined,
          })),
        );
      } catch (err) {
        console.error("Error fetching hierarchy data:", err);
      } finally {
        setIsHierarchyLoading(false);
      }
    };
    fetchData();
  }, [shouldShowProjectRequiredState]);

  /**
   * Define columns for the Data Grid with inline editing
   * Recalculates when cultures or beds change to update dropdown options
   */
  const commands = useMemo<CommandSpec[]>(
    () => [
      {
        id: "plans.edit",
        label: "Anbauplan bearbeiten (Alt+E)",
        group: 'navigation',
        keywords: ["anbauplan", "bearbeiten", "edit"],
        shortcutHint: "Alt+E",
        keys: { alt: true, key: "e" },
        contextTags: ["plans"],
        isEnabled: () => selectedPlan !== null,
        action: () => gridCommandApiRef.current?.editSelectedRow(),
      },
      {
        id: "plans.delete",
        label: "Anbauplan löschen (Alt+Shift+D)",
        group: 'navigation',
        keywords: ["anbauplan", "löschen", "delete"],
                keys: { key: "Delete" },
        contextTags: ["plans"],
        isEnabled: () => selectedPlan !== null,
        action: () => gridCommandApiRef.current?.deleteSelectedRow(),
      },
    ],
    [selectedPlan],
  );

  useRegisterCommands("plans-page", commands);

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer>
        <ProjectRequiredState reason={missingProjectReason} />
      </PageContainer>
    );
  }

  const columns: GridColDef[] = useMemo(
    () => [
      {
        ...createSingleSelectColumn<PlantingPlanRow>({
          field: "culture",
          headerName: t("plantingPlans:columns.culture"),
          flex: 0,
          minWidth: dynamicWidths.culture,
          maxWidth: CULTURE_COLUMN_MAX_WIDTH,
          truncateCellText: true,
          options: cultureOptions,
        }),
        valueSetter: (value, row) => {
          const nextRow = row as PlantingPlanRow;
          const numericValue =
            typeof value === "number" ? value : Number(value);
          const selectedCulture = cultures.find(
            (culture) => culture.id === numericValue,
          );
          const availableTypes =
            getAllowedCultivationTypesForCulture(selectedCulture);
          const nextCultivationType = resolveCultivationTypeForAllowedOptions(
            availableTypes,
            nextRow.cultivation_type,
          );

          return {
            ...nextRow,
            culture: numericValue,
            cultivation_type: nextCultivationType,
          } as PlantingPlanRow;
        },
      },
      {
        field: "cultivation_type",
        headerName: t("plantingPlans:columns.cultivationType"),
        flex: 0,
        minWidth: dynamicWidths.cultivationType,
        editable: true,
        type: "singleSelect",
        valueOptions: (params: GridValueOptionsParams<PlantingPlanRow>) => {
          const row = params.row as PlantingPlanRow | undefined;
          if (!row) {
            return cultivationTypeOptions;
          }
          return getCultivationTypeOptionsForRow(row);
        },
        valueFormatter: (value) => {
          const stringValue = typeof value === "string" ? value : "";
          const option = cultivationTypeOptions.find(
            (item) => item.value === (stringValue as CultivationType),
          );
          return option?.label ?? "";
        },
        renderCell: (params) => {
          const formattedValue =
            typeof params.formattedValue === "string" ? params.formattedValue : "";
          return formattedValue;
        },
        renderEditCell: (params) => {
          const row = params.row as PlantingPlanRow;
          const options = getCultivationTypeOptionsForRow(row);
          const selectedValue = normalizeCultivationType(params.value) ?? "";

          return (
            <TextField
              select
              fullWidth
              size="small"
              autoFocus={params.hasFocus}
              value={selectedValue}
              slotProps={{
                htmlInput: {
                  tabIndex: params.hasFocus ? 0 : -1,
                },
              }}
              onChange={async (event) => {
                await params.api.setEditCellValue({
                  id: params.id,
                  field: params.field,
                  value: event.target.value,
                });
              }}
            >
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          );
        },
        valueSetter: (value, row) => {
          const nextRow = row as PlantingPlanRow;
          const selectedCulture = cultures.find(
            (culture) => culture.id === nextRow.culture,
          );
          const allowedTypes =
            getAllowedCultivationTypesForCulture(selectedCulture);
          const nextType = normalizeCultivationType(value);

          return {
            ...row,
            cultivation_type: nextType && allowedTypes.includes(nextType)
              ? nextType
              : resolveCultivationTypeForAllowedOptions(
                allowedTypes,
                nextRow.cultivation_type,
              ),
          };
        },
        preProcessEditCellProps: (params) => ({
          ...params.props,
          error: !params.props.value,
        }),
      },
      {
        field: "bed",
          headerName: areaColumnLabel,
        flex: 0,
        minWidth: dynamicWidths.bed,
        maxWidth: BED_COLUMN_MAX_WIDTH,
        editable: true,
        type: "singleSelect",
        valueOptions: bedOptions,
        valueFormatter: (_value, row) => getBedLabelForRow(row as PlantingPlanRow),
        sortComparator: (_value1, _value2, cellParams1, cellParams2) => {
          const row1 = cellParams1.api.getRow(cellParams1.id) as PlantingPlanRow | null;
          const row2 = cellParams2.api.getRow(cellParams2.id) as PlantingPlanRow | null;
          return getBedLabelForRow(row1).localeCompare(
            getBedLabelForRow(row2),
            "de",
          );
        },
        renderCell: (params) => {
          const row = params.row as PlantingPlanRow;
          const label = getBedLabelForRow(row);
          return <CompactAreaCell label={label} hasFocus={params.hasFocus} />;
        },
        renderEditCell: (params) => {
          const row = params.row as PlantingPlanRow;
          const bedId = resolveBedCellValue(params.value, row);
          const label = getBedLabelForRow({ ...row, bed: bedId });
          return (
            <AreaAssignmentDialog
              bedId={bedId || null}
              beds={beds}
              fields={fields}
              locations={locations}
              locale={numberLocale}
              compactLabel={label}
              hasFocus={params.hasFocus}
              onApply={async (nextBedId) => {
                await params.api.setEditCellValue({
                  id: params.id,
                  field: "bed",
                  value: nextBedId,
                });
              }}
            />
          );
        },
        valueSetter: (value, row) => {
          const nextRow = row as PlantingPlanRow;
          const numericValue = resolveBedCellValue(value, nextRow);
          const selectedBed = bedById.get(numericValue);
          const isNewRow = Boolean(nextRow.isNew);
          const currentArea = nextRow.area_m2;
          const shouldAutofill = isNewRow && (currentArea === undefined || currentArea === null);

          return {
            ...nextRow,
            ...normalizeSelectionAfterBedChange(nextRow, numericValue, fields, beds),
            area_m2:
              shouldAutofill && selectedBed?.area_sqm !== undefined
                ? selectedBed.area_sqm
                : currentArea,
          } as PlantingPlanRow;
        },
      },
      {
        field: "planting_date",
        headerName: t("plantingPlans:columns.plantingDate"),
        flex: 0,
        minWidth: dynamicWidths.plantingDate,
        type: "date",
        editable: true,
        valueGetter: (value) => (value ? new Date(value) : null),
        renderEditCell: (params) => <PlantingDateEditCell {...params} />,
        preProcessEditCellProps: (params) => {
          const hasError = !params.props.value;
          return { ...params.props, error: hasError };
        },
      },
      {
        field: "harvest_date",
        headerName: t("plantingPlans:columns.harvestStartDate"),
        flex: 0,
        minWidth: dynamicWidths.harvestDate,
        ...getCalculatedColumnProps<PlantingPlanRow>({
          headerName: t("plantingPlans:columns.harvestStartDate"),
          tooltip: t("plantingPlans:tooltips.calculatedHarvestDate"),
        }),
        type: "date",
        valueGetter: (value) => (value ? new Date(value) : null),
      },
      {
        field: "harvest_end_date",
        headerName: t("plantingPlans:columns.harvestEndDate"),
        flex: 0,
        minWidth: dynamicWidths.harvestEndDate,
        ...getCalculatedColumnProps<PlantingPlanRow>({
          headerName: t("plantingPlans:columns.harvestEndDate"),
          tooltip: t("plantingPlans:tooltips.calculatedHarvestDate"),
        }),
        type: "date",
        valueGetter: (value) => (value ? new Date(value) : null),
      },
      {
        field: "area_m2",
        headerName: t("plantingPlans:columns.areaM2"),
        flex: 0,
        minWidth: dynamicWidths.area,
        width: dynamicWidths.area,
        maxWidth: dynamicWidths.area,
        editable: true,
        renderHeader: () => (
          <Tooltip title={t("plantingPlans:tooltips.areaInput")}>
            <Box component="span" sx={DATA_GRID_HEADER_LABEL_SX}>
              {t("plantingPlans:columns.areaM2")}
            </Box>
          </Tooltip>
        ),
        preProcessEditCellProps: (params) => {
          if (params.hasChanged) {
            lastEditedFieldRef.current = "area_m2";
          }
          return params.props;
        },
        renderEditCell: (params) => {
          const row = params.row as PlantingPlanRow;
          const derivedArea = getDerivedAreaFromRow(row);

          return (
            <AreaM2EditCell
              {...params}
              fallbackValue={derivedArea}
              locale={numberLocale}
              maxKeyword={t("plantingPlans:placeholders.maxKeyword")}
              maxPlaceholder={t("plantingPlans:placeholders.maxKeyword")}
              onLastEditedFieldChange={() => {
                lastEditedFieldRef.current = "area_m2";
                setAreaNotice(null);
              }}
            />
          );
        },
        valueFormatter: (value) => {
          const numericValue = Number(value);
          if (!Number.isNaN(numericValue)) {
            return formatAreaM2(numericValue, numberLocale);
          }
          return "";
        },
        headerClassName: "coupled-field-header",
      },
      {
        field: "plants_count",
        headerName: t("plantingPlans:columns.plantsCount"),
        flex: 0,
        minWidth: dynamicWidths.plants,
        editable: true,
        type: "number",
        renderHeader: () => (
          <Tooltip title={t("plantingPlans:tooltips.plantsFromSpacing")}>
            <Box component="span" sx={DATA_GRID_HEADER_LABEL_SX}>
              {t("plantingPlans:columns.plantsCount")}
            </Box>
          </Tooltip>
        ),
        preProcessEditCellProps: (params) => {
          if (params.hasChanged) {
            lastEditedFieldRef.current = "plants_count";
            setAreaNotice(null);
          }
          return params.props;
        },
        valueFormatter: (value) => {
          if (typeof value === "number" && !isNaN(value)) {
            return `≈ ${Math.round(value)}`;
          }
          return "—";
        },
        // Disable editing if culture has no valid spacing
        isCellEditable: (params: GridCellParams<PlantingPlanRow>) => {
          const row = params.row as PlantingPlanRow;
          const culture = cultures.find((c) => c.id === row.culture);
          if (!culture) return false;
          const plantsPerM2 = culture.plants_per_m2;
          return (
            plantsPerM2 !== null && plantsPerM2 !== undefined && plantsPerM2 > 0
          );
        },
        headerClassName: "coupled-field-header",
      },
      {
        field: "notes",
        headerName: t("common:fields.notes"),
        width: 72,
        minWidth: 56,
        maxWidth: 90,
        align: "center",
        headerAlign: "center",
        // Notes field will be overridden by NotesCell in EditableDataGrid
      },
    ],
    [
      bedById,
      bedLabelById,
      bedOptions,
      beds,
      fields,
      locations,
      cultivationTypeOptions,
      getCultivationTypeOptionsForRow,
      cultureOptions,
      cultures,
      dynamicWidths,
      getBedLabelForRow,
      areaColumnLabel,
      fieldBedColumnLabel,
      numberLocale,
      t,
    ],
  );

  const formatDateForDisplay = (value?: string): string => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("de-DE");
  };

  const getCultureLabel = (row: PlantingPlanRow): string => {
    const linkedCulture = cultures.find((culture) => culture.id === row.culture);
    if (row.culture_name) {
      if (linkedCulture?.variety && !row.culture_name.includes(`(${linkedCulture.variety})`)) {
        return `${row.culture_name} (${linkedCulture.variety})`;
      }
      return row.culture_name;
    }
    const fallback = cultureOptions.find((option) => option.value === row.culture);
    return fallback?.label ?? "—";
  };

  const getBedLabel = (row: PlantingPlanRow): string => {
    const fieldById = new Map(
      fields.filter((item) => item.id !== undefined).map((item) => [item.id as number, item]),
    );
    const locationById = new Map(
      locations.filter((item) => item.id !== undefined).map((item) => [item.id as number, item]),
    );
    const locationIdsWithBeds = new Set<number>();
    beds.forEach((item) => {
      const field = fieldById.get(item.field);
      if (field) {
        locationIdsWithBeds.add(field.location);
      }
    });
    const includeLocation = locationIdsWithBeds.size > 1;
    const linkedBed = beds.find((bed) => bed.id === row.bed);
    if (linkedBed) {
      const linkedField = fieldById.get(linkedBed.field);
      const locationName = linkedField
        ? locationById.get(linkedField.location)?.name
        : null;
      return buildBedDisplayLabel(
        locationName,
        linkedBed.field_name ?? linkedField?.name,
        linkedBed.name,
        toNumericValue(linkedBed.area_sqm),
        includeLocation,
        numberLocale,
      );
    }
    if (row.bed_name) {
      return buildBedDisplayLabel(null, null, row.bed_name, null, includeLocation, numberLocale);
    }
    return bedLabelById.get(row.bed) ?? "—";
  };

  const getDisplayArea = (row: PlantingPlanRow): string => {
    const explicitArea = toNumericValue(row.area_m2);
    if (explicitArea !== null) {
      return formatAreaM2(explicitArea, numberLocale);
    }
    if (typeof row.plants_count === "number") {
      const plantsPerSqm = getPlantsPerSqmForCulture(String(row.culture));
      if (plantsPerSqm) {
        return formatAreaM2(row.plants_count / plantsPerSqm, numberLocale);
      }
    }
    return "—";
  };

  const getCultivationTypeLabel = (row: PlantingPlanRow): string => {
    const option = cultivationTypeOptions.find((item) => item.value === row.cultivation_type);
    return option?.label ?? "";
  };

  const getPlantsCountLabel = (row: PlantingPlanRow): string => (
    typeof row.plants_count === "number" && !Number.isNaN(row.plants_count)
      ? `≈ ${Math.round(row.plants_count)}`
      : "—"
  );

  const clipboardColumns = useMemo(() => [
    {
      field: "culture",
      headerName: t("plantingPlans:columns.culture"),
      getValue: getCultureLabel,
    },
    {
      field: "cultivation_type",
      headerName: t("plantingPlans:columns.cultivationType"),
      getValue: getCultivationTypeLabel,
    },
    {
      field: "bed",
      headerName: areaColumnLabel,
      getValue: getBedLabel,
    },
    {
      field: "planting_date",
      headerName: t("plantingPlans:columns.plantingDate"),
      getValue: (row: PlantingPlanRow) => formatDateForDisplay(row.planting_date),
    },
    {
      field: "harvest_date",
      headerName: t("plantingPlans:columns.harvestStartDate"),
      getValue: (row: PlantingPlanRow) => formatDateForDisplay(row.harvest_date),
    },
    {
      field: "harvest_end_date",
      headerName: t("plantingPlans:columns.harvestEndDate"),
      getValue: (row: PlantingPlanRow) => formatDateForDisplay(row.harvest_end_date),
    },
    {
      field: "area_m2",
      headerName: t("plantingPlans:columns.areaM2"),
      getValue: getDisplayArea,
    },
    {
      field: "plants_count",
      headerName: t("plantingPlans:columns.plantsCount"),
      getValue: getPlantsCountLabel,
    },
    {
      field: "notes",
      headerName: t("common:fields.notes"),
      getValue: (row: PlantingPlanRow) => getPlainExcerpt(row.notes ?? "", 120),
    },
  ], [
    areaColumnLabel,
    getBedLabel,
    getCultureLabel,
    getCultivationTypeLabel,
    getDisplayArea,
    getPlantsCountLabel,
    t,
  ]);

  const formatNumberForInput = (
    value: number,
    options?: Intl.NumberFormatOptions,
  ): string =>
    formatLocalizedNumber(value, numberLocale, {
      useGrouping: false,
      maximumFractionDigits: 6,
      ...options,
    });

  const toggleCardExpanded = (id: string | number): void => {
    setExpandedCardIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openMobileCreateDialog = useCallback((
    prefill?: { cultureId?: number | null; bedId?: number | null },
  ): void => {
    setMobileCreateError("");
    setMobileEditId(null);
    setMobileCreateForm(buildMobileCreateForm(numberLocale, beds, prefill));
    setMobileLastEditedField(null);
    setIsMobileCreateOpen(true);
  }, [beds, numberLocale]);

  const closeMobileCreateDialog = (): void => {
    setIsMobileCreateOpen(false);
    setMobileCreateError("");
    setMobileEditId(null);
    setMobileLastEditedField(null);
  };

  useEffect(() => {
    if (!isMobile || mobilePrefillHandledRef.current) {
      return;
    }
    if (initialSelection.cultureId === null && initialSelection.bedId === null) {
      return;
    }
    if (initialSelection.bedId !== null && beds.length === 0) {
      return;
    }
    openMobileCreateDialog({
      cultureId: initialSelection.cultureId,
      bedId: initialSelection.bedId,
    });
    mobilePrefillHandledRef.current = true;
  }, [isMobile, initialSelection.cultureId, initialSelection.bedId, beds.length, openMobileCreateDialog]);

  const openMobileNotesDialog = (row: PlantingPlanRow): void => {
    setMobileNotesTarget(row);
    setMobileNotesDraft(row.notes || "");
    setIsMobileNotesOpen(true);
  };

  const closeMobileNotesDialog = (): void => {
    setIsMobileNotesOpen(false);
    setIsMobileNotesSaving(false);
    setMobileNotesTarget(null);
    setMobileNotesDraft("");
  };

  const saveMobileNotes = async (): Promise<void> => {
    if (isMobileNotesSaving || !mobileNotesTarget?.id) {
      return;
    }

    const targetId = mobileNotesTarget.id;
    const draftToSave = mobileNotesDraft;

    setIsMobileNotesSaving(true);
    try {
      await plantingPlanAPI.patch(targetId, {
        notes: draftToSave,
      } as PlantingPlan);

      await gridCommandApiRef.current?.reload();
      closeMobileNotesDialog();
    } catch (error) {
      setMobileCreateError(
        extractApiErrorMessage(error, t, t("plantingPlans:errors.save")),
      );
    } finally {
      setIsMobileNotesSaving(false);
    }
  };

  const getPlantsPerSqmForCulture = (cultureId: string): number | null => {
    const numericCultureId = Number(cultureId);
    const culture = cultures.find((item) => item.id === numericCultureId);
    if (!culture || !culture.plants_per_m2 || culture.plants_per_m2 <= 0) {
      return null;
    }
    return culture.plants_per_m2;
  };

  const getDerivedAreaFromRow = (row: PlantingPlanRow): number | null => {
    const explicitArea = toNumericValue(row.area_m2);
    if (explicitArea !== null) {
      return explicitArea;
    }
    if (typeof row.plants_count !== "number") {
      return null;
    }
    const plantsPerSqm = getPlantsPerSqmForCulture(String(row.culture ?? ""));
    if (!plantsPerSqm) {
      return null;
    }
    return Number((row.plants_count / plantsPerSqm).toFixed(2));
  };

  const getPlanBedId = (row: PlantingPlanRow): number | null => {
    const rowRecord = row as PlantingPlanRow & {
      bed_id?: unknown;
    };
    const bedValue: unknown = (row as { bed?: unknown }).bed;
    const directBedId = toOptionalNumber(bedValue);
    if (directBedId !== undefined) {
      return directBedId;
    }
    const apiBedId = toOptionalNumber(rowRecord.bed_id);
    if (apiBedId !== undefined) {
      return apiBedId;
    }
    if (
      bedValue &&
      typeof bedValue === "object" &&
      "id" in bedValue
    ) {
      return toOptionalNumber((bedValue as { id?: unknown }).id) ?? null;
    }
    return null;
  };

  const isSamePlanRow = (rowA: PlantingPlanRow, rowB: PlantingPlanRow): boolean =>
    rowA === rowB || (typeof rowA.id === "number" && typeof rowB.id === "number" && rowA.id === rowB.id);

  const datesOverlap = (rowA: PlantingPlanRow, rowB: PlantingPlanRow): boolean => {
    const startA = toDateKey(rowA.planting_date);
    const startB = toDateKey(rowB.planting_date);
    if (startA === null || startB === null) {
      return false;
    }
    const endA = toDateKey(rowA.harvest_end_date) ?? toDateKey(rowA.harvest_date) ?? Number.MAX_SAFE_INTEGER;
    const endB = toDateKey(rowB.harvest_end_date) ?? toDateKey(rowB.harvest_date) ?? Number.MAX_SAFE_INTEGER;
    return startA <= endB && startB <= endA;
  };

  const getCapacityForRow = (row: PlantingPlanRow): {
    bedArea: number;
    occupiedArea: number;
    availableArea: number;
  } | null => {
    const rowBedId = getPlanBedId(row);
    if (rowBedId === null) {
      return null;
    }
    const selectedBed = bedById.get(rowBedId);
    const bedArea = toNumericValue(selectedBed?.area_sqm);
    if (bedArea === null) {
      return null;
    }
    const occupiedArea = mobileRows
      .filter((item) => getPlanBedId(item) === rowBedId && !isSamePlanRow(item, row) && datesOverlap(item, row))
      .reduce((total, item) => total + Math.max(0, toAreaNumericValue(item.area_m2 ?? item.area_usage_sqm, numberLocale) ?? 0), 0);
    return {
      bedArea,
      occupiedArea,
      availableArea: Math.max(0, bedArea - occupiedArea),
    };
  };

  const buildAreaAndPlantsDraft = (
    row: Pick<PlantingPlanRow, "culture" | "plants_count"> | undefined,
    nextArea: number,
    fallbackCultureId?: number,
    fallbackPlantsCount?: number | null,
  ): Pick<PlantingPlanRow, "area_m2" | "plants_count"> => {
    const normalizedArea = Number(nextArea.toFixed(2));
    const cultureId = row?.culture ?? fallbackCultureId;
    const culture = cultures.find((item) => item.id === cultureId);
    const plantsPerSqm = culture?.plants_per_m2;
    return {
      area_m2: normalizedArea,
      plants_count: plantsPerSqm && plantsPerSqm > 0 ? Math.round(normalizedArea * plantsPerSqm) : row?.plants_count ?? fallbackPlantsCount,
    };
  };

  const applyAreaAndPlants = async (
    rowId: number,
    nextArea: number,
    fallbackCultureId?: number,
    fallbackPlantsCount?: number | null,
  ): Promise<void> => {
    const row = mobileRows.find((item) => item.id === rowId);
    const draftValues = buildAreaAndPlantsDraft(row, nextArea, fallbackCultureId, fallbackPlantsCount);
    lastEditedFieldRef.current = "area_m2";
    await gridCommandApiRef.current?.setDraftValues(rowId, {
      ...draftValues,
    });
    setMobileRows((previousRows) => previousRows.map((item) =>
      item.id === rowId
        ? {
          ...item,
          ...draftValues,
        }
        : item,
    ));
  };

  const applyAreaValidationDialogValue = async (dialog: AreaValidationDialogState): Promise<void> => {
    await applyAreaAndPlants(
      dialog.rowId,
      dialog.mode === "bedLimit"
        ? dialog.bedArea
        : dialog.availableArea,
      dialog.cultureId,
      dialog.plantsCount,
    );
  };

  const validateMobileForm = (): boolean => {
    if (!mobileCreateForm.culture || !mobileCreateForm.bed || !mobileCreateForm.planting_date) {
      setMobileCreateError(t("plantingPlans:validation.requiredFields", {
        fields: [
          t("plantingPlans:columns.culture"),
          t("plantingPlans:columns.bed"),
          t("plantingPlans:columns.plantingDate"),
        ].join(", "),
      }));
      return false;
    }
    if (
      mobileCreateForm.area_m2.trim() !== "" &&
      mobileCreateForm.area_m2.trim().toLowerCase() !== t("plantingPlans:placeholders.maxKeyword").toLowerCase() &&
      parseLocalizedNumber(mobileCreateForm.area_m2, numberLocale) === null
    ) {
      setMobileCreateError(t("plantingPlans:errors.save"));
      return false;
    }
    if (
      mobileCreateForm.plants_count.trim() !== "" &&
      parseLocalizedNumber(mobileCreateForm.plants_count, numberLocale) === null
    ) {
      setMobileCreateError(t("plantingPlans:errors.save"));
      return false;
    }
    return true;
  };

  const handleMobileCreate = async (): Promise<void> => {
    if (!validateMobileForm()) {
      return;
    }
    const normalizedMobileArea = mobileCreateForm.area_m2.trim().toLowerCase();
    const maxKeyword = t("plantingPlans:placeholders.maxKeyword").toLowerCase();
    const isMaxAreaKeyword = normalizedMobileArea === maxKeyword;
    const hasAreaInput = mobileCreateForm.area_m2.trim() !== "" && !isMaxAreaKeyword;
    const hasPlantsInput = mobileCreateForm.plants_count.trim() !== "";
    const parsedArea = isMaxAreaKeyword ? null : parseLocalizedNumber(mobileCreateForm.area_m2, numberLocale);
    const parsedPlants = parseLocalizedNumber(mobileCreateForm.plants_count, numberLocale);
    const usePlantsInput =
      mobileLastEditedField === "plants_count" ||
      (!mobileLastEditedField && !hasAreaInput && hasPlantsInput);
    let areaPayload: Partial<PlantingPlan> = {};
    if (hasAreaInput || hasPlantsInput) {
      areaPayload = {
        area_input_value: usePlantsInput
          ? parsedPlants ?? undefined
          : parsedArea ?? undefined,
        area_input_unit: usePlantsInput ? "PLANTS" : "M2",
      };
    }

    try {
      await plantingPlanAPI.create({
        culture: Number(mobileCreateForm.culture),
        bed: Number(mobileCreateForm.bed),
        planting_date: mobileCreateForm.planting_date,
        cultivation_type: mobileCreateForm.cultivation_type,
        notes: mobileCreateForm.notes || "",
        ...areaPayload,
      } as PlantingPlan);
      closeMobileCreateDialog();
      await gridCommandApiRef.current?.reload();
    } catch (error) {
      setMobileCreateError(
        extractApiErrorMessage(error, t, t("plantingPlans:errors.save")),
      );
    }
  };

  const openMobileEditDialog = (row: PlantingPlanRow): void => {
    const derivedArea = getDerivedAreaFromRow(row);
    setMobileCreateError("");
    setMobileEditId(row.id);
    setMobileCreateForm({
      culture: String(row.culture ?? ""),
      bed: String(row.bed ?? ""),
      cultivation_type: (row.cultivation_type as CultivationType) || "",
      planting_date: row.planting_date || "",
      area_m2:
        derivedArea !== null
          ? formatNumberForInput(derivedArea, { maximumFractionDigits: 2 })
          : "",
      plants_count:
        typeof row.plants_count === "number"
          ? formatNumberForInput(Math.round(row.plants_count), {
              maximumFractionDigits: 0,
            })
          : "",
      notes: row.notes || "",
    });
    setMobileLastEditedField(null);
    setIsMobileCreateOpen(true);
  };

  const handleMobileUpdate = async (): Promise<void> => {
    if (!mobileEditId || !validateMobileForm()) {
      return;
    }
    const hasAreaInput = mobileCreateForm.area_m2.trim() !== "";
    const hasPlantsInput = mobileCreateForm.plants_count.trim() !== "";
    const parsedArea = parseLocalizedNumber(mobileCreateForm.area_m2, numberLocale);
    const parsedPlants = parseLocalizedNumber(mobileCreateForm.plants_count, numberLocale);
    const usePlantsInput =
      mobileLastEditedField === "plants_count" ||
      (!mobileLastEditedField && !hasAreaInput && hasPlantsInput);
    let areaPayload: Partial<PlantingPlan> = {};
    if (hasAreaInput || hasPlantsInput) {
      areaPayload = {
        area_input_value: usePlantsInput
          ? parsedPlants ?? undefined
          : parsedArea ?? undefined,
        area_input_unit: usePlantsInput ? "PLANTS" : "M2",
      };
    }

    try {
      await plantingPlanAPI.update(mobileEditId, {
        culture: Number(mobileCreateForm.culture),
        bed: Number(mobileCreateForm.bed),
        planting_date: mobileCreateForm.planting_date,
        cultivation_type: mobileCreateForm.cultivation_type,
        notes: mobileCreateForm.notes || "",
        ...areaPayload,
      } as PlantingPlan);
      closeMobileCreateDialog();
      await gridCommandApiRef.current?.reload();
    } catch (error) {
      setMobileCreateError(
        extractApiErrorMessage(error, t, t("plantingPlans:errors.save")),
      );
    }
  };
  const hasLocations = locations.length > 0;
  const hasFields = fields.length > 0;
  const hasCultures = cultures.length > 0;
  const hasBeds = beds.length > 0;
  const hasPlans = mobileRows.length > 0;
  const firstMissingRequirement = getFirstMissingCultivationPlanRequirement({
    hasLocations,
    hasFields,
    hasBeds,
    hasCultures,
  });
  const canCreatePlan = firstMissingRequirement === null;
  const shouldShowPrerequisiteState = !canCreatePlan;
  const shouldShowNoPlansState = canCreatePlan && !hasPlans;
  const isInitialLoading = !shouldShowProjectRequiredState && (isHierarchyLoading || isPlansLoading);
  const prerequisiteActions = firstMissingRequirement
    ? getProjectSetupActions(firstMissingRequirement)
    : [];
  const createPlanAction = getProjectSetupAction("plans");

  const handleCreatePlan = useCallback((): void => {
    if (isMobile) {
      openMobileCreateDialog();
      return;
    }
    gridCommandApiRef.current?.addRow();
  }, [isMobile, openMobileCreateDialog]);

  const createActions = useMemo(() => [
    {
      id: "create-planting-plan",
      label: t("plantingPlans:addButton"),
      shortcut: "Alt+Shift+N",
      disabled: !canCreatePlan || shouldShowProjectRequiredState,
      handler: handleCreatePlan,
    },
  ], [canCreatePlan, handleCreatePlan, shouldShowProjectRequiredState, t]);

  useRegisterCreateActions("plans-page", createActions);

  useEffect(() => {
    if (createIntentHandledRef.current || !canCreatePlan) {
      return;
    }
    if (searchParams.get("create") !== "true") {
      return;
    }

    handleCreatePlan();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    replacePlantingPlanSearchParams(nextParams);
    createIntentHandledRef.current = true;
  }, [canCreatePlan, handleCreatePlan, replacePlantingPlanSearchParams, searchParams]);


  return (
    <PageContainer variant="workspacePage">

      <Snackbar
        open={areaNotice !== null}
        autoHideDuration={5000}
        onClose={() => setAreaNotice(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={areaNotice?.severity ?? "info"}
          variant="filled"
          onClose={() => setAreaNotice(null)}
        >
          {areaNotice?.message}
        </Alert>
      </Snackbar>

      <Box sx={{ width: "100%" }}>
        {isInitialLoading ? (
          <Box
            sx={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed",
              borderColor: "surface.surfaceSoftBorder",
              borderRadius: 2,
              bgcolor: "surface.surfaceBackground",
            }}
          >
            <Stack spacing={1.25} alignItems="center">
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Anbaupläne werden geladen…
              </Typography>
            </Stack>
          </Box>
        ) : shouldShowPrerequisiteState ? (
          <EmptyStateCard
            title={t(`plantingPlans:emptyStates.states.${firstMissingRequirement}.title`)}
            description={t(`plantingPlans:emptyStates.states.${firstMissingRequirement}.description`)}
            actions={prerequisiteActions.map((action) => ({ label: t(action.labelKey), to: action.to }))}
          />
        ) : shouldShowNoPlansState ? (
          <EmptyStateCard
            title={t("plantingPlans:emptyStates.states.plans.title")}
            description={t("plantingPlans:emptyStates.states.plans.description")}
            supplement={(
              <ContextMenuHint
                compact
                message={t("plantingPlans:contextMenuHint")}
                secondary={t("plantingPlans:contextMenuHintKeyboard")}
              />
            )}
            actions={[{ label: t(createPlanAction.labelKey), to: createPlanAction.to }]}
          />
        ) : null}

        {!isInitialLoading && showContextMenuHint && !isMobile && !shouldShowPrerequisiteState && hasPlans ? (
          <Box sx={{ mb: 1.25 }}>
            <ContextMenuHint
              message={t("plantingPlans:contextMenuHint")}
              secondary={t("plantingPlans:contextMenuHintKeyboard")}
              onClose={() => setShowContextMenuHint(false)}
            />
          </Box>
        ) : null}

        {isMobile && hasPlans ? (
          <Box sx={{ pb: 10 }}>
            <MobileCardList
              items={getVisibleMobileRows(mobileRows)}
              expandedIds={expandedCardIds}
              onToggleExpanded={toggleCardExpanded}
              renderPrimary={(item) => getCultureLabel(item)}
              renderSecondary={(item) => `${formatDateForDisplay(item.planting_date)} · ${getBedLabel(item)}`}
              renderDetails={(item) => (
                <Stack spacing={0.75}>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.cultivationType")}:</strong> {t(`plantingPlans:cultivationTypes.${item.cultivation_type === "direct_sowing" ? "directSowing" : "preCultivation"}`)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.bed")}:</strong> {getBedLabel(item)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.plantingDate")}:</strong> {formatDateForDisplay(item.planting_date)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.harvestStartDate")}:</strong> {formatDateForDisplay(item.harvest_date)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.harvestEndDate")}:</strong> {formatDateForDisplay(item.harvest_end_date)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.areaM2")}:</strong> {getDisplayArea(item)}</Typography>
                  <Typography variant="body2"><strong>{t("plantingPlans:columns.plantsCount")}:</strong> {typeof item.plants_count === "number" ? `≈ ${Math.round(item.plants_count)}` : "—"}</Typography>
                  <Typography variant="body2"><strong>{t("common:fields.notes")}:</strong> {item.notes?.trim() ? item.notes : "—"}</Typography>
                </Stack>
              )}
              renderActions={(item) => (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    size="small"
                    onClick={() => openMobileEditDialog(item)}
                    aria-label={t("plantingPlans:mobile.editAria")}
                    sx={{ minWidth: "auto" }}
                  >
                    {t("common:actions.edit")}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCameraOutlinedIcon />}
                    size="small"
                    onClick={() => openMobileNotesDialog(item)}
                    aria-label={t("plantingPlans:mobile.notesPhotosAria")}
                    sx={{ minWidth: "auto" }}
                  >
                    {t("plantingPlans:mobile.notesPhotos")}
                  </Button>
                </Stack>
              )}
              detailsShowLabel={t("plantingPlans:mobile.showDetails")}
              detailsHideLabel={t("plantingPlans:mobile.hideDetails")}
              emptyState={(
                <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1">{t("plantingPlans:mobile.emptyTitle")}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("plantingPlans:mobile.emptyDescription")}
                    </Typography>
                    <Button variant="contained" onClick={() => openMobileCreateDialog()}>
                      {t("plantingPlans:mobile.emptyCta")}
                    </Button>
                  </Stack>
                </Box>
              )}
            />
          </Box>
        ) : null}

        <PageSurface
          variant="fullWorkspace"
          sx={{ display: isMobile || shouldShowPrerequisiteState ? "none" : "block" }}
        >
          <EditableDataGrid<PlantingPlanRow>
            surfaceSizing="contentFit"
            columns={columns}
            api={plantingPlanAPI as unknown as DataGridAPI<PlantingPlanRow>}
            commandApiRef={gridCommandApiRef}
            onSelectedRowChange={setSelectedPlan}
            onRowsStateChange={(rows) => {
              setMobileRows((previousRows) =>
                areRowsSemanticallyEqual(previousRows, rows)
                  ? previousRows
                  : rows,
              );
            }}
            onLoadStateChange={({ loading, dataFetched }) => {
              setIsPlansLoading(loading || !dataFetched);
            }}
            createNewRow={() => ({
            id: -Date.now(),
            culture: 0,
            cultivation_type: "",
            location_id: undefined,
            field_id: undefined,
            bed: 0,
            planting_date: "",
            quantity: undefined,
            area_m2: undefined,
            plants_count: undefined,
            notes: "",
            note_attachment_count: 0,
            isNew: true,
          })}
          initialRow={
            !isMobile && (initialSelection.cultureId || initialSelection.bedId)
              ? {
                  ...(initialSelection.cultureId
                    ? { culture: initialSelection.cultureId }
                    : {}),
                  cultivation_type: resolveCultivationTypeForAllowedOptions(
                    getAllowedCultivationTypesForCulture(
                      cultures.find((culture) => culture.id === initialSelection.cultureId),
                    ),
                  ),
                  ...(initialSelection.bedId
                    ? { bed: initialSelection.bedId }
                    : {}),
                }
              : undefined
          }
          mapToRow={(plan) => {
            const areaFromApi = toNumericValue(plan.area_usage_sqm);
            const linkedBed = plan.bed ? bedById.get(plan.bed) : undefined;
            const linkedField = linkedBed ? fieldById.get(linkedBed.field) : undefined;
            return {
              ...plan,
              id: plan.id!,
              culture: plan.culture,
              cultivation_type: plan.cultivation_type ?? "",
              culture_name: plan.culture_name || "",
              bed: plan.bed,
              bed_name: plan.bed_name || "",
              field_id: linkedBed?.field,
              location_id: linkedField?.location,
              planting_date: plan.planting_date,
              harvest_date: plan.harvest_date,
              harvest_end_date: plan.harvest_end_date,
              quantity: plan.quantity,
              // Backend field name is area_usage_sqm, map to area_m2 for grid
              area_m2: areaFromApi ?? undefined,
              // plants_count computed by backend serializer
              plants_count: plan.plants_count ?? null,
              notes: plan.notes || "",
              note_attachment_count: plan.note_attachment_count ?? 0,
            };
          }}
          mapToApiData={async (row) => {
            const plantingDate = toIsoDateString(row.planting_date) ?? "";

            // Ensure culture and bed are numeric IDs, not label strings
            // DataGrid singleSelect can sometimes provide the label instead of value
            let cultureId: number;
            let bedId: number;

            if (typeof row.culture === "number") {
              cultureId = row.culture;
            } else {
              // If it's a string, it's the label - should not happen but handle gracefully
              console.warn(
                "Culture field contains non-numeric value:",
                row.culture,
              );
              cultureId = 0; // This will cause validation error
            }

            if (typeof row.bed === "number") {
              bedId = row.bed;
            } else {
              // If it's a string, it's the label - should not happen but handle gracefully
              console.warn("Bed field contains non-numeric value:", row.bed);
              bedId = 0; // This will cause validation error
            }

            // Prepare API data object
            const apiData: Partial<PlantingPlanRow> = {
              culture: cultureId,
              bed: bedId,
              planting_date: plantingDate,
              quantity: row.quantity,
              notes: row.notes || "",
              cultivation_type: row.cultivation_type ?? "",
            };

            // Determine which field to send based on last edit
            const source = lastEditedFieldRef.current || "area_m2";

            if (source === "area_m2" && isAutoAreaRequest(row.area_m2, t("plantingPlans:placeholders.maxKeyword"))) {
              const capacity = getCapacityForRow(row);
              if (capacity && capacity.availableArea > 0) {
                apiData.area_input_value = Number(capacity.availableArea.toFixed(2));
                apiData.area_input_unit = "M2";
              }
            } else if (source === "area_m2" && typeof row.area_m2 === "number") {
              // User edited area directly - send as M2
              apiData.area_input_value = row.area_m2;
              apiData.area_input_unit = "M2";
            } else if (
              source === "plants_count" &&
              typeof row.plants_count === "number"
            ) {
              // User edited plants count - send as PLANTS
              apiData.area_input_value = row.plants_count;
              apiData.area_input_unit = "PLANTS";
            }

            // Clear last edited field after use
            lastEditedFieldRef.current = null;

            return apiData;
          }}
          validateRow={(row) => {
            const missingFields: string[] = [];

            if (!row.planting_date) {
              missingFields.push(t("plantingPlans:columns.plantingDate"));
            }
            if (!row.culture || row.culture === 0) {
              missingFields.push(t("plantingPlans:columns.culture"));
            }
            if (!row.bed || row.bed === 0) {
              missingFields.push(t("plantingPlans:columns.bed"));
            }
            if (!row.cultivation_type) {
              missingFields.push(t("plantingPlans:columns.cultivationType"));
            }

            if (missingFields.length > 0) {
              return t("plantingPlans:validation.requiredFields", {
                fields: missingFields.join(", "),
              });
            }

            return null;
          }}
          getRowValidationErrors={(row) => {
            const errors: Record<string, string> = {};
            if (!row.planting_date) {
              errors.planting_date = t("plantingPlans:validation.plantingDateRequired");
            }
            if (!row.culture || row.culture === 0) {
              errors.culture = t("plantingPlans:validation.cultureRequired");
            }
            if (!row.bed || row.bed === 0) {
              errors.bed = t("plantingPlans:validation.bedRequired");
            }
            if (!row.cultivation_type) {
              errors.cultivation_type = t("plantingPlans:validation.cultivationTypeRequired");
            }
            return errors;
          }}
          onBeforeSaveRow={(row) => {
            if (areaValidationDialogRef.current || suppressAreaValidationSaveRef.current) {
              return false;
            }
            const capacity = getCapacityForRow(row);
            if (!capacity) {
              return true;
            }
            const maxKeyword = t("plantingPlans:placeholders.maxKeyword");
            if (isAutoAreaRequest(row.area_m2, maxKeyword)) {
              if (capacity.availableArea > 0) {
                setAreaNotice({
                  severity: "info",
                  message: t("plantingPlans:areaValidation.maxAreaApplied", { area: formatAreaM2(capacity.availableArea, numberLocale) }),
                });
                lastEditedFieldRef.current = "area_m2";
                return buildAreaAndPlantsDraft(row, capacity.availableArea);
              }
              return false;
            }
            const requestedArea = toAreaNumericValue(row.area_m2, numberLocale);
            if (requestedArea === null) {
              return true;
            }
            if (requestedArea > capacity.bedArea) {
              openAreaValidationDialog({
                rowId: row.id,
                requestedArea,
                availableArea: capacity.availableArea,
                bedArea: capacity.bedArea,
                occupiedArea: capacity.occupiedArea,
                cultureId: row.culture,
                plantsCount: row.plants_count,
                mode: "bedLimit",
              });
              return false;
            }
            if (capacity.availableArea <= 0) {
              openAreaValidationDialog({
                rowId: row.id,
                requestedArea,
                availableArea: capacity.availableArea,
                bedArea: capacity.bedArea,
                occupiedArea: capacity.occupiedArea,
                cultureId: row.culture,
                plantsCount: row.plants_count,
                mode: "noRemainingArea",
              });
              return false;
            }
            if (requestedArea > capacity.availableArea) {
              openAreaValidationDialog({
                rowId: row.id,
                requestedArea,
                availableArea: capacity.availableArea,
                bedArea: capacity.bedArea,
                occupiedArea: capacity.occupiedArea,
                cultureId: row.culture,
                plantsCount: row.plants_count,
                mode: "remainingLimit",
              });
              return false;
            }
            return true;
          }}
          loadErrorMessage={t("plantingPlans:errors.load")}
          saveErrorMessage={t("plantingPlans:errors.save")}
          deleteErrorMessage={t("plantingPlans:errors.delete")}
          deleteConfirmMessage={t("plantingPlans:confirmDelete")}
          deleteUndoOptions={{
            message: t("plantingPlans:messages.deleted"),
            snackbarTestId: "planting-plan-delete-snackbar",
          }}
          clipboardColumns={clipboardColumns}
          addButtonLabel={`${t("plantingPlans:addButton")} (Alt+Shift+N)`}
          showDeleteAction={false}
          showFooterEditControls={false}
          showRowEditActions={false}
          duplicateRow={(row) => ({
            ...row,
            id: -Date.now(),
            isNew: true,
            __draft: true,
            note_attachment_count: 0,
          })}
          tableKey="plantingPlans"
          defaultSortModel={[{ field: "planting_date", sort: "asc" }]}
          persistSortInUrl={true}
            notes={{
              fields: [
                {
                  field: "notes",
                  labelKey: "common:fields.notes",
                  attachmentNoteIdField: "id",
                  attachmentCountField: "note_attachment_count",
                  compactIndicator: true,
                },
              ],
            }}
          />
        </PageSurface>

      </Box>

      <Dialog open={isMobileCreateOpen} onClose={closeMobileCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {mobileEditId ? t("plantingPlans:mobile.editTitle") : t("plantingPlans:mobile.createTitle")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {mobileCreateError ? <Alert severity="error">{mobileCreateError}</Alert> : null}
            <FormControl fullWidth>
              <InputLabel>{t("plantingPlans:columns.culture")}</InputLabel>
              <Select
                value={mobileCreateForm.culture}
                label={t("plantingPlans:columns.culture")}
                onChange={(event) =>
                  setMobileCreateForm((previous) => ({ ...previous, culture: String(event.target.value) }))
                }
              >
                {cultureOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t("plantingPlans:columns.bed")}</InputLabel>
              <Select
                value={mobileCreateForm.bed}
                label={t("plantingPlans:columns.bed")}
                onChange={(event) =>
                  setMobileCreateForm((previous) => ({ ...previous, bed: String(event.target.value) }))
                }
              >
                {bedOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t("plantingPlans:columns.cultivationType")}</InputLabel>
              <Select
                value={mobileCreateForm.cultivation_type}
                label={t("plantingPlans:columns.cultivationType")}
                onChange={(event) =>
                  setMobileCreateForm((previous) => ({ ...previous, cultivation_type: event.target.value as CultivationType }))
                }
              >
                {cultivationTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="date"
              label={t("plantingPlans:columns.plantingDate")}
              InputLabelProps={{ shrink: true }}
              value={mobileCreateForm.planting_date}
              onChange={(event) =>
                setMobileCreateForm((previous) => ({ ...previous, planting_date: event.target.value }))
              }
            />
            <TextField
              type="text"
              inputMode="decimal"
              label={t("plantingPlans:columns.areaM2")}
              value={mobileCreateForm.area_m2}
              onChange={(event) => {
                const nextArea = event.target.value;
                const plantsPerSqm = getPlantsPerSqmForCulture(mobileCreateForm.culture);
                const normalizedArea = nextArea.trim().toLowerCase();
                const maxKeyword = t("plantingPlans:placeholders.maxKeyword").toLowerCase();
                const parsedArea = normalizedArea === maxKeyword ? null : parseLocalizedNumber(nextArea, numberLocale);
                setMobileCreateForm((previous) => ({
                  ...previous,
                  area_m2: nextArea,
                  plants_count:
                    plantsPerSqm && parsedArea !== null
                      ? formatNumberForInput(
                          Math.round(parsedArea * plantsPerSqm),
                          { maximumFractionDigits: 0 },
                        )
                      : previous.plants_count,
                }));
                setMobileLastEditedField("area_m2");
                setAreaNotice(null);
              }}
              placeholder={t("plantingPlans:placeholders.maxKeyword")}
              helperText={t("plantingPlans:tooltips.areaAutoMax")}
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
            <TextField
              type="text"
              inputMode="numeric"
              label={t("plantingPlans:columns.plantsCount")}
              value={mobileCreateForm.plants_count}
              onChange={(event) => {
                const nextPlants = event.target.value;
                const plantsPerSqm = getPlantsPerSqmForCulture(mobileCreateForm.culture);
                const parsedPlants = parseLocalizedNumber(nextPlants, numberLocale);
                setMobileCreateForm((previous) => ({
                  ...previous,
                  plants_count: nextPlants,
                  area_m2:
                    plantsPerSqm && parsedPlants !== null
                      ? formatNumberForInput(parsedPlants / plantsPerSqm, {
                          maximumFractionDigits: 2,
                        })
                      : previous.area_m2,
                }));
                setMobileLastEditedField("plants_count");
                setAreaNotice(null);
              }}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
            />
            <TextField
              label={t("common:fields.notes")}
              multiline
              minRows={3}
              value={mobileCreateForm.notes}
              onChange={(event) =>
                setMobileCreateForm((previous) => ({ ...previous, notes: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMobileCreateDialog}>{t("common:actions.cancel")}</Button>
          <Button onClick={() => void (mobileEditId ? handleMobileUpdate() : handleMobileCreate())} variant="contained">
            {mobileEditId ? t("common:actions.save") : t("common:actions.add")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={areaValidationDialog !== null} onClose={closeAreaValidationDialog} fullWidth maxWidth="xs">
        <DialogTitle>
          {areaValidationDialog?.mode === "bedLimit"
            ? t("plantingPlans:areaValidation.bedLimitTitle")
            : areaValidationDialog?.mode === "noRemainingArea"
              ? t("plantingPlans:areaValidation.noRemainingTitle")
              : t("plantingPlans:areaValidation.remainingLimitTitle")}
        </DialogTitle>
        <DialogContent>
          {areaValidationDialog && (
            <Stack spacing={1}>
              {areaValidationDialog.mode !== "bedLimit" && (
                <Typography sx={{ whiteSpace: "nowrap" }}>{t("plantingPlans:areaValidation.availableArea", { area: formatAreaM2(areaValidationDialog.availableArea, numberLocale) })}</Typography>
              )}
              <Typography sx={{ whiteSpace: "nowrap" }}>{t("plantingPlans:areaValidation.bedArea", { area: formatAreaM2(areaValidationDialog.bedArea, numberLocale) })}</Typography>
              {areaValidationDialog.mode !== "bedLimit" && (
                <Typography sx={{ whiteSpace: "nowrap" }}>{t("plantingPlans:areaValidation.occupiedArea", { area: formatAreaM2(areaValidationDialog.occupiedArea, numberLocale) })}</Typography>
              )}
              {areaValidationDialog.mode !== "noRemainingArea" && (
                <Typography sx={{ whiteSpace: "nowrap" }}>{t("plantingPlans:areaValidation.requestedArea", { area: formatAreaM2(areaValidationDialog.requestedArea, numberLocale) })}</Typography>
              )}
              {areaValidationDialog.mode !== "noRemainingArea" && (
                <Typography sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {t("plantingPlans:areaValidation.acceptedArea", {
                    area: formatAreaM2(
                      areaValidationDialog.mode === "bedLimit"
                        ? areaValidationDialog.bedArea
                        : areaValidationDialog.availableArea,
                      numberLocale,
                    ),
                  })}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAreaValidationDialog}>{t("common:actions.cancel")}</Button>
          {areaValidationDialog?.mode !== "noRemainingArea" && (
            <Button
              variant="contained"
              color="success"
              onClick={async () => {
                if (!areaValidationDialog) {
                  return;
                }
                await applyAreaValidationDialogValue(areaValidationDialog);
                closeAreaValidationDialog();
              }}
            >
              {areaValidationDialog?.mode === "bedLimit"
                ? t("plantingPlans:areaValidation.applyBedArea")
                : t("plantingPlans:areaValidation.applyRemainingArea")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <NotesDrawer
        open={isMobileNotesOpen}
        title={t("common:fields.notes")}
        value={mobileNotesDraft}
        onChange={setMobileNotesDraft}
        onSave={saveMobileNotes}
        onClose={closeMobileNotesDialog}
        loading={isMobileNotesSaving}
        noteId={mobileNotesTarget?.id}
        focusAttachments
        focusRequestId={mobileNotesTarget?.id ?? 0}
      />
    </PageContainer>
  );
}

export default PlantingPlans;
