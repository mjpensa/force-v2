/**
 * Re-exported from production source on purpose.
 *
 * The conversion rules are what make conformance results trustworthy, so the tests must
 * exercise exactly the implementation that runs in production — not a copy that can drift
 * from it. See server/schema-guard.js for why `nullable` handling is load-bearing.
 */
export { geminiToJsonSchema, formatErrors, checkResponse } from '../../server/schema-guard.js';
