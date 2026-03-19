import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt, generateSpeakerNotesPrompt, generateSpeakerNotesOutlinePrompt, slidesSchema, slidesOutlineSchema, speakerNotesSchema, speakerNotesOutlineSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { generateIntelligenceBriefPrompt, intelligenceBriefSchema } from './prompts/intelligence-brief.js';
import { CONFIG } from './config.js';

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes

class APIQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }
  async add(task, name = 'unknown') {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }
}

const apiQueue = new APIQueue(4);

// Generation config factory — topK is fixed at 64 for Gemini 2.5 Flash (not configurable)
const DEFAULTS = { thinkingBudget: 0 };
const createConfig = (overrides = {}) => ({ ...DEFAULTS, ...overrides });

const DOCUMENT_CONFIG = createConfig({ temperature: 0.65, topP: 0.9, thinkingBudget: 20000, maxOutputTokens: 65536 });
const STRUCTURED_DEFAULT_CONFIG = createConfig();
const ROADMAP_CONFIG = createConfig({ temperature: 0.1, topP: 0.5, thinkingBudget: 1024 });
const RESEARCH_ANALYSIS_CONFIG = createConfig({ temperature: 0.4, topP: 0.75, thinkingBudget: 8192 });
const SLIDES_CONFIG = createConfig({ temperature: 0.55, topP: 0.85, thinkingBudget: 12000, maxOutputTokens: 65536 });
const SLIDES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 20000 });
const SPEAKER_NOTES_CONFIG = createConfig({ temperature: 0.55, topP: 0.88, thinkingBudget: 6000 });
const SPEAKER_NOTES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 8000 });
const INTELLIGENCE_BRIEF_CONFIG = createConfig({ temperature: 0.5, topP: 0.85, thinkingBudget: 8192 });

// Shared validation patterns (used across multiple validators)
const WEAK_OPENERS = /^(this|the|our|in today|as we|it is|there (is|are|has|have))/i;
const WEASEL_WORDS = /(significant|substantial|considerable|various|many|some|often|generally)/i;
const CONTRAST_WORDS = /(while|however|yet|but|whereas|although|despite)/i;
const ESCALATION_WORDS = /(moreover|critically|furthermore|notably|increasingly|widening|accelerating)/i;
const BAD_SOURCE_PATTERNS = /\.(md|txt|pdf|docx|doc|xlsx|csv)$/i;
const GENERIC_SOURCE_PATTERNS = /^(research|document|file|data|upload|input|source)/i;
const DATA_POINT_PATTERN = /\d+\.?\d*\s*%|\$\d[\d,]*\.?\d*[MBK]?(?:illion)?|Q[1-4]\s*20\d{2}|\d+x\b|\d{1,3}(?:,\d{3})+/gi;
const STRONG_OPENER_PATTERNS = [
  /^[A-Z][a-zA-Z]+\s+(deployed|launched|announced|achieved|cut|reduced|eliminated|increased|acquired)/i,
  /^\d+[%xMBK]?[.,]?\s/,
  /^\$[\d,.]+[MBK]?/,
  /^Q[1-4]\s+20\d{2}/i,
  /^(On|In)\s+[A-Z][a-z]+\s+\d/,
  /^What\s+(happens|would|if)/i,
  /^[A-Z][^.]{5,}\s(while|but|yet)\s/i
];

function checkWeakOpener(text) {
  const trimmed = (text || '').trim();
  return { isWeak: WEAK_OPENERS.test(trimmed), isStrong: STRONG_OPENER_PATTERNS.some(p => p.test(trimmed)) };
}

