import { jest, describe, it, expect, beforeAll } from '@jest/globals';

let validateExecutiveSummary, validateReasoningCoherence, checkWeakOpener,
    reconcileOutlineWithSwimlanes, extractSwimlanesFromRoadmap, APIQueue;

beforeAll(async () => {
  // Mock Gemini so generators.js can load without a real API key
  await jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: function () {
      return { getGenerativeModel() { return { generateContent: async () => ({ response: { text: () => '{}' } }) }; } };
    }
  }));

  await jest.unstable_mockModule('../../server/cache/DiskCache.js', () => ({
    DiskCache: function () { return { get: async () => null, set: async () => {} }; },
    diskCache: { get: async () => null, set: async () => {} },
  }));

  const mod = await import('../../server/generators.js');
  validateExecutiveSummary = mod.validateExecutiveSummary;
  validateReasoningCoherence = mod.validateReasoningCoherence;
  checkWeakOpener = mod.checkWeakOpener;
  reconcileOutlineWithSwimlanes = mod.reconcileOutlineWithSwimlanes;
  extractSwimlanesFromRoadmap = mod.extractSwimlanesFromRoadmap;
  APIQueue = mod.APIQueue;
});

describe('validateExecutiveSummary', () => {
  const strongSummary = {
    situation: 'JPMorgan cut processing costs 50% via cloud migration in Q4 2024, while 73% of mid-tier firms remain on legacy systems.',
    insight: 'Each quarter of delay widens the cost gap by $350K, meaning the competitive disadvantage compounds and translates to $2.1M annually.',
    action: 'CTO approve and launch cloud migration pilot by Q2 2025 to capture the closing window.',
    source: 'Gartner 2024 Cloud Economics Report',
  };

  it('returns valid for a strong summary with quantified data, sources, and action', () => {
    const result = validateExecutiveSummary(strongSummary);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns invalid for missing quantified data point', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      situation: 'Cloud migration is important for companies.',
      insight: 'Delays are costly and translate to lost revenue, which compounds over time.',
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Low evidence density (0 data points, need 2+)');
  });

  it('returns invalid for weak opener ("This report...")', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      situation: 'This report analyzes cloud migration with $2.1M savings and 50% cost reduction.',
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Weak opening detected');
  });

  it('returns invalid for missing actionable recommendation', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      action: 'The situation is interesting and worth monitoring over the next 12 months.',
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing actionable recommendation');
  });

  it('returns invalid when text is too short', () => {
    const result = validateExecutiveSummary({
      situation: 'Short.',
      insight: 'Brief.',
      action: 'Launch.',
      source: 'Test',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.startsWith('Too short'))).toBe(true);
  });

  it('detects weasel words', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      insight: 'Significant delays widen the gap by $350K, meaning the competitive disadvantage compounds quarterly.',
    });
    expect(result.issues).toContain('Contains vague weasel words');
  });

  it('detects missing narrative energy markers', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      situation: 'JPMorgan cut costs 50% in Q4 2024. Goldman Sachs did the same.',
      insight: 'The cost gap is $350K per quarter, translating to $2.1M yearly loss.',
      action: 'CTO should launch pilot by Q2 2025.',
    });
    expect(result.issues).toContain('Missing narrative energy markers (contrast/escalation)');
  });

  it('detects bad source patterns (file extensions)', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      source: 'research-data.pdf',
    });
    expect(result.issues).toContain('Source appears to be filename rather than authoritative source');
  });

  it('detects generic source patterns', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      source: 'document uploaded by user',
    });
    expect(result.issues).toContain('Source appears to be filename rather than authoritative source');
  });

  it('validates string-type executive summary', () => {
    const result = validateExecutiveSummary(
      'JPMorgan cut processing costs 50% via cloud migration. However, 73% of firms have not started pilots. CTO should approve and launch the $2.1M initiative by Q2 2025.'
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects insight lacking depth language', () => {
    const result = validateExecutiveSummary({
      ...strongSummary,
      // No depth words: means that, implies, resulting in, translates to, equates to,
      // represents, cost/costs, gap, disadvantage, risk, at stake, widening, compounds
      insight: 'Cloud migration delivers $2.1M in annual efficiency gains and 50% better throughput for all operations.',
    });
    expect(result.issues).toContain('Insight lacks depth language (missing causal/impact connection)');
  });
});

