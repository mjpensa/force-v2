import { getCurrentDateContext, assembleResearchContent, getAcronymRules, extractKeyStats, getSourceExtractionRules, formatDateContext, NARRATIVE_POSITIONS } from './common.js';

/**
 * Formats extracted stats, sources, and contextual evidence for prompt injection.
 * @param {string} stats - Comma-separated raw stat matches
 * @param {string[]} sources - Extracted source names
 * @param {string[]} contextualStats - Full sentences containing statistics
 * @param {string} hint - Usage hint for the KEY DATA POINTS header (e.g. "use at least one per slide")
 * @returns {string}
 */
function formatStatsSourcesEvidence(stats, sources, contextualStats, hint) {
  const statsLine = stats || 'Extract specific numbers, percentages, and dates from the research text';
  const sourcesLine = sources.length > 0
    ? sources.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : 'No explicit sources identified - extract source names from the research content';
  const evidenceLine = contextualStats.length > 0
    ? contextualStats.map((s, i) => `${i + 1}. "${s}"`).join('\n')
    : 'No contextual statistics extracted - use specific data points from research';

  return `KEY DATA POINTS FROM RESEARCH (${hint}):
${statsLine}

EXTRACTED SOURCES (cite these in your content):
${sourcesLine}

EVIDENCE SENTENCES (use these for supporting claims):
${evidenceLine}`;
}

/**
 * Formats the slides reference summary used in speaker notes prompts.
 * @param {object} slidesData - Generated slides data with sections
 * @param {number} contentPreviewLength - How many characters of paragraph1 to include
 * @returns {string}
 */
function formatSlidesReference(slidesData, contentPreviewLength) {
  return slidesData.sections.map((section, sectionIdx) => {
    const sectionSlides = section.slides.map((slide, slideIdx) => {
      return `    Slide ${slideIdx + 1}: "${slide.tagline}" - ${slide.subTopic || 'No subtopic'}
      Title: ${slide.title?.replace(/\n/g, ' | ')}
      Key content: ${(slide.paragraph1 || '').substring(0, contentPreviewLength)}...`;
    }).join('\n');

    return `  Section ${sectionIdx + 1}: "${section.swimlane}"
${sectionSlides}`;
  }).join('\n\n');
}

/**
 * Formats the swimlane list for prompt injection.
 * @param {Array<{name: string, taskCount: number, isFixed?: boolean}>} swimlanes
 * @param {string} taskSuffix - Suffix for task count (e.g. "related tasks" or "related tasks in roadmap")
 * @returns {string|null} Formatted list or null if no swimlanes
 */
function formatSwimlaneList(swimlanes, taskSuffix) {
  if (swimlanes.length === 0) return null;
  return swimlanes.map((s, i) => {
    if (s.isFixed) {
      return `${i + 1}. "${s.name}" (FIXED SECTION - 4-8 slides required)`;
    }
    return `${i + 1}. "${s.name}" (${s.taskCount} ${taskSuffix})`;
  }).join('\n');
}

// Shared sub-schemas used across slidesOutlineSchema, speakerNotesSchema, and speakerNotesOutlineSchema
const audienceProfileSchema = {
  type: "object",
  properties: {
    primaryStakeholder: { type: "string", description: "Key decision-maker (CFO, CTO, Board, etc.)" },
    painPoints: { type: "array", items: { type: "string" }, description: "Top 3 pain points" },
    decisionCriteria: { type: "array", items: { type: "string" }, description: "Key decision factors" }
  }
};

const keyEvidenceChainsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      evidence: { type: "string", description: "Specific data point with source" },
      insight: { type: "string", description: "What this evidence means" },
      anticipatedQuestion: { type: "string", description: "Likely question this evidence will trigger" },
      preparedResponse: { type: "string", description: "Prepared response using ACE framework" }
    }
  },
  description: "3-5 anchor evidence chains that drive Q&A"
};

const sourceInventorySchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      sourceName: { type: "string", description: "Authoritative source name (not filename)" },
      keyFindings: { type: "array", items: { type: "string" }, description: "2-3 key findings from this source" },
      confidenceLevel: { type: "string", enum: ["high", "medium", "low"], description: "How reliable is this source?" }
    }
  },
  description: "Inventory of authoritative sources used"
};

const anticipatedPushbackSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      pushbackType: { type: "string", enum: ["skepticism", "cost_concern", "timeline", "feasibility", "risk", "scope", "competitive"] },
      specificObjection: { type: "string", description: "The exact objection they might raise" },
      evidenceToCounter: { type: "string", description: "Data point that counters this objection" },
      reframingStrategy: { type: "string", description: "How to reframe the objection as an opportunity" }
    }
  },
  description: "3-5 hardest pushbacks and how to handle them"
};

const narrativeTransitionsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      fromSlide: { type: "string", description: "Slide tagline transitioning FROM" },
      toSlide: { type: "string", description: "Slide tagline transitioning TO" },
      transitionLogic: { type: "string", description: "Why this transition makes narrative sense" },
      bridgePhrase: { type: "string", description: "Actual phrase to use: 'This leads us to...' or 'Building on this...'" }
    }
  },
  description: "Planned transitions between slides for narrative coherence"
};

const competitivePositioningSchema = {
  type: "object",
  description: "Ammunition for 'why not [competitor]?' questions",
  properties: {
    primaryCompetitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Competitor name (McKinsey, Deloitte, internal team, etc.)" },
          theirStrength: { type: "string", description: "What they're known for - acknowledge it" },
          ourCounter: { type: "string", description: "Why we're better for THIS engagement" },
          bridgePhrase: { type: "string", description: "Transition phrase: 'While X excels at..., what you need is...'" }
        }
      },
      description: "Top 2-3 competitors and how to position against them"
    },
    internalTeamResponse: {
      type: "string",
      description: "Response to 'why not do this in-house?' - the classic objection"
    },
    doNothingRisk: {
      type: "string",
      description: "Cost of inaction - critical for hostile audiences who want to delay"
    }
  }
};

const bridgePhrasesSchema = {
  type: "object",
  description: "Pre-written phrases for difficult presentation moments",
  properties: {
    dontKnowAnswer: {
      type: "array",
      items: { type: "string" },
      description: "Phrases when you don't have an answer ready"
    },
    hostileInterruption: {
      type: "array",
      items: { type: "string" },
      description: "Phrases to handle aggressive pushback"
    },
    goingOffTopic: {
      type: "array",
      items: { type: "string" },
      description: "Phrases to redirect wandering discussions"
    },
    technicalDive: {
      type: "array",
      items: { type: "string" },
      description: "Phrases to defer deep technical questions"
    },
    losingTheRoom: {
      type: "array",
      items: { type: "string" },
      description: "Recovery phrases when engagement drops"
    }
  }
};

// Schema for individual content slides
const contentSlideSchema = {
  type: "object",
  properties: {
    layout: {
      type: "string",
      enum: ["twoColumn", "threeColumn"],
      description: "Slide layout: 'twoColumn' (2 paragraphs right) or 'threeColumn' (3 columns below)"
    },
    tagline: {
      type: "string",
      description: "2-word uppercase tagline, max 21 characters (e.g. 'MARGIN EROSION')"
    },
    title: {
      type: "string",
      description: "STRICT: EXACTLY 3 or 4 lines total (count the \\n separators - must be 2 or 3). FORBIDDEN: 5+ lines will break layout. Combine short words to reduce line count. twoColumn: max 10 chars/line. threeColumn: max 18 chars/line."
    },
    paragraph1: {
      type: "string",
      description: "First paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn."
    },
    paragraph2: {
      type: "string",
      description: "Second paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn."
    },
    paragraph3: {
      type: "string",
      description: "Third paragraph (threeColumn only). 370-390 characters."
    },
    subTopic: {
      type: "string",
      description: "A 2-5 word sub-topic identifier for this slide within the section (e.g., 'Cost Analysis', 'Implementation Timeline', 'Risk Assessment'). Used for TOC navigation. Must be distinct within each section - NO DUPLICATES."
    }
  },
  required: ["layout", "tagline", "title", "paragraph1", "paragraph2", "subTopic"]
};

export const slidesSchema = {
  description: "Presentation slides organized by sections (aligned with Gantt chart swimlanes)",
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title of the presentation",
      nullable: false
    },
    sections: {
      type: "array",
      description: "Array of sections, each aligned with a Gantt chart swimlane topic",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          swimlane: {
            type: "string",
            description: "The swimlane/topic name from the Gantt chart",
            nullable: false
          },
          sectionTitle: {
            type: "string",
            description: "A compelling 2-4 word section title for the title slide, max 30 characters (can differ from swimlane name)",
            nullable: false
          },
          slides: {
            type: "array",
            description: "Content slides for this section (minimum 1 slide per section)",
            items: contentSlideSchema,
            minItems: 1
          }
        },
        required: ["swimlane", "sectionTitle", "slides"]
      }
    }
  },
  required: ["title", "sections"]
};

