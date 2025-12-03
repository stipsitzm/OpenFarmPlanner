/**
 * Cultures (Kulturen) page component.
 * 
 * Manages crop cultures with list and create functionality.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useEffect, useState } from 'react';
import { cultureAPI, type Culture } from '../api/client';

function Cultures(): React.ReactElement {
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<Culture>({
    name: '',
    variety: '',
    days_to_harvest: 0,
    notes: '',
  });

  useEffect(() => {
    fetchCultures();
  }, []);

  const fetchCultures = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await cultureAPI.list();
      setCultures(response.data.results);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Kulturen');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await cultureAPI.create(formData);
      setFormData({ name: '', variety: '', days_to_harvest: 0, notes: '' });
      setShowForm(false);
      fetchCultures();
    } catch (err) {
      setError('Fehler beim Erstellen der Kultur');
      console.error(err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (window.confirm('Möchten Sie diese Kultur wirklich löschen?')) {
      try {
        await cultureAPI.delete(id);
        fetchCultures();
      } catch (err) {
        setError('Fehler beim Löschen der Kultur');
        console.error(err);
      }
    }
  };

  if (loading) return <div className="page-container">Lädt...</div>;

  return (
    <div className="page-container">
      <h1>Kulturen</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neue Kultur hinzufügen'}
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
            <label htmlFor="variety">Sorte</label>
            <input
              id="variety"
              type="text"
              value={formData.variety}
              onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="days_to_harvest">Tage bis zur Ernte *</label>
            <input
              id="days_to_harvest"
              type="number"
              value={formData.days_to_harvest}
              onChange={(e) => setFormData({ ...formData, days_to_harvest: parseInt(e.target.value) || 0 })}
              required
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
            <th>Sorte</th>
            <th>Tage bis Ernte</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {cultures.map((culture) => (
            <tr key={culture.id}>
              <td>{culture.name}</td>
              <td>{culture.variety || '-'}</td>
              <td>{culture.days_to_harvest}</td>
              <td>{culture.notes || '-'}</td>
              <td>
                <button onClick={() => handleDelete(culture.id!)} className="delete-btn">
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

export default Cultures;
