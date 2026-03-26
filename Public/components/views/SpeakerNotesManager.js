import { escapeHtml } from '../../utils/dom.js';

const MATCH_TYPES = {
  partial_section: { css: 'notes-match-partial', title: 'Matched via partial section name', label: 'Partial match' },
  tagline_only:    { css: 'notes-match-fallback', title: 'Matched by tagline only - verify correct slide', label: 'Fallback match' },
  index_disambiguated:    { css: 'notes-match-partial', title: 'Resolved duplicate taglines using slide index', label: 'Index matched' },
  position_disambiguated: { css: 'notes-match-fallback', title: 'Matched by position - low confidence', label: 'Position guess' },
  fuzzy_tagline:   { css: 'notes-match-partial', title: 'Matched via similar tagline text', label: 'Fuzzy match' },
  fuzzy_section:   { css: 'notes-match-partial', title: 'Matched via similar tagline and section', label: 'Fuzzy + section' },
  section_index_fallback: null // handled dynamically (needs matchInfo interpolation)
};

function _placeholderHTML(type, title, hint, extra = '') {
  return `
    <div class="notes-placeholder${type ? ' notes-' + type : ''}">
      <p>${title}</p>
      ${hint ? `<p class="notes-hint">${hint}</p>` : ''}
      ${extra}
    </div>
  `;
}

function _wrapSection(icon, title, bodyHTML, { collapsible = false } = {}) {
  if (collapsible) {
    return `
      <div class="notes-section notes-section-collapsed">
        <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">${icon} ${title}</h4>
        <div class="notes-section-body">
          ${bodyHTML}
        </div>
      </div>
    `;
  }
  return `
    <div class="notes-section">
      <h4 class="notes-section-title">${icon} ${title}</h4>
      ${bodyHTML}
    </div>
  `;
}

export class SpeakerNotesManager {
  constructor(view) {
    this.view = view;
  }

  get speakerNotes() { return this.view.speakerNotes; }
  set speakerNotes(v) { this.view.speakerNotes = v; }
  get speakerNotesVisible() { return this.view.speakerNotesVisible; }
  set speakerNotesVisible(v) { this.view.speakerNotesVisible = v; }
  get speakerNotesLoading() { return this.view.speakerNotesLoading; }
  set speakerNotesLoading(v) { this.view.speakerNotesLoading = v; }
  get speakerNotesPanel() { return this.view.speakerNotesPanel; }
  get sessionId() { return this.view.sessionId; }
  get slides() { return this.view.slides; }
  get index() { return this.view.index; }

  renderPanel() {
    const panel = document.createElement('div');
    panel.className = 'speaker-notes-panel speaker-notes-inline';
    panel.setAttribute('aria-label', 'Speaker notes');

    const header = document.createElement('button');
    header.className = 'speaker-notes-header speaker-notes-toggle';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', 'speaker-notes-content');
    header.addEventListener('click', () => this.toggle());

    const headerLeft = document.createElement('div');
    headerLeft.className = 'speaker-notes-header-left';

    const icon = document.createElement('span');
    icon.className = 'speaker-notes-icon';
    icon.textContent = '\ud83d\udcdd';

    const title = document.createElement('span');
    title.className = 'speaker-notes-title';
    title.textContent = 'Speaker Notes';

    const slideIndicator = document.createElement('span');
    slideIndicator.className = 'speaker-notes-slide-indicator';
    slideIndicator.id = 'speaker-notes-slide-indicator';
    slideIndicator.textContent = '';

    headerLeft.appendChild(icon);
    headerLeft.appendChild(title);
    headerLeft.appendChild(slideIndicator);

    const spinner = document.createElement('span');
    spinner.className = 'speaker-notes-spinner';
    spinner.id = 'speaker-notes-spinner';
    spinner.innerHTML = '';
    spinner.style.display = 'none';

    const chevron = document.createElement('span');
    chevron.className = 'speaker-notes-chevron';
    chevron.textContent = '\u25bc';

    header.appendChild(headerLeft);
    header.appendChild(spinner);
    header.appendChild(chevron);

    const content = document.createElement('div');
    content.className = 'speaker-notes-content';
    content.id = 'speaker-notes-content';

    panel.appendChild(header);
    panel.appendChild(content);

    return panel;
  }

