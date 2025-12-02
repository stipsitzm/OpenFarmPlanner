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
    <div style={{ padding: '20px' }}>
      <h1>Beds</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: '20px' }}>
        {showForm ? 'Cancel' : 'Add New Bed'}
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
              Field:
              <select
                value={formData.field}
                onChange={(e) => setFormData({ ...formData, field: parseInt(e.target.value) })}
                required
                style={{ marginLeft: '10px', width: '200px' }}
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
          <div style={{ marginBottom: '10px' }}>
            <label>
              Length (m):
              <input
                type="number"
                step="0.01"
                value={formData.length_m || ''}
                onChange={(e) => setFormData({ ...formData, length_m: e.target.value ? parseFloat(e.target.value) : undefined })}
                style={{ marginLeft: '10px', width: '200px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Width (m):
              <input
                type="number"
                step="0.01"
                value={formData.width_m || ''}
                onChange={(e) => setFormData({ ...formData, width_m: e.target.value ? parseFloat(e.target.value) : undefined })}
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
          <button type="submit">Create Bed</button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Field</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Length (m)</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Width (m)</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Notes</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{bed.name}</td>
              <td style={{ padding: '10px' }}>{bed.field_name}</td>
              <td style={{ padding: '10px' }}>{bed.length_m}</td>
              <td style={{ padding: '10px' }}>{bed.width_m}</td>
              <td style={{ padding: '10px' }}>{bed.notes}</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => handleDelete(bed.id!)} style={{ color: 'red' }}>
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
