# QA Report – OpenFarmPlanner (Manueller Tester)

**Erfasst:** 2026-06-23  
**Quelle:** Feedback eines manuellen Testers (reale Nutzung, kein Automatisierungsframework)  
**Getestete Bereiche:** Anbauflächen (Liste + Grafik), Anbaupläne, Lieferanten

---

## Zusammenfassung

| # | Schweregrad | Bereich | Titel | Status |
|---|-------------|---------|-------|--------|
| T-01 | **Hoch** | Anbauflächen – Inline-Edit | Leere Parzelle kann nicht gelöscht werden | ✅ Behoben |
| T-02 | **Hoch** | Anbauflächen – Grafik | Parzellenname in Grafik teilweise nicht angezeigt | ✅ Behoben |
| T-03 | **Hoch** | Anbauflächen – Grafik | Größenverhältnis der Parzellen in der Grafik falsch | ✅ Behoben |
| T-04 | **Hoch** | Anbaupläne | Pflanz- und Erntezeiträume nicht korrekt dargestellt | ✅ Behoben |
| T-05 | **Hoch** | Anbauflächen – Grafik | Beete lassen sich nicht über die gesamte Parzelle verteilen | ✅ Behoben |
| T-06 | **Mittel** | Notizen | Markdown-Formatierung für Notizen zu technisch | ✅ Behoben (WYSIWYG) |
| T-07 | **Mittel** | Anbauflächen – Onboarding | Hervorgehobenes „Parzelle anlegen" beim Einstieg verwirrend | 🚫 Won't Fix |
| T-08 | **Mittel** | Lieferanten | Löschen nur über Rechtsklick schwer auffindbar | ✅ Behoben |
| T-09 | **Mittel** | Anbauflächen | Beet hinzufügen zunächst wenig intuitiv | 🚫 Won't Fix |

---

## Behobene Issues

### T-01 — Leere Parzelle kann nicht gelöscht werden

**Bereich:** Anbauflächen – Inline-Edit

**Beschreibung:**
Eine neu angelegte, noch nicht gespeicherte Parzelle (ohne eingetragene Daten) ließ sich nicht löschen. Das Löschen funktionierte erst, nachdem mindestens ein Feld befüllt und gespeichert wurde.

**Ursache:**
Der Delete-Handler in `useHierarchyDelete.ts` prüfte nicht, ob die Zeile überhaupt bereits eine persistierte ID hat. Für ungespeicherte Zeilen (negative ID) wurde ein API-Call ausgelöst, der fehlschlug.

**Fix:**
Eingeführt in `5622a635` auf `codex/fix-small-bed-layout-proportions`, wiederhergestellt in `68d5a725`.

Delete-Handler prüft nun zuerst `hasPersistedEntityId(targetId)`. Ist die ID negativ (ungespeicherte Zeile), wird die Zeile sofort aus dem lokalen State entfernt — kein API-Call, keine Fehlermeldung.

**Betroffene Dateien:**
- `frontend/src/components/hierarchy/hooks/useHierarchyDelete.ts`
- `frontend/src/components/hierarchy/utils/hierarchyUtils.ts` (`hasPersistedEntityId` hinzugefügt)

---

### T-02 — Parzellenname wird in der Grafik teilweise nicht angezeigt

**Bereich:** Anbauflächen – Grafik-Ansicht

**Beschreibung:**
Bei zwei angelegten Parzellen zeigte eine ihren Namen, die andere nicht. Die Beschriftung fehlte, sobald die Beet-Rechtecke unterhalb eines bestimmten Zoom-Schwellenwerts lagen.

**Ursache:**
`shouldShowBedLabel` in `graphicalViewport.ts` sperrte die Anzeige hinter einem kombinierten Pixel- und Zoom-Schwellenwert. Beim typischen Fit-to-Screen-Zoom lagen viele Rechtecke unterhalb dieses Schwellenwerts.

**Fix:**
Eingeführt in `e7fe3526` auf `codex/fix-small-bed-layout-proportions`, wiederhergestellt in `68d5a725`.

Schwellenwerte reduziert (Breite: 46 → 22 px, Höhe: 18 → 14 px) und der Zoom-Gate entfernt. Labels erscheinen jetzt bereits beim normalen Fit-to-Screen-Zoom, solange das Rechteck die minimale Pixelgröße auf dem Bildschirm einnimmt.

