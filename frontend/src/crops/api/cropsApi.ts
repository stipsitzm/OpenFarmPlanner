/**
 * Crop Library API client — talks to the new, additive `/api/crops` surface
 * (see docs/crop-library-architecture.md) rather than the legacy
 * `/api/public-cultures` one `api/api.ts`'s `publicCultureAPI` still uses.
 *
 * Not wired into any page yet. `Cultures.tsx`/`PublicCultureLibraryDialog`
 * keep using `publicCultureAPI` unchanged — switching them over is a
 * separate, deliberately deferred step (see the architecture doc) once
 * `/api/crops` has been exercised in production for a while.
 *
 * Known limitation: this reuses the shared `httpClient`, which attaches an
 * `X-Project-Id` header to every request whenever a project happens to be
 * active in local storage. The crop library ignores that header today, but
 * a genuinely standalone crop-library client should eventually get its own
 * instance instead of inheriting app-wide, project-scoped plumbing.
 */
import http from '../../api/httpClient';
import type { PaginatedResponse, PublicCulture, PublicCultureMatchResponse } from '../../api/types';

/** Alias so new crop-library code can talk about "Crop" rather than the
 * backend/historical "Culture" naming — see docs/crop-library-architecture.md
 * section 7. The shape is identical to `PublicCulture`; this is a type
 * alias, not a copy, so it can never drift. */
export type Crop = PublicCulture;
export type CropMatchResponse = PublicCultureMatchResponse;

export const cropsApi = {
  list: (params?: { q?: string; name?: string; variety?: string }) =>
    http.get<PaginatedResponse<Crop>>('/crops/', { params }),
  get: (id: number) => http.get<Crop>(`/crops/${id}/`),
  match: (params: { name: string; variety: string }, signal?: AbortSignal) =>
    http.get<CropMatchResponse>('/crops/match/', { params, signal }),
};