export const slidesOutlineSchema = {
  description: "Narrative outline for slide presentation - defines structure before full content generation",
  type: "object",
  properties: {
    reasoning: {
      type: "object",
      description: "Chain-of-thought reasoning completed BEFORE structuring sections. Forces analytical rigor.",
      properties: {
        overallNarrativeArc: {
          type: "string",
          description: "Complete story arc: [Opening Tension] -> [Deepening Stakes] -> [Resolution/Action]. What is the single narrative thread?",
          nullable: false
        },
        primaryFramework: {
          type: "string",
          enum: ["SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS", "TEMPORAL_ARBITRAGE", "RISK_ASYMMETRY"],
          description: "Dominant analytical lens for this presentation. Which framework best reveals the core insight?",
          nullable: false
        },
        keyEvidenceChains: {
          type: "array",
          items: {
            type: "object",
            properties: {
              evidence: { type: "string", description: "Specific data point from research with source", nullable: false },
              insight: { type: "string", description: "What this evidence means - the 'so what'", nullable: false },
              implication: { type: "string", description: "Action or decision this drives", nullable: false }
            },
            required: ["evidence", "insight", "implication"]
          },
          description: "3-5 anchor evidence-insight-implication chains that will drive the presentation"
        },
        crossSectionConnections: {
          type: "array",
          items: { type: "string" },
          description: "How each section's ending creates tension for the next section's opening"
        }
      },
      required: ["overallNarrativeArc", "primaryFramework", "keyEvidenceChains"]
    },
    sections: {
      type: "array",
      description: "Section outlines with narrative arcs and slide blueprints",
      items: {
        type: "object",
        properties: {
          swimlane: {
            type: "string",
            description: "The swimlane/topic name",
            nullable: false
          },
          narrativeArc: {
            type: "string",
            description: "1-sentence narrative arc: tension → insight → resolution for this section",
            nullable: false
          },
          slides: {
            type: "array",
            description: "Slide blueprints with taglines, data points, and connections",
            items: {
              type: "object",
              properties: {
                tagline: {
                  type: "string",
                  description: "2-word insight-driven tagline (NOT topic labels like OVERVIEW)",
                  nullable: false
                },
                keyDataPoint: {
                  type: "string",
                  description: "The primary quantified data point this slide will feature",
                  nullable: false
                },
                analyticalLens: {
                  type: "string",
                  enum: ["SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS", "TEMPORAL_ARBITRAGE", "RISK_ASYMMETRY", "CAUSAL_CHAIN"],
                  description: "The specific analytical framework applied to this slide. Must explicitly name which lens drives the insight.",
                  nullable: false
                },
                connectsTo: {
                  type: "string",
                  description: "How this slide's implication connects to the next slide's evidence",
                  nullable: false
                }
              },
              required: ["tagline", "keyDataPoint", "analyticalLens", "connectsTo"]
            },
            minItems: 1
          }
        },
        required: ["swimlane", "narrativeArc", "slides"]
      }
    }
  },
  required: ["reasoning", "sections"]
};

export const speakerNotesSchema = {
  description: "Speaker notes for each slide - generated after slides to support sales enablement",
  type: "object",
  properties: {
    reasoning: {
      type: "object",
      description: "Chain-of-thought reasoning that informed notes generation. Provides transparency into the analytical process.",
      properties: {
        presentationNarrativeArc: {
          type: "string",
          description: "The overall story arc: [Opening Hook] → [Tension Building] → [Resolution/CTA]"
        },
        audienceProfile: audienceProfileSchema,
        keyEvidenceChains: keyEvidenceChainsSchema,
        sourceInventory: sourceInventorySchema,
        anticipatedPushback: anticipatedPushbackSchema,
        narrativeTransitions: narrativeTransitionsSchema,
        competitivePositioning: competitivePositioningSchema,
        bridgePhrases: bridgePhrasesSchema
      }
    },
    slides: {
      type: "array",
      description: "Speaker notes for each content slide (matches slide order)",
      items: {
        type: "object",
        properties: {
          slideIndex: {
            type: "number",
            description: "Index of the slide these notes apply to (0-based within section)"
          },
          sectionName: {
            type: "string",
            description: "Name of the section this slide belongs to"
          },
          slideTagline: {
            type: "string",
            description: "Tagline of the slide for reference"
          },
          narrative: {
            type: "object",
            properties: {
              talkingPoints: {
                type: "array",
                items: { type: "string" },
                description: "3-5 key talking points presenter can use verbatim or adapt"
              },
              transitionIn: {
                type: "string",
                description: "How to transition FROM the previous slide to this one"
              },
              transitionOut: {
                type: "string",
                description: "How to transition FROM this slide TO the next"
              },
              keyPhrase: {
                type: "string",
                description: "The ONE phrase to emphasize for audience retention"
              }
            },
            required: ["talkingPoints", "keyPhrase"]
          },

          // 2. ANTICIPATE & RESPOND (Enhanced with severity tiers - Enhancement #2)
          anticipatedQuestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "A likely client question or objection"
                },
                response: {
                  type: "string",
                  description: "Initial response using ACE framework (Acknowledge, Cite Evidence, Expand)"
                },
                pushbackType: {
                  type: "string",
                  enum: ["skepticism", "cost_concern", "timeline", "feasibility", "risk", "scope", "competitive"],
                  description: "Category of pushback"
                },
                severity: {
                  type: "string",
                  enum: ["probing", "skeptical", "hostile", "deal_breaker"],
                  description: "How serious is this objection? Affects preparation priority"
                },
                escalationResponse: {
                  type: "string",
                  description: "Follow-up response if they push back AGAIN after initial response",
                  nullable: true
                },
                deferralOption: {
                  type: "string",
                  description: "Graceful way to defer: 'Let me follow up with specifics after this meeting'",
                  nullable: true
                },
                bridgeToStrength: {
                  type: "string",
                  description: "How to pivot this objection INTO a selling point",
                  nullable: true
                }
              },
              required: ["question", "response", "pushbackType", "severity"]
            },
            description: "2-3 likely questions/objections with prepared responses and escalation paths"
          },
          sourceAttribution: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim: {
                  type: "string",
                  description: "The specific claim or data point being cited"
                },
                source: {
                  type: "string",
                  description: "Source document name and location (e.g., 'McKinsey Report 2024, p.15')"
                },
                confidence: {
                  type: "string",
                  enum: ["direct_extraction", "paraphrase", "synthesis", "inference"],
                  description: "How the content was derived from the source"
                },
                originalText: {
                  type: "string",
                  description: "Original quote if direct extraction (optional)",
                  nullable: true
                }
              },
              required: ["claim", "source", "confidence"]
            },
            description: "Citations for key claims on this slide"
          },
          storyContext: {
            type: "object",
            properties: {
              narrativePosition: {
                type: "string",
                enum: NARRATIVE_POSITIONS,
                description: "Where this slide sits in the narrative arc"
              },
              precededBy: {
                type: "string",
                description: "What the audience just learned from the previous slide"
              },
              followedBy: {
                type: "string",
                description: "What comes next and why this slide sets it up"
              },
              soWhat: {
                type: "string",
                description: "Why this slide matters to the client - the key takeaway"
              },
              callToAction: {
                type: "object",
                description: "Different closes based on audience receptivity",
                properties: {
                  warmAudience: {
                    type: "object",
                    properties: {
                      ask: { type: "string", description: "Direct ask for commitment" },
                      timeline: { type: "string", description: "Specific next step timing" }
                    }
                  },
                  neutralAudience: {
                    type: "object",
                    properties: {
                      ask: { type: "string", description: "Softer ask - follow-up materials" },
                      nextStep: { type: "string", description: "Lower-commitment next action" }
                    }
                  },
                  hostileAudience: {
                    type: "object",
                    properties: {
                      ask: { type: "string", description: "Address concerns directly" },
                      fallback: { type: "string", description: "Minimum viable next step" }
                    }
                  }
                }
              },
              timeGuidance: {
                type: "object",
                description: "Time management for this slide",
                properties: {
                  suggestedDuration: { type: "string", description: "How long to spend: '2-3 minutes'" },
                  canCondense: { type: "boolean", description: "True if slide can be shortened if running late" },
                  condensedVersion: { type: "string", description: "One-sentence version if short on time" },
                  mustInclude: {
                    type: "array",
                    items: { type: "string" },
                    description: "Non-negotiable points even if condensing"
                  }
                }
              }
            },
            required: ["narrativePosition", "soWhat"]
          },
          generationTransparency: {
            type: "object",
            properties: {
              primarySources: {
                type: "array",
                items: { type: "string" },
                description: "List of source documents that informed this slide's content"
              },
              derivationMethod: {
                type: "string",
                enum: ["extracted", "paraphrased", "synthesized", "inferred"],
                description: "Primary method used to derive slide content from sources"
              },
              assumptions: {
                type: "array",
                items: { type: "string" },
                description: "Any assumptions made during content generation"
              },
              dataLineage: {
                type: "string",
                description: "Brief trace from source material to slide content"
              }
            },
            required: ["primarySources", "derivationMethod", "dataLineage"]
          },
          credibilityAnchors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["case_study", "analyst_quote", "regulatory", "peer_company", "research"],
                  description: "Type of credibility anchor"
                },
                statement: {
                  type: "string",
                  description: "The credibility-building statement"
                },
                dropPhrase: {
                  type: "string",
                  description: "Natural way to introduce: 'As Gartner noted...'"
                },
                fullCitation: {
                  type: "string",
                  description: "Full citation for follow-up questions"
                }
              },
              required: ["type", "statement", "dropPhrase", "fullCitation"]
            },
            description: "Third-party validation points for skeptical audiences"
          },
          riskMitigation: {
            type: "object",
            description: "De-risking language for risk-averse audiences",
            properties: {
              implementationRisk: {
                type: "object",
                properties: {
                  concern: { type: "string", description: "The implementation concern" },
                  response: { type: "string", description: "De-risk with pilot scope, phased approach" },
                  proofPoint: { type: "string", description: "Evidence of successful implementation" }
                },
                nullable: true
              },
              reputationalRisk: {
                type: "object",
                properties: {
                  concern: { type: "string", description: "Public failure fear" },
                  response: { type: "string", description: "Internal pilot framing, controlled rollout" }
                },
                nullable: true
              },
              careerRisk: {
                type: "object",
                properties: {
                  concern: { type: "string", description: "Sponsor's personal exposure" },
                  response: { type: "string", description: "Checkpoints, off-ramps, board-ready narratives" }
                },
                nullable: true
              }
            }
          },

          // 8. STAKEHOLDER-SPECIFIC MESSAGING (Enhancement #1)
          stakeholderAngles: {
            type: "object",
            description: "Tailored messaging for different decision-makers in the room",
            properties: {
              cfo: {
                type: "string",
                description: "ROI/cost framing: quantify savings, payback period, budget impact"
              },
              cto: {
                type: "string",
                description: "Technical feasibility: integration complexity, stack compatibility, security"
              },
              ceo: {
                type: "string",
                description: "Strategic positioning: competitive advantage, market timing, board narrative"
              },
              operations: {
                type: "string",
                description: "Implementation risk: timeline, resource requirements, change management"
              }
            }
          },
          audienceSignals: {
            type: "object",
            description: "How to read the room and adapt in real-time",
            properties: {
              losingThem: {
                type: "object",
                properties: {
                  signs: { type: "array", items: { type: "string" }, description: "Observable signals of disengagement" },
                  pivotStrategy: { type: "string", description: "What to do when you notice these signs" },
                  emergencyBridge: { type: "string", description: "Quick escape to skip ahead: 'Let me cut to the bottom line...'" }
                }
              },
              winningThem: {
                type: "object",
                properties: {
                  signs: { type: "array", items: { type: "string" }, description: "Signals of engagement and buy-in" },
                  accelerationOption: { type: "string", description: "How to capitalize: ask for commitment, go deeper" }
                }
              }
            }
          },
          quickReference: {
            type: "object",
            description: "Condensed view for quick glance during presentation",
            properties: {
              keyNumber: { type: "string", description: "The ONE number to remember: '$2.3M savings'" },
              keyPhrase: { type: "string", description: "The memorable quote: '60% cost reduction in 18 months'" },
              keyProof: { type: "string", description: "The credibility anchor: 'JPMorgan achieved this Q4 2024'" },
              keyAsk: { type: "string", description: "The call to action: 'Pilot program starting Q2'" }
            }
          }
        },
        required: ["slideIndex", "sectionName", "slideTagline", "narrative", "anticipatedQuestions", "sourceAttribution", "storyContext", "generationTransparency"]
      }
    }
  },
  required: ["reasoning", "slides"]
};

