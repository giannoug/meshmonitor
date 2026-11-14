/**
 * GET /api/sources/:id/activity?before=<ms>&limit=<1..100> (#6365 Task 2.7).
 *
 * Replies to, reactions on and mentions of the source's own node, newest
 * first, limited to the channels and DMs the caller may read (the
 * `GET /api/messages` rule). `before` returns items strictly older; page on
 * with `nextBefore` until it is null. Read-only, behind the global apiLimiter
 * like `/api/messages`.
 */
import { Router } from 'express';
import { optionalAuth } from '../auth/authMiddleware.js';
import { ok, fail } from '../utils/apiResponse.js';
import { logger } from '../../utils/logger.js';
import { getSourceActivity } from '../services/activityService.js';

const router = Router({ mergeParams: true });

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** `undefined` when absent, `null` when not a number. */
function numberParam(value: unknown): number | undefined | null {
  if (value === undefined || value === '') return undefined;
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

router.get('/', optionalAuth(), async (req, res) => {
  const before = numberParam(req.query.before);
  const rawLimit = numberParam(req.query.limit);
  if (before === null || rawLimit === null) {
    return fail(res, 400, 'INVALID_INPUT', '"before" and "limit" must be numbers');
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit ?? DEFAULT_LIMIT)));
  try {
    const result = await getSourceActivity(req.user, (req.params as { id: string }).id, { before, limit });
    if (result.status === 'not_found') return fail(res, 404, 'SOURCE_NOT_FOUND', 'Source not found');
    if (result.status === 'forbidden') return fail(res, 403, 'FORBIDDEN', 'Insufficient permissions');
    return ok(res, result.page);
  } catch (error) {
    logger.error('Error fetching activity:', error);
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to fetch activity');
  }
});

export default router;
