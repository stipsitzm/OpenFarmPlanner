# Keyboard & Edit Flow Analysis — PlantingPlans DataGrid

> **Scope:** `frontend/src/components/data-grid/DataGrid.tsx` and
> `frontend/src/pages/PlantingPlans.tsx`.  
> **Analysed at commit:** `c192054`  
> **Purpose:** Pure architecture analysis. No code was changed.

---

## 1. Grundprinzip: Row Editing

Der Grid verwendet `editMode="row"` (DataGrid.tsx:1241). MUI behandelt **immer
eine ganze Zeile** als editierbare Einheit — es gibt keinen separaten
cell-editing-Modus. Die einzige maßgebliche Edit-Zustandsquelle ist daher
`rowModesModel` (kein `cellModesModel`).

---

## 2. Eintritt in den Edit-Modus

Es gibt vier unabhängige Eintrittspfade.

### 2.1 Mausklick auf eine bearbeitbare Zelle

```
onCellClick (DataGrid.tsx:1288)
  → setDirtyRowIds
  → handleEditableCellClick (handlers.ts:23)
       Bedingung: params.isEditable && rowModesModel[id]?.mode !== Edit
       → setRowModesModel({ [id]: { mode: Edit, fieldToFocus: field } })
```

Gleichzeitig wird der Snapshot der Originalzeile in `rowSnapshotRef` gespeichert
(DataGrid.tsx:1290-1294).

### 2.2 Enter-Taste auf einer View-Zeile

```
onCellKeyDown (DataGrid.tsx:1314)
  Bedingung: Enter && editable && mode !== Edit
  → event.preventDefault() + defaultMuiPrevented = true
  → handleStartCellEditFromKeyboard (DataGrid.tsx:782)
       → api.setCellFocus(id, field)
       → setRowModesModel({ [id]: { mode: Edit, fieldToFocus: field } })
```

Snapshot wird ebenfalls angelegt (DataGrid.tsx:788-793).

### 2.3 Neue Zeile hinzufügen

```
handleAddClick (DataGrid.tsx:504)
  → createNewRow()
  → setRows([newRow, ...oldRows])
  → setRowModesModel({ [newRow.id]: { mode: Edit, fieldToFocus: columns[0].field } })
```

### 2.4 Keyboard-Navigation aus einer anderen Zeile (horizontale Pfeile/Tab)

Wird über `focusKeyboardNavigableCell` gestartet (DataGrid.tsx:348):

```
focusKeyboardNavigableCell(rowId, field, { startEdit: true })
  → api.scrollToIndexes(...)
  → api.setCellFocus(rowId, field)
  → setRowModesModel({ [rowId]: { mode: Edit, fieldToFocus: field } })
```

Gilt nur für horizontale Navigation (Tab, ArrowLeft, ArrowRight) auf
nicht-Notes-Spalten — Details in Abschnitt 5.

---

## 3. Austritt aus dem Edit-Modus

### 3.1 Speichern (normale Pfade)

Alle drei Speicherpfade setzen die Zeile auf `View`, was MUI's
`processRowUpdate` auslöst:

| Auslöser | Codestelle |
|---|---|
| Enter-Taste während Edit | DataGrid.tsx:1336 → `handleSaveRow` |
| Speichern-Button (Footer/Zeile) | DataGrid.tsx:1012 / 1104 → `handleSaveAllDirtyRows` / `handleSaveRow` |
| Keyboard-Navigation weg von der Zeile | DataGrid.tsx:662 in `navigateFromEditedCell` |
| Natürlicher Fokusverlust (Blur) | `onRowEditStop` / `rowFocusOut` → MUI's default |

```
handleSaveRow (DataGrid.tsx:751)
  → shouldSaveRow(rowId)
       → onBeforeSaveRow(draftRow)   // PlantingPlans: Flächenvalidierung
       → applyDraftValues(...)       // bei Partial<T>-Rückgabe
  → setRowModesModel({ [rowId]: { mode: View } })
       → MUI: processRowUpdate(newRow)
            → validateRow(newRow)
            → mapToApiData(row)
            → api.create / api.update
            → mapToRow(response)
            → setRows(...)
```

