import React from 'react';
export const fieldSx = { minWidth: '200px', flex: '1 1 45%' };
export const smallFieldSx = { minWidth: '150px', flex: '1 1 22%' };
export const spacingFieldSx = { minWidth: '200px', flex: '1 1 30%' };
export const colorFieldSx = { maxWidth: '300px' };

// Wrapper für Felder mit flex: 1
export function FieldWrapper({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'flex', flex: 1 }}>{children}</span>;
}
// Zentraler Style- und Hilfetext-Export für CultureForm
// Typisierung entfernt, da SxProps nicht als Export verfügbar ist