export const speakerNotesOutlineSchema = {
  description: "Speaker notes outline with chain-of-thought reasoning - Pass 1 of two-pass generation",
  type: "object",
  properties: {
    reasoning: {
      type: "object",
      description: "Explicit reasoning completed BEFORE generating notes. Forces analytical depth.",
      properties: {
        presentationNarrativeArc: {
          type: "string",
          description: "The overall story arc: [Opening Hook] → [Tension Building] → [Resolution/CTA]. What is the single thread connecting all slides?"
        },
        audienceProfile: audienceProfileSchema,
        keyEvidenceChains: keyEvidenceChainsSchema,
        sourceInventory: sourceInventorySchema,
        narrativeTransitions: narrativeTransitionsSchema,
        anticipatedPushback: anticipatedPushbackSchema,
        competitivePositioning: competitivePositioningSchema,
        bridgePhrases: bridgePhrasesSchema
      },
      required: ["presentationNarrativeArc", "keyEvidenceChains", "sourceInventory", "anticipatedPushback"]
    },
    slideOutlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slideIndex: { type: "number" },
          sectionName: { type: "string" },
          slideTagline: { type: "string" },
          narrativePosition: {
            type: "string",
            enum: NARRATIVE_POSITIONS
          },
          keyTalkingPoint: {
            type: "string",
            description: "The ONE most important point for this slide"
          },
          primaryQuestion: {
            type: "string",
            description: "The most likely question this slide will trigger"
          },
          primarySource: {
            type: "string",
            description: "The main source to cite for this slide's claims"
          },
          soWhatStatement: {
            type: "string",
            description: "Draft of the 'so what' - why this matters to the client"
          }
        },
        required: ["slideIndex", "sectionName", "slideTagline", "narrativePosition", "keyTalkingPoint"]
      }
    }
  },
  required: ["reasoning", "slideOutlines"]
};