### 3.2 Abbrechen (Escape)

```
onCellKeyDown: event.key === 'Escape' (DataGrid.tsx:1342)
  → event.preventDefault()
  → handleDiscardRowChanges (DataGrid.tsx:513)
       → Snapshot wiederherstellen  (oder Zeile löschen wenn isNew)
       → setDirtyRowIds.delete(rowId)
       → setActiveValidationErrors.delete(rowId)
       → setRowModesModel({ [rowId]: { mode: View, ignoreModifications: true } })
```

`ignoreModifications: true` teilt MUI mit, dass kein `processRowUpdate`
aufgerufen werden soll → kein API-Aufruf.

Ergänzend: `handleRowEditStop` (handlers.ts:47) setzt
`event.defaultMuiPrevented = true` für `escapeKeyDown`, damit MUI's eigener
Escape-Handler nicht doppelt feuert.

### 3.3 Natürlicher Fokusverlust

Wenn der Fokus die Zeile ohne expliziten Tastendruck verlässt, feuert MUI den
`rowFocusOut`-Grund in `onRowEditStop`. `handleRowEditStop` lässt diesen Grund
ungehindert durch → MUI ruft `processRowUpdate` auf (Autosave on Blur).

---

## 4. `rowModesModel` — Lebenszyklus

```
{}
 ↓ addRow / click / Enter / keyboard-navigate-into
{ [rowId]: { mode: Edit, fieldToFocus?: string } }
 ↓ Enter-Save / Save-Button / navigate-away
{ [rowId]: { mode: View } }                        → processRowUpdate
 ↓ Escape
{ [rowId]: { mode: View, ignoreModifications: true } }  → kein processRowUpdate
```

**Schreiborte:**

| Funktion | Auswirkung |
|---|---|
| `handleAddClick` | setzt Edit + fieldToFocus |
| `handleEditableCellClick` | setzt Edit + fieldToFocus |
| `handleStartCellEditFromKeyboard` | setzt Edit + fieldToFocus |
| `focusKeyboardNavigableCell` | setzt Edit + fieldToFocus (bei `startEdit: true`) |
| `navigateFromEditedCell` | setzt View für aktuelle Zeile |
| `handleSaveRow` / `handleSaveAllDirtyRows` | setzt View |
| `handleDiscardRowChanges` | setzt View + ignoreModifications |
| `setDraftValues` (commandApi) | stellt Edit sicher (damit Werte nicht verworfen werden) |
| `onRowModesModelChange={setRowModesModel}` | MUI kann das Modell extern überschreiben |

Das Modell wird als React-State gehalten (`useState`, DataGrid.tsx:223) und ist
vollständig im `EditableDataGrid`-Wrapper gekapselt. `PlantingPlans.tsx` greift
nicht direkt auf `rowModesModel` zu, sondern ausschließlich über die
`commandApiRef`-Schnittstelle.

---

## 5. `setCellFocus` — Flow

`api.setCellFocus(rowId, field)` ist ein MUI DataGrid API-Aufruf, der:

1. den internen Fokuszustand (`gridApiRef.current.state.focus.cell`) setzt,
2. das DOM-Element der Zelle fokussiert,
3. ggf. scrollt (DataGrid.tsx:360-363 scrollt vorher explizit via
   `api.scrollToIndexes`).

`setCellFocus` wird aus zwei Stellen aufgerufen:

| Funktion | Bedingung |
|---|---|
| `focusKeyboardNavigableCell` (DataGrid.tsx:363) | Keyboard-Navigation zu einer Zielzelle |
| `handleStartCellEditFromKeyboard` (DataGrid.tsx:800) | Enter auf View-Zeile |

**Verhältnis zu Edit-Modus:** `setCellFocus` allein startet den Edit-Modus
*nicht*. Der Edit-Modus wird immer durch ein separates `setRowModesModel(...Edit)`
gestartet, das direkt nach `setCellFocus` aufgerufen wird.

