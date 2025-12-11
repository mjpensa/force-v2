/**
 * DocumentView Component
 * Phase 4: Long-form document reading with Google Docs-inspired UI
 *
 * Features:
 * - Table of contents with scroll spy (highlights current section)
 * - Hierarchical section rendering (3 heading levels)
 * - Content blocks: paragraphs, lists, tables, quotes
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
   * Render table of contents
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

    // Build TOC from sections
    this.documentData.sections.forEach(section => {
      const li = document.createElement('li');

      const link = document.createElement('a');
      link.className = 'toc-link';
      link.href = `#${section.id}`;
      link.textContent = section.heading;
      link.setAttribute('data-section-id', section.id);

      link.addEventListener('click', (e) => {
        e.preventDefault();
        this._scrollToSection(section.id);
      });

      // Store reference for scroll spy
      this.tocLinks.set(section.id, link);

      li.appendChild(link);

      // Add subsections if level 2
      if (section.level === 1 && this.documentData.sections.some(s =>
        s.level === 2 && this._isSubsectionOf(s, section)
      )) {
        const sublist = document.createElement('ul');
        sublist.className = 'toc-sublist';

        this.documentData.sections
          .filter(s => s.level === 2 && this._isSubsectionOf(s, section))
          .forEach(subsection => {
            const subli = document.createElement('li');
            const sublink = document.createElement('a');
            sublink.className = 'toc-link';
            sublink.href = `#${subsection.id}`;
            sublink.textContent = subsection.heading;
            sublink.setAttribute('data-section-id', subsection.id);

            sublink.addEventListener('click', (e) => {
              e.preventDefault();
              this._scrollToSection(subsection.id);
            });

            this.tocLinks.set(subsection.id, sublink);
            subli.appendChild(sublink);
            sublist.appendChild(subli);
          });

        li.appendChild(sublist);
      }

      if (section.level === 1) {
        tocList.appendChild(li);
      }
    });

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

    // Sections
    this.documentData.sections.forEach(section => {
      const sectionEl = this._renderSection(section);
      contentContainer.appendChild(sectionEl);
    });

    return contentContainer;
  }

  /**
   * Render document header
   */
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
        `<span class="meta-item">${item}</span>`
      ).join('<span class="meta-divider">•</span>');

      header.appendChild(meta);
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

    // Section heading
    const headingLevel = Math.min(section.level + 1, 6); // h2-h4 (level 1-3 maps to h2-h4)
    const heading = document.createElement(`h${headingLevel}`);
    heading.className = section.level === 1 ? 'section-heading' :
                        section.level === 2 ? 'section-subheading' : 'section-subheading';
    heading.textContent = section.heading;
    sectionEl.appendChild(heading);

    // Content blocks
    if (section.content && Array.isArray(section.content)) {
      section.content.forEach(block => {
        const blockEl = this._renderContentBlock(block);
        if (blockEl) {
          sectionEl.appendChild(blockEl);
        }
      });
    }

    // Legacy support for paragraphs array
    if (section.paragraphs && Array.isArray(section.paragraphs)) {
      section.paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.className = 'section-paragraph';
        p.textContent = text;
        sectionEl.appendChild(p);
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
    if (section) {
      const headerOffset = 100; // Account for sticky header
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Setup scroll spy to highlight active section in TOC
   */
  _setupScrollSpy() {
    if (!this.documentData || !this.documentData.sections) return;

    const sections = this.documentData.sections.map(s => ({
      id: s.id,
      element: document.getElementById(s.id)
    })).filter(s => s.element);

    this.scrollHandler = () => {
      const scrollPosition = window.scrollY + 150; // Offset for header

      // Find the current section
      let currentSection = null;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.element.offsetTop <= scrollPosition) {
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

    window.addEventListener('scroll', this.scrollHandler, { passive: true });

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
   * Cleanup and remove event listeners
   */
  destroy() {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
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
