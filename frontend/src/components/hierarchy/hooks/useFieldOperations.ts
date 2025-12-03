/**
 * Custom hook for field operations (CRUD)
 */

import { fieldAPI, type Location } from '../../../api/client';

export function useFieldOperations(
  locations: Location[],
  setError: (error: string) => void,
  fetchData: () => Promise<void>
) {
  const addField = async (locationId?: number): Promise<void> => {
    // Use first location if not specified
    const targetLocationId = locationId || (locations.length > 0 ? locations[0].id : undefined);
    if (!targetLocationId) {
      setError('Bitte erstellen Sie zuerst einen Standort');
      return;
    }

    const fieldName = window.prompt('Name des neuen Schlags:');
    if (!fieldName || fieldName.trim() === '') {
      return; // User cancelled or entered empty name
    }

    try {
      await fieldAPI.create({
        name: fieldName.trim(),
        location: targetLocationId,
        area_sqm: undefined,
        notes: '',
      });
      
      // Reload all data to get the new field
      await fetchData();
      setError('');
    } catch (err) {
      setError('Fehler beim Erstellen des Schlags');
      console.error('Error creating field:', err);
    }
  };

  const deleteField = async (fieldId: number): Promise<void> => {
    if (!window.confirm('Möchten Sie diesen Schlag wirklich löschen? Alle zugehörigen Beete werden ebenfalls gelöscht.')) {
      return;
    }

    try {
      await fieldAPI.delete(fieldId);
      await fetchData();
      setError('');
    } catch (err) {
      setError('Fehler beim Löschen des Schlags');
      console.error('Error deleting field:', err);
    }
  };

  return {
    addField,
    deleteField,
  };
}
