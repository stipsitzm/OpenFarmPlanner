import type { TFunction } from 'i18next';
import type { CultureHistoryEntry } from '../api/types';

const OBJECT_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  culture: 'history.objectTypes.culture',
  planting_plan: 'history.objectTypes.plantingPlan',
  location: 'history.objectTypes.location',
  field: 'history.objectTypes.field',
  bed: 'history.objectTypes.bed',
  supplier: 'history.objectTypes.supplier',
  task: 'history.objectTypes.task',
  note_attachment: 'history.objectTypes.noteAttachment',
  media_file: 'history.objectTypes.mediaFile',
  seed_package: 'history.objectTypes.seedPackage',
  project: 'history.objectTypes.project',
};

const ACTION_TRANSLATION_KEYS: Record<string, string> = {
  created: 'history.actions.created',
  updated: 'history.actions.updated',
  deleted: 'history.actions.deleted',
  restored: 'history.actions.restored',
};

export function getHistoryObjectTypeLabel(objectType: string | undefined, t: TFunction<'cultures'>): string {
  if (!objectType) {
    return t('history.objectTypes.fallback');
  }
  return t(OBJECT_TYPE_TRANSLATION_KEYS[objectType] ?? 'history.objectTypes.fallback');
}

export function getHistoryActionLabel(action: string | undefined, t: TFunction<'cultures'>): string {
  if (!action) {
    return t('history.actions.updated');
  }
  return t(ACTION_TRANSLATION_KEYS[action] ?? 'history.actions.updated');
}

export function getHistoryEntryTitle(entry: CultureHistoryEntry, t: TFunction<'cultures'>): string {
  const objectTypeLabel = getHistoryObjectTypeLabel(entry.object_type, t);
  const actionLabel = getHistoryActionLabel(entry.action, t);
  const objectDisplayName = entry.object_display_name?.trim();

  if (objectDisplayName) {
    return t('history.title.withName', {
      objectType: objectTypeLabel,
      objectName: objectDisplayName,
      action: actionLabel,
    });
  }

  return t('history.title.withoutName', {
    objectType: objectTypeLabel,
    action: actionLabel,
  });
}

export function getHistoryActorLabel(entry: CultureHistoryEntry, t: TFunction<'cultures'>): string {
  return entry.actor_label?.trim()
    || entry.history_user?.trim()
    || t('history.unknownUser');
}

export function getHistoryEntryMeta(entry: CultureHistoryEntry, t: TFunction<'cultures'>): string {
  const actorLabel = getHistoryActorLabel(entry, t);
  const timestamp = new Date(entry.history_date).toLocaleString();
  return t('history.meta', { actor: actorLabel, timestamp });
}
