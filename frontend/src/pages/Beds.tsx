/**
 * Beds (Beete) page component.
 * 
 * Manages farm beds with list and create functionality.
 * Beds belong to fields.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Beds page component
 */

import { useCallback, useEffect, useState } from 'react';
import { bedAPI, fieldAPI, type Bed, type Field } from '../api/api';
import { useTranslation } from '../i18n';
import {
  formatLocalizedNumber,
  parseLocalizedNumber,
  resolveLocaleFromLanguage,
} from '../utils/numberLocalization';

function Beds(): React.ReactElement {
  const { t, i18n } = useTranslation(['beds', 'common']);
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<Bed>({
    name: '',
    field: 0,
    area_sqm: undefined,
    notes: '',
  });

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const [bedsResponse, fieldsResponse] = await Promise.all([
        bedAPI.list(),
        fieldAPI.list(),
      ]);
      setBeds(bedsResponse.data.results);
      setFields(fieldsResponse.data.results);
      setError(null);
    } catch (err) {
      setError(t('beds:errors.load'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await bedAPI.create(formData);
      setFormData({ name: '', field: 0, area_sqm: undefined, notes: '' });
      setShowForm(false);
      await fetchData();
    } catch (err) {
      setError(t('beds:errors.save'));
      console.error(err);
    }
  }, [fetchData, formData, t]);

  const handleDelete = useCallback(async (id: number): Promise<void> => {
    if (window.confirm(t('beds:confirmDelete'))) {
      try {
        await bedAPI.delete(id);
        await fetchData();
      } catch (err) {
        setError(t('beds:errors.delete'));
        console.error(err);
      }
    }
  }, [fetchData, t]);

  if (loading) return <div className="page-container">{t('common:messages.loading')}</div>;

  return (
    <div className="page-container">
      <h1>{t('beds:title')}</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? t('common:actions.cancel') : t('beds:addButton')}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="name">{t('common:fields.name')} *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="field">{t('beds:columns.field')} *</label>
            <select
              id="field"
              value={formData.field}
              onChange={(e) => setFormData({ ...formData, field: parseInt(e.target.value) })}
              required
              className="form-input"
            >
              <option value="">{t('beds:selectField')}</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} ({field.location_name})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="area_sqm">{t('beds:columns.area')}</label>
            <input
              id="area_sqm"
              type="text"
              inputMode="decimal"
              value={formData.area_sqm || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  area_sqm:
                    parseLocalizedNumber(e.target.value, numberLocale) ??
                    undefined,
                })
              }
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="notes">{t('common:fields.notes')}</label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="form-input"
              rows={3}
            />
          </div>
          <button type="submit" className="submit-btn">{t('common:actions.save')}</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('common:fields.name')}</th>
            <th>{t('beds:columns.field')}</th>
            <th>{t('beds:columns.area')}</th>
            <th>{t('common:fields.notes')}</th>
            <th>{t('common:actions.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id}>
              <td>{bed.name}</td>
              <td>{bed.field_name || t('common:messages.noData')}</td>
              <td>
                {typeof bed.area_sqm === 'number'
                  ? formatLocalizedNumber(bed.area_sqm, numberLocale)
                  : t('common:messages.noData')}
              </td>
              <td>{bed.notes || t('common:messages.noData')}</td>
              <td>
                <button onClick={() => handleDelete(bed.id!)} className="delete-btn">
                  {t('common:actions.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Beds;