  toggle() {
    this.speakerNotesVisible = !this.speakerNotesVisible;

    if (this.speakerNotesPanel) {
      this.speakerNotesPanel.classList.toggle('expanded', this.speakerNotesVisible);
      const toggleHeader = this.speakerNotesPanel.querySelector('.speaker-notes-toggle');
      if (toggleHeader) {
        toggleHeader.setAttribute('aria-expanded', this.speakerNotesVisible);
      }
    }
    const toggleBtn = document.getElementById('toggle-notes-btn');
    if (toggleBtn) {
      const textSpan = toggleBtn.querySelector('.menu-item-text');
      if (textSpan) {
        textSpan.textContent = this.speakerNotesVisible ? 'Hide Notes' : 'Show Notes';
      }
    }
    if (this.speakerNotesVisible) {
      if (!this.speakerNotes?.slides?.length && !this.speakerNotesLoading && this.sessionId) {
        this.generateOnDemand();
      } else {
        this.updateContent();
      }
    }
  }

  async generateOnDemand() {
    if (this.speakerNotesLoading || !this.sessionId) return;

    this.speakerNotesLoading = true;
    this._showLoading(true);

    // Clear any leaked interval from a prior rapid call
    if (this._elapsedInterval) clearInterval(this._elapsedInterval);

    const contentEl = document.getElementById('speaker-notes-content');
    const startTime = Date.now();

    const updateElapsedTime = () => {
      const elapsedEl = document.getElementById('notes-elapsed-time');
      if (elapsedEl) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        elapsedEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }
    };

    if (contentEl) {
      contentEl.innerHTML = _placeholderHTML('loading',
        'Generating speaker notes...',
        'This typically takes 2-3 minutes. You can continue navigating slides.',
        '<p class="notes-elapsed">Elapsed: <span id="notes-elapsed-time">0s</span></p><div class="notes-progress-bar"><div class="notes-progress-fill"></div></div>'
      );
      this._elapsedInterval = setInterval(updateElapsedTime, 1000);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20 * 60 * 1000);

    try {
      const response = await fetch(`/api/content/${this.sessionId}/slides/speaker-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (this._elapsedInterval) clearInterval(this._elapsedInterval);
      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.speakerNotes = result.data;
        if (this.speakerNotesVisible) {
          this.updateContent();
        }
      } else {
        console.error('[SpeakerNotes] Generation failed:', result.error);
        if (contentEl) {
          contentEl.innerHTML = _placeholderHTML('error',
            'Failed to generate speaker notes.',
            result.error || 'Unknown error occurred.',
            '<button class="notes-retry-btn" onclick="this.closest(\'.slides-view-container\').__view__._notesManager.generateOnDemand()">Retry</button>'
          );
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (this._elapsedInterval) clearInterval(this._elapsedInterval);
      console.error('[SpeakerNotes] Request failed:', error);

      const isTimeout = error.name === 'AbortError';
      const errorTitle = isTimeout ? 'Generation timed out.' : 'Network error while generating notes.';
      const errorHint = isTimeout
        ? 'The AI took too long to respond. Please try again.'
        : error.message;

      if (contentEl) {
        contentEl.innerHTML = _placeholderHTML('error',
          errorTitle,
          errorHint,
          '<button class="notes-retry-btn" onclick="this.closest(\'.slides-view-container\').__view__._notesManager.generateOnDemand()">Retry</button>'
        );
      }
    } finally {
      this.speakerNotesLoading = false;
      this._showLoading(false);
    }
  }

  _showLoading(show) {
    const spinner = document.getElementById('speaker-notes-spinner');
    if (spinner) {
      spinner.style.display = show ? 'inline-block' : 'none';
    }

    if (this.speakerNotesPanel) {
      this.speakerNotesPanel.classList.toggle('loading', show);
    }
  }

  updateContent() {
    const contentEl = document.getElementById('speaker-notes-content');
    if (!contentEl) return;

    this.updateSlideIndicator();

    const currentSlide = this.slides[this.index];
    if (currentSlide?.layout === 'sectionTitle') {
      contentEl.innerHTML = _placeholderHTML('',
        'Section title slides do not have speaker notes.',
        'Navigate to a content slide to view notes.'
      );
      return;
    }

    if (!this.speakerNotes?.slides || this.speakerNotes.slides.length === 0) {
      contentEl.innerHTML = _placeholderHTML('error',
        'Speaker notes not available.',
        'Notes may not have been generated for this presentation, or generation may have failed.',
        '<p class="notes-action">Try regenerating the slides to include speaker notes.</p>'
      );
      return;
    }

    const { notes, matchInfo } = this._getNotesForCurrentSlide();

    if (!notes) {
      let errorMessage = 'No speaker notes found for this slide.';
      let hintMessage = 'Notes may not have been generated for this specific slide.';

      if (matchInfo.reason === 'duplicate_taglines') {
        errorMessage = `Multiple slides share the tagline "${matchInfo.tagline}".`;
        hintMessage = `Found ${matchInfo.duplicateCount} slides with this tagline across different sections. Unable to determine which notes apply.`;
      } else if (matchInfo.reason === 'no_tagline_match') {
        errorMessage = `No notes match tagline "${matchInfo.tagline}".`;
        hintMessage = 'The slide tagline may have changed after notes were generated.';
      }

      contentEl.innerHTML = _placeholderHTML('warning',
        errorMessage,
        hintMessage,
        matchInfo.reason === 'duplicate_taglines' ? `
          <details class="notes-debug">
            <summary>Sections with this tagline</summary>
            <ul>${matchInfo.duplicateSections.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </details>
        ` : ''
      );
      return;
    }

    try {
      const reasoningHTML = this._renderReasoningSection();
      const slideNotesHTML = this._renderNotesHTML(notes);
      let matchIndicator = '';
      const matchDef = MATCH_TYPES[matchInfo.matchType];
      if (matchDef) {
        matchIndicator = `<div class="notes-match-indicator ${matchDef.css}" title="${matchDef.title}">${matchDef.label}</div>`;
      } else if (matchInfo.matchType === 'section_index_fallback') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by position in section - verify correct notes (expected: ${matchInfo.tagline}, got: ${matchInfo.matchedTagline})">Index fallback</div>`;
      }

      contentEl.innerHTML = matchIndicator + reasoningHTML + slideNotesHTML;
      this._attachCollapsibleToggleHandlers(contentEl);
    } catch (renderError) {
      console.error('[SpeakerNotes] Failed to render notes:', renderError);
      contentEl.innerHTML = _placeholderHTML('error',
        'Failed to render speaker notes.',
        `Error: ${renderError.message}`,
        '<p class="notes-action">Try refreshing the page or regenerating notes.</p>'
      );
    }
  }

