import { useEffect, useState } from 'react';
import { plantingPlanAPI, cultureAPI, bedAPI, type PlantingPlan, type Culture, type Bed } from '../api/client';

function PlantingPlans() {
  const [plans, setPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  const fetchData = async () => {
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
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await plantingPlanAPI.create(formData);
      setFormData({ culture: 0, bed: 0, planting_date: '', quantity: undefined, notes: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError('Failed to create planting plan');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this planting plan?')) {
      try {
        await plantingPlanAPI.delete(id);
        fetchData();
      } catch (err) {
        setError('Failed to delete planting plan');
        console.error(err);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="page-container">
      <h1>Planting Plans</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        {showForm ? 'Cancel' : 'Add New Planting Plan'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label>
              Culture:
              <select
                value={formData.culture}
                onChange={(e) => setFormData({ ...formData, culture: parseInt(e.target.value) || 0 })}
                required
                className="form-input"
              >
                <option value="">Select a culture</option>
                {cultures.map((culture) => (
                  <option key={culture.id} value={culture.id}>
                    {culture.name} {culture.variety && `(${culture.variety})`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-group">
            <label>
              Bed:
              <select
                value={formData.bed}
                onChange={(e) => setFormData({ ...formData, bed: parseInt(e.target.value) || 0 })}
                required
                className="form-input"
              >
                <option value="">Select a bed</option>
                {beds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.name} ({bed.field_name})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-group">
            <label>
              Planting Date:
              <input
                type="date"
                value={formData.planting_date}
                onChange={(e) => setFormData({ ...formData, planting_date: e.target.value })}
                required
                className="form-input"
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Quantity:
              <input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                className="form-input"
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Notes:
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="form-input"
              />
            </label>
          </div>
          <button type="submit">Create Planting Plan</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Culture</th>
            <th>Bed</th>
            <th>Planting Date</th>
            <th>Harvest Date</th>
            <th>Quantity</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>{plan.culture_name}</td>
              <td>{plan.bed_name}</td>
              <td>{plan.planting_date}</td>
              <td>{plan.harvest_date}</td>
              <td>{plan.quantity}</td>
              <td>{plan.notes}</td>
              <td>
                <button onClick={() => handleDelete(plan.id!)} className="btn-delete">
                  Delete
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