function getQualityTier(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

function createAugmentedSwimlanes(swimlanes) {
  return [
    { name: "Overview", taskCount: 0, isFixed: true },
    ...swimlanes,
    { name: "Conclusion", taskCount: 0, isFixed: true }
  ];
}
function extractSwimlanesFromRoadmap(roadmapData) {
  if (!roadmapData?.data) return [];
  const swimlanes = [];
  let currentSwimlane = null;
  let taskCount = 0;
  for (const row of roadmapData.data) {
    if (row.isSwimlane) {
      if (currentSwimlane) swimlanes.push({ ...currentSwimlane, taskCount });
      currentSwimlane = { name: row.title, entity: row.entity };
      taskCount = 0;
    } else if (currentSwimlane) {
      taskCount++;
    }
  }
  if (currentSwimlane) {
    swimlanes.push({ ...currentSwimlane, taskCount });
  }

  return swimlanes;
}

// Reconcile outline sections with authoritative swimlanes from roadmap.
// PRESERVES: reasoning, primaryFramework, keyEvidenceChains, narrativeArcs
// REPLACES: section swimlane names with authoritative names from roadmap
function reconcileOutlineWithSwimlanes(outline, swimlanes) {
  if (!outline || !swimlanes || swimlanes.length === 0) {
    return outline;
  }

  const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

  const outlineSections = outline.sections || [];

  const overviewSection = outlineSections.find(s => s.swimlane?.toLowerCase() === 'overview');
  const conclusionSection = outlineSections.find(s => s.swimlane?.toLowerCase() === 'conclusion');
  const middleOutlineSections = outlineSections.filter(s =>
    s.swimlane?.toLowerCase() !== 'overview' && s.swimlane?.toLowerCase() !== 'conclusion'
  );
  const middleSwimlanes = augmentedSwimlanes.filter(s => !s.isFixed);
  const reconciledSections = [];

  reconciledSections.push({
    swimlane: "Overview",
    narrativeArc: overviewSection?.narrativeArc ||
      "Context establishes urgency → Key themes previewed → Sets up detailed analysis",
    slides: overviewSection?.slides || createDefaultSlideBlueprints("Overview", 4)
  });

  for (let i = 0; i < middleSwimlanes.length; i++) {
    const targetSwimlane = middleSwimlanes[i];
    const matchingSection = middleOutlineSections.find(os =>
      os.swimlane?.toLowerCase().includes(targetSwimlane.name.toLowerCase()) ||
      targetSwimlane.name.toLowerCase().includes(os.swimlane?.toLowerCase())
    ) || middleOutlineSections[i];

    reconciledSections.push({
      swimlane: targetSwimlane.name,
      narrativeArc: matchingSection?.narrativeArc ||
        `${targetSwimlane.name} analysis reveals key insights → Evidence compounds urgency → Strategic implications emerge`,
      slides: matchingSection?.slides || createDefaultSlideBlueprints(targetSwimlane.name, 5)
    });
  }

  reconciledSections.push({
    swimlane: "Conclusion",
    narrativeArc: conclusionSection?.narrativeArc ||
      "Synthesis of insights → Strategic implications → Actionable recommendations",
    slides: conclusionSection?.slides || createDefaultSlideBlueprints("Conclusion", 4)
  });


  return { reasoning: outline.reasoning, sections: reconciledSections };
}

function createDefaultSlideBlueprints(sectionName, count) {
  return Array.from({ length: count }, (_, i) => ({
    tagline: "KEY INSIGHT",
    keyDataPoint: `Key data point for ${sectionName} slide ${i + 1}`,
    analyticalLens: "COMPETITIVE_DYNAMICS",
    connectsTo: i < count - 1
      ? `This insight leads to the next aspect of ${sectionName}`
      : "This conclusion sets up the following section"
  }));
}

function validateExecutiveSummary(execSummary) {
  const issues = [];
  const text = typeof execSummary === 'object'
    ? `${execSummary.situation || ''} ${execSummary.insight || ''} ${execSummary.action || ''}`
    : execSummary || '';

  if (!/\d+/.test(text)) issues.push('Missing quantified data point');

  if (!/(recommend|approve|launch|initiate|authorize|implement|hire|invest|prioritize|execute|deploy|expand|reduce|increase|allocate|greenlight)/i.test(text)) {
    issues.push('Missing actionable recommendation');
  }

  const minLength = typeof execSummary === 'object' ? 100 : 150;
  if (text.length < minLength) issues.push(`Too short (${text.length} chars, need ${minLength}+)`);

  const firstSentence = typeof execSummary === 'object'
    ? execSummary.situation
    : text.split(/[.!?]/)[0];
  const { isWeak, isStrong } = checkWeakOpener(firstSentence);
  if (isWeak && !isStrong) issues.push('Weak opening detected');

  if (WEASEL_WORDS.test(text)) issues.push('Contains vague weasel words');

  if (!CONTRAST_WORDS.test(text) && !ESCALATION_WORDS.test(text)) {
    issues.push('Missing narrative energy markers (contrast/escalation)');
  }

  if (typeof execSummary === 'object') {
    const situationInsight = `${execSummary.situation || ''} ${execSummary.insight || ''}`;
    const dataPointMatches = situationInsight.match(/\d+\.?\d*\s*%|\$\d[\d,]*\.?\d*[MBK]?|Q[1-4]\s*20\d{2}|\d+x\b/gi) || [];
    // High-impact data points (large dollar amounts $XM/B or significant percentages 20%+)
    const highImpactMatches = situationInsight.match(/\$\d{1,3}(?:,\d{3})*\.?\d*[MB]|\d{2,}%/gi) || [];
    const effectiveDataPoints = dataPointMatches.length + (highImpactMatches.length > 0 ? 1 : 0);
    if (effectiveDataPoints < 2) {
      issues.push(`Low evidence density (${dataPointMatches.length} data points, need 2+)`);
    }
  }

  if (typeof execSummary === 'object' && execSummary.insight) {
    const insightDepthPatterns = /(means that|implies|resulting in|translates to|equates to|represents|costs?|gap|disadvantage|risk|at stake|widening|compounds)/i;
    if (!insightDepthPatterns.test(execSummary.insight)) {
      issues.push('Insight lacks depth language (missing causal/impact connection)');
    }
  }

  if (typeof execSummary === 'object' && execSummary.source) {
    if (BAD_SOURCE_PATTERNS.test(execSummary.source) || GENERIC_SOURCE_PATTERNS.test(execSummary.source)) {
      issues.push('Source appears to be filename rather than authoritative source');
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateReasoningCoherence(reasoning, executiveSummary) {
  const issues = [];
  if (!reasoning || !executiveSummary) {
    return { coherent: false, issues: ['Missing reasoning or executiveSummary object'] };
  }

  if (reasoning.stakesQuantified && executiveSummary.insight) {
    const stakesNumbers = reasoning.stakesQuantified.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    const insightNumbers = executiveSummary.insight.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    if (stakesNumbers.length > 0 && insightNumbers.length === 0) {
      issues.push('Insight lacks quantified data from reasoning.stakesQuantified');
    }
  }

  if (reasoning.tensionAnalysis && executiveSummary.tensionPoint) {
    const keywords = reasoning.tensionAnalysis.toLowerCase()
      .match(/\b(cost|competitive|compliance|risk|pressure|delay|resource|gap|deadline|regulatory)\b/gi) || [];
    const hasAlignment = keywords.some(k =>
      executiveSummary.tensionPoint.toLowerCase().includes(k.toLowerCase())
    );
    if (keywords.length > 0 && !hasAlignment) {
      issues.push('TensionPoint does not reflect tensionAnalysis themes');
    }
  } else if (reasoning.tensionAnalysis && !executiveSummary.tensionPoint) {
    issues.push('Missing tensionPoint despite tensionAnalysis in reasoning');
  }

  if (executiveSummary.action) {
    if (!/\b(cto|cfo|ceo|coo|cio|director|vp|head|chief|board|leadership|team)\b/i.test(executiveSummary.action)) {
      issues.push('Action missing clear role assignment');
    }
    if (!/\b(q[1-4]\s*20\d{2}|by\s+(january|february|march|april|may|june|july|august|september|october|november|december)|20\d{2})\b/i.test(executiveSummary.action)) {
      issues.push('Action missing deadline/timeline');
    }
  }

  if (reasoning.keyDataPoints && Array.isArray(reasoning.keyDataPoints) && reasoning.keyDataPoints.length >= 3 &&
      executiveSummary.evidenceChain && Array.isArray(executiveSummary.evidenceChain) && executiveSummary.evidenceChain.length > 0) {
    const keyNumbers = reasoning.keyDataPoints.join(' ').match(/\d+\.?\d*/g) || [];
    const evidenceNumbers = executiveSummary.evidenceChain
      .map(e => e.dataPoint || '').join(' ').match(/\d+\.?\d*/g) || [];
    const overlap = keyNumbers.filter(n => evidenceNumbers.includes(n));
    if (overlap.length === 0) {
      issues.push('EvidenceChain does not reference keyDataPoints from reasoning');
    }
  }

  return { coherent: issues.length === 0, issues };
}

function validateSectionQuality(section, sectionIndex) {
  const issues = [];
  const sectionId = `Section ${sectionIndex + 1} "${section.heading || 'untitled'}"`;

  if (/^(overview|introduction|summary|analysis|background|conclusion|section\s*\d|topic|area|focus)/i.test(section.heading?.trim() || '')) {
    issues.push(`${sectionId}: Generic heading (should lead with insight)`);
  }

  const allParagraphs = (section.paragraphs || []).join(' ');
  if (!/\d+/.test(allParagraphs)) issues.push(`${sectionId}: No quantified data in paragraphs`);
  if (!section.supportingEvidence || section.supportingEvidence.length < 2) {
    issues.push(`${sectionId}: Insufficient supporting evidence (need 2+, have ${section.supportingEvidence?.length || 0})`);
  }
  if (WEASEL_WORDS.test(allParagraphs)) issues.push(`${sectionId}: Contains vague weasel words`);

  return issues;
}

function calculateQualityScore(documentData) {
  const breakdown = { opening: 0, evidence: 0, insight: 0, narrative: 0, counterargument: 0, source: 0 };
  const warnings = [];
  const execSummary = documentData?.executiveSummary || {};
  const sections = documentData?.sections || [];

  const situation = execSummary.situation || '';
  const { isWeak: hasWeakOpening, isStrong: hasStrongOpening } = checkWeakOpener(situation);

  if (hasStrongOpening) {
    breakdown.opening = 15;
  } else if (!hasWeakOpening && situation.length > 50) {
    breakdown.opening = 10;
  } else if (hasWeakOpening) {
    breakdown.opening = 3;
    warnings.push('Executive summary uses weak opening pattern');
  } else {
    breakdown.opening = 5;
  }

  const situationInsight = `${execSummary.situation || ''} ${execSummary.insight || ''}`;
  const dataPoints = (situationInsight.match(DATA_POINT_PATTERN) || []).length;
  const evidenceChainCount = (execSummary.evidenceChain || []).length;

  if (dataPoints >= 3 && evidenceChainCount >= 2) {
    breakdown.evidence = 20;
  } else if (dataPoints >= 2 && evidenceChainCount >= 1) {
    breakdown.evidence = 15;
  } else if (dataPoints >= 2) {
    breakdown.evidence = 12;
  } else if (dataPoints >= 1) {
    breakdown.evidence = 8;
    warnings.push(`Low evidence density (${dataPoints} data points in executive summary)`);
  } else {
    breakdown.evidence = 3;
    warnings.push('Executive summary lacks quantified data points');
  }

  const insight = execSummary.insight || '';
  const insightDepthPatterns = [
    /(means that|implies|resulting in|translates to|equates to)/i,
    /(costs?|gap|disadvantage|risk|at stake)/i,
    /(widening|compounds|accelerat|trajectory)/i,
    /\$[\d,.]+[MBK]?/  // Dollar amounts in insight
  ];
  const insightPatternMatches = insightDepthPatterns.filter(p => p.test(insight)).length;

  if (insightPatternMatches >= 3) {
    breakdown.insight = 20;
  } else if (insightPatternMatches >= 2) {
    breakdown.insight = 15;
  } else if (insightPatternMatches >= 1) {
    breakdown.insight = 10;
  } else {
    breakdown.insight = 5;
    warnings.push('Insight lacks causal/impact language (missing "so what" connection)');
  }

  const allText = `${execSummary.situation || ''} ${execSummary.insight || ''} ${execSummary.tensionPoint || ''}`;
  const hasContrast = CONTRAST_WORDS.test(allText);
  const hasEscalation = ESCALATION_WORDS.test(allText);
  const hasTensionPoint = execSummary.tensionPoint && execSummary.tensionPoint.length > 20;

  if (hasContrast && hasEscalation && hasTensionPoint) {
    breakdown.narrative = 15;
  } else if ((hasContrast || hasEscalation) && hasTensionPoint) {
    breakdown.narrative = 12;
  } else if (hasContrast || hasEscalation) {
    breakdown.narrative = 8;
  } else {
    breakdown.narrative = 4;
    warnings.push('Missing narrative energy markers (contrast/escalation words)');
  }

  const sectionsWithCounterarguments = sections.filter(s => s.counterargument && s.counterargument.length > 50);
  const genericCounterarguments = /(may not|could be|might face|some may argue|potential challenges)/i;
  const specificCounterarguments = sectionsWithCounterarguments.filter(s => !genericCounterarguments.test(s.counterargument));
  const counterargumentRatio = sections.length > 0 ? specificCounterarguments.length / sections.length : 0;

  if (counterargumentRatio >= 0.8) {
    breakdown.counterargument = 15;
  } else if (counterargumentRatio >= 0.5) {
    breakdown.counterargument = 10;
  } else if (sectionsWithCounterarguments.length > 0) {
    breakdown.counterargument = 6;
    warnings.push(`Only ${sectionsWithCounterarguments.length}/${sections.length} sections have substantive counterarguments`);
  } else {
    breakdown.counterargument = 2;
    warnings.push('Sections lack counterarguments (missing analytical rigor)');
  }

  const source = execSummary.source || '';
  const authoritativePatterns = /(report|analysis|study|survey|publication|filing|data|institute|research)/i;
  const isFilename = BAD_SOURCE_PATTERNS.test(source) || GENERIC_SOURCE_PATTERNS.test(source);
  const isAuthoritative = authoritativePatterns.test(source) && source.length > 10;
  const evidenceChain = execSummary.evidenceChain || [];
  const validSourceCount = evidenceChain.filter(e => {
    const src = e.source || '';
    return src.length > 5 && !BAD_SOURCE_PATTERNS.test(src) && !GENERIC_SOURCE_PATTERNS.test(src);
  }).length;
  const sourceRatio = evidenceChain.length > 0 ? validSourceCount / evidenceChain.length : 0;

  if (!isFilename && isAuthoritative && sourceRatio >= 0.8) {
    breakdown.source = 15;
  } else if (!isFilename && isAuthoritative && sourceRatio >= 0.5) {
    breakdown.source = 12;
  } else if (!isFilename && sourceRatio >= 0.5) {
    breakdown.source = 10;
  } else if (!isFilename && source.length > 10) {
    breakdown.source = 8;
  } else if (isFilename) {
    breakdown.source = 2;
    warnings.push('Source appears to be filename rather than authoritative source');
  } else {
    breakdown.source = 5;
  }

  if (sourceRatio < 0.8 && evidenceChain.length > 0) {
    warnings.push(`Only ${Math.round(sourceRatio * 100)}% of evidence chain entries have valid sources`);
  }

  const overall = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  let rating;
  if (overall >= 85) rating = 'Excellent';
  else if (overall >= 70) rating = 'Good';
  else if (overall >= 50) rating = 'Needs Improvement';
  else rating = 'Poor';

  return { overall, breakdown, warnings, rating };
}

function validateSlideQuality(slidesData) {
  const issues = [];
  if (!slidesData?.sections || !Array.isArray(slidesData.sections)) {
    return { valid: false, issues: ['Invalid slides structure - missing sections array'] };
  }

  let slideIndex = 0;
  for (const section of slidesData.sections) {
    const sectionName = section.swimlane || 'Unknown Section';
    const isFixedSection = sectionName === 'Overview' || sectionName === 'Conclusion';
    const minSlides = isFixedSection ? 4 : 1;

    if (!section.slides || section.slides.length < minSlides) {
      issues.push(`Section "${sectionName}": ${section.slides?.length || 0} slides generated (minimum ${minSlides} required)`);
      continue;
    }

    const subTopics = new Set();
    const duplicateSubTopics = [];
    for (const slide of section.slides) {
      const subTopic = slide.subTopic?.trim();
      if (subTopic) {
        if (subTopics.has(subTopic.toLowerCase())) {
          duplicateSubTopics.push(subTopic);
        } else {
          subTopics.add(subTopic.toLowerCase());
        }
      }
    }
    if (duplicateSubTopics.length > 0) {
      issues.push(`Section "${sectionName}": Duplicate subTopics found: ${duplicateSubTopics.join(', ')}`);
    }

    const threeColumnCount = section.slides.filter(s => s.layout === 'threeColumn').length;
    const totalSlides = section.slides.length;
    if (totalSlides >= 3) {
      const threeColumnRatio = threeColumnCount / totalSlides;
      if (threeColumnRatio < 0.2) {
        issues.push(`Section "${sectionName}": Low layout variety - only ${Math.round(threeColumnRatio * 100)}% threeColumn (target 30-60%)`);
      } else if (threeColumnRatio > 0.7) {
        issues.push(`Section "${sectionName}": Excessive threeColumn - ${Math.round(threeColumnRatio * 100)}% (target 30-60%)`);
      }
    }

    for (const slide of section.slides) {
      slideIndex++;
      const slideId = `Section "${sectionName}" Slide ${slideIndex} "${slide.tagline || 'untitled'}"`;
      validateSingleSlide(slide, slideId, issues);
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateSingleSlide(slide, slideId, issues) {
  const allText = `${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;

  if (slide.layout === 'threeColumn' && !slide.paragraph3?.trim()) {
    issues.push(`${slideId}: threeColumn layout requires paragraph3`);
  }
  if (!/\d+/.test(allText)) issues.push(`${slideId}: Missing quantified data point`);

  const { isWeak } = checkWeakOpener(slide.paragraph1);
  if (isWeak) issues.push(`${slideId}: Weak opening detected`);
  if (WEASEL_WORDS.test(allText)) issues.push(`${slideId}: Contains vague weasel words`);

  if (/^(OVERVIEW|INTRODUCTION|SUMMARY|ANALYSIS|BACKGROUND|CONCLUSION|KEY FINDINGS|KEY POINTS|CRITICAL POINTS|IMPORTANT FACTORS|COST ANALYSIS|EXECUTIVE SUMMARY)$/i.test(slide.tagline?.trim() || '')) {
    issues.push(`${slideId}: Generic tagline "${slide.tagline}" (should signal insight, not topic)`);
  }

  if (!/\[.*?\]/.test(allText) && !/(according to|reveals|shows)/i.test(allText)) {
    issues.push(`${slideId}: No apparent source citation`);
  }

  const title = slide.title || '';
  const separatorCount = (title.match(/\n/g) || []).length;
  if (separatorCount < 2 || separatorCount > 3) {
    issues.push(`${slideId}: Title has ${separatorCount + 1} lines (need 3-4). Title: "${title.replace(/\n/g, '\\n')}"`);
  }

  const maxLineLength = slide.layout === 'threeColumn' ? 18 : 10;
  const titleLines = title.split('\n');
  for (let i = 0; i < titleLines.length; i++) {
    if (titleLines[i].length > maxLineLength) {
      issues.push(`${slideId}: Title line ${i + 1} too long (${titleLines[i].length} chars, max ${maxLineLength}): "${titleLines[i]}"`);
    }
  }

  const maxWordLength = slide.layout === 'threeColumn' ? 12 : 9;
  const titleWords = title.replace(/\n/g, ' ').split(/\s+/).filter(w => w);
  for (const word of titleWords) {
    if (word.length > maxWordLength) {
      issues.push(`${slideId}: Title word too long (${word.length} chars, max ${maxWordLength}): "${word}" - use shorter synonym`);
    }
  }
}

function validateOutlineStructure(outline, swimlanes) {
  const errors = [];
  if (!outline.reasoning) errors.push('Missing reasoning object');
  if (!outline.reasoning?.primaryFramework) errors.push('Missing primaryFramework');
  if (!outline.reasoning?.keyEvidenceChains?.length) errors.push('Missing keyEvidenceChains');
  if (outline.reasoning?.keyEvidenceChains?.length < 3) {
    errors.push(`Only ${outline.reasoning?.keyEvidenceChains?.length || 0} evidence chains (need 3+)`);
  }
  if (!outline.sections || !Array.isArray(outline.sections)) {
    errors.push('Missing or invalid sections array');
  }
  if (swimlanes.length > 0 && outline.sections?.length !== swimlanes.length) {
    errors.push(`Swimlane mismatch: ${swimlanes.length} swimlanes but ${outline.sections?.length} sections`);
  }

  const validLenses = ['SECOND_ORDER_EFFECTS', 'CONTRARIAN', 'COMPETITIVE_DYNAMICS',
                       'TEMPORAL_ARBITRAGE', 'RISK_ASYMMETRY', 'CAUSAL_CHAIN'];
  for (const section of (outline.sections || [])) {
    const sectionName = section.swimlane || 'Unknown';
    if (!section.narrativeArc) errors.push(`Section "${sectionName}": missing narrativeArc`);
    if (!section.slides?.length) errors.push(`Section "${sectionName}": no slides defined`);

    for (const slide of (section.slides || [])) {
      if (slide.analyticalLens && !validLenses.includes(slide.analyticalLens)) {
        errors.push(`Section "${sectionName}": invalid analyticalLens "${slide.analyticalLens}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateFrameworkConsistency(outline, slidesData) {
  const issues = [];
  const primaryFramework = outline?.reasoning?.primaryFramework;
  if (!primaryFramework) return { valid: true, issues: [], consistency: 100 };

  const frameworkPatterns = {
    'SECOND_ORDER_EFFECTS': /(?:trigger|follow|downstream|result in|which means|then|in turn)/i,
    'CONTRARIAN': /(?:obvious|conventional|however|but|reveals|surprising|counter to|expected)/i,
    'COMPETITIVE_DYNAMICS': /(?:competitor|market|first-mover|gap|edge|positioning|competitive)/i,
    'TEMPORAL_ARBITRAGE': /(?:front-load|compound|future|short-term|long-term|delayed|invest now)/i,
    'RISK_ASYMMETRY': /(?:asymmetric|bounded|unlimited|downside|upside|cap|limited risk)/i,
    'CAUSAL_CHAIN': /(?:because|cause|root|trigger|leads to|directly)/i
  };

  let frameworkMatches = 0;
  let totalAnalyticalSlides = 0;

  for (const section of slidesData?.sections || []) {
    for (const slide of section.slides || []) {
      totalAnalyticalSlides++;
      const allText = `${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;

      if (frameworkPatterns[primaryFramework]?.test(allText)) {
        frameworkMatches++;
      }
    }
  }

  const consistency = totalAnalyticalSlides > 0
    ? Math.round((frameworkMatches / totalAnalyticalSlides) * 100)
    : 0;

  if (consistency < 50) {
    issues.push(`Primary framework "${primaryFramework}" detected in only ${consistency}% of slides (target: 50%+)`);
  }

  return { valid: issues.length === 0, issues, consistency };
}

function validateEvidenceChainUsage(outline, slidesData) {
  const issues = [];
  const keyChains = outline?.reasoning?.keyEvidenceChains || [];
  if (keyChains.length === 0) return { valid: true, issues: [], usedChains: 0, totalChains: 0, coverage: 100 };

  let allSlideText = '';
  for (const section of slidesData?.sections || []) {
    for (const slide of section.slides || []) {
      allSlideText += ` ${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;
    }
  }
  allSlideText = allSlideText.toLowerCase();

  let usedChains = 0;
  const missingChains = [];
  for (const chain of keyChains) {
    const evidence = chain.evidence || '';
    const evidenceTerms = evidence.match(/\d+%|\$[\d.]+[MBK]?|Q[1-4]\s*20\d{2}|\d{2,}/gi) || [];
    const hasEvidence = evidenceTerms.some(term => allSlideText.includes(term.toLowerCase()));
    const conceptWords = evidence.split(/\s+/).slice(0, 4).filter(w => w.length > 4);
    const hasConceptMatch = conceptWords.some(word => allSlideText.includes(word.toLowerCase()));

    if (hasEvidence || hasConceptMatch) {
      usedChains++;
    } else {
      missingChains.push(evidence.substring(0, 50) + (evidence.length > 50 ? '...' : ''));
    }
  }

  const coverage = Math.round((usedChains / keyChains.length) * 100);

  if (coverage < 60) {
    issues.push(`Only ${usedChains}/${keyChains.length} key evidence chains used (${coverage}%, target: 60%+)`);
  }

  return { valid: issues.length === 0, issues, usedChains, totalChains: keyChains.length, coverage, missingChains };
}

function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}) {
  try {
    const {
      temperature,
      topP,
      topK,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget,
      maxOutputTokens,
      frequencyPenalty,
      presencePenalty
    } = configOverrides;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
    if (frequencyPenalty !== undefined) generationConfig.frequencyPenalty = frequencyPenalty;
    if (presencePenalty !== undefined) generationConfig.presencePenalty = presencePenalty;
    const model = genAI.getGenerativeModel({
      model: CONFIG.API.GEMINI_MODEL,
      generationConfig
    });
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    const response = result.response;
    const text = response.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch (parseError) {
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        return repairedData;
      } catch (repairError) {
        throw parseError;
      }
    }
  } catch (error) {
    console.error(`[${contentType}] Generation failed:`, error.message);
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles) {
  try {
    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateSlides(userPrompt, researchFiles, swimlanes = []) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    const totalOutlineSlides = outline.sections?.reduce((sum, s) => sum + (s.slides?.length || 0), 0) || 0;

    const outlineValidation = validateOutlineStructure(outline, augmentedSwimlanes);

    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    const slideQualityValidation = validateSlideQuality(data);

    const frameworkValidation = validateFrameworkConsistency(outline, data);

    const evidenceChainValidation = validateEvidenceChainUsage(outline, data);

    const allValidationIssues = [
      ...slideQualityValidation.issues,
      ...frameworkValidation.issues,
      ...evidenceChainValidation.issues
    ];

    return {
      success: true,
      data,
      validationIssues: allValidationIssues,
      outline,
      validation: {
        outline: outlineValidation,
        slideQuality: slideQualityValidation,
        framework: frameworkValidation,
        evidenceChains: evidenceChainValidation
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes = []) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);
    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    const totalOutlineSlides = outline.sections?.reduce((sum, s) => sum + (s.slides?.length || 0), 0) || 0;

    return { success: true, data: outline };
  } catch (error) {
    console.error('[Slides Outline] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outline) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

    const outlineValidation = validateOutlineStructure(outline, augmentedSwimlanes);

    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    const slideQualityValidation = validateSlideQuality(data);
    const frameworkValidation = validateFrameworkConsistency(outline, data);
    const evidenceChainValidation = validateEvidenceChainUsage(outline, data);


    const allValidationIssues = [
      ...slideQualityValidation.issues,
      ...frameworkValidation.issues,
      ...evidenceChainValidation.issues
    ];

    return {
      success: true,
      data,
      validationIssues: allValidationIssues,
      outline,
      validation: {
        outline: outlineValidation,
        slideQuality: slideQualityValidation,
        framework: frameworkValidation,
        evidenceChains: evidenceChainValidation
      }
    };
  } catch (error) {
    console.error('[Slides Pass 2] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateSpeakerNotes(slidesData, researchFiles, userPrompt) {
  try {
    const totalSlides = slidesData.sections?.reduce((sum, section) =>
      sum + (section.slides?.length || 0), 0) || 0;

    let outline = null;
    let outlineMetrics = { evidenceChains: 0, sources: 0, pushbacks: 0, transitions: 0, slideOutlines: 0 };

    try {
      const outlinePrompt = generateSpeakerNotesOutlinePrompt(slidesData, researchFiles, userPrompt);
      outline = await generateWithGemini(outlinePrompt, speakerNotesOutlineSchema, 'SpeakerNotesOutline', SPEAKER_NOTES_OUTLINE_CONFIG);
      outlineMetrics = {
        evidenceChains: outline.reasoning?.keyEvidenceChains?.length || 0,
        sources: outline.reasoning?.sourceInventory?.length || 0,
        pushbacks: outline.reasoning?.anticipatedPushback?.length || 0,
        transitions: outline.reasoning?.narrativeTransitions?.length || 0,
        slideOutlines: outline.slideOutlines?.length || 0
      };

    } catch (pass1Error) {
      outline = null;
    }

    const fullPrompt = generateSpeakerNotesPrompt(slidesData, researchFiles, userPrompt, outline);
    const data = await generateWithGemini(fullPrompt, speakerNotesSchema, 'SpeakerNotes', SPEAKER_NOTES_CONFIG);

    const notesCount = data.slides?.length || 0;

    if (data.reasoning) {
    } else if (outline?.reasoning) {
      data.reasoning = outline.reasoning;
    }

    const deliveryCuePattern = /\[(pause|emphasize|gesture|lean in|lower voice|rhetorical)\]/i;
    const slidesWithCues = data.slides?.filter(s =>
      s.narrative?.talkingPoints?.some(tp => deliveryCuePattern.test(tp))
    ).length || 0;

    if (slidesWithCues === 0) {
    } else if (slidesWithCues < Math.floor((data.slides?.length || 0) / 2)) {
    }

    return { success: true, data, outline };
  } catch (error) {
    console.error('[Speaker Notes] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateDocument(userPrompt, researchFiles, swimlanes = []) {
  const MAX_RETRIES = 2;
  let lastResult = null;
  let lastValidation = null;
  let lastCoherenceValidation = null;


  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes);
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);
      const validation = validateExecutiveSummary(data.executiveSummary);
      const coherenceValidation = validateReasoningCoherence(data.reasoning, data.executiveSummary);

      lastResult = data;
      lastValidation = validation;
      lastCoherenceValidation = coherenceValidation;

      if (data.sections && Array.isArray(data.sections)) {
        const sectionIssues = data.sections.flatMap((s, i) => validateSectionQuality(s, i));
      }

      const combinedValid = validation.valid && coherenceValidation.coherent;
      if (combinedValid) {
        const qualityScore = calculateQualityScore(data);
        const qualityTier = getQualityTier(qualityScore.overall);

        return {
          success: true,
          data,
          qualityScore,
          qualityTier,
          coherenceIssues: coherenceValidation.issues,
          qualityWarning: qualityScore.overall < 70 ?
            `Quality score ${qualityScore.overall}/100 below threshold. Consider regenerating.` : null
        };
      }

      const allIssues = [...validation.issues, ...coherenceValidation.issues];

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const allValidationIssues = [...(lastValidation?.issues || []), ...(lastCoherenceValidation?.issues || [])];
  const qualityScore = calculateQualityScore(lastResult);
  const qualityTier = getQualityTier(qualityScore.overall);

  return {
    success: true,
    data: lastResult,
    qualityScore,
    qualityTier,
    validationIssues: allValidationIssues,
    coherenceIssues: lastCoherenceValidation?.issues || [],
    qualityWarning: qualityScore.overall < 70 ?
      `Quality score ${qualityScore.overall}/100 below threshold. Consider regenerating.` : null
  };
}
async function generateResearchAnalysis(userPrompt, researchFiles) {
  try {
    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function generateIntelligenceBrief(sessionData, meetingContext) {
  try {

    const prompt = generateIntelligenceBriefPrompt(sessionData, meetingContext);
    const data = await generateWithGemini(prompt, intelligenceBriefSchema, 'IntelligenceBrief', INTELLIGENCE_BRIEF_CONFIG);


    return { success: true, data };
  } catch (error) {
    console.error('[IntelligenceBrief] Generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// 3-phase pipeline: Phase 0 (Research), Phase 1 (Roadmap + Outline), Phase 2 (Slides + Document)
// Speaker notes generated on-demand via generateSpeakerNotesAsync()
export async function generateAllContent(userPrompt, researchFiles) {
  try {
    const startTime = Date.now();

    const researchAnalysisPromise = apiQueue.add(
      () => generateResearchAnalysis(userPrompt, researchFiles), 'ResearchAnalysis'
    );

    const phase1Tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles), name: 'Roadmap' },
      { task: () => generateSlidesOutlineOnly(userPrompt, researchFiles, []), name: 'SlidesOutline' }
    ];
    const [roadmap, slidesOutline] = await apiQueue.runAll(phase1Tasks);

    const swimlanes = roadmap.success ? extractSwimlanesFromRoadmap(roadmap.data) : [];


    // CRITICAL: Reconcile outline with authoritative roadmap swimlanes for correct TOC
    let reconciledOutline = slidesOutline.data;
    if (slidesOutline.success && swimlanes.length > 0) {
      reconciledOutline = reconcileOutlineWithSwimlanes(slidesOutline.data, swimlanes);
    }

    const phase2Tasks = [
      {
        task: () => slidesOutline.success
          ? generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, reconciledOutline)
          : generateSlides(userPrompt, researchFiles, swimlanes),
        name: 'Slides'
      },
      { task: () => generateDocument(userPrompt, researchFiles, swimlanes), name: 'Document' }
    ];
    const [slides, document] = await apiQueue.runAll(phase2Tasks);

    const researchAnalysis = await researchAnalysisPromise;

    if (slides.success && swimlanes.length > 0) {
      const slideSwimlanes = slides.data?.sections?.map(s => s.swimlane) || [];
      const roadmapSwimlanes = swimlanes.map(s => s.name);

      const mismatchedSwimlanes = slideSwimlanes.filter(
        ss => !roadmapSwimlanes.some(rs =>
          rs.toLowerCase().includes(ss.toLowerCase()) ||
          ss.toLowerCase().includes(rs.toLowerCase())
        )
      );

    }

    const speakerNotes = { success: false, error: 'Speaker notes available on-demand', deferred: true };

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    return { roadmap, slides, document, researchAnalysis, speakerNotes };
  } catch (error) {
    throw error;
  }
}

export async function generateSpeakerNotesAsync(slidesData, researchFiles, userPrompt) {
  if (!slidesData?.sections) {
    return { success: false, error: 'Slides data required for speaker notes generation' };
  }

  const startTime = Date.now();

  const result = await apiQueue.add(
    () => generateSpeakerNotes(slidesData, researchFiles, userPrompt),
    'SpeakerNotes'
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  return result;
}
export async function regenerateContent(viewType, prompt, researchFiles) {
  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles);
        case 'slides':
          return generateSlides(prompt, researchFiles);
        case 'document':
          return generateDocument(prompt, researchFiles);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    return await apiQueue.add(task, taskName);
  } catch (error) {
    throw error;
  }
}