export function generateSlidesOutlinePrompt(userPrompt, researchFiles, swimlanes = [], precomputed = null) {
  // Convert array to formatted string
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  const spineText = precomputed?.narrativeSpineText || '';
  const digestText = precomputed?.researchDigestText || '';

  // Extract key statistics
  const { stats, sources, contextualStats } = precomputed?.keyStats || extractKeyStats(researchContent);
  // Get current temporal context
  const dateContext = precomputed?.dateContext || getCurrentDateContext();

  // Format swimlanes for the prompt (including fixed Overview and Conclusion sections)
  const swimlaneList = formatSwimlaneList(swimlanes, 'related tasks');

  const swimlaneInstructions = swimlanes.length > 0
    ? `
SECTIONS (create one per swimlane, in this exact order):
${swimlaneList}
`
    : `
SECTIONS: Identify 3-6 major themes from the research and create one section per theme.
`;

  // Fixed section instructions for Overview and Conclusion
  const fixedSectionInstructions = `
FIXED SECTION REQUIREMENTS:

OVERVIEW SECTION (FIRST SECTION - REQUIRED):
- swimlane: "Overview"
- Purpose: Set the stage, introduce key themes, establish urgency
- Generate 4-8 slides covering:
  1-2. CONTEXT: What is the landscape/situation? Frame the problem/opportunity
  3-4. KEY THEMES: What are the 2-3 major topics this presentation covers? Preview without deep diving
  5-6. DATA ANCHOR: Key statistics that frame the opportunity/challenge from research
  7-8. BRIDGE: Why this matters now, transition to detailed analysis
- narrativeArc: "Current situation creates urgency → key themes preview → sets up deep dive"
- Tagline examples: "MARKET INFLECTION", "3 CRITICAL PRESSURES", "ADOPTION SURGE", "TIMELINE IMPERATIVE"

CONCLUSION SECTION (LAST SECTION - REQUIRED):
- swimlane: "Conclusion"
- Purpose: Synthesize insights, provide recommendations, call to action
- Generate 4-8 slides covering:
  1-2. SYNTHESIS: Key insights across all sections (not repetition - true synthesis of interconnections)
  3-4. IMPLICATIONS: What do these findings mean collectively? Strategic impact
  5-6. RECOMMENDATIONS: Specific actions with timelines and ownership
  7-8. CALL TO ACTION: Next steps, decision points, urgency, cost of inaction
- narrativeArc: "Evidence synthesis → strategic implications → actionable path forward"
- Tagline examples: "3 CONVERGING FORCES", "DECISION FRAMEWORK", "Q2 ADOPTION TARGETS", "COST OF DELAY"
`;

  return `You are creating a NARRATIVE OUTLINE for a presentation. This outline will guide full slide content generation.

Your goal: Define the STRUCTURE and NARRATIVE FLOW before any detailed content is written.

## ACRONYM CAPITALIZATION (CRITICAL - applies to all text including swimlane names, taglines, and narratives)
${getAcronymRules(true)}

## CHAIN OF THOUGHT: REASON BEFORE STRUCTURING

You MUST complete the 'reasoning' object FIRST, before creating any sections. This forces analytical rigor.

1. OVERALL NARRATIVE ARC: What is the complete story?
   - Opening Tension: What problem/opportunity creates urgency?
   - Deepening Stakes: How does evidence compound the urgency?
   - Resolution: What action resolves the tension?
   Format: "[Opening Tension] -> [Deepening Stakes] -> [Resolution/Action]"

2. PRIMARY FRAMEWORK: Name ONE dominant analytical lens from the enum (SECOND_ORDER_EFFECTS, CONTRARIAN, COMPETITIVE_DYNAMICS, TEMPORAL_ARBITRAGE, RISK_ASYMMETRY).

3. KEY EVIDENCE CHAINS: Identify 3-5 anchor chains from the research:
   For each: Evidence (specific data with source) -> Insight (what it means) -> Implication (action it drives)

4. CROSS-SECTION CONNECTIONS: How does each section's ending hook into the next?

ONLY AFTER completing reasoning should you define sections and slides.

${swimlaneInstructions}
${fixedSectionInstructions}

FOR EACH SECTION, provide:

1. "swimlane": The topic name (use exact swimlane name if provided)

2. "narrativeArc": A single sentence describing the section's story arc using this pattern:
   "[Tension/Problem] → [Key Insight from data] → [Resolution/Implication]"

   EXAMPLE: "Rising reconciliation costs threaten margins → JPMorgan's 50% cost reduction proves CDM viability → Q2 2025 becomes the adoption deadline for competitive survival"

3. "slides": Array of 5-10 slide blueprints, each with:

   a) "tagline": 2-word INSIGHT-DRIVEN tagline (max 21 characters)
      GOOD: "MARGIN EROSION", "50% COST GAP", "Q2 DEADLINE", "73% UNPREPARED"
      BAD: "OVERVIEW", "SUMMARY", "KEY POINTS", "ANALYSIS", "INTRODUCTION"

   b) "keyDataPoint": The PRIMARY quantified evidence this slide will feature
      Extract REAL numbers from research: percentages, dollar amounts, timeframes, ratios
      EXAMPLE: "50% reconciliation cost reduction at JPMorgan Q4 2024"

   c) "analyticalLens": Which analytical framework drives this slide's insight (one of the enum values: SECOND_ORDER_EFFECTS, CONTRARIAN, COMPETITIVE_DYNAMICS, TEMPORAL_ARBITRAGE, RISK_ASYMMETRY, CAUSAL_CHAIN).

   d) "connectsTo": How this slide's IMPLICATION leads to the next slide's EVIDENCE
      This creates narrative threading between slides.

      GOOD EXAMPLES (specific, actionable connections):
      - "$2.3M cost gap from Section 1 → compounds into → competitive market share loss analyzed here"
      - "60% efficiency gain established above → enables → the pricing strategy examined next"
      - "Regulatory deadline pressure → forces → accelerated implementation timeline in next slide"

      CONNECTSTO ANTI-PATTERNS (DO NOT USE):
      - ❌ "Relates to next slide" (vague, no logical connection)
      - ❌ "Continues the analysis" (describes, doesn't connect)
      - ❌ "See next slide for more" (defers, doesn't link)
      - ❌ "Another important point" (no causal relationship)
      - ❌ "Moving on to..." (transition word without logic)
      - ❌ "" or omitted (breaks narrative thread entirely)
      - ❌ "Related to [topic]" (topic label, not logical connection)

      CONNECTSTO REQUIREMENTS:
      1. Must reference SPECIFIC content from current slide (data point, insight, or implication)
      2. Must specify WHAT in the next slide this connects to
      3. Must show LOGICAL RELATIONSHIP (causes, enables, compounds, challenges, resolves)

      For the last slide in a section: "Section conclusion → creates tension for → next section's opening"
      TEST: If you can't explain WHY slide N+1 follows slide N, your connectsTo is too weak.

NARRATIVE FLOW REQUIREMENTS:

1. SECTION-LEVEL COHERENCE:
   - First 1-2 slides: CONTEXT (what IS happening)
   - Middle 3-5 slides: ANALYSIS (why it matters, deep dive)
   - Final 2-3 slides: IMPLICATIONS (what to DO)

2. CROSS-SLIDE CONNECTIONS:
   - Every slide must logically flow from the previous
   - The "connectsTo" field is CRITICAL - it defines the narrative thread
   - Avoid isolated "islands" of analysis

3. CROSS-SECTION TENSION:
   - Each section's ending should create tension
   - The next section's opening should resolve or build on that tension

${spineText ? spineText + '\n' : ''}${digestText ? digestText + '\n' : ''}${formatDateContext(dateContext, 'slides')}

${formatStatsSourcesEvidence(stats, sources, contextualStats, 'use at least 2-3 per slide')}

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

OUTPUT: Valid JSON matching the outline schema. Start with { and end with }
`;
}
/**
 * Get framework signal phrases for enforcement in Pass 2
 * @param {string} framework - The primary framework from outline reasoning
 * @returns {string} Signal phrases for the specified framework
 */
function getFrameworkSignalPhrases(framework) {
  const phrases = {
    'SECOND_ORDER_EFFECTS': '"This triggers...", "Which in turn...", "The downstream effect...", "If X → Y → Z"',
    'CONTRARIAN': '"Conventional wisdom suggests...", "However, data reveals...", "Counter to expectations..."',
    'COMPETITIVE_DYNAMICS': '"Market positioning shifts...", "First-mover advantage...", "The competitive gap..."',
    'TEMPORAL_ARBITRAGE': '"Front-loading investment...", "Compounds over time...", "Short-term X enables long-term Y"',
    'RISK_ASYMMETRY': '"Bounded risk of...", "Unlimited potential for...", "Asymmetric opportunity..."',
    'CAUSAL_CHAIN': '"Because...", "Root cause...", "This leads directly to..."'
  };
  return phrases[framework] || 'Use explicit analytical language that signals your reasoning';
}

