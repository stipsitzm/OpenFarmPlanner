/**
 * Beds (Beete) page component.
 * 
 * Manages farm beds with list and create functionality.
 * Beds belong to fields.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Beds page component
 */

import { useEffect, useState } from 'react';
import { bedAPI, fieldAPI, type Bed, type Field } from '../api/client';

function Beds(): React.ReactElement {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<Bed>({
    name: '',
    field: 0,
    length_m: undefined,
    width_m: undefined,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (): Promise<void> => {
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
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await bedAPI.create(formData);
      setFormData({ name: '', field: 0, length_m: undefined, width_m: undefined, notes: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError('Fehler beim Erstellen des Beets');
      console.error(err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (window.confirm('Möchten Sie dieses Beet wirklich löschen?')) {
      try {
        await bedAPI.delete(id);
        fetchData();
      } catch (err) {
        setError('Fehler beim Löschen des Beets');
        console.error(err);
      }
    }
  };

  if (loading) return <div className="page-container">Lädt...</div>;

  return (
    <div className="page-container">
      <h1>Beete</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neues Beet hinzufügen'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
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
            <label htmlFor="field">Schlag *</label>
            <select
              id="field"
              value={formData.field}
              onChange={(e) => setFormData({ ...formData, field: parseInt(e.target.value) })}
              required
              className="form-input"
            >
              <option value="">Bitte wählen...</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} ({field.location_name})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="length_m">Länge (m)</label>
            <input
              id="length_m"
              type="number"
              step="0.01"
              value={formData.length_m || ''}
              onChange={(e) => setFormData({ ...formData, length_m: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="width_m">Breite (m)</label>
            <input
              id="width_m"
              type="number"
              step="0.01"
              value={formData.width_m || ''}
              onChange={(e) => setFormData({ ...formData, width_m: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notizen</label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="form-input"
              rows={3}
            />
          </div>
          <button type="submit" className="submit-btn">Speichern</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Schlag</th>
            <th>Länge (m)</th>
            <th>Breite (m)</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id}>
              <td>{bed.name}</td>
              <td>{bed.field_name || '-'}</td>
              <td>{bed.length_m || '-'}</td>
              <td>{bed.width_m || '-'}</td>
              <td>{bed.notes || '-'}</td>
              <td>
                <button onClick={() => handleDelete(bed.id!)} className="delete-btn">
                  Löschen
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
