/**
 * Planting Plans (Anbaupläne) page component.
 * 
 * Manages planting schedules with automatic harvest date calculation.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Planting Plans page component
 */

import { useEffect, useState } from 'react';
import { plantingPlanAPI, cultureAPI, bedAPI, type PlantingPlan, type Culture, type Bed } from '../api/client';

function PlantingPlans(): React.ReactElement {
  const [plans, setPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<PlantingPlan>({
    culture: 0,
    bed: 0,
    planting_date: '',
    quantity: undefined,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [plansResponse, culturesResponse, bedsResponse] = await Promise.all([
        plantingPlanAPI.list(),
        cultureAPI.list(),
        bedAPI.list(),
      ]);
      setPlans(plansResponse.data.results);
      setCultures(culturesResponse.data.results);
      setBeds(bedsResponse.data.results);
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
      await plantingPlanAPI.create(formData);
      setFormData({ culture: 0, bed: 0, planting_date: '', quantity: undefined, notes: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError('Fehler beim Erstellen des Anbau plans');
      console.error(err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (window.confirm('Möchten Sie diesen Anbauplan wirklich löschen?')) {
      try {
        await plantingPlanAPI.delete(id);
        fetchData();
      } catch (err) {
        setError('Fehler beim Löschen des Anbau plans');
        console.error(err);
      }
    }
  };

  if (loading) return <div className="page-container">Lädt...</div>;

  return (
    <div className="page-container">
      <h1>Anbaupläne</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neuen Anbauplan hinzufügen'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="culture">Kultur *</label>
            <select
              id="culture"
              value={formData.culture}
              onChange={(e) => setFormData({ ...formData, culture: parseInt(e.target.value) || 0 })}
              required
              className="form-input"
            >
              <option value="">Bitte wählen...</option>
              {cultures.map((culture) => (
                <option key={culture.id} value={culture.id}>
                  {culture.name} {culture.variety && `(${culture.variety})`}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="bed">Beet *</label>
            <select
              id="bed"
              value={formData.bed}
              onChange={(e) => setFormData({ ...formData, bed: parseInt(e.target.value) || 0 })}
              required
              className="form-input"
            >
              <option value="">Bitte wählen...</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name} ({bed.field_name})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="planting_date">Pflanzdatum *</label>
            <input
              id="planting_date"
              type="date"
              value={formData.planting_date}
              onChange={(e) => setFormData({ ...formData, planting_date: e.target.value })}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="quantity">Anzahl</label>
            <input
              id="quantity"
              type="number"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseInt(e.target.value) : undefined })}
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
            <th>Kultur</th>
            <th>Beet</th>
            <th>Pflanzdatum</th>
            <th>Erntedatum</th>
            <th>Anzahl</th>
            <th>Notizen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>{plan.culture_name}</td>
              <td>{plan.bed_name}</td>
              <td>{plan.planting_date}</td>
              <td>{plan.harvest_date || '-'}</td>
              <td>{plan.quantity || '-'}</td>
              <td>{plan.notes || '-'}</td>
              <td>
                <button onClick={() => handleDelete(plan.id!)} className="delete-btn">
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

export default PlantingPlans;

