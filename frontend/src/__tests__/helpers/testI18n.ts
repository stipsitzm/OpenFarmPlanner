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