/**
 * Generate prompt for slides with research content, organized by swimlane sections
 * AI creates multiple slides per swimlane topic, summarizing research for each
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Swimlane topics from Gantt chart
 * @param {object|null} outline - Optional narrative outline from pass 1 for guided generation
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles, swimlanes = [], outline = null, precomputed = null) {
  // Validate swimlane objects if provided (allowing isFixed property for Overview/Conclusion)
  if (swimlanes && swimlanes.length > 0) {
    const invalidSwimlane = swimlanes.find(s => !s || typeof s.name !== 'string' || (typeof s.taskCount !== 'number' && !s.isFixed));
    if (invalidSwimlane) {
      throw new Error('Swimlane objects must have "name" (string) and "taskCount" (number) properties (or isFixed: true)');
    }
  }

  // Convert array to formatted string (consistent with other generators)
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  const spineText = precomputed?.narrativeSpineText || '';
  const digestText = precomputed?.researchDigestText || '';

  // Extract key statistics to force AI to use real data
  const { stats, sources, contextualStats } = precomputed?.keyStats || extractKeyStats(researchContent);
  // Get current temporal context
  const dateContext = precomputed?.dateContext || getCurrentDateContext();

  // Format swimlanes for the prompt (including fixed Overview and Conclusion sections)
  const swimlaneList = formatSwimlaneList(swimlanes, 'related tasks in roadmap');

  // Fixed section content generation instructions
  const fixedSectionContentInstructions = `
FIXED SECTION CONTENT REQUIREMENTS:
Follow outline structure for Overview (first section: context, themes, data anchor, bridge - no deep dives) and Conclusion (last section: synthesis of cross-section connections, strategic implications, actionable recommendations with timelines, call to action with urgency). Each fixed section: 4-8 slides.
`;

  // Build section-specific instructions if swimlanes are provided
  const sectionInstructions = swimlanes.length > 0
    ? `
SECTION STRUCTURE (CRITICAL - FOLLOW EXACTLY):
You MUST create one section for each swimlane topic listed below, IN THE SAME ORDER.
The first section (Overview) and last section (Conclusion) are FIXED sections with specific requirements.
Middle sections represent key topics from the project roadmap.

SWIMLANE TOPICS (create sections in this exact order):
${swimlaneList}
${fixedSectionContentInstructions}

FOR EACH SECTION:
1. "swimlane": Use the EXACT swimlane name from the list above
2. "sectionTitle": Create a compelling 2-4 word title (max 30 characters) for the section title slide (can be more engaging than the swimlane name)
3. "slides": Generate content slides summarizing research findings for this topic

SLIDES PER SECTION (EXPANDED COVERAGE - CRITICAL):
- Generate 5-10 slides per section for comprehensive topic coverage
- Each slide MUST focus on a DISTINCT sub-topic within the section
- Minimum 5 slides per section with substantial research content
- Maximum 10 slides to maintain focus and avoid repetition

NARRATIVE PROGRESSION WITHIN EACH SECTION (REQUIRED):
Every section must follow this three-phase arc for coherent storytelling:

PHASE 1 - CONTEXT (1-2 slides at section start):
- What IS happening? (Competitive move, market shift, regulatory change)
- Use twoColumn layout for focused, authoritative opening
- Tagline signals the situation: "MARKET SHIFT", "Q3 DEADLINE", "COMPETITOR MOVE"
- Establish urgency and stakes before diving into analysis

PHASE 2 - ANALYSIS (3-5 slides, section middle):
- Why does it matter? Deep dive into data, comparisons, implications
- Mix twoColumn and threeColumn layouts for visual variety
- Each slide explores a distinct analytical angle
- Tagline signals insight: "COST GAP WIDENING", "MARGIN EROSION", "60% UNPREPARED"
- Build the case with compounding evidence

PHASE 3 - IMPLICATIONS (2-3 slides at section end):
- What should we DO? Recommendations, timelines, decision points
- Prefer threeColumn for presenting options or multiple factors
- Tagline signals action: "DECISION REQUIRED", "TIMELINE CRITICAL", "INVESTMENT CASE"
- End with forward momentum, not backward summary

ANTI-PATTERN: Random slide order that jumps context→implications→context
Readers need context before analysis, analysis before implications

SUB-TOPIC FIELD (REQUIRED FOR EVERY SLIDE):
- The "subTopic" field identifies the specific focus of each slide
- Sub-topics must be distinct within a section - NO DUPLICATES
- Format: 2-5 words, title case (e.g., "Cost Benefit Analysis", "Q3 Timeline", "Vendor Comparison")
- Sub-topics enable slide-level TOC navigation
- Example sub-topics for a "Digital Transformation" section:
  1. "Current State Assessment"
  2. "Technology Gap Analysis"
  3. "Implementation Roadmap"
  4. "Cost Projections"
  5. "Risk Mitigation Strategy"
  6. "Success Metrics"
  7. "Vendor Evaluation"

CONTENT FOCUS:
- Summarize key findings, insights, and implications from research for each topic
- Do NOT copy task-level details from the Gantt chart
- Focus on strategic insights, data points, and recommendations
- Each slide should stand alone with valuable information
`
    : `
SLIDE GENERATION:
Generate a logical sequence of slides covering the key topics from the research.
Aim for 15-30 slides total, organized by theme (5-10 slides per section).

Create sections based on major themes you identify in the research.
Each section should have:
- "swimlane": A topic name you identify from the research
- "sectionTitle": A compelling 2-4 word title (max 30 characters) for that topic
- "slides": 5-10 content slides per section, each with a distinct sub-topic

SUB-TOPIC FIELD (REQUIRED FOR EVERY SLIDE):
- The "subTopic" field identifies the specific focus of each slide
- Sub-topics must be distinct within a section - NO DUPLICATES
- Format: 2-5 words, title case (e.g., "Cost Benefit Analysis", "Risk Assessment")
`;

  // Build outline constraint if outline is provided (Pass 2 of two-pass generation)
  const primaryFramework = outline?.reasoning?.primaryFramework;
  const keyEvidenceChains = outline?.reasoning?.keyEvidenceChains || [];

  const outlineConstraint = outline ? `
NARRATIVE OUTLINE (STRICT CONSTRAINT - FROM PASS 1):
You have been given a pre-planned narrative structure. You MUST follow it exactly.

${JSON.stringify(outline, null, 2)}

OUTLINE FIELD REFERENCE (use these to verify compliance):
- Total sections: ${outline.sections?.length || 0}
- Slides per section: ${outline.sections?.map((s, i) => `Section ${i+1}: ${s.slides?.length || 0} slides`).join(', ') || 'See outline'}
- Primary framework: ${outline.reasoning?.primaryFramework || 'See outline'}
- Evidence chains to include: ${outline.reasoning?.keyEvidenceChains?.length || 0}

PRIMARY FRAMEWORK ENFORCEMENT:
The outline specifies "${primaryFramework}" as the dominant analytical lens.
- EVERY analytical slide MUST use this framework's signature patterns
- At least 50% of slides must explicitly signal this framework
- Use phrases from: ${getFrameworkSignalPhrases(primaryFramework)}

KEY EVIDENCE CHAINS (MUST APPEAR IN SLIDES):
${keyEvidenceChains.map((c, i) =>
  `${i + 1}. Evidence: "${c.evidence?.substring(0, 80)}${c.evidence?.length > 80 ? '...' : ''}" -> Must appear in at least one slide`
).join('\n') || 'No key evidence chains specified'}

OUTLINE REQUIREMENTS (HARD CONSTRAINTS):
- Use the EXACT taglines from the outline (minor rewording only for impact)
- Feature the keyDataPoint identified for each slide as PRIMARY evidence
- Apply the analyticalLens specified - use the EXACT framework from the outline
- Honor the connectsTo field - ensure your slide's conclusion leads logically to the next slide
- Maintain the narrativeArc for each section (tension → insight → resolution)

` : '';

  return `You are creating presentation slides organized into SECTIONS, with STRICT formatting requirements.

${sectionInstructions}
${outlineConstraint}
CROSS-SLIDE NARRATIVE THREADING (CRITICAL FOR COHERENCE):
Follow the outline's connectsTo fields for narrative flow. Each slide must build on the previous slide's implication using forward-referencing language. Section endings must create tension that the next section resolves. No isolated "islands" of analysis.

ANALYTICAL DEPTH FRAMEWORKS (MANDATORY):
Go beyond surface-level observations. For EVERY analytical slide, you MUST:
1. Apply one framework from the list below
2. Use the framework's SIGNAL PHRASES (not the framework name itself) to express the analysis

CRITICAL: NEVER write framework names like "SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS" etc. literally in slide content. These are internal labels only. Instead, use natural language signal phrases to convey the analytical approach.

FRAMEWORK SIGNATURE PATTERNS (use these phrases to signal your framework):

1. SECOND_ORDER_EFFECTS: "If X happens → Y follows → which means Z..."
   Signal phrases: "This triggers...", "Which in turn...", "The downstream effect..."
   Don't just state the fact; trace its downstream consequences
   Example: "50% cost reduction → competitors lose pricing power → industry consolidation accelerates"

2. CONTRARIAN: "The obvious conclusion is X, but evidence suggests Y..."
   Signal phrases: "Conventional wisdom suggests...", "However, data reveals...", "Counter to expectations..."
   Challenge the expected interpretation with data
   Example: "While CDM appears costly, the $2.3M quarterly loss from NOT adopting exceeds implementation cost"

3. COMPETITIVE_DYNAMICS: "While we consider X, competitors gain/lose Y..."
   Signal phrases: "Market positioning shifts as...", "First-mover advantage...", "The competitive gap..."
   Frame decisions in competitive context, not isolation
   Example: "Each quarter of delay shifts market share; early adopters capture sticky client relationships"

4. TEMPORAL_ARBITRAGE: "Short-term cost X enables long-term advantage Y..."
   Signal phrases: "Front-loading investment...", "Compounds over time...", "Delayed gratification..."
   Connect present pain to future gain (or present inaction to future loss)
   Example: "18-month implementation investment yields 10-year operational moat"

5. RISK_ASYMMETRY: "Downside is capped at X, but upside extends to Y..."
   Signal phrases: "Bounded risk of...", "Unlimited potential for...", "Asymmetric opportunity..."
   Frame decisions in terms of bounded downside vs. unbounded upside
   Example: "$4M pilot risk vs. $40M annual savings potential = asymmetric opportunity"

6. CAUSAL_CHAIN: "A causes B which triggers C..."
   Signal phrases: "Because of...", "This leads to...", "The root cause..."
   Trace the causal links explicitly

TAGLINE INSIGHT PATTERNS (use these, NOT topic labels):
Your tagline must signal INSIGHT, TENSION, or STAKES - never just name the topic.

QUANTIFIED STAKES: "73% UNPREPARED", "$4.2M AT RISK", "50% COST GAP", "8% QUARTERLY EROSION"
ACTION TENSION: "DECISION WINDOW", "ADOPTION CLIFF", "CLOSING RUNWAY", "PILOT OR PERISH"
COMPETITIVE GAP: "WIDENING GAP", "FIRST-MOVER EDGE", "MARGIN EROSION", "MARKET SHARE SHIFT"
TEMPORAL PRESSURE: "Q2 DEADLINE", "18-MONTH RUNWAY", "WINDOW CLOSING", "2025 INFLECTION"

TAGLINE ANTI-PATTERNS (NEVER USE - THESE ARE TOPIC LABELS, NOT INSIGHTS):
"OVERVIEW", "SUMMARY", "KEY POINTS", "ANALYSIS", "FINDINGS", "FACTORS", "INTRODUCTION"
"BACKGROUND", "CONTEXT", "DETAILS", "INFORMATION", "DISCUSSION", "CONSIDERATIONS"

TWO LAYOUT OPTIONS - You MUST explicitly specify layout for EVERY content slide:

LAYOUT 1: "twoColumn" - Use for focused topics, executive summaries, key findings
- MUST include: layout: "twoColumn"
- Fields: layout, tagline, title, paragraph1, paragraph2
- paragraph1 and paragraph2: EXACTLY 380-410 characters each

LAYOUT 2: "threeColumn" - Use for comparisons, multiple related points, detailed breakdowns
- MUST include: layout: "threeColumn"
- Fields: layout, tagline, title, paragraph1, paragraph2, paragraph3
- paragraph1, paragraph2, paragraph3: EXACTLY 370-390 characters each

LAYOUT SELECTION RULES (CRITICAL - MUST VARY LAYOUTS):
- You MUST use BOTH layouts throughout the presentation for visual variety
- Aim for approximately 40-50% threeColumn slides
- NEVER create a presentation with only one layout type
- twoColumn: Opening slides, conclusions, single-topic deep dives, executive summaries
- threeColumn: Comparisons, multiple benefits/features, process steps, detailed breakdowns, data-heavy topics

COMMON RULES FOR ALL CONTENT SLIDES:

ACRONYMS (CRITICAL - USE EXACT STANDARD CAPITALIZATION IN ALL FIELDS):
Applies to: title, sectionTitle, tagline, paragraph1, paragraph2, paragraph3

${getAcronymRules()}

TAGLINE: 2-word uppercase label, MAX 21 characters. Example: "MARGIN EROSION"

TITLE RULES (CRITICAL - HARD LIMIT: 3 OR 4 LINES ONLY):
!!! STOP AND COUNT: Every title MUST have EXACTLY 2 or 3 \\n separators. NO EXCEPTIONS !!!
!!! ACRONYM REMINDER: Preserve exact acronym casing in titles - "FpML" NOT "Fpml", "SaaS" NOT "Saas" !!!
- MANDATORY: Count \\n separators BEFORE writing each title. 2 = 3 lines, 3 = 4 lines. NEVER 4+ separators.
- 5+ LINES = REJECTED. 6+ LINES = REJECTED. 7+ LINES = REJECTED. The slide WILL break.
- If your concept has 5+ words, you MUST combine words onto shared lines
- REWRITE titles that are too long - use shorter synonyms, remove unnecessary words
- twoColumn layout: Each line MAX 10 characters - use SHORT words only (5-8 chars ideal)!
- threeColumn layout: Each line MAX 18 characters

!!! CRITICAL: WORD LENGTH LIMIT - MAX 9 CHARACTERS PER WORD IN TITLES !!!
The title column is VERY NARROW. Words over 9 characters WILL break mid-word and look terrible.

BANNED WORDS (10+ chars) - You MUST use shorter synonyms:
- "standardized" (12) → "standard" (8) or "unified" (7)
- "foundation" (10) → "basis" (5) or "core" (4)
- "modernization" (13) → "upgrade" (7) or "reform" (6)
- "implementation" (14) → "rollout" (7) or "launch" (6)
- "transformation" (14) → "shift" (5) or "change" (6)
- "infrastructure" (14) → "systems" (7) or "stack" (5)
- "standardization" (15) → "standards" (9)
- "reconciliation" (14) → "matching" (8)
- "consolidation" (13) → "merger" (6)
- "organizations" (13) → "firms" (5) or "banks" (5)
- "opportunities" (13) → "chances" (7) or "gains" (5)
- "jurisdictions" (13) → "regions" (7)
- "requirements" (12) → "rules" (5) or "needs" (5)
- "capabilities" (12) → "skills" (6) or "tools" (5)
- "competitive" (11) → "rival" (5)
- "operational" (11) → "ops" (3)
- "regulatory" (10) → "rules" (5) or "regs" (4)
- "compliance" (10) → "comply" (6)
- "automation" (10) → "auto" (4)

BEFORE WRITING ANY TITLE: Count characters in each word. If ANY word > 9 chars, replace it!

TITLE FAILURE EXAMPLES (NEVER DO THIS):
- BAD 7-line: "BSA/AML\\norder\\ndelays\\nstrategic\\ntech\\nadoption\\nroadmap" = 6 separators = BROKEN
  FIXED 4-line: "BSA/AML order\\ndelays tech\\nadoption\\nroadmap" = 3 separators = OK
- BAD 5-line: "Multi-\\njurisdiction\\nDRR rollout\\naccelerates\\nadoption" = 4 separators = BROKEN
  FIXED 4-line: "Global DRR\\nrollout\\naccelerates\\nadoption" = 3 separators = OK
- BAD 5-line: "Unknown\\nstatus\\nwidening\\ntechnology\\ngap" = 4 separators = BROKEN
  FIXED 3-line: "Unknown status\\nwidens tech\\ngap" = 2 separators = OK

TITLE SUCCESS PATTERN:
- 3-line: "Word1\\nWord2\\nWord3" (exactly 2 \\n)
- 4-line: "Line1\\nLine2\\nLine3\\nLine4" (exactly 3 \\n)
- GOOD: "Data\\nFuels\\nDecisions", "Market\\nShare\\nErosion", "CDM cuts\\ncosts by\\n60%"

OTHER TITLE RULES:
- NEVER split a word across lines
- NEVER put short connector words alone (to, a, in, of, for, the, and, or) - combine with adjacent words
- AVOID letters g, y, p, q, j on lines 1-2 for 3-line titles (descenders overlap)
- Last line can use any letters

PARAGRAPH REQUIREMENTS (CRITICAL):
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph
- twoColumn paragraphs: 380-410 characters each
- threeColumn paragraphs: 370-390 characters each

ANALYTICAL RIGOR (CRITICAL):
- Each paragraph MUST contain at least ONE specific data point from research
- Quantify all claims: use percentages, dollar amounts, timeframes
- NEVER use vague terms: "significant", "substantial", "considerable", "various"

EVIDENCE → INSIGHT → IMPLICATION CHAIN (REQUIRED FOR EVERY PARAGRAPH):

Every paragraph MUST follow this three-part structure:
1. EVIDENCE: Open with a sourced, quantified data point from research
2. INSIGHT: Explain what this data MEANS - the "so what?" that reveals significance
3. IMPLICATION: State what the reader should DO, DECIDE, or EXPECT as a result

PARAGRAPH CONSTRUCTION PATTERN:
- Sentence 1-2: EVIDENCE - "[Source] reveals [specific data point]..."
- Sentence 2-3: INSIGHT - "This demonstrates/indicates/exposes [meaning]..."
- Sentence 3-4: IMPLICATION - "Organizations that [action] will [outcome]..."

EXAMPLE - POOR PARAGRAPH (no chain, isolated facts):
"JPMorgan deployed CDM. Reconciliation costs dropped 50%. Banks face pressure."
Problems: No source attribution, facts don't connect, no insight or implication

EXAMPLE - GOOD PARAGRAPH (complete chain):
"JPMorgan's Q4 2024 deployment of CDM cut reconciliation costs 50%, according to their Annual Investor Report. This early-mover advantage compounds quarterly as manual-process competitors fall further behind on unit economics. Organizations delaying past Q2 2025 face a widening cost gap estimated at 8-12% per quarter."
Why it works: Sourced evidence → clear insight about competitive dynamics → actionable implication with timeline

${getSourceExtractionRules('full')}

NARRATIVE ENERGY (CRITICAL):
- Lead each paragraph with tension, insight, or stakes - not topic introduction
- Use power verbs: Reveals, Threatens, Enables, Erodes, Accelerates, Undermines, Exposes
- Vary sentence rhythm: follow complex sentences with short punchy ones
- Use contrast: "While X suggests..., Y reveals..."
- End paragraphs with forward momentum pointing to implications, not summary
- Use active voice: "Revenue collapsed 40%" not "There was a 40% decline"

ANTI-PATTERNS TO REJECT:
- Opening with: "This slide discusses...", "The following points...", "In this section..."
- Generic statements without data: "Growth has been strong", "Performance improved"
- Weasel words: significant, substantial, considerable, various, many, some, often
- Passive voice hiding the actor: "It was determined that..." → "Analysis reveals..."
- Topic-label taglines: "OVERVIEW", "INTRODUCTION", "SUMMARY", "ANALYSIS"
- Backward-looking conclusions: "In summary, we discussed..." → forward implications

COMPLETE SLIDE EXAMPLES (STUDY THESE):

EXAMPLE - POOR SLIDE (don't do this):
{
  tagline: "CDM OVERVIEW",
  title: "Common\\nData\\nModel",
  paragraph1: "CDM is a data model used in financial services. It helps with data reconciliation across different systems. Many banks are considering adoption. The technology has been around for several years and is becoming more important.",
  paragraph2: "Implementation requires careful planning. Organizations should assess their current state. There are various factors to consider. The benefits can be significant for those who adopt early."
}
PROBLEMS: Generic tagline, no sources, no data points, weasel words ("various", "significant"), no insight chain, vague statements

EXAMPLE - GOOD SLIDE (do this):
{
  tagline: "MARGIN COMPRESSION",
  title: "CDM cuts\\ncosts 50%\\nfor rivals",
  paragraph1: "JPMorgan's Q4 2024 CDM deployment slashed reconciliation costs by 50%, according to their Annual Investor Report. This competitive gap compounds as early adopters lock in operational efficiency while manual-process firms hemorrhage $2.3M quarterly on redundant reconciliation workflows. Each quarter of delay widens the unit cost disadvantage by an estimated 8-12%, creating urgency for accelerated adoption timelines.",
  paragraph2: "The Federal Reserve's Economic Data reveals 60% of mid-tier banks haven't initiated CDM pilots, exposing a market where fast followers still capture second-mover advantage. Goldman Sachs and Citi both announced Q1 2025 deployment targets, signaling industry consensus on CDM's strategic necessity. Organizations without active CDM roadmaps by Q2 2025 risk permanent cost structure disadvantage against digitally-transformed competitors."
}
WHY IT WORKS: Insight-driven tagline, sourced data points, complete evidence-insight-implication chains, specific numbers, power verbs ("slashed", "hemorrhage", "exposing"), forward momentum

${spineText ? spineText + '\n' : ''}${digestText ? digestText + '\n' : ''}${formatDateContext(dateContext, 'slides')}

${formatStatsSourcesEvidence(stats, sources, contextualStats, 'use at least one per slide')}

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

${outline ? `
OUTLINE FIDELITY CHECKLIST (verify before generating):
1. TAGLINE FIDELITY: Use EXACT taglines from outline (minor rewording only for impact).
2. KEY DATA POINTS: Each slide's keyDataPoint MUST appear as PRIMARY evidence.
3. ANALYTICAL LENS: Primary framework "${outline.reasoning?.primaryFramework || 'Not specified'}" — at least 50% of slides must use its signal phrases.
4. CONNECTION THREADING: Paragraph endings must match connectsTo fields.
5. SECTION ARC: Each section follows its narrativeArc (Context → Analysis → Implications).
` : ''}
OUTPUT FORMAT (CRITICAL):
- Output ONLY valid JSON - no markdown code fences, no explanatory text before or after
- The response must start with { and end with }

JSON STRUCTURE:
- "title": Presentation title (string)
- "sections": Array of section objects, each with:
  - "swimlane": Topic name (string)
  - "sectionTitle": Compelling section title, max 30 characters (string)
  - "slides": Array of content slides (minimum 1 per section)

Content slide format (layout and subTopic are REQUIRED for all slides):
- twoColumn: {layout: "twoColumn", tagline, title, paragraph1, paragraph2, subTopic}
- threeColumn: {layout: "threeColumn", tagline, title, paragraph1, paragraph2, paragraph3, subTopic}

REMEMBER: Use BOTH layouts - aim for ~40-50% threeColumn slides for visual variety.

FINAL VALIDATION (DO THIS BEFORE OUTPUTTING - MANDATORY):
1. For EVERY title field in your output, COUNT the \\n characters
2. If count > 3, that title has 5+ lines and WILL BREAK the slide - REWRITE IT NOW
3. Rewrite strategy: combine short words, use synonyms, drop unnecessary words
4. VERIFY: Every title must have exactly 2 or 3 \\n separators (3 or 4 lines)
5. Double-check twoColumn titles: each line must be ≤10 characters
`;
}

/**
 * Generate prompt for speaker notes (Pass 2 of two-pass generation)
 * Creates comprehensive presenter support notes for each slide
 * Uses outline from Pass 1 as constraint for higher quality output
 * @param {object} slidesData - Generated slides data with sections
 * @param {Array<{filename: string, content: string}>} researchFiles - Original research files
 * @param {string} userPrompt - Original user request
 * @param {object|null} outline - Optional outline from Pass 1 for constrained generation
 * @returns {string} Complete prompt for speaker notes generation
 */
