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
    <div className="page-container">
      <h1>Cultures</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        {showForm ? 'Cancel' : 'Add New Culture'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label>
              Name:
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="form-input"
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Variety:
              <input
                type="text"
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                className="form-input"
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Days to Harvest:
              <input
                type="number"
                value={formData.days_to_harvest}
                onChange={(e) => setFormData({ ...formData, days_to_harvest: parseInt(e.target.value) || 0 })}
                required
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
          <button type="submit">Create Culture</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Variety</th>
            <th>Days to Harvest</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cultures.map((culture) => (
            <tr key={culture.id}>
              <td>{culture.name}</td>
              <td>{culture.variety}</td>
              <td>{culture.days_to_harvest}</td>
              <td>{culture.notes}</td>
              <td>
                <button onClick={() => handleDelete(culture.id!)} className="btn-delete">
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