describe('validateReasoningCoherence', () => {
  it('returns coherent for well-formed reasoning and summary', () => {
    const reasoning = {
      stakesQuantified: 'The opportunity is $2.1M annually.',
    };
    const summary = {
      insight: 'Each quarter of delay costs $350K, translating to $2.1M annual disadvantage.',
      action: 'CTO approve pilot by Q2 2025.',
    };
    const result = validateReasoningCoherence(reasoning, summary);
    expect(result.coherent).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns incoherent when reasoning or summary is missing', () => {
    expect(validateReasoningCoherence(null, {}).coherent).toBe(false);
    expect(validateReasoningCoherence({}, null).coherent).toBe(false);
    expect(validateReasoningCoherence(null, null).coherent).toBe(false);
  });

  it('flags when insight lacks quantified data from reasoning.stakesQuantified', () => {
    const result = validateReasoningCoherence(
      { stakesQuantified: 'The opportunity is $2.1M annually.' },
      { insight: 'Cloud migration is important for future growth.', action: 'CTO approve by Q2 2025.' }
    );
    expect(result.issues).toContain('Insight lacks quantified data from reasoning.stakesQuantified');
  });

  it('flags action missing clear role assignment', () => {
    const result = validateReasoningCoherence(
      {},
      { action: 'Approve cloud migration pilot by Q2 2025.' }
    );
    expect(result.issues).toContain('Action missing clear role assignment');
  });

  it('flags action missing deadline/timeline', () => {
    const result = validateReasoningCoherence(
      {},
      { action: 'CTO should approve the cloud migration pilot.' }
    );
    expect(result.issues).toContain('Action missing deadline/timeline');
  });
});

describe('checkWeakOpener', () => {
  it('identifies "This report" as weak', () => {
    const result = checkWeakOpener('This report examines cloud migration.');
    expect(result.isWeak).toBe(true);
  });

  it('identifies "This document" as weak', () => {
    const result = checkWeakOpener('This document provides an analysis.');
    expect(result.isWeak).toBe(true);
  });

  it('identifies "The following" as weak', () => {
    const result = checkWeakOpener('The following analysis covers key findings.');
    expect(result.isWeak).toBe(true);
  });

  it('identifies "In today" as weak', () => {
    const result = checkWeakOpener("In today's market, firms face challenges.");
    expect(result.isWeak).toBe(true);
  });

  it('returns isWeak=false for strong openers', () => {
    expect(checkWeakOpener('Market disruption accelerated in Q4 2024.').isWeak).toBe(false);
    expect(checkWeakOpener('Revenue declined 23% year-over-year.').isWeak).toBe(false);
  });

  it('identifies strong opener patterns', () => {
    expect(checkWeakOpener('JPMorgan deployed cloud infrastructure in Q1.').isStrong).toBe(true);
    expect(checkWeakOpener('50% cost reduction achieved at peer firms.').isStrong).toBe(true);
    expect(checkWeakOpener('$4.2M annual savings projected for 2025.').isStrong).toBe(true);
    expect(checkWeakOpener('Q1 2025 marks a critical decision point.').isStrong).toBe(true);
  });

  it('handles empty/null input gracefully', () => {
    expect(checkWeakOpener('').isWeak).toBe(false);
    expect(checkWeakOpener(null).isWeak).toBe(false);
    expect(checkWeakOpener(undefined).isWeak).toBe(false);
  });
});

describe('extractSwimlanesFromRoadmap', () => {
  it('extracts swimlane names from roadmap data', () => {
    const roadmapData = {
      data: [
        { title: 'IT/Technology', isSwimlane: true, entity: 'IT/Technology' },
        { title: 'Task 1', isSwimlane: false },
        { title: 'Task 2', isSwimlane: false },
        { title: 'Business/Operations', isSwimlane: true, entity: 'Business/Operations' },
        { title: 'Task 3', isSwimlane: false },
      ],
    };
    const result = extractSwimlanesFromRoadmap(roadmapData);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('IT/Technology');
    expect(result[0].taskCount).toBe(2);
    expect(result[1].name).toBe('Business/Operations');
    expect(result[1].taskCount).toBe(1);
  });

  it('returns empty array for null data', () => {
    expect(extractSwimlanesFromRoadmap(null)).toEqual([]);
    expect(extractSwimlanesFromRoadmap({})).toEqual([]);
    expect(extractSwimlanesFromRoadmap({ data: null })).toEqual([]);
  });

  it('returns empty array for data with no swimlanes', () => {
    const result = extractSwimlanesFromRoadmap({ data: [{ title: 'Task', isSwimlane: false }] });
    expect(result).toEqual([]);
  });

  it('handles swimlane with no tasks', () => {
    const roadmapData = {
      data: [
        { title: 'Empty Lane', isSwimlane: true, entity: 'Empty' },
        { title: 'Next Lane', isSwimlane: true, entity: 'Next' },
      ],
    };
    const result = extractSwimlanesFromRoadmap(roadmapData);
    expect(result).toHaveLength(2);
    expect(result[0].taskCount).toBe(0);
    expect(result[1].taskCount).toBe(0);
  });
});

