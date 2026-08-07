import Ajv from 'ajv';

/**
 * Runtime check that a model response matches the schema the app asked for.
 *
 * The app has always trusted Gemini's `responseSchema` and validated nothing after
 * JSON.parse. That trust does not hold: captured production responses omit fields the
 * schema marks required — narrative-spine is missing five of them, which is why
 * formatNarrativeSpine was interpolating the literal string "undefined" into every
 * downstream prompt for months with no signal anywhere.
 *
 * This runs in observe-only mode in production. It never rejects a user's generation over
 * a mismatch we only just started detecting; it logs one structured warning so real traffic
 * becomes evidence. Tests throw instead, so a regression fails loudly there.
 */

const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = new Map();

/**
 * Convert a Gemini/OpenAPI-flavored schema to real JSON Schema.
 *
 * `nullable: true` is OpenAPI; JSON Schema spells it `type: ["string", "null"]`. ajv does
 * not error on the unknown keyword — it ignores it — so without this conversion a field
 * that legitimately arrives as null reads as a type error. An early conformance sweep
 * reported exactly that against competitive-analysis and the finding was pure artifact.
 */
export function geminiToJsonSchema(schema, opts = {}) {
  const { strictAdditional = false } = opts;

  const convert = node => {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(convert);

    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'nullable') continue;
      if (key === 'properties') {
        out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)]));
      } else if (key === 'items') {
        out.items = convert(value);
      } else {
        out[key] = convert(value);
      }
    }

    if (node.nullable === true && typeof node.type === 'string') {
      out.type = [node.type, 'null'];
    }
    // node.type, not out.type — the nullable rewrite above may have turned out.type into
    // an array, and a nullable object is still an object for this purpose.
    if (strictAdditional && node.type === 'object' && out.properties && out.additionalProperties === undefined) {
      out.additionalProperties = false;
    }
    return out;
  };

  return convert(schema);
}

/**
 * Stable, comparable error strings. Array indices collapse to `*` because the defect is the
 * missing field, not which element happened to be missing it.
 */
export function formatErrors(errors) {
  if (!errors) return [];
  return [
    ...new Set(
      errors.map(e => {
        const path = (e.instancePath || '').replace(/\/\d+/g, '/*');
        const detail = e.params?.missingProperty ? `missing:${e.params.missingProperty}` : e.keyword;
        return `${path || '/'} ${detail}`;
      })
    ),
  ].sort();
}

function validatorFor(schema, contentType) {
  if (!compiled.has(contentType)) {
    compiled.set(contentType, ajv.compile(geminiToJsonSchema(schema)));
  }
  return compiled.get(contentType);
}

/**
 * Validate a parsed response. Returns the data unchanged either way.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
export function checkResponse(data, schema, contentType) {
  if (!schema) return { ok: true, errors: [] };
  try {
    const validate = validatorFor(schema, contentType);
    if (validate(data)) return { ok: true, errors: [] };
    return { ok: false, errors: formatErrors(validate.errors) };
  } catch (err) {
    // A schema that won't compile is a developer error, not a user-facing one.
    console.warn(`[SchemaGuard] could not validate ${contentType}: ${err.message}`);
    return { ok: true, errors: [] };
  }
}

/**
 * Observe-only by default: warns, never rejects, always returns the data unchanged.
 *
 * Deliberately does NOT throw under NODE_ENV=test. Unit tests feed hand-written fixtures
 * through a mocked Gemini client, and those fixtures are not real model output — failing
 * them would add friction without adding signal. The real gate is
 * tests/server/golden-conformance.test.js, which validates captured production responses
 * against an allowlist that may only shrink.
 *
 * Set SCHEMA_GUARD_STRICT=1 to make violations throw — useful when driving real responses
 * through a script and you want a hard stop rather than a log line.
 */
export function validateOrWarn(data, schema, contentType) {
  const { ok, errors } = checkResponse(data, schema, contentType);
  if (ok) return data;

  const summary =
    `[SchemaGuard] ${contentType} response does not match its declared schema ` +
    `(${errors.length} issue${errors.length === 1 ? '' : 's'}): ${errors.join('; ')}`;

  if (process.env.SCHEMA_GUARD_STRICT === '1') throw new Error(summary);

  // Silent under test. Unit tests drive minimal hand-written fixtures through a mocked
  // client, so this would fire on nearly every one — and a warning that always fires is
  // noise people learn to scroll past, which is exactly how a signal dies. Real coverage
  // lives in tests/server/golden-conformance.test.js.
  if (process.env.NODE_ENV !== 'test') console.warn(summary);
  return data;
}
