import { describe, expect, it } from 'vitest';
import { getHistoryActorLabel, getHistoryEntryMeta, getHistoryEntryTitle } from '../pages/culturesHistoryUtils';
import i18n from '../i18n';
import type { CultureHistoryEntry } from '../api/types';

const t = i18n.getFixedT('de', 'cultures');

function buildEntry(partial: Partial<CultureHistoryEntry>): CultureHistoryEntry {
  return {
    history_id: 1,
    history_date: '2026-03-23T14:48:00.000Z',
    history_type: 'snapshot',
    history_user: null,
    summary: '',
    ...partial,
  };
}

describe('culturesHistoryUtils', () => {
  it('builds a localized title with object label and display name', () => {
    const entry = buildEntry({
      object_type: 'culture',
      object_display_name: 'Bijella',
      action: 'updated',
    });

    expect(getHistoryEntryTitle(entry, t)).toBe('Kultur „Bijella“ bearbeitet');
  });

  it('falls back to generic localized labels for unknown object type and missing name', () => {
    const entry = buildEntry({
      object_type: 'unknown_type',
      object_display_name: null,
      action: 'created',
    });

    expect(getHistoryEntryTitle(entry, t)).toBe('Eintrag erstellt');
  });

  it('prefers actor_label over history_user and falls back to unknown user', () => {
    const withActor = buildEntry({ actor_label: 'Martin Stipsitz', history_user: 'ignored@example.com' });
    const withHistoryUser = buildEntry({ actor_label: '', history_user: 'user@example.com' });
    const withoutActor = buildEntry({ actor_label: '', history_user: null });

    expect(getHistoryActorLabel(withActor, t)).toBe('Martin Stipsitz');
    expect(getHistoryActorLabel(withHistoryUser, t)).toBe('user@example.com');
    expect(getHistoryActorLabel(withoutActor, t)).toBe('Unbekannter Nutzer');
  });

  it('builds metadata line with actor and timestamp', () => {
    const entry = buildEntry({
      actor_label: 'Martin Stipsitz',
      history_date: '2026-03-23T14:48:00.000Z',
    });

    const meta = getHistoryEntryMeta(entry, t);
    expect(meta).toContain('von Martin Stipsitz ·');
  });
});