export function generateSpeakerNotesPrompt(slidesData, researchFiles, userPrompt, outline = null) {
  if (!slidesData?.sections?.length) {
    throw new Error('slidesData with sections is required for speaker notes generation');
  }
  if (!researchFiles?.length) {
    throw new Error('researchFiles are required for speaker notes generation');
  }

  // Format slides data for the prompt
  const slidesReference = formatSlidesReference(slidesData, 200);

  // Format research content
  const validResearchFiles = researchFiles.filter(file => file?.filename && file?.content?.trim());
  const researchContent = assembleResearchContent(validResearchFiles);

  // Extract source document names for reference
  const sourceDocuments = researchFiles
    .filter(file => file?.filename)
    .map(file => file.filename);

  // Build outline constraint section if outline is provided
  const outlineConstraint = outline ? `
## OUTLINE FROM PASS 1 (STRICT CONSTRAINT)
You have been given a pre-analyzed reasoning framework. You MUST use it to guide your notes.

### PRESENTATION NARRATIVE ARC
${outline.reasoning?.presentationNarrativeArc || 'Not specified'}

### AUDIENCE PROFILE
- Primary Stakeholder: ${outline.reasoning?.audienceProfile?.primaryStakeholder || 'Not specified'}
- Pain Points: ${outline.reasoning?.audienceProfile?.painPoints?.join(', ') || 'Not specified'}
- Decision Criteria: ${outline.reasoning?.audienceProfile?.decisionCriteria?.join(', ') || 'Not specified'}

### KEY EVIDENCE CHAINS (MUST appear in Q&A responses)
${outline.reasoning?.keyEvidenceChains?.map((chain, i) => `
${i + 1}. Evidence: "${chain.evidence}"
   Insight: "${chain.insight}"
   Anticipated Question: "${chain.anticipatedQuestion}"
   Prepared Response: "${chain.preparedResponse}"
`).join('') || 'No evidence chains specified'}

### SOURCE INVENTORY (USE THESE SOURCE NAMES)
${outline.reasoning?.sourceInventory?.map((src, i) => `
${i + 1}. ${src.sourceName} (${src.confidenceLevel} confidence)
   - ${src.keyFindings?.join('\n   - ') || 'No key findings'}
`).join('') || 'No sources specified'}

### ANTICIPATED PUSHBACK (PREPARE FOR THESE)
${outline.reasoning?.anticipatedPushback?.map((pb, i) => `
${i + 1}. [${pb.pushbackType}] "${pb.specificObjection}"
   Counter with: ${pb.evidenceToCounter}
   Reframe as: ${pb.reframingStrategy}
`).join('') || 'No pushback specified'}

### NARRATIVE TRANSITIONS (USE THESE BRIDGE PHRASES)
${outline.reasoning?.narrativeTransitions?.map(t => `
- From "${t.fromSlide}" → To "${t.toSlide}": "${t.bridgePhrase}"
`).join('') || 'No transitions specified'}

### SLIDE-LEVEL GUIDANCE
${outline.slideOutlines?.map((so, i) => `
Slide ${i + 1} (${so.sectionName} - "${so.slideTagline}"):
- Narrative Position: ${so.narrativePosition}
- Key Talking Point: ${so.keyTalkingPoint}
- Primary Question: ${so.primaryQuestion || 'Not specified'}
- Primary Source: ${so.primarySource || 'Not specified'}
- So-What: ${so.soWhatStatement || 'Not specified'}
`).join('') || 'No slide outlines'}

OUTLINE FIDELITY REQUIREMENTS:
1. Use EXACT source names from sourceInventory (not filenames)
2. Include ALL keyEvidenceChains in Q&A responses
3. Use anticipatedPushback for response strategies and narrativeTransitions for transitions
4. Honor narrative position and so-what from slideOutlines
5. Copy reasoning object to top-level 'reasoning' field in output

` : '';

  return `You are generating SPEAKER NOTES for a sales presentation. These notes will help a consulting partner prepare for client meetings.
${outline ? '\nThis is PASS 2 of a two-pass generation. You have been given an outline with reasoning to guide your output.' : ''}

## YOUR ROLE
You are a senior consultant preparing presenter notes that will:
1. Help the presenter deliver the content confidently
2. Anticipate client questions and objections
3. Trace every claim back to source documents
4. Explain how the presentation fits together as a narrative

## SLIDES TO ANNOTATE
The following slides have already been generated. Create speaker notes for EACH content slide (skip section title slides).

${slidesReference}

## SOURCE DOCUMENTS
These are the original research documents used to generate the slides. Use them for:
- Source attribution (cite specific documents, pages, sections)
- Answering "where did this come from?" questions
- Identifying direct extractions vs. synthesis vs. inference

${outline?.reasoning?.sourceInventory?.length ? `
Authoritative sources identified in analysis:
${outline.reasoning.sourceInventory.map(s => `- ${s.sourceName} (${s.confidenceLevel} confidence)`).join('\n')}
` : `Source documents provided: ${sourceDocuments.join(', ')}
NOTE: Extract actual publication names from within these documents - do NOT cite these filenames.`}
${outlineConstraint}
## SPEAKER NOTES REQUIREMENTS

For EACH content slide, populate all schema fields. Key quality guidance per section:

### 1. NARRATIVE
- Talking points: 1-2 natural sentences usable VERBATIM (not bullet fragments)
- Include delivery cues: [pause], [emphasize], [gesture to slide]
- Open with a hook: "Here's where it gets interesting..." / "This is the critical insight..."
- keyPhrase: a memorable, quotable line the client will repeat internally

### 2. ANTICIPATED QUESTIONS
- Use ACE framework for EVERY response: Acknowledge -> Cite Evidence -> Expand
- severity levels guide preparation priority (deal_breaker = kills the deal if unaddressed)
- escalationResponse: second response if they push back AGAIN
- bridgeToStrength: pivot the objection INTO a selling point

### 3. SOURCE ATTRIBUTION
- CRITICAL: Extract REAL publication names from research ("McKinsey 2024 Report", "Gartner MQ Q3 2024"), NEVER cite uploaded filenames
- For inference-level confidence, flag assumptions explicitly

### 4. STORY CONTEXT
- soWhat MUST be: action-oriented, quantified, urgent, client-specific
  Example: "Accelerate CDM pilot before Q2, saving \$2.3M annually"
- callToAction: vary ask intensity by audience warmth (warm=commitment, neutral=follow-up, hostile=address concerns)
- timeGuidance: condensedVersion = one-sentence version if running late

### 5-6. TRANSPARENCY & CREDIBILITY
- Data lineage: trace claim -> source -> page/section
- Credibility anchors: prioritize analyst firms > peer results > regulatory bodies > academic

### 7. RISK MITIGATION
- Address implementation, reputational, and career risk only when relevant to slide content
- De-risk with: pilot scope, phased approach, checkpoints, off-ramps

### 8. STAKEHOLDER ANGLES
- cfo: ROI/savings with specific numbers; cto: integration/security feasibility
- ceo: competitive positioning/board narrative; operations: timeline/resource/change mgmt

### 9-10. AUDIENCE SIGNALS & QUICK REFERENCE
- Schema fields are self-descriptive; focus on making quickReference memorable and quotable

### 11. BRIDGE PHRASES (TOP-LEVEL reasoning.bridgePhrases, NOT per-slide)
Pre-written escape phrases for: dontKnowAnswer, hostileInterruption, goingOffTopic, technicalDive, losingTheRoom (2-3 phrases each)

## QUALITY STANDARDS

TALKING POINTS: Sound like a confident senior partner, not reading. Include specific numbers/dates/companies. Add context the slide doesn't show.

QUESTIONS: Target the HARDEST CFO/CTO objections. NEVER give generic responses - every answer needs a specific data point.

SOURCES: NEVER cite filenames. ALWAYS extract actual publication names. Flag confidence level clearly.

SO-WHAT: Action verb + timeline + business metric + client-specific framing. Specific enough for the client to repeat in their next board meeting.

## ORIGINAL USER REQUEST
"${userPrompt}"

## RESEARCH CONTENT
${researchContent}

## OUTPUT FORMAT
Return valid JSON matching the speakerNotesSchema. Generate notes for every content slide in order.
- Skip section title slides (they don't need presenter notes)
- Match slideIndex to the slide's position within its section (0-based)
- Include sectionName and slideTagline for reference
${outline ? `
IMPORTANT: Include the 'reasoning' block at the top level of your output.
Transform the outline reasoning into the speakerNotesSchema reasoning format:
- presentationNarrativeArc: Copy from outline
- audienceProfile: Copy from outline (primaryStakeholder, painPoints, decisionCriteria)
- keyEvidenceChains: Transform evidence/insight/question/response to evidence/insight/anticipatedQuestion/preparedResponse
- sourceInventory: Copy from outline
- anticipatedPushback: Copy from outline
` : ''}
Start with { and end with }`;
}

