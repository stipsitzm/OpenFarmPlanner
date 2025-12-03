/**
 * Tasks (Aufgaben) page component.
 * 
 * Manages farm tasks with list and create functionality.
 * Tasks can be linked to planting plans.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Tasks page component
 */

import { useState, useEffect } from 'react';
import { taskAPI, plantingPlanAPI, type Task, type PlantingPlan } from '../api/client';

function Tasks(): React.ReactElement {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Task>({
    title: '',
    description: '',
    planting_plan: undefined,
    due_date: '',
    status: 'pending',
  });

  useEffect(() => {
    fetchTasks();
    fetchPlantingPlans();
  }, []);

  const fetchTasks = async (): Promise<void> => {
    try {
      const response = await taskAPI.list();
      setTasks(response.data.results);
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Aufgaben');
      console.error('Error fetching tasks:', err);
    }
  };

  const fetchPlantingPlans = async (): Promise<void> => {
    try {
      const response = await plantingPlanAPI.list();
      setPlantingPlans(response.data.results);
    } catch (err) {
      console.error('Error fetching planting plans:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await taskAPI.create(formData);
      setFormData({
        title: '',
        description: '',
        planting_plan: undefined,
        due_date: '',
        status: 'pending',
      });
      setShowForm(false);
      fetchTasks();
      setError('');
    } catch (err) {
      setError('Fehler beim Erstellen der Aufgabe');
      console.error('Error creating task:', err);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Möchten Sie diese Aufgabe wirklich löschen?')) return;
    
    try {
      await taskAPI.delete(id);
      fetchTasks();
      setError('');
    } catch (err) {
      setError('Fehler beim Löschen der Aufgabe');
      console.error('Error deleting task:', err);
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': 'Ausstehend',
      'in_progress': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'cancelled': 'Abgebrochen',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="page-container">
      <h1>Aufgaben</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <button onClick={() => setShowForm(!showForm)} className="toggle-form-btn">
        {showForm ? 'Abbrechen' : 'Neue Aufgabe hinzufügen'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="title">Titel *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Beschreibung</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="planting_plan">Anbauplan (optional)</label>
            <select
              id="planting_plan"
              value={formData.planting_plan || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                planting_plan: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              className="form-input"
            >
              <option value="">Kein Plan zugeordnet</option>
              {plantingPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.culture_name} in {plan.bed_name} - {plan.planting_date}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="due_date">Fälligkeitsdatum</label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status *</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ 
                ...formData, 
                status: e.target.value as Task['status'] 
              })}
              required
              className="form-input"
            >
              <option value="pending">Ausstehend</option>
              <option value="in_progress">In Bearbeitung</option>
              <option value="completed">Abgeschlossen</option>
              <option value="cancelled">Abgebrochen</option>
            </select>
          </div>

          <button type="submit" className="submit-btn">Speichern</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Status</th>
            <th>Fälligkeit</th>
            <th>Anbauplan</th>
            <th>Beschreibung</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>{getStatusLabel(task.status)}</td>
              <td>{task.due_date || '-'}</td>
              <td>{task.planting_plan_name || '-'}</td>
              <td>{task.description || '-'}</td>
              <td>
                <button
                  onClick={() => task.id && handleDelete(task.id)}
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

export default Tasks;
