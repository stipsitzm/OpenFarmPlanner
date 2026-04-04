/**
 * Fields (Parzellen) page component.
 *
 * Manages farm fields with list and create functionality.
 * Fields belong to locations and contain beds.
 * UI text is in German, code comments remain in English.
 *
 * @returns The Fields page component
 */

import { useCallback, useEffect, useState } from 'react';
import { fieldAPI, locationAPI, type Field, type Location } from '../api/api';
import { useTranslation } from '../i18n';
import {
  formatLocalizedNumber,
  parseLocalizedNumber,
  resolveLocaleFromLanguage,
} from '../utils/numberLocalization';

const EMPTY_FIELD_FORM_DATA: Field = {
  name: '',
  location: 0,
  area_sqm: undefined,
  notes: '',
};

function parseOptionalNumber(value: string, locale: string): number | undefined {
  const parsed = parseLocalizedNumber(value, locale);
  return parsed ?? undefined;
}

function Fields(): React.ReactElement {
  const { t, i18n } = useTranslation(['fields', 'common']);
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const [fields, setFields] = useState<Field[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Field>(EMPTY_FIELD_FORM_DATA);

  const fetchFields = useCallback(async (): Promise<void> => {
    try {
      const response = await fieldAPI.list();
      setFields(response.data.results);
      setError('');
    } catch (err) {
      setError(t('fields:errors.load'));
      console.error('Error fetching fields:', err);
    }
  }, [t]);

  const fetchLocations = useCallback(async (): Promise<void> => {
    try {
      const response = await locationAPI.list();
      setLocations(response.data.results);
    } catch (err) {
      setError(t('fields:errors.loadLocations'));
      console.error('Error fetching locations:', err);
    }
  }, [t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchFields();
      void fetchLocations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchFields, fetchLocations]);

  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await fieldAPI.create(formData);
      setFormData(EMPTY_FIELD_FORM_DATA);
      setShowForm(false);
      await fetchFields();
      setError('');
    } catch (err) {
      setError(t('fields:errors.save'));
      console.error('Error creating field:', err);
    }
  }, [fetchFields, formData, t]);

  const handleDelete = useCallback(async (id: number): Promise<void> => {
    if (!window.confirm(t('fields:confirmDelete'))) {
      return;
    }

    try {
      await fieldAPI.delete(id);
      await fetchFields();
      setError('');
    } catch (err) {
      setError(t('fields:errors.delete'));
      console.error('Error deleting field:', err);
    }
  }, [fetchFields, t]);

  return (
    <div className="page-container">
      <h1>{t('fields:title')}</h1>

      {error && <div className="error-message">{error}</div>}

      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? t('common:actions.cancel') : t('fields:addButton')}
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
            <label htmlFor="location">{t('fields:columns.location')} *</label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: Number.parseInt(e.target.value, 10) })}
              required
              className="form-input"
            >
              <option value={0}>{t('fields:selectLocation')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="area_sqm">{t('fields:columns.area')}</label>
            <input
              id="area_sqm"
              type="text"
              inputMode="decimal"
              value={formData.area_sqm || ''}
              onChange={(e) => setFormData({
                ...formData,
                area_sqm: parseOptionalNumber(e.target.value, numberLocale),
              })}
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
            <th>{t('fields:columns.location')}</th>
            <th>{t('fields:columns.area')}</th>
            <th>{t('common:fields.notes')}</th>
            <th>{t('common:actions.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.id} className="clickable">
              <td>{field.name}</td>
              <td>{field.location_name || t('common:messages.noData')}</td>
              <td>
                {typeof field.area_sqm === 'number'
                  ? formatLocalizedNumber(field.area_sqm, numberLocale)
                  : t('common:messages.noData')}
              </td>
              <td>{field.notes || t('common:messages.noData')}</td>
              <td>
                <button
                  onClick={() => field.id && handleDelete(field.id)}
                  className="delete-btn"
                >
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

export default Fields;