describe('reconcileOutlineWithSwimlanes', () => {
  const swimlanes = [
    { name: 'IT/Technology', entity: 'IT/Technology', taskCount: 3 },
    { name: 'Business/Operations', entity: 'Business/Operations', taskCount: 2 },
  ];

  it('matches outline sections to swimlanes', () => {
    const outline = {
      reasoning: { core: 'test reasoning' },
      sections: [
        { swimlane: 'Overview', narrativeArc: 'Overview arc', slides: [{ tagline: 'O1' }] },
        { swimlane: 'IT/Technology', narrativeArc: 'IT arc', slides: [{ tagline: 'IT1' }] },
        { swimlane: 'Business/Operations', narrativeArc: 'Biz arc', slides: [{ tagline: 'B1' }] },
        { swimlane: 'Conclusion', narrativeArc: 'Conclusion arc', slides: [{ tagline: 'C1' }] },
      ],
    };
    const result = reconcileOutlineWithSwimlanes(outline, swimlanes);
    expect(result.reasoning).toEqual({ core: 'test reasoning' });
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0].swimlane).toBe('Overview');
    expect(result.sections[1].swimlane).toBe('IT/Technology');
    expect(result.sections[2].swimlane).toBe('Business/Operations');
    expect(result.sections[3].swimlane).toBe('Conclusion');
  });

  it('returns outline unchanged when swimlanes is empty', () => {
    const outline = { reasoning: {}, sections: [{ swimlane: 'Test' }] };
    expect(reconcileOutlineWithSwimlanes(outline, [])).toBe(outline);
  });

  it('returns outline unchanged when outline is null', () => {
    expect(reconcileOutlineWithSwimlanes(null, swimlanes)).toBeNull();
  });

  it('returns outline unchanged when swimlanes is null', () => {
    const outline = { sections: [] };
    expect(reconcileOutlineWithSwimlanes(outline, null)).toBe(outline);
  });

  it('generates default slides when outline sections are missing', () => {
    const outline = {
      reasoning: {},
      sections: [],
    };
    const result = reconcileOutlineWithSwimlanes(outline, swimlanes);
    // Overview + 2 middle + Conclusion = 4 sections
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0].swimlane).toBe('Overview');
    expect(result.sections[0].slides).toHaveLength(4);
    expect(result.sections[1].swimlane).toBe('IT/Technology');
    expect(result.sections[1].slides).toHaveLength(5);
    expect(result.sections[3].swimlane).toBe('Conclusion');
    expect(result.sections[3].slides).toHaveLength(4);
  });

  it('preserves reasoning field through reconciliation', () => {
    const outline = {
      reasoning: { framework: 'TEMPORAL_ARBITRAGE', chains: ['a', 'b'] },
      sections: [
        { swimlane: 'Overview', slides: [] },
        { swimlane: 'Conclusion', slides: [] },
      ],
    };
    const result = reconcileOutlineWithSwimlanes(outline, swimlanes);
    expect(result.reasoning).toEqual({ framework: 'TEMPORAL_ARBITRAGE', chains: ['a', 'b'] });
  });
});

describe('APIQueue constructor', () => {
  it('sets maxConcurrent from argument', () => {
    const queue = new APIQueue(5);
    expect(queue.maxConcurrent).toBe(5);
  });

  it('defaults maxConcurrent to 2', () => {
    const queue = new APIQueue();
    expect(queue.maxConcurrent).toBe(2);
  });

  it('initializes with empty queue and zero running', () => {
    const queue = new APIQueue(3);
    expect(queue.running).toBe(0);
    expect(queue.queue).toEqual([]);
  });
});