**Fokus in Custom Renderers:** Edit-Zellen wie `AreaM2EditCell`,
`SearchableSelectEditCell`, `PlantsCountEditCell` prüfen `params.hasFocus` und
rufen bei `true` ihre innere Input-Referenz via `useEffect` auf. Das stellt
sicher, dass der DOM-Fokus innerhalb der Zelle landet, sobald MUI `hasFocus`
auf `true` setzt (was nach dem `setCellFocus`-Aufruf und dem nächsten Render
passiert).

---

## 6. Verhalten Enter

Enter ist dreifach belegt (geprüft in der Reihenfolge unten):

### 6.1 Notes-Spalte

```
Bedingung: notesFieldNames.includes(field) && key === 'Enter'
→ event.preventDefault() + defaultMuiPrevented = true
→ notesEditor.handleOpen(id, field)   // öffnet Notes-Drawer
```

### 6.2 Editierbare Zelle, Zeile im View-Modus

```
Bedingung: key === 'Enter' && isEditable && mode !== Edit
→ event.preventDefault() + defaultMuiPrevented = true
→ handleStartCellEditFromKeyboard(params)
     → api.setCellFocus(id, field)
     → setRowModesModel(Edit + fieldToFocus)
```

### 6.3 Zelle, Zeile im Edit-Modus

```
Bedingung: key === 'Enter' && mode === Edit
→ event.preventDefault() + defaultMuiPrevented = true
→ handleSaveRow(id)
     → shouldSaveRow → onBeforeSaveRow → (ggf. applyDraftValues)
     → setRowModesModel(View)
     → MUI: processRowUpdate → API-Aufruf
```

MUI's Standard-Enter-Verhalten (Zeile speichern) wird in allen drei Fällen via
`defaultMuiPrevented = true` unterdrückt.

---

## 7. Verhalten Pfeiltasten

### 7.1 Gemeinsame Eingangsbedingung

Der Capture-Handler `handleGridEditNavigation` (DataGrid.tsx:678) wird über
`onKeyDownCapture` ausgelöst — d.h. **bevor** jeder innere Handler eine Chance
bekommt. Er greift ein, wenn:

- Die Taste in `gridNavigationKeys` ist (`Tab`, `ArrowLeft`, `ArrowRight`,
  `ArrowUp`, `ArrowDown`),
- kein Alt/Ctrl/Meta/Composing,
- die fokussierte Zelle **im Edit-Modus** ist,
- für ArrowUp/ArrowDown: kein aufgeklapptes Dropdown offen ist
  (`isDropdownUsingArrowKey`, DataGrid.tsx:174).

Wenn diese Bedingungen nicht alle zutreffen, passiert nichts — der Event
propagiert normal durch MUI.

### 7.2 ArrowRight / ArrowLeft

```
Ziel:   getHorizontalNavigationTarget(rowId, field, ±1)
         → liefert { id: rowId, field: nächstesEditierbaresField }
         → gibt null zurück, wenn kein weiteres Feld in der Richtung existiert

Wenn Ziel vorhanden:
  event.preventDefault() + stopPropagation()
  navigateFromEditedCell(current, target, { startTargetEdit: true })
    → canLeaveEditedRowForKeyboardNavigation(current.id)
    → blurActiveElementInCell(current)
    → setRowModesModel({ [current.id]: View })          ← Zeile verlässt Edit
    → requestAnimationFrame():
         focusKeyboardNavigableCell(target.id, target.field, { startEdit: true })
           → api.setCellFocus(target)
           → setRowModesModel({ [target.id]: Edit })    ← Zeile tritt wieder in Edit
```

**Wenn Ziel nicht vorhanden** (erstes/letztes Feld): `null` wird zurückgegeben,
`preventDefault` wird nicht aufgerufen, MUI erhält das Event unverändert.

### 7.3 ArrowUp / ArrowDown

