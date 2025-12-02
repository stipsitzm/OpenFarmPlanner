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
    <div style={{ padding: '20px' }}>
      <h1>Planting Plans</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: '20px' }}>
        {showForm ? 'Cancel' : 'Add New Planting Plan'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Culture:
              <select
                value={formData.culture}
                onChange={(e) => setFormData({ ...formData, culture: parseInt(e.target.value) || 0 })}
                required
                style={{ marginLeft: '10px', width: '200px' }}
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
          <div style={{ marginBottom: '10px' }}>
            <label>
              Bed:
              <select
                value={formData.bed}
                onChange={(e) => setFormData({ ...formData, bed: parseInt(e.target.value) || 0 })}
                required
                style={{ marginLeft: '10px', width: '200px' }}
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
          <div style={{ marginBottom: '10px' }}>
            <label>
              Planting Date:
              <input
                type="date"
                value={formData.planting_date}
                onChange={(e) => setFormData({ ...formData, planting_date: e.target.value })}
                required
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Quantity:
              <input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Notes:
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <button type="submit">Create Planting Plan</button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Culture</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Bed</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Planting Date</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Harvest Date</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Quantity</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Notes</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{plan.culture_name}</td>
              <td style={{ padding: '10px' }}>{plan.bed_name}</td>
              <td style={{ padding: '10px' }}>{plan.planting_date}</td>
              <td style={{ padding: '10px' }}>{plan.harvest_date}</td>
              <td style={{ padding: '10px' }}>{plan.quantity}</td>
              <td style={{ padding: '10px' }}>{plan.notes}</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => handleDelete(plan.id!)} style={{ color: 'red' }}>
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
