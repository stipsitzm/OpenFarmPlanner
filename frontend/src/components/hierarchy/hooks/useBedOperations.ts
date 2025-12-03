/**
 * Custom hook for bed operations (CRUD)
 */

import { useState } from 'react';
import { bedAPI, type Bed } from '../../../api/client';

export function useBedOperations(
  beds: Bed[],
  setBeds: React.Dispatch<React.SetStateAction<Bed[]>>,
  setError: (error: string) => void
) {
  const [pendingEditRow, setPendingEditRow] = useState<number | null>(null);

  const addBed = (fieldId: number): number => {
    const newBedId = -Date.now();
    const newBed: Bed = {
      id: newBedId,
      name: '',
      field: fieldId,
      length_m: undefined,
      width_m: undefined,
      notes: '',
    };

    // Add temporary bed to beds state
    setBeds((prevBeds) => [newBed, ...prevBeds]);

    // Return the ID for setting edit mode
    return newBedId;
  };

  const saveBed = async (bedData: Partial<Bed> & { id: number; field: number }): Promise<Bed> => {
    const isNew = bedData.id < 0;

    try {
      const payload = {
        name: bedData.name || '',
        field: bedData.field,
        length_m: bedData.length_m,
        width_m: bedData.width_m,
        notes: bedData.notes || '',
      };

      if (isNew) {
        // Create new bed
        const response = await bedAPI.create(payload);
        setError('');
        
        // Remove temporary bed and add saved bed to state
        setBeds((prevBeds) => {
          const filteredBeds = prevBeds.filter(b => b.id !== bedData.id);
          return [response.data, ...filteredBeds];
        });
        
        return response.data;
      } else {
        // Update existing bed
        const response = await bedAPI.update(bedData.id, payload);
        setError('');
        
        // Update bed in state
        setBeds((prevBeds) => 
          prevBeds.map(b => b.id === bedData.id ? response.data : b)
        );
        
        return response.data;
      }
    } catch (err) {
      setError('Fehler beim Speichern des Beets');
      console.error('Error saving bed:', err);
      throw err;
    }
  };

  const deleteBed = async (bedId: number): Promise<void> => {
    if (!window.confirm('Möchten Sie dieses Beet wirklich löschen?')) return;

    if (bedId < 0) {
      // Remove unsaved bed from state
      setBeds((prevBeds) => prevBeds.filter((bed) => bed.id !== bedId));
      return;
    }

    try {
      await bedAPI.delete(bedId);
      // Remove bed from state
      setBeds((prevBeds) => prevBeds.filter((bed) => bed.id !== bedId));
      setError('');
    } catch (err) {
      setError('Fehler beim Löschen des Beets');
      console.error('Error deleting bed:', err);
      throw err;
    }
  };

  return {
    addBed,
    saveBed,
    deleteBed,
    pendingEditRow,
    setPendingEditRow,
  };
}
