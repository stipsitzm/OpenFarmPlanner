import {
  ExportFormatDialog,
  type TableExportFormat,
} from '../components/data-grid/ExportFormatDialog';

type ExportScope = 'current' | 'all';

type Translator = (key: string, options?: Record<string, unknown>) => string;

type CulturesExportDialogProps = {
  open: boolean;
  hasCurrentCulture: boolean;
  onClose: () => void;
  onExport: (scope: ExportScope, format: TableExportFormat) => Promise<void>;
  t: Translator;
};

export function CulturesExportDialog({
  open,
  hasCurrentCulture,
  onClose,
  onExport,
  t,
}: CulturesExportDialogProps) {
  return (
    <ExportFormatDialog
      open={open}
      title={t('export.dialogTitle')}
      onClose={onClose}
      onExport={(format, scope) => onExport((scope ?? 'all') as ExportScope, format)}
      scopeLabel={t('export.scopeLabel')}
      scopeOptions={[
        { value: 'all', label: t('export.scopeAll') },
        {
          value: 'current',
          label: t('export.scopeCurrent'),
          disabled: !hasCurrentCulture,
          disabledHint: t('export.scopeCurrentDisabled'),
        },
      ]}
      defaultScope="all"
      formatLabel={t('export.formatLabel')}
      formatLabels={{
        xlsx: t('export.formatXlsx'),
        ods: t('export.formatOds'),
        csv: t('export.formatCsv'),
        json: t('export.formatJson'),
      }}
      jsonHint={t('export.formatJsonHint')}
      cancelLabel={t('export.cancel')}
      submitLabel={t('export.submit')}
    />
  );
}