```
Ziel:   getVerticalNavigationTarget(rowId, field, ±1)
         → andere Zeile, selbes Feld (oder Fallback-Feld)
         → gibt null zurück, wenn keine weitere Zeile vorhanden

Wenn Ziel vorhanden:
  event.preventDefault() + stopPropagation()
  navigateFromEditedCell(current, target, { startTargetEdit: false })
    → (gleicher Pfad wie horizontal)
    → ABER startTargetEdit: false
    → focusKeyboardNavigableCell(target, { startEdit: false })
         → api.setCellFocus(target)
         → KEIN setRowModesModel → Zielzeile startet NICHT im Edit-Modus
```

ArrowUp/ArrowDown verlassen die aktuelle Zeile (Save), fokussieren die nächste,
starten die nächste Zeile aber **nicht automatisch** im Edit-Modus. Ein
weiterer Klick oder Enter ist nötig, um die Zielzeile zu editieren.

### 7.4 Übersicht

| Taste | Richtung | Ziel | startTargetEdit |
|---|---|---|---|
| ArrowLeft | horizontal −1 | gleiche Zeile, voriges Feld | **true** |
| ArrowRight | horizontal +1 | gleiche Zeile, nächstes Feld | **true** |
| ArrowUp | vertikal −1 | vorige Zeile, gleiches Feld | **false** |
| ArrowDown | vertikal +1 | nächste Zeile, gleiches Feld | **false** |
| Tab | horizontal +1 | gleiche Zeile, nächstes Feld | **true** |
| Shift+Tab | horizontal −1 | gleiche Zeile, voriges Feld | **true** |

---

## 8. Unterschiede Zeilen-/Zellmodus

Diese Anwendung nutzt ausschließlich `editMode="row"`. Der MUI
cell-editing-Modus ist nicht aktiviert und wird nirgendwo verwendet.

Konsequenzen aus dem Row-Modus:

| Aspekt | Row-Modus (aktiv) | Cell-Modus (nicht verwendet) |
|---|---|---|
| Edit-Zustandsträger | `rowModesModel` | `cellModesModel` |
| Granularität | gesamte Zeile tritt in/aus Edit | einzelne Zelle |
| `processRowUpdate` | feuert beim Verlassen der gesamten Zeile | feuert beim Verlassen der einzelnen Zelle |
| Mehrere Felder gleichzeitig editierbar | ja, alle Felder der Zeile | nein, nur ein Feld |
| `fieldToFocus` | kann angegeben werden, um initiales Fokusfeld zu steuern | nicht relevant |

Da alle Felder einer Zeile gleichzeitig im Edit-Modus sind, ist der Fokussprung
zwischen ArrowLeft/ArrowRight innerhalb einer Zeile ein reiner Fokus-Wechsel —
**der Edit-Modus der Zeile muss dabei technisch nicht beendet werden**. Die
aktuelle Implementierung tut dies trotzdem (Details in Abschnitt 9).

---

## 9. Ursache: Warum ArrowLeft/ArrowRight den Edit-Modus verliert

### 9.1 Beobachtung

Beim Navigieren von Feld A nach Feld B innerhalb derselben Zeile mit ArrowLeft
oder ArrowRight durchläuft die Zeile folgende Zustandssequenz:

```
[Zeile im Edit-Modus, Feld A fokussiert]
  ↓ ArrowRight
setRowModesModel({ [rowId]: View })         → Zeile verlässt Edit
  ↓ (synchron, gleicher React-Render-Zyklus)
MUI: rowFocusOut → processRowUpdate         → API-Aufruf wird ausgelöst
  ↓ requestAnimationFrame (nächster Frame)
setRowModesModel({ [rowId]: Edit, fieldToFocus: B })  → Zeile tritt wieder in Edit
```

### 9.2 Ursache im Code

`navigateFromEditedCell` (DataGrid.tsx:645) wurde als **allgemeiner**
Navigationsmechanismus entworfen, der immer folgende Schritte ausführt:

1. Validation / `onBeforeSaveRow` prüfen
2. Aktuelle Zeile auf `View` setzen (=Speichern auslösen)
3. Per `requestAnimationFrame` zur Zielzelle wechseln

