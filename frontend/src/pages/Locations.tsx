/**
 * Locations (Standorte) page component.
 * 
 * Manages farm locations with list and create functionality.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Locations page component
 */

import { useState, useEffect } from 'react';
import { locationAPI, type Location } from '../api/client';

function Locations(): React.ReactElement {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Location>({
    name: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async (): Promise<void> => {
    try {
      const response = await locationAPI.list();
      setLocations(response.data.results);
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Standorte');
      console.error('Error fetching locations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await locationAPI.create(formData);
      setFormData({ name: '', address: '', notes: '' });
      setShowForm(false);
      fetchLocations();
      setError('');
    } catch (err) {
      setError('Fehler beim Erstellen des Standorts');
      console.error('Error creating location:', err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Möchten Sie diesen Standort wirklich löschen?')) return;
    
    try {
      await locationAPI.delete(id);
      fetchLocations();
      setError('');
    } catch (err) {
      setError('Fehler beim Löschen des Standorts');
      console.error('Error deleting location:', err);
    }
  };

  return (
    <div className="page-container">
      <h1>Standorte</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neuen Standort hinzufügen'}
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
            <label htmlFor="address">Adresse</label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="form-input"
              rows={3}
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
            <th>Adresse</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <tr key={location.id}>
              <td>{location.name}</td>
              <td>{location.address || '-'}</td>
              <td>{location.notes || '-'}</td>
              <td>
                <button
                  onClick={() => location.id && handleDelete(location.id)}
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

export default Locations;
