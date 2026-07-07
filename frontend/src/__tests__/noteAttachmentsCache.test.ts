import { vi } from 'vitest';

const listMock = vi.fn();

vi.mock('../api/api', () => ({
  noteAttachmentAPI: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

import { getCachedNoteAttachments, invalidateNoteAttachmentsCache } from '../components/data-grid/noteAttachmentsCache';

describe('noteAttachmentsCache', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('only fetches once for repeated calls with the same note id', async () => {
    listMock.mockResolvedValue({ data: [{ id: 1 }] });

    const first = await getCachedNoteAttachments(42);
    const second = await getCachedNoteAttachments(42);

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('fetches again after invalidation', async () => {
    listMock.mockResolvedValue({ data: [{ id: 1 }] });

    await getCachedNoteAttachments(7);
    invalidateNoteAttachmentsCache(7);
    await getCachedNoteAttachments(7);

    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed request so it can be retried', async () => {
    listMock.mockRejectedValueOnce(new Error('network error'));
    listMock.mockResolvedValueOnce({ data: [] });

    await expect(getCachedNoteAttachments(9)).rejects.toThrow('network error');
    await expect(getCachedNoteAttachments(9)).resolves.toEqual([]);

    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