/**
 * Generate prompt for speaker notes outline (Pass 1)
 * Creates reasoning framework and lightweight structure before full notes generation
 * @param {object} slidesData - Generated slides data with sections
 * @param {Array<{filename: string, content: string}>} researchFiles - Original research files
 * @param {string} userPrompt - Original user request
 * @returns {string} Complete prompt for speaker notes outline generation
 */
export function generateSpeakerNotesOutlinePrompt(slidesData, researchFiles, userPrompt) {
  if (!slidesData?.sections?.length) {
    throw new Error('slidesData with sections is required for speaker notes outline generation');
  }
  if (!researchFiles?.length) {
    throw new Error('researchFiles are required for speaker notes outline generation');
  }

  // Format slides data for the prompt
  const slidesReference = formatSlidesReference(slidesData, 150);

  // Format research content
  const validResearchFiles = researchFiles.filter(file => file?.filename && file?.content?.trim());
  const researchContent = assembleResearchContent(validResearchFiles);

  // Extract source document names for reference
  const sourceDocuments = researchFiles
    .filter(file => file?.filename)
    .map(file => file.filename);

  return `You are performing STEP 1 of a two-step speaker notes generation process.

## YOUR TASK
Create a REASONING FRAMEWORK and LIGHTWEIGHT OUTLINE for speaker notes.
This will guide the full notes generation in Step 2.

## CHAIN-OF-THOUGHT INSTRUCTION (CRITICAL)
You MUST complete the 'reasoning' object FIRST, before creating any slide outlines.
This forces you to think deeply about:
1. The overall narrative arc of the presentation
2. Who the audience is and what they care about
3. What evidence chains will drive the Q&A
4. What sources to cite (not filenames - actual publication names)
5. How slides connect through transitions
6. What pushback to anticipate and how to handle it

## REASONING REQUIREMENTS (COMPLETE BEFORE SLIDE OUTLINES)
Populate all schema reasoning fields. Focus especially on:

### 1. PRESENTATION NARRATIVE ARC
Format: "[Opening Hook] → [Tension Building] → [Resolution/CTA]" — the single story thread connecting all slides.

### 2. KEY EVIDENCE CHAINS (3-5 chains)
For each: evidence (data+source) -> insight (so what) -> anticipatedQuestion -> preparedResponse (ACE: Acknowledge, Cite Evidence, Expand)

### 3. SOURCE INVENTORY
Extract REAL publication names from research (not filenames). Note key findings and confidence level per source.

### 4. ANTICIPATED PUSHBACK (3-5)
Think like a skeptical CFO/CTO: specific objection, evidence to counter, reframing as opportunity.

## SLIDES TO OUTLINE

${slidesReference}

## SOURCE DOCUMENTS
Available for citation: ${sourceDocuments.join(', ')}

## RESEARCH CONTENT
${researchContent}

## ORIGINAL USER REQUEST
"${userPrompt}"

## SLIDE OUTLINE REQUIREMENTS (AFTER REASONING)

For each content slide, provide a lightweight outline:
- slideIndex: Position within section (0-based)
- sectionName: Section name
- slideTagline: The slide's tagline
- narrativePosition: Where it sits in the arc (${NARRATIVE_POSITIONS.join(", ")})
- keyTalkingPoint: The ONE most important point (will be expanded in Pass 2)
- primaryQuestion: Most likely question this slide triggers
- primarySource: Main source to cite (authoritative name, not filename)
- soWhatStatement: Draft of why this matters to the client

## OUTPUT FORMAT
Return valid JSON matching the speakerNotesOutlineSchema.
- Complete the 'reasoning' object FIRST
- Then provide 'slideOutlines' for each content slide
- Skip section title slides

Start with { and end with }`;
}
