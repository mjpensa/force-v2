/**
 * DocumentView Component
 * Phase 4: Long-form document reading with Google Docs-inspired UI
 *
 * Features:
 * - Table of contents with scroll spy (highlights current section)
 * - Hierarchical section rendering (3 heading levels)
 * - Content blocks: paragraphs, lists, tables, quotes, evidence
 * - Executive summary with TL;DR label
 * - Key insights per section
 * - Prioritized recommendations section
 * - Sticky TOC navigation for easy jumping
 * - Print-friendly layout
 * - Responsive design (mobile hides TOC, shows inline)
 */

export class DocumentView {
  /**
   * @param {object} documentData - Document data from API
   * @param {string} sessionId - Session ID for data fetching
   */
  constructor(documentData = null, sessionId = null) {
    this.documentData = documentData;
    this.sessionId = sessionId;
    this.container = null;
    this.activeSectionId = null;
    this.scrollHandler = null;
    this.resizeObserver = null;
    this.tocLinks = new Map(); // sectionId -> tocLink element
  }

  /**
   * Render the document view
   * @returns {HTMLElement} Container element
   */
  render() {
    this.container = document.createElement('div');
    this.container.className = 'document-view';

    if (!this.documentData || !this.documentData.sections || this.documentData.sections.length === 0) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }

    // Add glassmorphic three-dot menu in upper right corner (above TOC)
    if (this.sessionId) {
      const menu = this._createDocumentMenu();
      this.container.appendChild(menu);
    }

    // Normalize sections - add id and level if missing
    this._normalizeSections();

    // Main container with TOC + content layout
    const documentContainer = document.createElement('div');
    documentContainer.className = 'document-container';

    // Table of contents (left sidebar)
    const toc = this._renderTableOfContents();
    documentContainer.appendChild(toc);

    // Document content (main area)
    const content = this._renderContent();
    documentContainer.appendChild(content);

    this.container.appendChild(documentContainer);

    // Setup scroll spy after rendering
    setTimeout(() => this._setupScrollSpy(), 100);

