import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHelp from '../components/help/PageHelp';

describe('PageHelp', () => {
  it('renders compact planting plans help without structured sections', async () => {
    render(<PageHelp pageKey="plantingPlans" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Hier planst du, welche Kultur wann auf welchem Beet angebaut wird. Die Seite verbindet Anbauflächen und Kulturen und bildet die Grundlage für Anbaukalender und Saatgutbedarf.')).toBeInTheDocument();
    expect(screen.getByText('Einträge können direkt in der Tabelle erstellt und bearbeitet werden.')).toBeInTheDocument();
    expect(screen.getByText('Anbaukalender und Saatgutbedarf werden automatisch aus diesen Planungen berechnet.')).toBeInTheDocument();

    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Zusammenhang mit anderen Seiten')).not.toBeInTheDocument();
    expect(screen.queryByText('Symbole und Bedienelemente')).not.toBeInTheDocument();
    expect(screen.queryByText('Anbauplan hinzufügen')).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders compact dashboard help without structured sections', async () => {
    render(<PageHelp pageKey="dashboard" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Die Übersicht zeigt die nächsten wichtigen Aufgaben aus deiner Planung.')).toBeInTheDocument();
    expect(screen.getByText('Sobald Anbaupläne vorhanden sind, erscheinen hier anstehende Termine für Aussaat, Pflanzung, Anzucht und Ernte.')).toBeInTheDocument();
    expect(screen.getByText('Änderungen an den Daten erfolgen in den jeweiligen Bereichen wie Anbauflächen, Kulturen oder Anbaupläne.')).toBeInTheDocument();
    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Hinweis')).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders compact areas list help without obsolete symbol guidance', async () => {
    render(<PageHelp pageKey="areas" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Hier verwaltest du die Flächenstruktur deines Betriebs – vom Standort über Parzellen bis zu einzelnen Beeten.')).toBeInTheDocument();
    expect(screen.getByText('Neue Standorte, Parzellen und Beete können über das', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('AddIcon')).toBeInTheDocument();
    expect(screen.getByText('hinzugefügt werden, das beim Überfahren eines Elements mit der Maus erscheint.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Einträge können direkt in der Tabelle bearbeitet werden. Weitere Aktionen wie Umbenennen, Löschen oder das Anlegen von Anbauplänen findest du im Kontextmenü per Rechtsklick.')).toBeInTheDocument();
    expect(screen.getByText('Die angelegten Flächen bilden die Grundlage für deine Anbauplanung.')).toBeInTheDocument();
    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Zusammenhang mit anderen Seiten')).not.toBeInTheDocument();
    expect(screen.queryByText('Symbole und Bedienelemente')).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders cultures help with vertical more-actions icon and without separate delete symbol', async () => {
    render(<PageHelp pageKey="cultures" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Weitere Aktionen öffnen')).toBeInTheDocument();
    expect(screen.getAllByTestId('MoreVertIcon').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Über', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('erreichst du weitere Aktionen wie Versionen, Veröffentlichung in der öffentlichen Kulturbibliothek oder das Löschen der ausgewählten Kultur.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/⋯/)).not.toBeInTheDocument();
    expect(screen.queryByText('Kultur entfernen')).not.toBeInTheDocument();
  });

  it('renders compact calendar help without controls or icon guidance', async () => {
    render(<PageHelp pageKey="calendar" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Der Anbaukalender visualisiert die zeitliche Planung deiner Anbaupläne. So erkennst du Belegungen, Anzuchtphasen, Erntezeiträume und mögliche Überschneidungen.')).toBeInTheDocument();
    expect(screen.getByText('Fahre über Einträge, um weitere Details anzuzeigen.')).toBeInTheDocument();
    expect(screen.getByText('Änderungen in den Anbauplänen werden hier automatisch übernommen.')).toBeInTheDocument();

    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Zusammenhang mit anderen Seiten')).not.toBeInTheDocument();
    expect(screen.queryByText('Symbole und Bedienelemente')).not.toBeInTheDocument();
    expect(screen.queryByText('Zwischen Ansichten wechseln')).not.toBeInTheDocument();
    expect(screen.queryByText(/Drag & Drop/)).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders compact seed demand help without supplier or package control guidance', async () => {
    render(<PageHelp pageKey="seedDemand" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Hier siehst du den berechneten Saatgutbedarf deiner Anbaupläne.')).toBeInTheDocument();
    expect(screen.getByText('Die Berechnung basiert auf den Kulturdaten und Anbauplänen. Änderungen werden automatisch übernommen.')).toBeInTheDocument();

    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Zusammenhang mit anderen Seiten')).not.toBeInTheDocument();
    expect(screen.queryByText('Symbole und Bedienelemente')).not.toBeInTheDocument();
    expect(screen.queryByText('Lieferant pro Kultur festlegen')).not.toBeInTheDocument();
    expect(screen.queryByText('Empfohlene Packungskombinationen prüfen')).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders compact suppliers help without icon guidance', async () => {
    render(<PageHelp pageKey="suppliers" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    expect(await screen.findByText('Hier verwaltest du deine Lieferanten.')).toBeInTheDocument();
    expect(screen.getByText('Lieferanten können in Kulturen hinterlegt werden, um kulturspezifische Artikel- und Verpackungsinformationen zu erfassen. Diese Daten werden für Saatgutbedarf und Bestellvorschläge verwendet.')).toBeInTheDocument();

    expect(screen.queryByText('Bedienung')).not.toBeInTheDocument();
    expect(screen.queryByText('Symbole und Bedienelemente')).not.toBeInTheDocument();
    expect(screen.queryByText('Lieferanten hinzufügen')).not.toBeInTheDocument();
    expect(screen.queryByText('Lieferantendaten ändern')).not.toBeInTheDocument();
    expect(screen.queryByText('Lieferanten entfernen')).not.toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });
});
