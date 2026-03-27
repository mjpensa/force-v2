import { createDropdownMenu, escapeHtml } from '../../utils/dom.js';

export class DocumentView {
  constructor(documentData = null, sessionId = null) {
    this.documentData = documentData;
    this.sessionId = sessionId;
    this.container = null;
    this.activeSectionId = null;
    this.scrollHandler = null;
    this.tocLinks = new Map(); // sectionId -> tocLink element
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'document-view';

    if (!this.documentData || !this.documentData.sections || this.documentData.sections.length === 0) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }
    if (this.sessionId) {
      const menu = this._createDocumentMenu();
      this.container.appendChild(menu);
    }
    this._normalizeSections();
    const documentContainer = document.createElement('div');
    documentContainer.className = 'document-container';
    const toc = this._renderTableOfContents();
    documentContainer.appendChild(toc);
    const content = this._renderContent();
    documentContainer.appendChild(content);

    this.container.appendChild(documentContainer);
    setTimeout(() => this._setupScrollSpy(), 100);

    return this.container;
  }

  _normalizeSections() {
    this.documentData.sections = this.documentData.sections.map((section, index) => {
      if (!section.id) {
        section.id = this._generateId(section.heading, index);
      }
      if (!section.level) {
        section.level = 1;
      }
      return section;
    });
  }

  _generateId(heading, index) {
    if (!heading) return `section-${index}`;
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) || `section-${index}`;
  }

  _renderTableOfContents() {
    const tocContainer = document.createElement('div');
    tocContainer.className = 'toc-sidebar document-toc';

    const tocTitle = document.createElement('h3');
    tocTitle.className = 'toc-title';
    tocTitle.textContent = 'Contents';
    tocContainer.appendChild(tocTitle);

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    if (this.documentData.analysisOverview) {
      tocList.appendChild(this._createTocEntry('analysis-overview', 'Overview'));
    }
    this.documentData.sections.forEach(section => {
      if (section.level !== 1) return;
      tocList.appendChild(this._createTocEntry(section.id, section.swimlaneTopic || section.heading));
    });
    tocList.appendChild(this._createTocEntry('document-closing', 'Closing'));

    tocContainer.appendChild(tocList);
    return tocContainer;
  }

  _createTocEntry(sectionId, text) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'toc-link';
    link.href = `#${sectionId}`;
    link.textContent = text;
    link.setAttribute('data-section-id', sectionId);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this._scrollToSection(sectionId);
    });
    this.tocLinks.set(sectionId, link);
    li.appendChild(link);
    return li;
  }

  _renderContent() {
    const contentContainer = document.createElement('div');
    contentContainer.className = 'document-content';
    const header = this._renderDocumentHeader();
    contentContainer.appendChild(header);
    const overview = this._renderAnalysisOverview();
    if (overview) {
      contentContainer.appendChild(overview);
    }
    this.documentData.sections.forEach(section => {
      const sectionEl = this._renderSection(section);
      contentContainer.appendChild(sectionEl);
    });
    const recommendations = this._renderRecommendations();
    if (recommendations) {
      contentContainer.appendChild(recommendations);
    }
    const closing = this._renderClosingSection();
    contentContainer.appendChild(closing);

    return contentContainer;
  }

  _renderClosingSection() {
    const container = document.createElement('div');
    container.className = 'document-closing';
    container.id = 'document-closing'; // ID for TOC navigation

    const header = document.createElement('h2');
    header.className = 'section-heading closing-heading';
    header.textContent = 'Closing';
    container.appendChild(header);
    const closingContent = document.createElement('div');
    closingContent.className = 'closing-content';
    const closingParagraph = document.createElement('p');
    closingParagraph.className = 'closing-paragraph';

    if (this.documentData.executiveSummary?.action) {
      closingParagraph.textContent = `The analysis presented above supports a clear path forward. The recommended action—${this.documentData.executiveSummary.action.replace(/\.$/, '')}—addresses the critical findings and positions the organization to capitalize on the opportunities identified across each strategic theme.`;
    } else {
      closingParagraph.textContent = 'The analysis presented above provides a comprehensive view of the strategic landscape. The detailed sections offer actionable insights for each key area, enabling informed decision-making and strategic prioritization.';
    }
    closingContent.appendChild(closingParagraph);
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
   * Build a labeled subsection: container div with h3 label, then call itemRenderer
   * to populate the body element.
   * @param {string} containerClass - CSS class for the wrapper div
   * @param {string} title - h3 label text
   * @param {function} itemRenderer - receives the container div and populates it after the h3
   * @returns {HTMLElement}
   */
  _buildOverviewBlock(containerClass, title, itemRenderer) {
    const block = document.createElement('div');
    block.className = containerClass;

    const label = document.createElement('h3');
    label.className = 'overview-section-label';
    label.textContent = title;
    block.appendChild(label);

    itemRenderer(block);
    return block;
  }

  _renderAnalysisOverview() {
    const overview = this.documentData.analysisOverview;
    if (!overview) return null;

    const container = document.createElement('div');
    container.className = 'analysis-overview';
    container.id = 'analysis-overview'; // ID for TOC navigation
    const header = document.createElement('div');
    header.className = 'analysis-overview-header';

    const label = document.createElement('span');
    label.className = 'analysis-overview-label';
    label.textContent = 'Strategic Analysis Overview';
    header.appendChild(label);

    container.appendChild(header);
    if (overview.narrative) {
      const narrativeContainer = document.createElement('div');
      narrativeContainer.className = 'overview-narrative';
      const paragraphs = overview.narrative.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach(para => {
        const p = document.createElement('p');
        p.className = 'narrative-paragraph';
        p.textContent = para.trim();
        narrativeContainer.appendChild(p);
      });

      container.appendChild(narrativeContainer);
    }
    if (overview.keyThemes && Array.isArray(overview.keyThemes) && overview.keyThemes.length > 0) {
      container.appendChild(this._buildOverviewBlock('overview-themes', 'Key Themes', (block) => {
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

        block.appendChild(themesList);
      }));
    }
    if (overview.criticalFindings && Array.isArray(overview.criticalFindings) && overview.criticalFindings.length > 0) {
      container.appendChild(this._buildOverviewBlock('overview-findings', 'Critical Findings', (block) => {
        const findingsList = document.createElement('ul');
        findingsList.className = 'findings-list';

        overview.criticalFindings.forEach(finding => {
          const li = document.createElement('li');
          li.className = 'finding-item';
          li.textContent = finding;
          findingsList.appendChild(li);
        });

        block.appendChild(findingsList);
      }));
    }
    if (overview.strategicContext) {
      container.appendChild(this._buildOverviewBlock('overview-context', 'Strategic Context', (block) => {
        const paragraphs = overview.strategicContext.split(/\n\n+/).filter(p => p.trim());
        paragraphs.forEach(para => {
          const p = document.createElement('p');
          p.className = 'context-paragraph';
          p.textContent = para.trim();
          block.appendChild(p);
        });
      }));
    }

    return container;
  }

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

  _renderDocumentHeader() {
    const header = document.createElement('div');
    header.className = 'document-header';
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
        `<span class="meta-item">${escapeHtml(item)}</span>`
      ).join('<span class="meta-divider">•</span>');

      header.appendChild(meta);
    }

    return header;
  }

  _renderSection(section) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'document-section';
    sectionEl.id = section.id;
    if (section.swimlaneTopic) {
      const sectionTitle = document.createElement('h2');
      sectionTitle.className = 'section-title';
      sectionTitle.textContent = section.swimlaneTopic;
      sectionEl.appendChild(sectionTitle);
    }
    const headingLevel = section.swimlaneTopic ? 3 : Math.min(section.level + 1, 6);
    const heading = document.createElement(`h${headingLevel}`);
    heading.className = section.swimlaneTopic ? 'section-subtitle' :
                        (section.level === 1 ? 'section-heading' : 'section-subheading');
    heading.textContent = section.heading;
    sectionEl.appendChild(heading);
    if (section.paragraphs && Array.isArray(section.paragraphs)) {
      section.paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.className = 'section-paragraph';
        p.textContent = text;
        sectionEl.appendChild(p);
      });
    }
    if (section.content && Array.isArray(section.content)) {
      section.content.forEach(block => {
        const blockEl = this._renderContentBlock(block);
        if (blockEl) {
          sectionEl.appendChild(blockEl);
        }
      });
    }
    if (section.keyInsight) {
      const insight = document.createElement('p');
      insight.className = 'key-insight';
      insight.textContent = section.keyInsight;
      sectionEl.appendChild(insight);
    }
    if (section.researchSummary) {
      sectionEl.appendChild(this._renderLabeledBlock(
        'research-summary', 'Research Findings', 'research-summary', section.researchSummary
      ));
    }
    if (section.implications) {
      sectionEl.appendChild(this._renderLabeledBlock(
        'strategic-implications', 'Strategic Implications', 'implications', section.implications
      ));
    }
    if (section.supportingEvidence && Array.isArray(section.supportingEvidence)) {
      section.supportingEvidence.forEach(evidence => {
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

  _renderParagraph(block) {
    const p = document.createElement('p');
    p.className = 'section-paragraph';
    p.textContent = block.text;
    return p;
  }

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

  _renderTable(block) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'section-table';
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

  _renderLabeledBlock(containerClass, labelText, prefix, text) {
    const container = document.createElement('div');
    container.className = containerClass;
    const label = document.createElement('span');
    label.className = `${prefix}-label`;
    label.textContent = labelText;
    container.appendChild(label);
    const p = document.createElement('p');
    p.className = `${prefix}-text`;
    p.textContent = text;
    container.appendChild(p);
    return container;
  }

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

  _setupScrollSpy() {
    if (!this.documentData || !this.documentData.sections) return;

    const scrollContainer = document.querySelector('.app-main') || window;
    
    const sections = [];
    const overviewEl = document.getElementById('analysis-overview');
    if (overviewEl) {
      sections.push({ id: 'analysis-overview', element: overviewEl });
    }
    this.documentData.sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) sections.push({ id: s.id, element: el });
    });
    const closingEl = document.getElementById('document-closing');
    if (closingEl) {
      sections.push({ id: 'document-closing', element: closingEl });
    }

    this.scrollHandler = () => {
      const containerTop = scrollContainer === window 
        ? 0 
        : scrollContainer.getBoundingClientRect().top;
      const scrollOffset = 150; // Offset for header
      let currentSection = null;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const sectionTop = section.element.getBoundingClientRect().top - containerTop;
        if (sectionTop <= scrollOffset) {
          currentSection = section.id;
          break;
        }
      }
      if (currentSection && currentSection !== this.activeSectionId) {
        this.activeSectionId = currentSection;
        this._updateActiveSection(currentSection);
      }
    };

    const eventTarget = scrollContainer === window ? window : scrollContainer;
    eventTarget.addEventListener('scroll', this.scrollHandler, { passive: true });
    
    // Store reference to remove listener later
    this.scrollContainer = eventTarget;
    this.scrollHandler();
  }

  _updateActiveSection(sectionId) {
    this.tocLinks.forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = this.tocLinks.get(sectionId);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

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
      await this._downloadResponseBlob(response, 'Executive_Summary.docx');
    } catch (error) {
      console.error('DOCX export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  }

  async _downloadResponseBlob(response, defaultFilename) {
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = defaultFilename;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  _createDocumentMenu() {
    const { container, destroy } = createDropdownMenu({
      containerClass: 'document-header-menu',
      triggerLabel: 'Open document menu',
      minWidth: 180,
      items: [
        { id: 'export-word-btn', icon: '📄', text: 'Export to Word', ariaLabel: 'Export document as Word file',
          onClick: () => this._exportToDocx() },
        { id: 'intelligence-brief-btn', icon: '🎯', text: 'Pre-Meeting Intelligence Brief', ariaLabel: 'Generate pre-meeting intelligence brief',
          onClick: () => this._showIntelligenceBriefModal() },
      ]
    });
    this._menuCleanup = destroy;
    return container;
  }

  _showIntelligenceBriefModal() {
    const existing = document.querySelector('.intelligence-brief-modal-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'intelligence-brief-modal-overlay';
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
          <label for="company-name">Company Name *</label>
          <input type="text" id="company-name" placeholder="e.g., Bank of America, Acme Corp" required />
        </div>

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
    setTimeout(() => modal.querySelector('#company-name').focus(), 100);
    this._setupIntelligenceBriefModalHandlers(overlay, modal);
  }

  _setupIntelligenceBriefModalHandlers(overlay, modal) {
    const closeModal = () => overlay.remove();
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    modal.querySelector('#generate-brief-btn').addEventListener('click', () => {
      this._handleGenerateIntelligenceBrief(modal, closeModal);
    });
    modal.querySelectorAll('input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._handleGenerateIntelligenceBrief(modal, closeModal);
        }
      });
    });
  }

  async _handleGenerateIntelligenceBrief(modal, closeModal) {
    const companyName = modal.querySelector('#company-name').value.trim();
    const meetingAttendees = modal.querySelector('#meeting-attendees').value.trim();
    const meetingObjective = modal.querySelector('#meeting-objective').value.trim();
    const keyConcerns = modal.querySelector('#key-concerns').value.trim();
    const requiredFields = ['company-name', 'meeting-attendees', 'meeting-objective'];
    for (const fieldId of requiredFields) {
      const field = modal.querySelector(`#${fieldId}`);
      if (!field.value.trim()) {
        field.focus();
        field.classList.add('input-error');
        setTimeout(() => field.classList.remove('input-error'), 500);
        return;
      }
    }
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
        body: JSON.stringify({ companyName, meetingAttendees, meetingObjective, keyConcerns })
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.details || error.message || error.error || 'Generation failed';
        throw new Error(errorMessage);
      }
      await this._downloadResponseBlob(response, 'Pre_Meeting_Brief.docx');
      closeModal();

    } catch (error) {
      console.error('Intelligence brief generation failed:', error);
      loading.classList.add('hidden');
      formBody.classList.remove('hidden');
      footer.classList.remove('hidden');
      let errorMsg = modal.querySelector('.error-message');
      if (!errorMsg) {
        errorMsg = document.createElement('p');
        errorMsg.className = 'error-message';
        formBody.insertBefore(errorMsg, formBody.firstChild);
      }
      errorMsg.textContent = `Error: ${error.message}`;
    }
  }

  destroy() {
    if (this._menuCleanup) this._menuCleanup();

    if (this.scrollHandler && this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      this.scrollContainer = null;
    }

    this.tocLinks.clear();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

}