**Betroffene Dateien:**
- `frontend/src/pages/graphicalViewport.ts`
- `frontend/src/pages/GraphicalFields.tsx`

---

### T-03 — Größenverhältnis der Parzellen in der Grafik falsch

**Bereich:** Anbauflächen – Grafik-Ansicht

**Beschreibung:**
Ein Hauptbeet (ca. 3×3 m) wurde in der Grafik kleiner dargestellt als eine deutlich kleinere Dreiecksfläche. Das Größenverhältnis war invertiert.

**Ursache:**
`getBedRectSize` und `getBedRectSizeWithinField` in `graphicalLayoutUtils.ts` wendeten `Math.max(20, Math.round(...))` auf die berechneten Pixel-Größen an. Bei kleinen Flächen unterschritten beide Werte die 20-px-Grenze und wurden auf denselben Wert normiert — das tatsächliche Verhältnis ging verloren.

**Fix:**
Eingeführt in `586e1b7b` auf `codex/fix-small-bed-layout-proportions`, wiederhergestellt in `f78a4668`.

`Math.max(20, ...)` entfernt. Größen werden jetzt direkt aus `length_m * pxPerMeter` berechnet.

**Betroffene Dateien:**
- `frontend/src/pages/graphicalLayoutUtils.ts`

---

### T-08 — Löschen nur über Rechtsklick schwer auffindbar

**Bereich:** Lieferanten

**Beschreibung:**
Zwei Tester meldeten unabhängig voneinander, dass sie erwartet hätten, ein sichtbares Löschen-Symbol zu finden. Das Löschen war nur über das Rechtsklick-Kontextmenü zugänglich.

**Fix:**
Eingeführt in `ecaaff16` auf `codex/fix-small-bed-layout-proportions`, wiederhergestellt in `61a63d64`.

Edit- und Delete-Icons werden jetzt beim Hover über eine Zeile sichtbar (Opacity-Transition 120 ms). Zusätzlich öffnet ein Klick auf die Zeile direkt den Bearbeitungsdialog (`e2e673a3`, wiederhergestellt in `68d5a725`). Die Hover-Icons entsprechen dem bereits etablierten Muster in der Anbauflächen-Hierachie.

**Betroffene Dateien:**
- `frontend/src/pages/Suppliers.tsx`

---

## Sonstige Issues

### T-04 — Pflanz- und Erntezeiträume nicht korrekt dargestellt

**Bereich:** Anbaupläne

**Beschreibung:**
Eingetragene Pflanz- und Erntezeiträume wurden nach dem Speichern zunächst nur mit dem ersten Tag dargestellt. Erst nach Verschieben des aktiven Zeitraums aktualisierte sich die Anzeige korrekt.

**Status:** ✅ Behoben.

---

### T-05 — Beete lassen sich grafisch nicht über die gesamte Parzelle verteilen

**Bereich:** Anbauflächen – Grafik-Ansicht

**Beschreibung:**
Beete ließen sich nur in einem Teil der Parzellenfläche positionieren. Die Drag-Interaktion wurde durch den Text-Layer der Parzellenbeschriftung blockiert.

**Status:** ✅ Behoben.

---

### T-06 — Markdown-Formatierung für Notizen zu technisch

**Bereich:** Notizen überall

**Beschreibung:**
Fett/Kursiv funktioniert per Markdown-Syntax, aber Tester empfand dies als zu technisch. Leerzeichen beim Doppelklick markieren stören die Formatierung.

**Status:** ✅ Behoben – WYSIWYG Rich-Text-Editor eingeführt (`7fa40d84`).

---

### T-07 — Hervorgehobenes „Parzelle anlegen" beim Einstieg verwirrend

**Bereich:** Anbauflächen – Onboarding

**Beschreibung:**
Tester dachte beim ersten Besuch, er müsse auf das hervorgehobene Element klicken, aber es war nur eine Orientierungshilfe für den nächsten empfohlenen Schritt.

**Status:** 🚫 Won't Fix.

---

### T-09 — Beet hinzufügen zunächst wenig intuitiv

**Bereich:** Anbauflächen

**Beschreibung:**
Der erste Eindruck beim Anlegen eines Beets war etwas unklar, nach kurzer Eingewöhnung aber verständlich.

**Status:** 🚫 Won't Fix.
