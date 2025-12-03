import { useEffect, useState } from 'react';
import { bedAPI, fieldAPI, type Bed, type Field } from '../api/client';

function Beds() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  const fetchData = async () => {
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
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bedAPI.create(formData);
      setFormData({ name: '', field: 0, length_m: undefined, width_m: undefined, notes: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError('Failed to create bed');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this bed?')) {
      try {
        await bedAPI.delete(id);
        fetchData();
      } catch (err) {
        setError('Failed to delete bed');
        console.error(err);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="page-container">
      <h1>Beds</h1>
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        {showForm ? 'Cancel' : 'Add New Bed'}
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
              Field:
              <select
                value={formData.field}
                onChange={(e) => setFormData({ ...formData, field: parseInt(e.target.value) })}
                required
                className="form-input"
              >
                <option value="">Select a field</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name} ({field.location_name})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-group">
            <label>
              Length (m):
              <input
                type="number"
                step="0.01"
                value={formData.length_m || ''}
                onChange={(e) => setFormData({ ...formData, length_m: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="form-input"
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Width (m):
              <input
                type="number"
                step="0.01"
                value={formData.width_m || ''}
                onChange={(e) => setFormData({ ...formData, width_m: e.target.value ? parseFloat(e.target.value) : undefined })}
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
          <button type="submit">Create Bed</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Field</th>
            <th>Length (m)</th>
            <th>Width (m)</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id}>
              <td>{bed.name}</td>
              <td>{bed.field_name}</td>
              <td>{bed.length_m}</td>
              <td>{bed.width_m}</td>
              <td>{bed.notes}</td>
              <td>
                <button onClick={() => handleDelete(bed.id!)} className="btn-delete">
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

export default Beds;
