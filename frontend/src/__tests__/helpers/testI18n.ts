export const i18nMap: Record<string, string> = {
  'common:messages.unsavedChanges': 'Ungespeicherte Änderungen',
  'common:messages.validationErrors': 'Validierungsfehler vorhanden',
  'common:actions.delete': 'Löschen',
  'common:actions.actions': 'Aktionen',
  'common:fields.notes': 'Notizen',
  'hierarchy:columns.name': 'Name',
  'hierarchy:columns.area': 'Fläche (m²)',
  'hierarchy:addBed': 'Beet hinzufügen',
  'hierarchy:addField': 'Feld hinzufügen',
  addField: 'Feld hinzufügen',
  'hierarchy:createPlantingPlan': 'Pflanzplan erstellen',
  'messages.createLocationFirst': 'Bitte erstellen Sie zuerst einen Standort.',
  'prompts.newFieldName': 'Name des neuen Schlags:',
  'confirm.deleteFieldWithBeds': 'Feld löschen?',
  'confirm.deleteBed': 'Beet löschen?',
  'errors.createField': 'Fehler beim Erstellen des Schlags',
  'errors.deleteField': 'Fehler beim Löschen des Schlags',
  'errors.saveBed': 'Fehler beim Speichern des Beets',
  'errors.deleteBed': 'Fehler beim Löschen des Beets',
  'hierarchy:columns.length': 'Länge (m)',
  'hierarchy:columns.width': 'Breite (m)',
  'columns.length': 'Länge (m)',
  'columns.width': 'Breite (m)',
  'tooltips.length': 'Länge in Metern',
  'tooltips.width': 'Breite in Metern',
  'tooltips.expand': 'Eintrag aufklappen',
  'tooltips.collapse': 'Eintrag zuklappen',
  'tooltips.addField': 'Schlag hinzufügen',
  'footer.singleLocation': 'Ein Standort',
  'footer.multipleLocations': 'Mehrere Standorte',
};

export const mockT = (key: string): string => i18nMap[key] ?? key;

export const mockUseTranslationReturn = {
  t: mockT,
  i18n: {
    language: 'de',
    changeLanguage: async () => undefined,
  },
};
