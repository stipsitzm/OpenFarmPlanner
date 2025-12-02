import { useEffect, useState } from 'react';
import { cultureAPI, type Culture } from '../api/client';

function Cultures() {
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Culture>({
    name: '',
    variety: '',
    days_to_harvest: 0,
    notes: '',
  });

  useEffect(() => {
    fetchCultures();
  }, []);

  const fetchCultures = async () => {
    try {
      setLoading(true);
      const response = await cultureAPI.list();
      setCultures(response.data.results);
      setError(null);
    } catch (err) {
      setError('Failed to fetch cultures');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await cultureAPI.create(formData);
      setFormData({ name: '', variety: '', days_to_harvest: 0, notes: '' });
      setShowForm(false);
      fetchCultures();
    } catch (err) {
      setError('Failed to create culture');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this culture?')) {
      try {
        await cultureAPI.delete(id);
        fetchCultures();
      } catch (err) {
        setError('Failed to delete culture');
        console.error(err);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Cultures</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: '20px' }}>
        {showForm ? 'Cancel' : 'Add New Culture'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Name:
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Variety:
              <input
                type="text"
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Days to Harvest:
              <input
                type="number"
                value={formData.days_to_harvest}
                onChange={(e) => setFormData({ ...formData, days_to_harvest: parseInt(e.target.value) || 0 })}
                required
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
          <button type="submit">Create Culture</button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Variety</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Days to Harvest</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Notes</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cultures.map((culture) => (
            <tr key={culture.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{culture.name}</td>
              <td style={{ padding: '10px' }}>{culture.variety}</td>
              <td style={{ padding: '10px' }}>{culture.days_to_harvest}</td>
              <td style={{ padding: '10px' }}>{culture.notes}</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => handleDelete(culture.id!)} style={{ color: 'red' }}>
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

export default Cultures;