Dieser Ablauf ist korrekt für **zeilenübergreifende Navigation** (ArrowUp/Down,
Tab bis Ende der Zeile). Für **zellinterne Navigation** (ArrowLeft/Right
innerhalb einer Zeile) ist der Umweg über `View` jedoch unnötig, weil die Zeile
im Edit-Modus bleibt und kein Speichern erforderlich wäre.

Da `navigateFromEditedCell` ohne Fallunterscheidung (gleiche vs. andere Zeile)
aufgerufen wird, tritt derselbe Save-Zyklus auch für Intrazeilen-Navigation auf:

```js
// DataGrid.tsx:714 — kein Unterschied ob gleiche oder andere Zeile
void navigateFromEditedCell(focusedCell, target, {
  startTargetEdit: isHorizontalNavigation && !notesFieldNames.includes(target.field),
});
```

### 9.3 Konkrete Nebeneffekte

| Nebeneffekt | Beschreibung |
|---|---|
| Unnötiger API-Aufruf | Jedes ArrowLeft/ArrowRight innerhalb einer Zeile löst `processRowUpdate` und damit `api.update(...)` aus — auch wenn der Nutzer noch weiter editieren wollte. |
| Kurzzeitiges View-State | Zwischen View und dem nächsten Edit-Eintritt über `requestAnimationFrame` befindet sich die Zeile einen Frame lang im View-Modus; React re-rendert die Zeile ohne Edit-Input. |
| Race Condition bei Validierung | Wenn `canLeaveEditedRowForKeyboardNavigation` (wegen `onBeforeSaveRow`) `false` zurückgibt (z.B. Flächenvalidierungsdialog öffnet sich), wird die Navigation abgebrochen. Der Cursor bleibt auf Feld A, obwohl der Nutzer nur zu Feld B wollte. |
| rAF-Timing | `setRowModesModel(View)` ist synchron; das erneute `setRowModesModel(Edit)` liegt im nächsten Animationsframe. Wenn zwischen diesen beiden Frames ein externer State-Update eintrifft (z.B. aus dem async `processRowUpdate`-Promise), kann die zweite `setRowModesModel`-Änderung überschrieben werden. |

### 9.4 Warum ArrowUp/ArrowDown dieses Problem *nicht* in gleicher Weise zeigt

Bei vertikaler Navigation ist `startTargetEdit: false`, d.h. die Zielzeile tritt
nach dem Speichern der aktuellen Zeile **nicht automatisch** in den Edit-Modus.
Der Nutzer bemerkt daher nur das Speichern der alten Zeile — dieses Verhalten
ist gewollt (Autosave on Navigate).

Bei horizontaler Navigation hingegen erwartet der Nutzer, weiterhin in der
gleichen Zeile zu editieren. Der `View → Edit`-Übergang ist für ihn unsichtbar,
solange kein Validierungsfehler oder API-Fehler eintritt.

---

## 10. Zusammenfassung Speicherfluss

```
[Auslöser: Enter / Save-Button / Keyboard-Navigate-Away / Blur]
  ↓
shouldSaveRow(rowId)
  ↓
onBeforeSaveRow(draftRow)           [optional, z.B. Flächenvalidierung]
  ├─ false   → Abbruch, ggf. Dialog
  ├─ Partial → applyDraftValues → Draft-Werte korrigieren
  └─ true    → weiter
  ↓
setRowModesModel({ [rowId]: View })
  ↓
MUI: processRowUpdate(newRow)
  ├─ validateRow(newRow)            [Pflichtfelder]
  ├─ mapToApiData(row)
  ├─ api.create / api.update
  ├─ mapToRow(response)
  └─ setRows(...)

[Abbruch via Escape]
  ↓
handleDiscardRowChanges(rowId)
  ├─ Snapshot wiederherstellen
  ├─ dirtyRowIds / validationErrors bereinigen
  └─ setRowModesModel({ mode: View, ignoreModifications: true })
     → kein processRowUpdate, kein API-Aufruf
```
