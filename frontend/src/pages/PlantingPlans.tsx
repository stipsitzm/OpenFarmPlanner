/**
 * Planting Plans (Anbaupläne) page component.
 *
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 *
 * @returns The Planting Plans page component
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { GridColDef, GridCellParams } from "@mui/x-data-grid";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { useTranslation } from "../i18n";
import {
  plantingPlanAPI,
  cultureAPI,
  bedAPI,
  type PlantingPlan,
  type Culture,
  type Bed,
} from "../api/api";
import type { CultivationType } from "../api/types";
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
  type EditableRow,
  type DataGridAPI,
  type SearchableSelectOption,
  type EditableDataGridCommandApi,
} from "../components/data-grid";
import { MobileCardList } from "../components/mobile/MobileCardList";
import { NotesDrawer } from "../components/data-grid/NotesDrawer";
import PageHelp from "../components/help/PageHelp";
import PageHeader from "../components/layout/PageHeader";
import {
  useCommandContextTag,
  useRegisterCommands,
} from "../commands/useCommandContext";
import type { CommandSpec } from "../commands/types";

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
  area_m2?: number;
  plants_count?: number | null; // UI-only derived field
  note_attachment_count?: number;
}

interface MobileCreateFormState {
  culture: string;
  bed: string;
  cultivation_type: CultivationType;
  planting_date: string;
  area_m2: string;
  plants_count: string;
  notes: string;
}

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
const BED_COLUMN_MAX_WIDTH = 320;

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
  })} m²`;

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

const buildBedDisplayLabel = (
  bedName: string | null | undefined,
  fieldName: string | null | undefined,
  areaSqm: number | null,
  locale: string,
): string => {
  const normalizedBedName = (bedName ?? "").trim();
  const normalizedFieldName = (fieldName ?? "").trim();
  const combinedName = [normalizedFieldName, normalizedBedName]
    .filter((part) => part.length > 0)
    .join(" - ");

  if (!combinedName) {
    return "—";
  }

  if (areaSqm === null) {
    return combinedName;
  }

  return `${combinedName} (${formatAreaM2(areaSqm, locale)})`;
};

const createEmptyMobileCreateForm = (): MobileCreateFormState => ({
  culture: "",
  bed: "",
  cultivation_type: "pre_cultivation",
  planting_date: "",
  area_m2: "",
  plants_count: "",
  notes: "",
});

export const getVisibleMobileRows = (
  rows: PlantingPlanRow[],
): PlantingPlanRow[] => rows.filter((row) => !row.isNew);

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
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [areaWarning, setAreaWarning] = useState<string>("");
  const urlParamProcessedRef = useRef<boolean>(false);
  const gridCommandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlantingPlanRow | null>(
    null,
  );
  const [mobileRows, setMobileRows] = useState<PlantingPlanRow[]>([]);
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
  const mobilePrefillHandledRef = useRef(false);

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

  useCommandContextTag("plans");

  // Track which field was last edited (for determining API payload)
  const lastEditedFieldRef = useRef<"area_m2" | "plants_count" | null>(null);

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

  const bedOptions: SearchableSelectOption[] = useMemo(
    () =>
      beds
        .filter((b) => b.id !== undefined)
        .map((b) => {
          const normalizedAreaSqm = toNumericValue(b.area_sqm);
          return {
            value: b.id!,
            label: buildBedDisplayLabel(
              b.name,
              b.field_name,
              normalizedAreaSqm,
              numberLocale,
            ),
          };
        }),
    [beds, numberLocale],
  );

  const cultivationTypeOptions = useMemo(
    () =>
      CULTIVATION_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const dynamicWidths = useMemo(() => {
    const cultureWidth = estimateColumnWidth(
      [
        t("plantingPlans:columns.culture"),
        ...cultureOptions.map((option) => option.label),
      ],
      200,
      CULTURE_COLUMN_MAX_WIDTH,
    );
    const bedWidth = estimateColumnWidth(
      [
        t("plantingPlans:columns.fieldBed"),
        ...bedOptions.map((option) => option.label),
      ],
      260,
      BED_COLUMN_MAX_WIDTH,
    );

    return {
      culture: cultureWidth,
      bed: bedWidth,
      cultivationType: estimateColumnWidth(
        [
          t("plantingPlans:columns.cultivationType"),
          ...cultivationTypeOptions.map((option) => option.label),
        ],
        140,
        190,
      ),
      plantingDate: estimateColumnWidth(
        [t("plantingPlans:columns.plantingDate"), "2026-12-31"],
        140,
        180,
      ),
      harvestDate: estimateColumnWidth(
        [t("plantingPlans:columns.harvestStartDate"), "2026-12-31"],
        145,
        190,
      ),
      harvestEndDate: estimateColumnWidth(
        [t("plantingPlans:columns.harvestEndDate"), "2026-12-31"],
        145,
        190,
      ),
      area: estimateColumnWidth(
        [
          t("plantingPlans:columns.areaM2"),
          ...beds
            .filter((bed) => typeof bed.area_sqm === "number")
            .map((bed) => formatAreaM2(bed.area_sqm as number, numberLocale)),
        ],
        112,
        150,
      ),
      plants: estimateColumnWidth(
        [t("plantingPlans:columns.plantsCount"), "≈ 9999"],
        120,
        150,
      ),
      notes: 260,
    };
  }, [bedOptions, beds, cultivationTypeOptions, cultureOptions, t]);

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
      setSearchParams(newParams, { replace: true });
    }

    urlParamProcessedRef.current = true;
  }, [initialSelection, searchParams, setSearchParams]);

  /**
   * Fetch cultures and beds for dropdowns
   */
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [culturesResponse, bedsResponse] = await Promise.all([
          cultureAPI.list(),
          bedAPI.list(),
        ]);
        setCultures(culturesResponse.data.results);
        setBeds(
          bedsResponse.data.results.map((bed) => ({
            ...bed,
            area_sqm: toNumericValue(bed.area_sqm) ?? undefined,
          })),
        );
      } catch (err) {
        console.error("Error fetching cultures and beds:", err);
      }
    };
    fetchData();
  }, []);

  /**
   * Define columns for the Data Grid with inline editing
   * Recalculates when cultures or beds change to update dropdown options
   */
  const commands = useMemo<CommandSpec[]>(
    () => [
      {
        id: "plans.create",
        label: "Neuer Anbauplan (Alt+Shift+N)",
        group: 'navigation',
        keywords: ["anbauplan", "neu", "create"],
        shortcutHint: "Alt+Shift+N",
        keys: { alt: true, shift: true, key: "n" },
        contextTags: ["plans"],
        isEnabled: () => Boolean(gridCommandApiRef.current),
        action: () => gridCommandApiRef.current?.addRow(),
      },
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
        shortcutHint: "Alt+Shift+D",
        keys: { alt: true, shift: true, key: "d" },
        contextTags: ["plans"],
        isEnabled: () => selectedPlan !== null,
        action: () => gridCommandApiRef.current?.deleteSelectedRow(),
      },
    ],
    [selectedPlan],
  );

  useRegisterCommands("plans-page", commands);

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
          const availableTypes = (
            selectedCulture?.cultivation_types?.length
              ? selectedCulture.cultivation_types
              : selectedCulture?.cultivation_type
                ? [selectedCulture.cultivation_type]
                : []
          ).filter(
            (value): value is CultivationType =>
              value === "pre_cultivation" || value === "direct_sowing",
          );

          const currentType =
            nextRow.cultivation_type === "pre_cultivation" ||
            nextRow.cultivation_type === "direct_sowing"
              ? nextRow.cultivation_type
              : undefined;

          const nextCultivationType: CultivationType = availableTypes.includes(
            currentType ?? "pre_cultivation",
          )
            ? (currentType ?? "pre_cultivation")
            : (availableTypes[0] ?? "pre_cultivation");

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
        valueOptions: cultivationTypeOptions,
        valueFormatter: (value) => {
          const stringValue = typeof value === "string" ? value : "";
          const option = cultivationTypeOptions.find(
            (item) => item.value === (stringValue as CultivationType),
          );
          return option?.label ?? "";
        },
        valueSetter: (value, row) => ({
          ...row,
          cultivation_type: value || "pre_cultivation",
        }),
        preProcessEditCellProps: (params) => ({
          ...params.props,
          error: !params.props.value,
        }),
      },
      {
        ...createSingleSelectColumn<PlantingPlanRow>({
          field: "bed",
          headerName: t("plantingPlans:columns.fieldBed"),
          flex: 0,
          minWidth: dynamicWidths.bed,
          maxWidth: BED_COLUMN_MAX_WIDTH,
          truncateCellText: true,
          options: bedOptions,
        }),
        valueSetter: (value, row) => {
          const nextRow = row as PlantingPlanRow;
          const numericValue =
            typeof value === "number" ? value : Number(value);
          const selectedBed = beds.find((bed) => bed.id === numericValue);
          const isNewRow = Boolean(nextRow.isNew);
          const currentArea = nextRow.area_m2;
          const shouldAutofill =
            isNewRow && (currentArea === undefined || currentArea === null);

          return {
            ...nextRow,
            bed: numericValue,
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
        editable: false,
        type: "date",
        valueGetter: (value) => (value ? new Date(value) : null),
      },
      {
        field: "harvest_end_date",
        headerName: t("plantingPlans:columns.harvestEndDate"),
        flex: 0,
        minWidth: dynamicWidths.harvestEndDate,
        editable: false,
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
        type: "number",
        renderHeader: () => (
          <Tooltip title={t("plantingPlans:tooltips.coupledFields")}>
            <div>{t("plantingPlans:columns.areaM2")}</div>
          </Tooltip>
        ),
        preProcessEditCellProps: (params) => {
          if (params.hasChanged) {
            lastEditedFieldRef.current = "area_m2";
          }
          const bed = beds.find(
            (item) => item.id === (params.row as PlantingPlanRow).bed,
          );
          const bedArea = bed?.area_sqm;
          const numericValue = Number(params.props.value);
          const hasAreaError =
            bedArea !== undefined &&
            bedArea !== null &&
            Number.isFinite(numericValue) &&
            numericValue > bedArea;
          return { ...params.props, error: hasAreaError };
        },
        renderEditCell: (params) => {
          const row = params.row as PlantingPlanRow;
          const selectedBed = beds.find((item) => item.id === row.bed);
          const derivedArea = getDerivedAreaFromRow(row);

          return (
            <AreaM2EditCell
              {...params}
              bedAreaSqm={selectedBed?.area_sqm}
              fallbackValue={derivedArea}
              locale={numberLocale}
              onLastEditedFieldChange={() => {
                lastEditedFieldRef.current = "area_m2";
              }}
              normalizeAreaOnBlur={async (value) => {
                const bedId =
                  typeof row.bed === "number" ? row.bed : Number(row.bed);
                const startDate = toIsoDateString(row.planting_date);
                const endDate =
                  toIsoDateString(row.harvest_end_date) ??
                  toIsoDateString(row.harvest_date) ??
                  startDate;

                if (!bedId || !startDate || !endDate || value === null) {
                  return value;
                }

                const requestParams = {
                  bed_id: bedId,
                  start_date: startDate,
                  end_date: endDate,
                  ...(row.id > 0 ? { exclude_plan_id: row.id } : {}),
                };

                const response =
                  await plantingPlanAPI.remainingArea(requestParams);
                const remaining = response.data.remaining_area_sqm;

                if (value > remaining) {
                  setAreaWarning(
                    `Fläche wurde auf Restfläche begrenzt (${formatAreaM2(remaining, numberLocale)}). Bitte Speichern bestätigen, dann wird der Restwert übernommen.`,
                  );
                  return remaining;
                }

                if (areaWarning) {
                  setAreaWarning("");
                }

                return value;
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
            <div>{t("plantingPlans:columns.plantsCount")}</div>
          </Tooltip>
        ),
        preProcessEditCellProps: (params) => {
          if (params.hasChanged) {
            lastEditedFieldRef.current = "plants_count";
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
        width: dynamicWidths.notes,
        // Notes field will be overridden by NotesCell in EditableDataGrid
      },
    ],
    [
      bedOptions,
      beds,
      cultivationTypeOptions,
      cultureOptions,
      cultures,
      dynamicWidths,
      areaWarning,
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
    const linkedBed = beds.find((bed) => bed.id === row.bed);
    if (linkedBed) {
      return buildBedDisplayLabel(
        linkedBed.name,
        linkedBed.field_name,
        toNumericValue(linkedBed.area_sqm),
        numberLocale,
      );
    }
    if (row.bed_name) {
      return buildBedDisplayLabel(row.bed_name, null, null, numberLocale);
    }
    const fallback = bedOptions.find((option) => option.value === row.bed);
    return fallback?.label ?? "—";
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

  const openMobileCreateDialog = (
    prefill?: { cultureId?: number | null; bedId?: number | null },
  ): void => {
    setMobileCreateError("");
    setMobileEditId(null);
    setMobileCreateForm(buildMobileCreateForm(numberLocale, beds, prefill));
    setMobileLastEditedField(null);
    setIsMobileCreateOpen(true);
  };

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
  }, [isMobile, initialSelection.cultureId, initialSelection.bedId, beds, numberLocale]);

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
    if (!mobileNotesTarget?.id) {
      return;
    }

    setIsMobileNotesSaving(true);
    try {
      await plantingPlanAPI.update(mobileNotesTarget.id, {
        notes: mobileNotesDraft,
      } as PlantingPlan);
      closeMobileNotesDialog();
      await gridCommandApiRef.current?.reload();
    } catch (error) {
      setMobileCreateError(
        extractApiErrorMessage(error, t, t("plantingPlans:errors.save")),
      );
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
    const selectedBed = beds.find((bed) => bed.id === Number(mobileCreateForm.bed));
    const hasAreaInput = mobileCreateForm.area_m2.trim() !== "";
    const hasPlantsInput = mobileCreateForm.plants_count.trim() !== "";
    const parsedArea = parseLocalizedNumber(mobileCreateForm.area_m2, numberLocale);
    const parsedPlants = parseLocalizedNumber(mobileCreateForm.plants_count, numberLocale);
    const usePlantsInput =
      mobileLastEditedField === "plants_count" ||
      (!mobileLastEditedField && !hasAreaInput && hasPlantsInput);
    const areaPayload =
      hasAreaInput || hasPlantsInput
        ? {
            area_input_value: usePlantsInput
              ? parsedPlants
              : parsedArea,
            area_input_unit: usePlantsInput ? "PLANTS" : "M2",
          }
        : typeof selectedBed?.area_sqm === "number"
          ? {
              area_input_value: selectedBed.area_sqm,
              area_input_unit: "M2" as const,
            }
          : {};

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
      cultivation_type: (row.cultivation_type as CultivationType) || "pre_cultivation",
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
    const selectedBed = beds.find((bed) => bed.id === Number(mobileCreateForm.bed));
    const hasAreaInput = mobileCreateForm.area_m2.trim() !== "";
    const hasPlantsInput = mobileCreateForm.plants_count.trim() !== "";
    const parsedArea = parseLocalizedNumber(mobileCreateForm.area_m2, numberLocale);
    const parsedPlants = parseLocalizedNumber(mobileCreateForm.plants_count, numberLocale);
    const usePlantsInput =
      mobileLastEditedField === "plants_count" ||
      (!mobileLastEditedField && !hasAreaInput && hasPlantsInput);
    const areaPayload =
      hasAreaInput || hasPlantsInput
        ? {
            area_input_value: usePlantsInput
              ? parsedPlants
              : parsedArea,
            area_input_unit: usePlantsInput ? "PLANTS" : "M2",
          }
        : typeof selectedBed?.area_sqm === "number"
          ? {
              area_input_value: selectedBed.area_sqm,
              area_input_unit: "M2" as const,
            }
          : {};

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

  return (
    <div
      className="page-container"
      style={{ maxWidth: "none", margin: 0, paddingLeft: 16, paddingRight: 16 }}
    >
      {areaWarning ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {areaWarning}
        </Alert>
      ) : null}

      <Box sx={{ width: "100%", maxWidth: "100%" }}>
        <PageHeader
          title={t("plantingPlans:title")}
          actions={(
            <>
              {!isMobile ? (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => gridCommandApiRef.current?.addRow()}
                  aria-label={`${t("plantingPlans:addButton")} (Alt+N)`}
                >
                  {t("plantingPlans:addButton")}
                </Button>
              ) : null}
              <PageHelp pageKey="plantingPlans" />
            </>
          )}
        />

        {isMobile ? (
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

        <Box sx={{ display: isMobile ? "none" : "block" }}>
          <EditableDataGrid<PlantingPlanRow>
            columns={columns}
            api={plantingPlanAPI as unknown as DataGridAPI<PlantingPlanRow>}
            commandApiRef={gridCommandApiRef}
            onSelectedRowChange={setSelectedPlan}
            onRowsStateChange={(rows) => setMobileRows(rows)}
            createNewRow={() => ({
            id: -Date.now(),
            culture: 0,
            cultivation_type: "pre_cultivation",
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
                  cultivation_type: "pre_cultivation",
                  ...(initialSelection.bedId
                    ? { bed: initialSelection.bedId }
                    : {}),
                }
              : undefined
          }
          mapToRow={(plan) => {
            const areaFromApi = toNumericValue(plan.area_usage_sqm);
            return {
              ...plan,
              id: plan.id!,
              culture: plan.culture,
              cultivation_type: plan.cultivation_type || "pre_cultivation",
              culture_name: plan.culture_name || "",
              bed: plan.bed,
              bed_name: plan.bed_name || "",
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
          mapToApiData={(row) => {
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
              cultivation_type: row.cultivation_type || "pre_cultivation",
            };

            // Determine which field to send based on last edit
            const source = lastEditedFieldRef.current || "area_m2";
            const selectedBed = beds.find((bed) => bed.id === bedId);

            if (source === "area_m2" && typeof row.area_m2 === "number") {
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

            if (
              apiData.area_input_value === undefined &&
              typeof selectedBed?.area_sqm === "number"
            ) {
              apiData.area_input_value = selectedBed.area_sqm;
              apiData.area_input_unit = "M2";
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

            const selectedBed = beds.find((bed) => bed.id === row.bed);
            if (
              selectedBed?.area_sqm !== undefined &&
              selectedBed.area_sqm !== null &&
              typeof row.area_m2 === "number" &&
              row.area_m2 > selectedBed.area_sqm
            ) {
              return "Fläche darf die Beetfläche nicht überschreiten.";
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
          loadErrorMessage={t("plantingPlans:errors.load")}
          saveErrorMessage={t("plantingPlans:errors.save")}
          deleteErrorMessage={t("plantingPlans:errors.delete")}
          deleteConfirmMessage={t("plantingPlans:confirmDelete")}
          addButtonLabel={`${t("plantingPlans:addButton")} (Alt+N)`}
          showDeleteAction={true}
          showFooterEditControls={false}
          showRowEditActions={true}
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
                },
              ],
            }}
          />
        </Box>

        {isMobile ? (
          <Fab
            color="primary"
            variant="extended"
            onClick={() => openMobileCreateDialog()}
            sx={{ position: "fixed", bottom: 24, right: 16, zIndex: theme.zIndex.fab }}
            aria-label={t("plantingPlans:mobile.fabAria")}
          >
            <AddIcon sx={{ mr: 0.75 }} />
            {t("plantingPlans:mobile.fabLabel")}
          </Fab>
        ) : null}
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
                const parsedArea = parseLocalizedNumber(nextArea, numberLocale);
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
              }}
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
    </div>
  );
}

export default PlantingPlans;
