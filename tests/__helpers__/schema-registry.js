/**
 * Maps a golden-corpus generator name to the schema the app actually passes to Gemini.
 *
 * Schemas are imported from production source rather than copied, so this cannot drift
 * from what the app sends. The meta-test in golden-conformance.test.js asserts every
 * generator present in tests/golden/manifest.json has an entry here, which is what catches
 * a new generator being added without a validator.
 */
import { roadmapSchema } from '../../server/prompts/roadmap.js';
import {
  slidesSchema,
  slidesOutlineSchema,
  speakerNotesSchema,
  speakerNotesOutlineSchema,
} from '../../server/prompts/slides.js';
import { documentSchema } from '../../server/prompts/document.js';
import { researchAnalysisSchema } from '../../server/prompts/research-analysis.js';
import { intelligenceBriefSchema } from '../../server/prompts/intelligence-brief.js';
import { narrativeSpineSchema } from '../../server/prompts/narrative-spine.js';
import { swotAnalysisSchema } from '../../server/prompts/swot-analysis.js';
import { competitiveAnalysisSchema } from '../../server/prompts/competitive-analysis.js';
import { riskRegisterSchema } from '../../server/prompts/risk-register.js';

export const SCHEMA_REGISTRY = {
  'roadmap': roadmapSchema,
  'slides': slidesSchema,
  'slides-outline': slidesOutlineSchema,
  'speaker-notes': speakerNotesSchema,
  'speaker-notes-outline': speakerNotesOutlineSchema,
  'document': documentSchema,
  'research-analysis': researchAnalysisSchema,
  'intelligence-brief': intelligenceBriefSchema,
  'narrative-spine': narrativeSpineSchema,
  'swot-analysis': swotAnalysisSchema,
  'competitive-analysis': competitiveAnalysisSchema,
  'risk-register': riskRegisterSchema,
};
