/**
 * Tiny shared cache for note attachment lists, keyed by note id.
 *
 * The notes preview popover fetches attachments lazily (only once opened) and
 * reuses this cache so re-hovering the same row doesn't re-fetch. NotesDrawer
 * invalidates a note's entry after uploading/deleting an attachment so the
 * preview never shows stale data.
 */

import { noteAttachmentAPI } from '../../api/api';
import type { NoteAttachment } from '../../api/types';

const cache = new Map<number, Promise<NoteAttachment[]>>();

export function getCachedNoteAttachments(noteId: number): Promise<NoteAttachment[]> {
  const existing = cache.get(noteId);
  if (existing) {
    return existing;
  }

  const request = noteAttachmentAPI
    .list(noteId)
    .then((response) => response.data)
    .catch((error: unknown) => {
      cache.delete(noteId);
      throw error;
    });

  cache.set(noteId, request);
  return request;
}

export function invalidateNoteAttachmentsCache(noteId: number): void {
  cache.delete(noteId);
}