  _attachCollapsibleToggleHandlers(container) {
    const toggles = container.querySelectorAll('.notes-section-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const section = e.target.closest('.notes-section');
        if (section) {
          section.classList.toggle('notes-section-collapsed');
          const isCollapsed = section.classList.contains('notes-section-collapsed');
          toggle.setAttribute('aria-expanded', !isCollapsed);
        }
      });
    });
  }

  _getNotesForCurrentSlide() {
    const noMatch = (reason, extra = {}) => ({
      notes: null,
      matchInfo: { matchType: 'none', reason, ...extra }
    });

    if (!this.speakerNotes?.slides) {
      return noMatch('no_data');
    }

    const currentSlide = this.slides[this.index];
    if (!currentSlide || currentSlide.layout === 'sectionTitle') {
      return noMatch('section_title');
    }

    const sectionName = currentSlide._sectionId?.replace(/-/g, ' ') || '';
    const slideTagline = (currentSlide.tagline || '').toLowerCase().trim();
    const slideIndex = currentSlide._slideId ? parseInt(currentSlide._slideId.split('-').pop(), 10) : -1;

    if (!slideTagline) {
      return noMatch('no_tagline');
    }

    // Strategy 1: Exact match on both section and tagline
    const exactMatch = this.speakerNotes.slides.find(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline &&
      note.sectionName?.toLowerCase().trim() === sectionName.toLowerCase().trim()
    );
    if (exactMatch) {
      return { notes: exactMatch, matchInfo: { matchType: 'exact', tagline: slideTagline } };
    }

    // Strategy 2: Section contains match + exact tagline
    const partialSectionMatch = this.speakerNotes.slides.find(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline &&
      (note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
       sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || ''))
    );
    if (partialSectionMatch) {
      return { notes: partialSectionMatch, matchInfo: { matchType: 'partial_section', tagline: slideTagline } };
    }

    // Strategy 3: Tagline-only matches
    const taglineOnlyMatches = this.speakerNotes.slides.filter(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline
    );

    if (taglineOnlyMatches.length === 1) {
      console.warn(`[SpeakerNotes] Using tagline-only match for "${slideTagline}" - section mismatch`);
      return { notes: taglineOnlyMatches[0], matchInfo: { matchType: 'tagline_only', tagline: slideTagline } };
    }

    if (taglineOnlyMatches.length > 1) {
      const indexMatch = taglineOnlyMatches.find(note => note.slideIndex === slideIndex);
      if (indexMatch) {
        console.warn(`[SpeakerNotes] Resolved duplicate tagline "${slideTagline}" using slideIndex ${slideIndex}`);
        return { notes: indexMatch, matchInfo: { matchType: 'index_disambiguated', tagline: slideTagline } };
      }

      const slidesInSection = this.slides.filter(s =>
        s._sectionId === currentSlide._sectionId &&
        (s.tagline || '').toLowerCase().trim() === slideTagline
      );
      const positionInSection = slidesInSection.findIndex(s => s === currentSlide);

      if (positionInSection >= 0 && positionInSection < taglineOnlyMatches.length) {
        const positionalMatch = taglineOnlyMatches[positionInSection];
        console.warn(`[SpeakerNotes] Resolved duplicate tagline "${slideTagline}" using position ${positionInSection}`);
        return {
          notes: positionalMatch,
          matchInfo: {
            matchType: 'position_disambiguated',
            tagline: slideTagline,
            confidence: 'low'
          }
        };
      }

      const duplicateSections = [...new Set(taglineOnlyMatches.map(n => n.sectionName || 'Unknown'))];
      console.warn(`[SpeakerNotes] Ambiguous match: ${taglineOnlyMatches.length} notes with tagline "${slideTagline}" in sections: ${duplicateSections.join(', ')}`);
      return noMatch('duplicate_taglines', {
        tagline: slideTagline,
        duplicateCount: taglineOnlyMatches.length,
        duplicateSections
      });
    }

    // Strategy 4: Partial/fuzzy tagline matching
    const fuzzyTaglineMatches = this.speakerNotes.slides.filter(note => {
      const noteTagline = (note.slideTagline || '').toLowerCase().trim();
      if (!noteTagline) return false;
      return slideTagline.includes(noteTagline) || noteTagline.includes(slideTagline);
    });

    if (fuzzyTaglineMatches.length === 1) {
      console.warn(`[SpeakerNotes] Using fuzzy tagline match for "${slideTagline}" \u2192 "${fuzzyTaglineMatches[0].slideTagline}"`);
      return { notes: fuzzyTaglineMatches[0], matchInfo: { matchType: 'fuzzy_tagline', tagline: slideTagline } };
    }

    if (fuzzyTaglineMatches.length > 1) {
      const fuzzyWithSection = fuzzyTaglineMatches.find(note =>
        note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
        sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || '')
      );
      if (fuzzyWithSection) {
        console.warn(`[SpeakerNotes] Resolved fuzzy tagline "${slideTagline}" using section match`);
        return { notes: fuzzyWithSection, matchInfo: { matchType: 'fuzzy_section', tagline: slideTagline } };
      }
    }

    // Strategy 5: Slide index within section as last resort
    let contentSlideIndex = 0;
    for (let i = 0; i < this.slides.length && i < this.index; i++) {
      const s = this.slides[i];
      if (s._sectionId === currentSlide._sectionId && s.layout !== 'sectionTitle') {
        contentSlideIndex++;
      }
    }
    const sectionNotes = this.speakerNotes.slides.filter(note =>
      note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
      sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || '')
    );

    if (sectionNotes.length > 0) {
      const sortedSectionNotes = [...sectionNotes].sort((a, b) => (a.slideIndex || 0) - (b.slideIndex || 0));
      if (contentSlideIndex < sortedSectionNotes.length) {
        const indexMatch = sortedSectionNotes[contentSlideIndex];
        console.warn(`[SpeakerNotes] Using section index fallback for "${slideTagline}" \u2192 matched to "${indexMatch.slideTagline}" at position ${contentSlideIndex}`);
        return {
          notes: indexMatch,
          matchInfo: {
            matchType: 'section_index_fallback',
            tagline: slideTagline,
            matchedTagline: indexMatch.slideTagline,
            confidence: 'low'
          }
        };
      }
    }

    return noMatch('no_tagline_match', { tagline: slideTagline });
  }

  _renderNotesHTML(notes) {
    if (!notes || typeof notes !== 'object') {
      console.warn('[SpeakerNotes] Invalid notes object received');
      return '<p class="notes-placeholder">No notes available.</p>';
    }

    const sections = [];

    if (notes.narrative?.talkingPoints?.length) {
      sections.push(_wrapSection('\ud83d\udcac', 'Talking Points', `
          <ul class="notes-list">
            ${notes.narrative.talkingPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
          </ul>
          ${notes.narrative.keyPhrase ? `
            <div class="key-phrase">
              <strong>Key Phrase:</strong> "${escapeHtml(notes.narrative.keyPhrase)}"
            </div>
          ` : ''}
      `));
    }

    if (notes.narrative?.transitionIn || notes.narrative?.transitionOut) {
      sections.push(_wrapSection('\ud83d\udd04', 'Transitions', `
          ${notes.narrative.transitionIn ? `<p><strong>\u2190 From previous:</strong> ${escapeHtml(notes.narrative.transitionIn)}</p>` : ''}
          ${notes.narrative.transitionOut ? `<p><strong>\u2192 To next:</strong> ${escapeHtml(notes.narrative.transitionOut)}</p>` : ''}
      `));
    }

    if (notes.stakeholderAngles) {
      const angles = notes.stakeholderAngles;
      const STAKEHOLDERS = [
        { key: 'cfo', icon: '\ud83d\udcb0', label: 'CFO' },
        { key: 'cto', icon: '\u2699\ufe0f', label: 'CTO' },
        { key: 'ceo', icon: '\ud83c\udfaf', label: 'CEO' },
        { key: 'operations', icon: '\ud83d\udd27', label: 'Ops' },
      ];
      const STAKEHOLDER_ROLES = { cfo: 'cfo', cto: 'cto', ceo: 'ceo', operations: 'ops' };
      sections.push(_wrapSection('\ud83d\udc65', 'Stakeholder Angles', `
          <div class="stakeholder-tabs">
            ${STAKEHOLDERS.filter(s => angles[s.key]).map(s => `
              <div class="stakeholder-tab" data-role="${STAKEHOLDER_ROLES[s.key]}">
                <span class="stakeholder-icon">${s.icon}</span>
                <span class="stakeholder-label">${s.label}</span>
                <p class="stakeholder-angle">${escapeHtml(angles[s.key])}</p>
              </div>
            `).join('')}
          </div>
      `));
    }

    if (notes.anticipatedQuestions?.length) {
      sections.push(_wrapSection('\u2753', 'Anticipated Questions', `
          ${notes.anticipatedQuestions.map(qa => `
            <div class="qa-item qa-severity-${qa.severity || 'probing'}">
              <div class="qa-header">
                <span class="severity-badge severity-${qa.severity || 'probing'}">${escapeHtml((qa.severity || 'probing').replace(/_/g, ' '))}</span>
                <span class="pushback-type">${escapeHtml(qa.pushbackType?.replace(/_/g, ' '))}</span>
              </div>
              <p class="question"><strong>Q:</strong> ${escapeHtml(qa.question)}</p>
              <p class="response"><strong>A:</strong> ${escapeHtml(qa.response)}</p>
              ${qa.escalationResponse ? `
                <div class="escalation-response">
                  <strong>If they push back:</strong> ${escapeHtml(qa.escalationResponse)}
                </div>
              ` : ''}
              ${qa.bridgeToStrength ? `
                <div class="bridge-to-strength">
                  <strong>Pivot to strength:</strong> ${escapeHtml(qa.bridgeToStrength)}
                </div>
              ` : ''}
              ${qa.deferralOption ? `
                <div class="deferral-option">
                  <strong>Defer with:</strong> "${escapeHtml(qa.deferralOption)}"
                </div>
              ` : ''}
            </div>
          `).join('')}
      `));
    }

    if (notes.storyContext) {
      sections.push(_wrapSection('\ud83d\udcd6', 'Story Context', `
          <p class="narrative-position"><strong>Position:</strong> ${escapeHtml(notes.storyContext.narrativePosition?.replace(/_/g, ' '))}</p>
          ${notes.storyContext.precededBy ? `<p><strong>Preceded by:</strong> ${escapeHtml(notes.storyContext.precededBy)}</p>` : ''}
          ${notes.storyContext.followedBy ? `<p><strong>Followed by:</strong> ${escapeHtml(notes.storyContext.followedBy)}</p>` : ''}
          ${notes.storyContext.soWhat ? `<p class="so-what"><strong>So What:</strong> ${escapeHtml(notes.storyContext.soWhat)}</p>` : ''}
          ${notes.storyContext.timeGuidance ? `
            <div class="time-guidance">
              <span class="time-badge">\u23f1\ufe0f ${notes.storyContext.timeGuidance.suggestedDuration || '2-3 min'}</span>
              ${notes.storyContext.timeGuidance.canCondense ? '<span class="condensable-badge">Can condense</span>' : ''}
              ${notes.storyContext.timeGuidance.condensedVersion ? `
                <p class="condensed-version"><strong>Short version:</strong> "${escapeHtml(notes.storyContext.timeGuidance.condensedVersion)}"</p>
              ` : ''}
              ${notes.storyContext.timeGuidance.mustInclude?.length ? `
                <p class="must-include"><strong>Must include:</strong> ${notes.storyContext.timeGuidance.mustInclude.map(s => escapeHtml(s)).join(' \u2022 ')}</p>
              ` : ''}
            </div>
          ` : ''}
          ${notes.storyContext.callToAction ? `
            <div class="cta-variants">
              <h5>Call-to-Action Options:</h5>
              ${[
                { key: 'warmAudience', css: 'cta-warm', icon: '\ud83d\udfe2', label: 'Warm', extraKey: 'timeline', extraCss: 'cta-timeline', extraWrap: v => v },
                { key: 'neutralAudience', css: 'cta-neutral', icon: '\ud83d\udfe1', label: 'Neutral', extraKey: 'nextStep', extraCss: 'cta-next-step', extraWrap: v => v },
                { key: 'hostileAudience', css: 'cta-hostile', icon: '\ud83d\udd34', label: 'Hostile', extraKey: 'fallback', extraCss: 'cta-fallback', extraWrap: v => `<em>Fallback: ${v}</em>` },
              ].filter(c => notes.storyContext.callToAction[c.key]).map(c => {
                const aud = notes.storyContext.callToAction[c.key];
                return `
                <div class="cta-option ${c.css}">
                  <span class="cta-label">${c.icon} ${c.label}</span>
                  <p>${escapeHtml(aud.ask)}</p>
                  ${aud[c.extraKey] ? `<p class="${c.extraCss}">${c.extraWrap(escapeHtml(aud[c.extraKey]))}</p>` : ''}
                </div>
              `;
              }).join('')}
            </div>
          ` : ''}
      `));
    }

    if (notes.sourceAttribution?.length) {
      sections.push(_wrapSection('\ud83d\udcda', 'Sources', `
          ${notes.sourceAttribution.map(src => `
            <div class="source-item">
              <p class="claim">"${escapeHtml(src.claim)}"</p>
              <p class="source"><strong>Source:</strong> ${escapeHtml(src.source)}</p>
              <span class="confidence confidence-${src.confidence}">${escapeHtml(src.confidence?.replace(/_/g, ' '))}</span>
            </div>
          `).join('')}
      `));
    }

    if (notes.generationTransparency) {
      sections.push(_wrapSection('\ud83d\udd0d', 'Content Derivation', `
            <p><strong>Sources:</strong> ${notes.generationTransparency.primarySources?.map(s => escapeHtml(s)).join(', ') || 'N/A'}</p>
            <p><strong>Method:</strong> ${notes.generationTransparency.derivationMethod || 'N/A'}</p>
            ${notes.generationTransparency.dataLineage ? `<p><strong>Lineage:</strong> ${escapeHtml(notes.generationTransparency.dataLineage)}</p>` : ''}
            ${notes.generationTransparency.assumptions?.length ? `
              <p><strong>Assumptions:</strong></p>
              <ul class="assumptions-list">
                ${notes.generationTransparency.assumptions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
              </ul>
            ` : ''}
      `, { collapsible: true }));
    }

    if (notes.credibilityAnchors?.length) {
      sections.push(_wrapSection('\ud83c\udfc6', 'Credibility Anchors', `
          ${notes.credibilityAnchors.map(anchor => `
            <div class="credibility-item credibility-${anchor.type || 'research'}">
              <span class="credibility-type">${escapeHtml((anchor.type || 'research').replace(/_/g, ' '))}</span>
              <p class="credibility-statement">${escapeHtml(anchor.statement)}</p>
              <p class="drop-phrase"><strong>Say:</strong> "${escapeHtml(anchor.dropPhrase)}"</p>
              <p class="full-citation"><em>${escapeHtml(anchor.fullCitation)}</em></p>
            </div>
          `).join('')}
      `));
    }

    if (notes.riskMitigation) {
      const rm = notes.riskMitigation;
      const RISKS = [
        { key: 'implementationRisk', label: 'Implementation Risk' },
        { key: 'reputationalRisk', label: 'Reputational Risk' },
        { key: 'careerRisk', label: 'Career Risk' },
      ];
      const riskBlocks = RISKS.filter(r => rm[r.key]).map(r => `
                <div class="risk-block">
                  <h5>${r.label}</h5>
                  <p class="risk-concern"><em>"${escapeHtml(rm[r.key].concern)}"</em></p>
                  <p class="risk-response">${escapeHtml(rm[r.key].response)}</p>
                  ${rm[r.key].proofPoint ? `<p class="risk-proof">Proof: ${escapeHtml(rm[r.key].proofPoint)}</p>` : ''}
                </div>
              `).join('');
      if (riskBlocks) {
        sections.push(_wrapSection('\ud83d\udee1\ufe0f', 'Risk Mitigation', riskBlocks, { collapsible: true }));
      }
    }

    if (notes.audienceSignals) {
      const signals = notes.audienceSignals;
      sections.push(_wrapSection('\ud83c\udf21\ufe0f', 'Room Temperature', `
            ${signals.losingThem ? `
              <div class="signal-block signal-losing">
                <h5>\u26a0\ufe0f Losing Them</h5>
                <p><strong>Watch for:</strong> ${signals.losingThem.signs?.map(s => escapeHtml(s)).join(', ') || 'N/A'}</p>
                <p><strong>Pivot:</strong> ${escapeHtml(signals.losingThem.pivotStrategy)}</p>
                ${signals.losingThem.emergencyBridge ? `<p class="emergency-bridge"><strong>Emergency exit:</strong> "${escapeHtml(signals.losingThem.emergencyBridge)}"</p>` : ''}
              </div>
            ` : ''}
            ${signals.winningThem ? `
              <div class="signal-block signal-winning">
                <h5>\u2705 Winning Them</h5>
                <p><strong>Look for:</strong> ${signals.winningThem.signs?.map(s => escapeHtml(s)).join(', ') || 'N/A'}</p>
                <p><strong>Accelerate:</strong> ${escapeHtml(signals.winningThem.accelerationOption)}</p>
              </div>
            ` : ''}
      `, { collapsible: true }));
    }

    if (notes.quickReference) {
      const qr = notes.quickReference;
      const quickRefSection = `
        <div class="notes-section quick-reference-section">
          <h4 class="notes-section-title">\u26a1 Quick Reference</h4>
          <div class="cheat-sheet">
            ${qr.keyNumber ? `<div class="cheat-item cheat-number"><span class="cheat-label">Key Number</span>${escapeHtml(qr.keyNumber)}</div>` : ''}
            ${qr.keyPhrase ? `<div class="cheat-item cheat-phrase"><span class="cheat-label">Key Phrase</span>"${escapeHtml(qr.keyPhrase)}"</div>` : ''}
            ${qr.keyProof ? `<div class="cheat-item cheat-proof"><span class="cheat-label">Proof Point</span>${escapeHtml(qr.keyProof)}</div>` : ''}
            ${qr.keyAsk ? `<div class="cheat-item cheat-ask"><span class="cheat-label">Ask For</span>${escapeHtml(qr.keyAsk)}</div>` : ''}
          </div>
        </div>
      `;
      sections.unshift(quickRefSection);
    }

    return sections.join('') || '<p class="notes-placeholder">No notes available.</p>';
  }

  _renderReasoningSection() {
    const reasoning = this.speakerNotes?.reasoning;
    if (!reasoning || typeof reasoning !== 'object') return '';

    const sections = [];

    if (reasoning.presentationNarrativeArc) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83c\udfaf Narrative Arc</h5>
          <p class="reasoning-value">${escapeHtml(reasoning.presentationNarrativeArc)}</p>
        </div>
      `);
    }

    if (reasoning.audienceProfile) {
      const profile = reasoning.audienceProfile;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83d\udc64 Audience Profile</h5>
          ${profile.primaryStakeholder ? `<p><strong>Decision Maker:</strong> ${escapeHtml(profile.primaryStakeholder)}</p>` : ''}
          ${profile.painPoints?.length ? `
            <p><strong>Pain Points:</strong></p>
            <ul class="reasoning-list">
              ${profile.painPoints.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          ` : ''}
          ${profile.decisionCriteria?.length ? `
            <p><strong>Decision Criteria:</strong></p>
            <ul class="reasoning-list">
              ${profile.decisionCriteria.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `);
    }

    if (reasoning.keyEvidenceChains?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83d\udcca Key Evidence Chains</h5>
          ${reasoning.keyEvidenceChains.map((chain, i) => `
            <div class="evidence-chain">
              <p class="chain-number">Chain ${i + 1}</p>
              <p><strong>Evidence:</strong> ${escapeHtml(chain.evidence)}</p>
              <p><strong>Insight:</strong> ${escapeHtml(chain.insight)}</p>
              ${chain.anticipatedQuestion ? `<p><strong>Q:</strong> ${escapeHtml(chain.anticipatedQuestion)}</p>` : ''}
              ${chain.preparedResponse ? `<p><strong>A:</strong> ${escapeHtml(chain.preparedResponse)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    if (reasoning.sourceInventory?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83d\udcda Source Inventory</h5>
          ${reasoning.sourceInventory.map(src => `
            <div class="source-inventory-item">
              <p class="source-name"><strong>${escapeHtml(src.sourceName)}</strong>
                <span class="confidence-badge confidence-${src.confidenceLevel}">${src.confidenceLevel}</span>
              </p>
              ${src.keyFindings?.length ? `
                <ul class="findings-list">
                  ${src.keyFindings.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    if (reasoning.anticipatedPushback?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\u26a1 Anticipated Pushback</h5>
          ${reasoning.anticipatedPushback.map(pb => `
            <div class="pushback-item">
              <span class="pushback-type-badge">${escapeHtml(pb.pushbackType?.replace(/_/g, ' '))}</span>
              <p class="objection"><strong>Objection:</strong> "${escapeHtml(pb.specificObjection)}"</p>
              <p><strong>Counter:</strong> ${escapeHtml(pb.evidenceToCounter)}</p>
              <p><strong>Reframe:</strong> ${escapeHtml(pb.reframingStrategy)}</p>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (reasoning.competitivePositioning) {
      const cp = reasoning.competitivePositioning;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\u2694\ufe0f Competitive Positioning</h5>
          ${cp.primaryCompetitors?.length ? `
            <div class="competitors-list">
              ${cp.primaryCompetitors.map(comp => `
                <div class="competitor-card">
                  <p class="competitor-name"><strong>${escapeHtml(comp.name)}</strong></p>
                  <p class="competitor-strength"><em>Their strength:</em> ${escapeHtml(comp.theirStrength)}</p>
                  <p class="our-counter"><em>Our counter:</em> ${escapeHtml(comp.ourCounter)}</p>
                  <p class="bridge-phrase">"${escapeHtml(comp.bridgePhrase)}"</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${cp.internalTeamResponse ? `
            <div class="internal-team-block">
              <strong>If they ask "why not in-house?":</strong>
              <p>${escapeHtml(cp.internalTeamResponse)}</p>
            </div>
          ` : ''}
          ${cp.doNothingRisk ? `
            <div class="do-nothing-risk">
              <strong>Cost of inaction:</strong>
              <p>${escapeHtml(cp.doNothingRisk)}</p>
            </div>
          ` : ''}
        </div>
      `);
    }

    if (reasoning.bridgePhrases) {
      const bp = reasoning.bridgePhrases;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83c\udf09 Bridge Phrases</h5>
          <div class="bridge-phrases-grid">
            ${[
              { key: 'dontKnowAnswer', label: "Don't Know Answer", css: '' },
              { key: 'hostileInterruption', label: 'Hostile Interruption', css: ' phrase-hostile' },
              { key: 'goingOffTopic', label: 'Going Off Topic', css: '' },
              { key: 'technicalDive', label: 'Technical Deep-Dive', css: '' },
              { key: 'losingTheRoom', label: 'Losing the Room', css: ' phrase-warning' },
            ].filter(c => bp[c.key]?.length).map(c => `
              <div class="phrase-category${c.css}">
                <h6>${c.label}</h6>
                <ul>${bp[c.key].map(p => `<li>"${escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }

    if (sections.length === 0) return '';

    return `
      <div class="notes-section notes-section-collapsed reasoning-section">
        <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">\ud83e\udde0 Presentation Reasoning (CoT)</h4>
        <div class="notes-section-body">
          <p class="reasoning-intro">Chain-of-thought analysis from two-pass generation:</p>
          ${sections.join('')}
        </div>
      </div>
    `;
  }

  updateSlideIndicator() {
    const slideIndicator = document.getElementById('speaker-notes-slide-indicator');
    if (!slideIndicator) return;

    const currentSlide = this.slides[this.index];
    if (currentSlide?.tagline) {
      slideIndicator.textContent = `\u2014 ${currentSlide.tagline}`;
    } else if (currentSlide?.layout === 'sectionTitle') {
      slideIndicator.textContent = `\u2014 ${currentSlide.sectionTitle || currentSlide.swimlane || 'Section'}`;
    } else {
      slideIndicator.textContent = `\u2014 Slide ${this.index + 1}`;
    }
  }
}
