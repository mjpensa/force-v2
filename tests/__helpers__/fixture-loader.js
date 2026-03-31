import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESPONSES_DIR = join(__dirname, '..', 'fixtures', 'responses');
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

export function loadFixture(name) {
  return JSON.parse(readFileSync(join(RESPONSES_DIR, `${name}.json`), 'utf8'));
}

export function loadAllFixtures() {
  return {
    roadmap: loadFixture('roadmap'),
    slidesOutline: loadFixture('slides-outline'),
    slides: loadFixture('slides'),
    document: loadFixture('document'),
    researchAnalysis: loadFixture('research-analysis'),
    narrativeSpine: loadFixture('narrative-spine'),
    intelligenceBrief: loadFixture('intelligence-brief'),
    speakerNotes: loadFixture('speaker-notes'),
  };
}

export function loadResearchFiles() {
  return [
    { filename: 'sample-research-1.txt', content: readFileSync(join(FIXTURES_DIR, 'sample-research-1.txt'), 'utf8') },
    { filename: 'sample-research-2.txt', content: readFileSync(join(FIXTURES_DIR, 'sample-research-2.txt'), 'utf8') },
  ];
}