    return this.container;
  }

  /**
   * Normalize sections to ensure they have id and level properties
   */
  _normalizeSections() {
    this.documentData.sections = this.documentData.sections.map((section, index) => {
      // Generate id from heading if missing
      if (!section.id) {
        section.id = this._generateId(section.heading, index);
      }
      // Default to level 1 if missing
      if (!section.level) {
        section.level = 1;
      }
      return section;
    });
  }

  /**
   * Generate a URL-safe id from heading text
   */
  _generateId(heading, index) {
    if (!heading) return `section-${index}`;
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) || `section-${index}`;
  }

  /**
   * Render table of contents with structured navigation:
   * 1. Overview (Analysis Overview section)
   * 2. Swimlane topic sections
   * 3. Closing
   */
  _renderTableOfContents() {
    const tocContainer = document.createElement('div');
    tocContainer.className = 'document-toc';

    const tocTitle = document.createElement('h3');
    tocTitle.className = 'toc-title';
    tocTitle.textContent = 'Contents';
    tocContainer.appendChild(tocTitle);

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';

    // 1. Overview link (if analysis overview exists)
    if (this.documentData.analysisOverview) {
      const overviewLi = document.createElement('li');
      const overviewLink = document.createElement('a');
      overviewLink.className = 'toc-link';
      overviewLink.href = '#analysis-overview';
      overviewLink.textContent = 'Overview';
      overviewLink.setAttribute('data-section-id', 'analysis-overview');

      overviewLink.addEventListener('click', (e) => {
        e.preventDefault();
        this._scrollToSection('analysis-overview');
      });

      this.tocLinks.set('analysis-overview', overviewLink);
      overviewLi.appendChild(overviewLink);
      tocList.appendChild(overviewLi);
    }

    // 2. Swimlane topic sections - use swimlaneTopic name if available
    this.documentData.sections.forEach(section => {
      if (section.level !== 1) return; // Only top-level sections

      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'toc-link';
      link.href = `#${section.id}`;
      // Use swimlaneTopic for display if available, otherwise use heading
      link.textContent = section.swimlaneTopic || section.heading;
      link.setAttribute('data-section-id', section.id);

      link.addEventListener('click', (e) => {
        e.preventDefault();
        this._scrollToSection(section.id);
      });

      // Store reference for scroll spy
      this.tocLinks.set(section.id, link);
      li.appendChild(link);
      tocList.appendChild(li);
    });

    // 3. Closing link (always add at the end)
    const closingLi = document.createElement('li');
    const closingLink = document.createElement('a');
    closingLink.className = 'toc-link';
    closingLink.href = '#document-closing';
    closingLink.textContent = 'Closing';
    closingLink.setAttribute('data-section-id', 'document-closing');

    closingLink.addEventListener('click', (e) => {
      e.preventDefault();
      this._scrollToSection('document-closing');
    });

    this.tocLinks.set('document-closing', closingLink);
    closingLi.appendChild(closingLink);
    tocList.appendChild(closingLi);

    tocContainer.appendChild(tocList);
    return tocContainer;
  }

  /**
   * Check if subsection belongs to parent section
   */
  _isSubsectionOf(subsection, parentSection) {
    // Simple heuristic: subsection comes after parent and before next level-1 section
    const sections = this.documentData.sections;
    const parentIndex = sections.indexOf(parentSection);
    const subsectionIndex = sections.indexOf(subsection);

    if (subsectionIndex <= parentIndex) return false;

    // Find next level-1 section
    const nextLevel1Index = sections.findIndex((s, idx) =>
      idx > parentIndex && s.level === 1
    );

    if (nextLevel1Index === -1) {
      return subsectionIndex > parentIndex;
    }

    return subsectionIndex > parentIndex && subsectionIndex < nextLevel1Index;
  }

  /**
   * Render document content
   */
  _renderContent() {
    const contentContainer = document.createElement('div');
    contentContainer.className = 'document-content';

    // Document header
    const header = this._renderDocumentHeader();
    contentContainer.appendChild(header);

    // Analysis Overview (if present) - comprehensive synthesis before detailed sections
    const overview = this._renderAnalysisOverview();
    if (overview) {
      contentContainer.appendChild(overview);
    }

    // Sections
    this.documentData.sections.forEach(section => {
      const sectionEl = this._renderSection(section);
      contentContainer.appendChild(sectionEl);
    });

    // Recommendations section (if present)
    const recommendations = this._renderRecommendations();
    if (recommendations) {
      contentContainer.appendChild(recommendations);
    }

    // Closing section (always rendered for TOC navigation)
    const closing = this._renderClosingSection();
    contentContainer.appendChild(closing);

    return contentContainer;
  }

  /**
   * Render closing section - wraps up the document
   */
  _renderClosingSection() {
    const container = document.createElement('div');
    container.className = 'document-closing';
    container.id = 'document-closing'; // ID for TOC navigation

    const header = document.createElement('h2');
    header.className = 'section-heading closing-heading';
    header.textContent = 'Closing';
    container.appendChild(header);

    // Generate closing content based on executive summary action
    const closingContent = document.createElement('div');
    closingContent.className = 'closing-content';

    // Primary closing paragraph
    const closingParagraph = document.createElement('p');
    closingParagraph.className = 'closing-paragraph';

    if (this.documentData.executiveSummary?.action) {
      closingParagraph.textContent = `The analysis presented above supports a clear path forward. The recommended action—${this.documentData.executiveSummary.action.replace(/\.$/, '')}—addresses the critical findings and positions the organization to capitalize on the opportunities identified across each strategic theme.`;
    } else {
      closingParagraph.textContent = 'The analysis presented above provides a comprehensive view of the strategic landscape. The detailed sections offer actionable insights for each key area, enabling informed decision-making and strategic prioritization.';
    }
    closingContent.appendChild(closingParagraph);

    // Next steps callout
    const nextSteps = document.createElement('div');
    nextSteps.className = 'closing-next-steps';

    const nextStepsLabel = document.createElement('span');
    nextStepsLabel.className = 'next-steps-label';
    nextStepsLabel.textContent = 'Next Steps';
    nextSteps.appendChild(nextStepsLabel);

    const nextStepsList = document.createElement('ul');
    nextStepsList.className = 'next-steps-list';

    const steps = [
      'Review the detailed findings in each section above',
      'Align key stakeholders on priorities and timelines',
      'Reference the roadmap for implementation sequencing'
    ];

    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      nextStepsList.appendChild(li);
    });

    nextSteps.appendChild(nextStepsList);
    closingContent.appendChild(nextSteps);

    container.appendChild(closingContent);
    return container;
  }

  /**
   * Render analysis overview - comprehensive strategic synthesis
   */
  _renderAnalysisOverview() {
    const overview = this.documentData.analysisOverview;
    if (!overview) return null;

    const container = document.createElement('div');
    container.className = 'analysis-overview';
    container.id = 'analysis-overview'; // ID for TOC navigation

    // Overview header
    const header = document.createElement('div');
    header.className = 'analysis-overview-header';

    const label = document.createElement('span');
    label.className = 'analysis-overview-label';
    label.textContent = 'Strategic Analysis Overview';
    header.appendChild(label);

    container.appendChild(header);

    // Narrative section
    if (overview.narrative) {
      const narrativeContainer = document.createElement('div');
      narrativeContainer.className = 'overview-narrative';

      // Split narrative into paragraphs if it contains newlines, otherwise treat as single block
      const paragraphs = overview.narrative.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach(para => {
        const p = document.createElement('p');
        p.className = 'narrative-paragraph';
        p.textContent = para.trim();
        narrativeContainer.appendChild(p);
      });

      container.appendChild(narrativeContainer);
    }

    // Key Themes section
    if (overview.keyThemes && Array.isArray(overview.keyThemes) && overview.keyThemes.length > 0) {
      const themesContainer = document.createElement('div');
      themesContainer.className = 'overview-themes';

      const themesLabel = document.createElement('h3');
      themesLabel.className = 'overview-section-label';
      themesLabel.textContent = 'Key Themes';
      themesContainer.appendChild(themesLabel);

      const themesList = document.createElement('div');
      themesList.className = 'themes-list';

      overview.keyThemes.forEach(theme => {
        const themeItem = document.createElement('div');
        themeItem.className = 'theme-item';

        const themeName = document.createElement('h4');
        themeName.className = 'theme-name';
        themeName.textContent = theme.theme;
        themeItem.appendChild(themeName);

        if (theme.description) {
          const themeDesc = document.createElement('p');
          themeDesc.className = 'theme-description';
          themeDesc.textContent = theme.description;
          themeItem.appendChild(themeDesc);
        }

        if (theme.affectedTopics && Array.isArray(theme.affectedTopics) && theme.affectedTopics.length > 0) {
          const topicsContainer = document.createElement('div');
          topicsContainer.className = 'theme-topics';

          theme.affectedTopics.forEach(topic => {
            const topicBadge = document.createElement('span');
            topicBadge.className = 'theme-topic-badge';
            topicBadge.textContent = topic;
            topicsContainer.appendChild(topicBadge);
          });

          themeItem.appendChild(topicsContainer);
        }

        themesList.appendChild(themeItem);
      });

      themesContainer.appendChild(themesList);
      container.appendChild(themesContainer);
    }

    // Critical Findings section
    if (overview.criticalFindings && Array.isArray(overview.criticalFindings) && overview.criticalFindings.length > 0) {
      const findingsContainer = document.createElement('div');
      findingsContainer.className = 'overview-findings';

      const findingsLabel = document.createElement('h3');
      findingsLabel.className = 'overview-section-label';
      findingsLabel.textContent = 'Critical Findings';
      findingsContainer.appendChild(findingsLabel);

      const findingsList = document.createElement('ul');
      findingsList.className = 'findings-list';

      overview.criticalFindings.forEach(finding => {
        const li = document.createElement('li');
        li.className = 'finding-item';
        li.textContent = finding;
        findingsList.appendChild(li);
      });

      findingsContainer.appendChild(findingsList);
      container.appendChild(findingsContainer);
    }

    // Strategic Context section
    if (overview.strategicContext) {
      const contextContainer = document.createElement('div');
      contextContainer.className = 'overview-context';

      const contextLabel = document.createElement('h3');
      contextLabel.className = 'overview-section-label';
      contextLabel.textContent = 'Strategic Context';
      contextContainer.appendChild(contextLabel);

      // Split into paragraphs
      const paragraphs = overview.strategicContext.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach(para => {
        const p = document.createElement('p');
        p.className = 'context-paragraph';
        p.textContent = para.trim();
        contextContainer.appendChild(p);
      });

      container.appendChild(contextContainer);
    }

    return container;
  }

  /**
   * Render recommendations section with prioritized actions
   */
  _renderRecommendations() {
    if (!this.documentData.recommendations || !Array.isArray(this.documentData.recommendations) || this.documentData.recommendations.length === 0) {
      return null;
    }

    const section = document.createElement('section');
    section.className = 'recommendations-section';

    const heading = document.createElement('h2');
    heading.className = 'section-heading';
    heading.textContent = 'Recommended Actions';
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'recommendations-list';

    // Sort by priority: critical > high > medium
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    const sortedRecs = [...this.documentData.recommendations].sort((a, b) => {
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });

    sortedRecs.forEach(rec => {
      const item = document.createElement('div');
      item.className = `recommendation-item priority-${rec.priority || 'medium'}`;

      const badge = document.createElement('span');
      badge.className = 'priority-badge';
      badge.textContent = (rec.priority || 'medium').toUpperCase();
      item.appendChild(badge);

      const action = document.createElement('h3');
      action.className = 'recommendation-action';
      action.textContent = rec.action;
      item.appendChild(action);

      const rationale = document.createElement('p');
      rationale.className = 'recommendation-rationale';
      rationale.textContent = rec.rationale;
      item.appendChild(rationale);

      if (rec.timeframe) {
        const timeframe = document.createElement('span');
        timeframe.className = 'recommendation-timeframe';
        timeframe.textContent = rec.timeframe;
        item.appendChild(timeframe);
      }

      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  /**
   * Render document header
   */
  _renderDocumentHeader() {
    const header = document.createElement('div');
    header.className = 'document-header';

    // Title
    const title = document.createElement('h1');
    title.className = 'document-title';
    title.textContent = this.documentData.title;
    header.appendChild(title);

    if (this.documentData.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'document-subtitle';
      subtitle.textContent = this.documentData.subtitle;
      header.appendChild(subtitle);
    }

    if (this.documentData.meta) {
      const meta = document.createElement('div');
      meta.className = 'document-meta';

      const metaItems = [];
      if (this.documentData.meta.author) metaItems.push(this.documentData.meta.author);
      if (this.documentData.meta.date) metaItems.push(this.documentData.meta.date);
      if (this.documentData.meta.version) metaItems.push(`v${this.documentData.meta.version}`);

      meta.innerHTML = metaItems.map(item =>
        `<span class="meta-item">${item}</span>`
      ).join('<span class="meta-divider">•</span>');

      header.appendChild(meta);
    }

    // Executive Summary (At a Glance) - handles new and legacy formats
    if (this.documentData.executiveSummary) {
      const summary = document.createElement('div');
      summary.className = 'executive-summary';

      // Header row with label and source badge
      const headerRow = document.createElement('div');
      headerRow.className = 'executive-summary-header';

      const label = document.createElement('span');
      label.className = 'executive-summary-label';
      label.textContent = 'At a Glance';
      headerRow.appendChild(label);

      summary.appendChild(headerRow);

      const execSummary = this.documentData.executiveSummary;

      // Handle NEW structured format (situation, insight, action)
      if (typeof execSummary === 'object' && execSummary !== null &&
          (execSummary.situation || execSummary.insight || execSummary.action)) {

        const glanceGrid = document.createElement('div');
        glanceGrid.className = 'glance-grid';

        if (execSummary.situation) {
          const situationBlock = document.createElement('div');
          situationBlock.className = 'glance-block glance-context';

          const situationLabel = document.createElement('span');
          situationLabel.className = 'glance-label';
          situationLabel.textContent = 'CONTEXT';
          situationBlock.appendChild(situationLabel);

          const situationText = document.createElement('p');
          situationText.className = 'glance-text';
          situationText.textContent = execSummary.situation;
          situationBlock.appendChild(situationText);

          glanceGrid.appendChild(situationBlock);
        }

        if (execSummary.insight) {
          const insightBlock = document.createElement('div');
          insightBlock.className = 'glance-block glance-insight';

          const insightLabel = document.createElement('span');
          insightLabel.className = 'glance-label';
          insightLabel.textContent = 'KEY INSIGHT';
          insightBlock.appendChild(insightLabel);

          const insightText = document.createElement('p');
          insightText.className = 'glance-text';
          insightText.textContent = execSummary.insight;
          insightBlock.appendChild(insightText);

          glanceGrid.appendChild(insightBlock);
        }

        if (execSummary.action) {
          const actionBlock = document.createElement('div');
          actionBlock.className = 'glance-block glance-action';

          const actionLabel = document.createElement('span');
          actionLabel.className = 'glance-label';
          actionLabel.textContent = 'RECOMMENDED ACTION';
          actionBlock.appendChild(actionLabel);

          const actionText = document.createElement('p');
          actionText.className = 'glance-text';
          actionText.textContent = execSummary.action;
          actionBlock.appendChild(actionText);

          glanceGrid.appendChild(actionBlock);
        }

        summary.appendChild(glanceGrid);
      }
      // Handle LEGACY structured format (stakes, keyFinding, recommendation)
      else if (typeof execSummary === 'object' && execSummary !== null &&
          (execSummary.stakes || execSummary.keyFinding || execSummary.recommendation)) {

        const glanceGrid = document.createElement('div');
        glanceGrid.className = 'glance-grid';

        if (execSummary.stakes) {
          const stakesBlock = document.createElement('div');
          stakesBlock.className = 'glance-block glance-context';

          const stakesLabel = document.createElement('span');
          stakesLabel.className = 'glance-label';
          stakesLabel.textContent = 'CONTEXT';
          stakesBlock.appendChild(stakesLabel);

          const stakesText = document.createElement('p');
          stakesText.className = 'glance-text';
          stakesText.textContent = execSummary.stakes;
          stakesBlock.appendChild(stakesText);

          glanceGrid.appendChild(stakesBlock);
        }

        if (execSummary.keyFinding) {
          const findingBlock = document.createElement('div');
          findingBlock.className = 'glance-block glance-insight';

          const findingLabel = document.createElement('span');
          findingLabel.className = 'glance-label';
          findingLabel.textContent = 'KEY INSIGHT';
          findingBlock.appendChild(findingLabel);

          const findingText = document.createElement('p');
          findingText.className = 'glance-text';
          findingText.textContent = execSummary.keyFinding;
          findingBlock.appendChild(findingText);

          glanceGrid.appendChild(findingBlock);
        }

        if (execSummary.recommendation) {
          const actionBlock = document.createElement('div');
          actionBlock.className = 'glance-block glance-action';

          const actionLabel = document.createElement('span');
          actionLabel.className = 'glance-label';
          actionLabel.textContent = 'RECOMMENDED ACTION';
          actionBlock.appendChild(actionLabel);

          const actionText = document.createElement('p');
          actionText.className = 'glance-text';
          actionText.textContent = execSummary.recommendation;
          actionBlock.appendChild(actionText);

          glanceGrid.appendChild(actionBlock);
        }

        summary.appendChild(glanceGrid);
      } else if (typeof execSummary === 'string') {
        // Legacy string format
        const text = document.createElement('p');
        text.className = 'executive-summary-text';
        text.textContent = execSummary;
        summary.appendChild(text);
      } else if (typeof execSummary === 'object' && execSummary !== null) {
        // Unknown object format - render all string properties
        const entries = Object.entries(execSummary).filter(([_, v]) => typeof v === 'string' && v);
        if (entries.length > 0) {
          entries.forEach(([key, value]) => {
            const el = document.createElement('p');
            el.className = 'executive-summary-text';
            el.textContent = value;
            summary.appendChild(el);
          });
        } else {
          // Last resort: show as formatted JSON
          const text = document.createElement('p');
          text.className = 'executive-summary-text';
          text.textContent = JSON.stringify(execSummary, null, 2);
          summary.appendChild(text);
        }
      }

      // Add source badge at END of executive summary (after content)
      if (typeof execSummary === 'object' && execSummary !== null && execSummary.source) {
        const sourceBadge = document.createElement('span');
        sourceBadge.className = 'executive-summary-source';
        sourceBadge.textContent = execSummary.source;
        sourceBadge.title = `Primary source: ${execSummary.source}`;
        summary.appendChild(sourceBadge);
      }

      header.appendChild(summary);
    }

    return header;
  }

  /**
   * Render a section
   */
  _renderSection(section) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'document-section';
    sectionEl.id = section.id;

    // Section title (swimlaneTopic) - matches TOC entry exactly
    if (section.swimlaneTopic) {
      const sectionTitle = document.createElement('h2');
      sectionTitle.className = 'section-title';
      sectionTitle.textContent = section.swimlaneTopic;
      sectionEl.appendChild(sectionTitle);
    }

    // Section heading (insight-driven subtitle)
    const headingLevel = section.swimlaneTopic ? 3 : Math.min(section.level + 1, 6);
    const heading = document.createElement(`h${headingLevel}`);
    heading.className = section.swimlaneTopic ? 'section-subtitle' :
                        (section.level === 1 ? 'section-heading' :
                        section.level === 2 ? 'section-subheading' : 'section-subheading');
    heading.textContent = section.heading;
    sectionEl.appendChild(heading);

    // TEXT CONTENT FIRST (paragraphs and content blocks)
    // Paragraphs array
    if (section.paragraphs && Array.isArray(section.paragraphs)) {
      section.paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.className = 'section-paragraph';
        p.textContent = text;
        sectionEl.appendChild(p);
      });
    }

    // Content blocks
    if (section.content && Array.isArray(section.content)) {
      section.content.forEach(block => {
        const blockEl = this._renderContentBlock(block);
        if (blockEl) {
          sectionEl.appendChild(blockEl);
        }
      });
    }

    // CARDS, BADGES, AND HIGHLIGHTS AT END
    // Key insight (if present)
    if (section.keyInsight) {
      const insight = document.createElement('p');
      insight.className = 'key-insight';
      insight.textContent = section.keyInsight;
      sectionEl.appendChild(insight);
    }

    // Research summary (if present) - new field for swimlane-aligned sections
    if (section.researchSummary) {
      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'research-summary';

      const summaryLabel = document.createElement('span');
      summaryLabel.className = 'research-summary-label';
      summaryLabel.textContent = 'Research Findings';
      summaryContainer.appendChild(summaryLabel);

      const summaryText = document.createElement('p');
      summaryText.className = 'research-summary-text';
      summaryText.textContent = section.researchSummary;
      summaryContainer.appendChild(summaryText);

      sectionEl.appendChild(summaryContainer);
    }

    // Strategic implications (if present) - new field for swimlane-aligned sections
    if (section.implications) {
      const implicationsContainer = document.createElement('div');
      implicationsContainer.className = 'strategic-implications';

      const implicationsLabel = document.createElement('span');
      implicationsLabel.className = 'implications-label';
      implicationsLabel.textContent = 'Strategic Implications';
      implicationsContainer.appendChild(implicationsLabel);

      const implicationsText = document.createElement('p');
      implicationsText.className = 'implications-text';
      implicationsText.textContent = section.implications;
      implicationsContainer.appendChild(implicationsText);

      sectionEl.appendChild(implicationsContainer);
    }

    // Supporting evidence (if present) - renders evidence citations from schema
    if (section.supportingEvidence && Array.isArray(section.supportingEvidence)) {
      section.supportingEvidence.forEach(evidence => {
        // Reuse existing _renderEvidence method, mapping 'quote' to 'text'
        const evidenceBlock = this._renderEvidence({
          claim: evidence.claim,
          text: evidence.quote,  // Schema uses 'quote', renderer expects 'text'
          source: evidence.source
        });
        sectionEl.appendChild(evidenceBlock);
      });
    }

    return sectionEl;
  }

  /**
   * Render a content block
   */
  _renderContentBlock(block) {
    switch (block.type) {
      case 'paragraph':
        return this._renderParagraph(block);
      case 'list':
        return this._renderList(block);
      case 'table':
        return this._renderTable(block);
      case 'quote':
        return this._renderQuote(block);
      case 'evidence':
        return this._renderEvidence(block);
      default:
        console.warn('Unknown block type:', block.type);
        return null;
    }
  }

  /**
   * Render paragraph block
   */
  _renderParagraph(block) {
    const p = document.createElement('p');
    p.className = 'section-paragraph';
    p.textContent = block.text;
    return p;
  }

  /**
   * Render list block
   */
  _renderList(block) {
    const list = block.ordered ? document.createElement('ol') : document.createElement('ul');
    list.className = 'section-list';

    if (block.items && Array.isArray(block.items)) {
      block.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
    }

    return list;
  }

  /**
   * Render table block
   */
  _renderTable(block) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'section-table';

    // Table header
    if (block.headers && Array.isArray(block.headers)) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');

      block.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        tr.appendChild(th);
      });

      thead.appendChild(tr);
      table.appendChild(thead);
    }

    // Table body
    if (block.rows && Array.isArray(block.rows)) {
      const tbody = document.createElement('tbody');

      block.rows.forEach(row => {
        const tr = document.createElement('tr');

        if (Array.isArray(row)) {
          row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
          });
        }

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
    }

    wrapper.appendChild(table);
    return wrapper;
  }

  /**
   * Render quote block
   */
  _renderQuote(block) {
    const quote = document.createElement('blockquote');
    quote.className = 'section-quote';
    quote.textContent = block.text;

    if (block.attribution) {
      const cite = document.createElement('cite');
      cite.textContent = `— ${block.attribution}`;
      quote.appendChild(cite);
    }

    return quote;
  }

  /**
   * Render evidence block - citation linking claim to source
   */
  _renderEvidence(block) {
    const evidence = document.createElement('div');
    evidence.className = 'evidence-block';

    if (block.claim) {
      const claim = document.createElement('p');
      claim.className = 'evidence-claim';
      claim.textContent = block.claim;
      evidence.appendChild(claim);
    }

    if (block.text) {
      const quote = document.createElement('blockquote');
      quote.className = 'evidence-quote';
      quote.textContent = block.text;
      evidence.appendChild(quote);
    }

    if (block.source) {
      const source = document.createElement('cite');
      source.className = 'evidence-source';
      source.textContent = `— ${block.source}`;
      evidence.appendChild(source);
    }

    return evidence;
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <h2>No Document Available</h2>
      <p>The document has not been generated yet for this session.</p>
    `;
    return emptyState;
  }

  /**
   * Scroll to a specific section
   */
  _scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    const scrollContainer = document.querySelector('.app-main') || window;
    
    if (section) {
      const headerOffset = 32; // Account for padding
      
      if (scrollContainer === window) {
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      } else {
        // Scroll within .app-main container
        const containerRect = scrollContainer.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        const offsetPosition = sectionRect.top - containerRect.top + scrollContainer.scrollTop - headerOffset;
        
        scrollContainer.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Setup scroll spy to highlight active section in TOC
   */
  _setupScrollSpy() {
    if (!this.documentData || !this.documentData.sections) return;

    const scrollContainer = document.querySelector('.app-main') || window;
    
    const sections = this.documentData.sections.map(s => ({
      id: s.id,
      element: document.getElementById(s.id)
    })).filter(s => s.element);

    this.scrollHandler = () => {
      const containerTop = scrollContainer === window 
        ? 0 
        : scrollContainer.getBoundingClientRect().top;
      const scrollOffset = 150; // Offset for header

      // Find the current section
      let currentSection = null;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const sectionTop = section.element.getBoundingClientRect().top - containerTop;
        if (sectionTop <= scrollOffset) {
          currentSection = section.id;
          break;
        }
      }

      // Update active state
      if (currentSection && currentSection !== this.activeSectionId) {
        this.activeSectionId = currentSection;
        this._updateActiveSection(currentSection);
      }
    };

    const eventTarget = scrollContainer === window ? window : scrollContainer;
    eventTarget.addEventListener('scroll', this.scrollHandler, { passive: true });
    
    // Store reference to remove listener later
    this.scrollContainer = eventTarget;

    // Initial check
    this.scrollHandler();
  }

  /**
   * Update active section in TOC
   */
  _updateActiveSection(sectionId) {
    // Remove active class from all links
    this.tocLinks.forEach(link => {
      link.classList.remove('active');
    });

    // Add active class to current link
    const activeLink = this.tocLinks.get(sectionId);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  /**
   * Export document to Word (.docx) file
   */
  async _exportToDocx() {
    if (!this.sessionId) {
      alert('Export requires a valid session. Please regenerate the document.');
      return;
    }

    try {
      const response = await fetch(`/api/content/${this.sessionId}/document/export`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Executive_Summary.docx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('DOCX export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  }

  /**
   * Create the glassmorphic three-dot menu for the document (upper right corner)
   * @returns {HTMLElement} The menu container
   */
  _createDocumentMenu() {
    const menuContainer = document.createElement('div');
    menuContainer.className = 'document-header-menu';

    // Three-dot trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'document-menu-trigger';
    triggerBtn.setAttribute('aria-label', 'Open document menu');
    triggerBtn.setAttribute('aria-haspopup', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.innerHTML = `
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
    `;

    // Dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'document-menu-dropdown';
    dropdown.setAttribute('role', 'menu');

    // Export to Word
    const exportWordItem = this._createDocMenuItem({
      id: 'export-word-btn',
      icon: '📄',
      text: 'Export to Word',
      ariaLabel: 'Export document as Word file'
    });
    exportWordItem.addEventListener('click', () => this._exportToDocx());
    dropdown.appendChild(exportWordItem);

    // Pre-Meeting Intelligence Brief
    const intelligenceBriefItem = this._createDocMenuItem({
      id: 'intelligence-brief-btn',
      icon: '🎯',
      text: 'Pre-Meeting Intelligence Brief',
      ariaLabel: 'Generate pre-meeting intelligence brief'
    });
    intelligenceBriefItem.addEventListener('click', () => this._showIntelligenceBriefModal());
    dropdown.appendChild(intelligenceBriefItem);

    menuContainer.appendChild(triggerBtn);
    menuContainer.appendChild(dropdown);

    // Setup menu toggle behavior
    this._setupDocMenuBehavior(triggerBtn, dropdown);

    return menuContainer;
  }

  /**
   * Create a menu item element for document menu
   */
  _createDocMenuItem({ id, icon, text, ariaLabel }) {
    const item = document.createElement('button');
    item.id = id;
    item.className = 'menu-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('aria-label', ariaLabel);
    item.innerHTML = `
      <span class="menu-item-icon">${icon}</span>
      <span class="menu-item-text">${text}</span>
    `;
    return item;
  }

  /**
   * Setup menu open/close behavior for document menu
   */
  _setupDocMenuBehavior(trigger, dropdown) {
    let isOpen = false;

    const openMenu = () => {
      isOpen = true;
      dropdown.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      isOpen = false;
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        closeMenu();
      }
    });

    // Close menu when a menu item is clicked
    dropdown.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.menu-item');
      if (menuItem) {
        closeMenu();
      }
    });
  }

  /**
   * Show the intelligence brief modal
   */
  _showIntelligenceBriefModal() {
    // Remove existing modal if present
    const existing = document.querySelector('.intelligence-brief-modal-overlay');
    if (existing) existing.remove();

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'intelligence-brief-modal-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'intelligence-brief-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h2>Pre-Meeting Intelligence Brief</h2>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-description">Generate a one-page brief synthesizing your research and analysis for this meeting.</p>

        <div class="form-group">
          <label for="meeting-attendees">Meeting Attendees *</label>
          <input type="text" id="meeting-attendees" placeholder="e.g., CEO, CFO, Head of Strategy" required />
        </div>

        <div class="form-group">
          <label for="meeting-objective">Meeting Objective *</label>
          <input type="text" id="meeting-objective" placeholder="e.g., Present digital transformation roadmap" required />
        </div>

        <div class="form-group">
          <label for="key-concerns">Key Concerns to Address (Optional)</label>
          <input type="text" id="key-concerns" placeholder="e.g., Budget constraints, timeline, competitive pressure" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-cancel">Cancel</button>
        <button class="modal-generate" id="generate-brief-btn">Generate Brief</button>
      </div>
      <div class="modal-loading hidden">
        <div class="loading-spinner"></div>
        <p>Synthesizing your research and analysis...</p>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus first input
    setTimeout(() => modal.querySelector('#meeting-attendees').focus(), 100);

    // Attach event handlers
    this._setupIntelligenceBriefModalHandlers(overlay, modal);
  }

  /**
   * Setup modal event handlers
   */
  _setupIntelligenceBriefModalHandlers(overlay, modal) {
    const closeModal = () => overlay.remove();

    // Close button
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Escape key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Generate button
    modal.querySelector('#generate-brief-btn').addEventListener('click', () => {
      this._handleGenerateIntelligenceBrief(modal, closeModal);
    });

    // Enter key in inputs triggers generate
    modal.querySelectorAll('input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._handleGenerateIntelligenceBrief(modal, closeModal);
        }
      });
    });
  }

  /**
   * Handle intelligence brief generation
   */
  async _handleGenerateIntelligenceBrief(modal, closeModal) {
    const meetingAttendees = modal.querySelector('#meeting-attendees').value.trim();
    const meetingObjective = modal.querySelector('#meeting-objective').value.trim();
    const keyConcerns = modal.querySelector('#key-concerns').value.trim();

    // Validate required fields
    if (!meetingAttendees) {
      modal.querySelector('#meeting-attendees').focus();
      modal.querySelector('#meeting-attendees').classList.add('input-error');
      setTimeout(() => modal.querySelector('#meeting-attendees').classList.remove('input-error'), 500);
      return;
    }
    if (!meetingObjective) {
      modal.querySelector('#meeting-objective').focus();
      modal.querySelector('#meeting-objective').classList.add('input-error');
      setTimeout(() => modal.querySelector('#meeting-objective').classList.remove('input-error'), 500);
      return;
    }

    // Show loading state
    const formBody = modal.querySelector('.modal-body');
    const footer = modal.querySelector('.modal-footer');
    const loading = modal.querySelector('.modal-loading');

    formBody.classList.add('hidden');
    footer.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
      const response = await fetch(`/api/content/${this.sessionId}/intelligence-brief/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingAttendees, meetingObjective, keyConcerns })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Generation failed');
      }

      // Get filename from header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Pre_Meeting_Brief.docx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Close modal on success
      closeModal();

    } catch (error) {
      console.error('Intelligence brief generation failed:', error);

      // Show error state
      loading.classList.add('hidden');
      formBody.classList.remove('hidden');
      footer.classList.remove('hidden');

      // Show error message
      let errorMsg = modal.querySelector('.error-message');
      if (!errorMsg) {
        errorMsg = document.createElement('p');
        errorMsg.className = 'error-message';
        formBody.insertBefore(errorMsg, formBody.firstChild);
      }
      errorMsg.textContent = `Error: ${error.message}`;
    }
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy() {
    if (this.scrollHandler && this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      this.scrollContainer = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.tocLinks.clear();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Load document data from API
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async loadData(sessionId) {
    try {
      const response = await fetch(`/api/content/${sessionId}/document`);

      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.documentData = result.data;
        this.sessionId = sessionId;
      } else if (result.status === 'processing') {
        throw new Error('Document is still being generated. Please wait...');
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Failed to generate document');
      }

    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }
}
