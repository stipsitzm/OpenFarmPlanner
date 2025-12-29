/**
 * Fields (Schläge) page component.
 * 
 * Manages farm fields with list and create functionality.
 * Fields belong to locations and contain beds.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Fields page component
 */

import { useState, useEffect } from 'react';
import { fieldAPI, locationAPI, type Field, type Location } from '../api/client';

function Fields(): React.ReactElement {
  const [fields, setFields] = useState<Field[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Field>({
    name: '',
    location: 0,
    area_sqm: undefined,
    notes: '',
  });

  useEffect(() => {
    fetchFields();
    fetchLocations();
  }, []);

  const fetchFields = async (): Promise<void> => {
    try {
      const response = await fieldAPI.list();
      setFields(response.data.results);
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Schläge');
      console.error('Error fetching fields:', err);
    }
  };

  const fetchLocations = async (): Promise<void> => {
    try {
      const response = await locationAPI.list();
      setLocations(response.data.results);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await fieldAPI.create(formData);
      setFormData({ name: '', location: 0, area_sqm: undefined, notes: '' });
      setShowForm(false);
      fetchFields();
      setError('');
    } catch (err) {
      setError('Fehler beim Erstellen des Schlags');
      console.error('Error creating field:', err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Möchten Sie diesen Schlag wirklich löschen?')) return;
    
    try {
      await fieldAPI.delete(id);
      fetchFields();
      setError('');
    } catch (err) {
      setError('Fehler beim Löschen des Schlags');
      console.error('Error deleting field:', err);
    }
  };

  return (
    <div className="page-container">
      <h1>Schläge</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neuen Schlag hinzufügen'}
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
            <label htmlFor="location">Standort *</label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: parseInt(e.target.value) })}
              required
              className="form-input"
            >
              <option value={0}>Bitte wählen...</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="area_sqm">Fläche (m²)</label>
            <input
              id="area_sqm"
              type="number"
              step="0.01"
              value={formData.area_sqm || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                area_sqm: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
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
            <th>Standort</th>
            <th>Fläche (m²)</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.id} className="clickable">
              <td>{field.name}</td>
              <td>{field.location_name || '-'}</td>
              <td>{field.area_sqm || '-'}</td>
              <td>{field.notes || '-'}</td>
              <td>
                <button
                  onClick={() => field.id && handleDelete(field.id)}
                  className="delete-btn"
                >
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

export default Fields;
