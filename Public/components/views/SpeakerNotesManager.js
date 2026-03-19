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

    const contentEl = document.getElementById('speaker-notes-content');
    const startTime = Date.now();
    let elapsedInterval = null;

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
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-loading">
          <p>Generating speaker notes...</p>
          <p class="notes-hint">This typically takes 2-3 minutes. You can continue navigating slides.</p>
          <p class="notes-elapsed">Elapsed: <span id="notes-elapsed-time">0s</span></p>
          <div class="notes-progress-bar"><div class="notes-progress-fill"></div></div>
        </div>
      `;
      elapsedInterval = setInterval(updateElapsedTime, 1000);
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
      if (elapsedInterval) clearInterval(elapsedInterval);
      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.speakerNotes = result.data;
        console.log('[SpeakerNotes] On-demand generation complete:', result.data.slides?.length || 0, 'notes');
        if (this.speakerNotesVisible) {
          this.updateContent();
        }
      } else {
        console.error('[SpeakerNotes] Generation failed:', result.error);
        if (contentEl) {
          contentEl.innerHTML = `
            <div class="notes-placeholder notes-error">
              <p>Failed to generate speaker notes.</p>
              <p class="notes-hint">${result.error || 'Unknown error occurred.'}</p>
              <button class="notes-retry-btn" onclick="this.closest('.slides-view-container').__view__._notesManager.generateOnDemand()">Retry</button>
            </div>
          `;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (elapsedInterval) clearInterval(elapsedInterval);
      console.error('[SpeakerNotes] Request failed:', error);

      const isTimeout = error.name === 'AbortError';
      const errorTitle = isTimeout ? 'Generation timed out.' : 'Network error while generating notes.';
      const errorHint = isTimeout
        ? 'The AI took too long to respond. Please try again.'
        : error.message;

      if (contentEl) {
        contentEl.innerHTML = `
          <div class="notes-placeholder notes-error">
            <p>${errorTitle}</p>
            <p class="notes-hint">${errorHint}</p>
            <button class="notes-retry-btn" onclick="this.closest('.slides-view-container').__view__._notesManager.generateOnDemand()">Retry</button>
          </div>
        `;
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

    const currentSlide = this.slides[this.index];
    const slideIndicator = document.getElementById('speaker-notes-slide-indicator');
    if (slideIndicator) {
      if (currentSlide?.tagline) {
        slideIndicator.textContent = `\u2014 ${currentSlide.tagline}`;
      } else if (currentSlide?.layout === 'sectionTitle') {
        slideIndicator.textContent = `\u2014 ${currentSlide.sectionTitle || currentSlide.swimlane || 'Section'}`;
      } else {
        slideIndicator.textContent = `\u2014 Slide ${this.index + 1}`;
      }
    }

    if (currentSlide?.layout === 'sectionTitle') {
      contentEl.innerHTML = `
        <div class="notes-placeholder">
          <p>Section title slides do not have speaker notes.</p>
          <p class="notes-hint">Navigate to a content slide to view notes.</p>
        </div>
      `;
      return;
    }

    if (!this.speakerNotes?.slides || this.speakerNotes.slides.length === 0) {
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-error">
          <p>Speaker notes not available.</p>
          <p class="notes-hint">Notes may not have been generated for this presentation, or generation may have failed.</p>
          <p class="notes-action">Try regenerating the slides to include speaker notes.</p>
        </div>
      `;
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

      contentEl.innerHTML = `
        <div class="notes-placeholder notes-warning">
          <p>${errorMessage}</p>
          <p class="notes-hint">${hintMessage}</p>
          ${matchInfo.reason === 'duplicate_taglines' ? `
            <details class="notes-debug">
              <summary>Sections with this tagline</summary>
              <ul>${matchInfo.duplicateSections.map(s => `<li>${s}</li>`).join('')}</ul>
            </details>
          ` : ''}
        </div>
      `;
      return;
    }

    try {
      const reasoningHTML = this._renderReasoningSection();
      const slideNotesHTML = this._renderNotesHTML(notes);
      let matchIndicator = '';
      if (matchInfo.matchType === 'partial_section') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via partial section name">Partial match</div>`;
      } else if (matchInfo.matchType === 'tagline_only') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by tagline only - verify correct slide">Fallback match</div>`;
      } else if (matchInfo.matchType === 'index_disambiguated') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Resolved duplicate taglines using slide index">Index matched</div>`;
      } else if (matchInfo.matchType === 'position_disambiguated') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by position - low confidence">Position guess</div>`;
      } else if (matchInfo.matchType === 'fuzzy_tagline') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via similar tagline text">Fuzzy match</div>`;
      } else if (matchInfo.matchType === 'fuzzy_section') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via similar tagline and section">Fuzzy + section</div>`;
      } else if (matchInfo.matchType === 'section_index_fallback') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by position in section - verify correct notes (expected: ${matchInfo.tagline}, got: ${matchInfo.matchedTagline})">Index fallback</div>`;
      }

      contentEl.innerHTML = matchIndicator + reasoningHTML + slideNotesHTML;
      this._attachCollapsibleToggleHandlers(contentEl);
    } catch (renderError) {
      console.error('[SpeakerNotes] Failed to render notes:', renderError);
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-error">
          <p>Failed to render speaker notes.</p>
          <p class="notes-hint">Error: ${renderError.message}</p>
          <p class="notes-action">Try refreshing the page or regenerating notes.</p>
        </div>
      `;
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
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83d\udcac Talking Points</h4>
          <ul class="notes-list">
            ${notes.narrative.talkingPoints.map(point => `<li>${this._escapeHtml(point)}</li>`).join('')}
          </ul>
          ${notes.narrative.keyPhrase ? `
            <div class="key-phrase">
              <strong>Key Phrase:</strong> "${this._escapeHtml(notes.narrative.keyPhrase)}"
            </div>
          ` : ''}
        </div>
      `);
    }

    if (notes.narrative?.transitionIn || notes.narrative?.transitionOut) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83d\udd04 Transitions</h4>
          ${notes.narrative.transitionIn ? `<p><strong>\u2190 From previous:</strong> ${this._escapeHtml(notes.narrative.transitionIn)}</p>` : ''}
          ${notes.narrative.transitionOut ? `<p><strong>\u2192 To next:</strong> ${this._escapeHtml(notes.narrative.transitionOut)}</p>` : ''}
        </div>
      `);
    }

    if (notes.stakeholderAngles) {
      const angles = notes.stakeholderAngles;
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83d\udc65 Stakeholder Angles</h4>
          <div class="stakeholder-tabs">
            ${angles.cfo ? `
              <div class="stakeholder-tab" data-role="cfo">
                <span class="stakeholder-icon">\ud83d\udcb0</span>
                <span class="stakeholder-label">CFO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.cfo)}</p>
              </div>
            ` : ''}
            ${angles.cto ? `
              <div class="stakeholder-tab" data-role="cto">
                <span class="stakeholder-icon">\u2699\ufe0f</span>
                <span class="stakeholder-label">CTO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.cto)}</p>
              </div>
            ` : ''}
            ${angles.ceo ? `
              <div class="stakeholder-tab" data-role="ceo">
                <span class="stakeholder-icon">\ud83c\udfaf</span>
                <span class="stakeholder-label">CEO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.ceo)}</p>
              </div>
            ` : ''}
            ${angles.operations ? `
              <div class="stakeholder-tab" data-role="ops">
                <span class="stakeholder-icon">\ud83d\udd27</span>
                <span class="stakeholder-label">Ops</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.operations)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (notes.anticipatedQuestions?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\u2753 Anticipated Questions</h4>
          ${notes.anticipatedQuestions.map(qa => `
            <div class="qa-item qa-severity-${qa.severity || 'probing'}">
              <div class="qa-header">
                <span class="severity-badge severity-${qa.severity || 'probing'}">${(qa.severity || 'probing').replace(/_/g, ' ')}</span>
                <span class="pushback-type">${qa.pushbackType?.replace(/_/g, ' ')}</span>
              </div>
              <p class="question"><strong>Q:</strong> ${this._escapeHtml(qa.question)}</p>
              <p class="response"><strong>A:</strong> ${this._escapeHtml(qa.response)}</p>
              ${qa.escalationResponse ? `
                <div class="escalation-response">
                  <strong>If they push back:</strong> ${this._escapeHtml(qa.escalationResponse)}
                </div>
              ` : ''}
              ${qa.bridgeToStrength ? `
                <div class="bridge-to-strength">
                  <strong>Pivot to strength:</strong> ${this._escapeHtml(qa.bridgeToStrength)}
                </div>
              ` : ''}
              ${qa.deferralOption ? `
                <div class="deferral-option">
                  <strong>Defer with:</strong> "${this._escapeHtml(qa.deferralOption)}"
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    if (notes.storyContext) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83d\udcd6 Story Context</h4>
          <p class="narrative-position"><strong>Position:</strong> ${notes.storyContext.narrativePosition?.replace(/_/g, ' ')}</p>
          ${notes.storyContext.precededBy ? `<p><strong>Preceded by:</strong> ${this._escapeHtml(notes.storyContext.precededBy)}</p>` : ''}
          ${notes.storyContext.followedBy ? `<p><strong>Followed by:</strong> ${this._escapeHtml(notes.storyContext.followedBy)}</p>` : ''}
          ${notes.storyContext.soWhat ? `<p class="so-what"><strong>So What:</strong> ${this._escapeHtml(notes.storyContext.soWhat)}</p>` : ''}
          ${notes.storyContext.timeGuidance ? `
            <div class="time-guidance">
              <span class="time-badge">\u23f1\ufe0f ${notes.storyContext.timeGuidance.suggestedDuration || '2-3 min'}</span>
              ${notes.storyContext.timeGuidance.canCondense ? '<span class="condensable-badge">Can condense</span>' : ''}
              ${notes.storyContext.timeGuidance.condensedVersion ? `
                <p class="condensed-version"><strong>Short version:</strong> "${this._escapeHtml(notes.storyContext.timeGuidance.condensedVersion)}"</p>
              ` : ''}
              ${notes.storyContext.timeGuidance.mustInclude?.length ? `
                <p class="must-include"><strong>Must include:</strong> ${notes.storyContext.timeGuidance.mustInclude.join(' \u2022 ')}</p>
              ` : ''}
            </div>
          ` : ''}
          ${notes.storyContext.callToAction ? `
            <div class="cta-variants">
              <h5>Call-to-Action Options:</h5>
              ${notes.storyContext.callToAction.warmAudience ? `
                <div class="cta-option cta-warm">
                  <span class="cta-label">\ud83d\udfe2 Warm</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.warmAudience.ask)}</p>
                  ${notes.storyContext.callToAction.warmAudience.timeline ? `<p class="cta-timeline">${this._escapeHtml(notes.storyContext.callToAction.warmAudience.timeline)}</p>` : ''}
                </div>
              ` : ''}
              ${notes.storyContext.callToAction.neutralAudience ? `
                <div class="cta-option cta-neutral">
                  <span class="cta-label">\ud83d\udfe1 Neutral</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.neutralAudience.ask)}</p>
                  ${notes.storyContext.callToAction.neutralAudience.nextStep ? `<p class="cta-next-step">${this._escapeHtml(notes.storyContext.callToAction.neutralAudience.nextStep)}</p>` : ''}
                </div>
              ` : ''}
              ${notes.storyContext.callToAction.hostileAudience ? `
                <div class="cta-option cta-hostile">
                  <span class="cta-label">\ud83d\udd34 Hostile</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.hostileAudience.ask)}</p>
                  ${notes.storyContext.callToAction.hostileAudience.fallback ? `<p class="cta-fallback"><em>Fallback: ${this._escapeHtml(notes.storyContext.callToAction.hostileAudience.fallback)}</em></p>` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    if (notes.sourceAttribution?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83d\udcda Sources</h4>
          ${notes.sourceAttribution.map(src => `
            <div class="source-item">
              <p class="claim">"${this._escapeHtml(src.claim)}"</p>
              <p class="source"><strong>Source:</strong> ${this._escapeHtml(src.source)}</p>
              <span class="confidence confidence-${src.confidence}">${src.confidence?.replace(/_/g, ' ')}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (notes.generationTransparency) {
      sections.push(`
        <div class="notes-section notes-section-collapsed">
          <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">\ud83d\udd0d Content Derivation</h4>
          <div class="notes-section-body">
            <p><strong>Sources:</strong> ${notes.generationTransparency.primarySources?.join(', ') || 'N/A'}</p>
            <p><strong>Method:</strong> ${notes.generationTransparency.derivationMethod || 'N/A'}</p>
            ${notes.generationTransparency.dataLineage ? `<p><strong>Lineage:</strong> ${this._escapeHtml(notes.generationTransparency.dataLineage)}</p>` : ''}
            ${notes.generationTransparency.assumptions?.length ? `
              <p><strong>Assumptions:</strong></p>
              <ul class="assumptions-list">
                ${notes.generationTransparency.assumptions.map(a => `<li>${this._escapeHtml(a)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (notes.credibilityAnchors?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">\ud83c\udfc6 Credibility Anchors</h4>
          ${notes.credibilityAnchors.map(anchor => `
            <div class="credibility-item credibility-${anchor.type || 'research'}">
              <span class="credibility-type">${(anchor.type || 'research').replace(/_/g, ' ')}</span>
              <p class="credibility-statement">${this._escapeHtml(anchor.statement)}</p>
              <p class="drop-phrase"><strong>Say:</strong> "${this._escapeHtml(anchor.dropPhrase)}"</p>
              <p class="full-citation"><em>${this._escapeHtml(anchor.fullCitation)}</em></p>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (notes.riskMitigation) {
      const rm = notes.riskMitigation;
      const hasContent = rm.implementationRisk || rm.reputationalRisk || rm.careerRisk;
      if (hasContent) {
        sections.push(`
          <div class="notes-section notes-section-collapsed">
            <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">\ud83d\udee1\ufe0f Risk Mitigation</h4>
            <div class="notes-section-body">
              ${rm.implementationRisk ? `
                <div class="risk-block">
                  <h5>Implementation Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.implementationRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.implementationRisk.response)}</p>
                  ${rm.implementationRisk.proofPoint ? `<p class="risk-proof">Proof: ${this._escapeHtml(rm.implementationRisk.proofPoint)}</p>` : ''}
                </div>
              ` : ''}
              ${rm.reputationalRisk ? `
                <div class="risk-block">
                  <h5>Reputational Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.reputationalRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.reputationalRisk.response)}</p>
                </div>
              ` : ''}
              ${rm.careerRisk ? `
                <div class="risk-block">
                  <h5>Career Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.careerRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.careerRisk.response)}</p>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      }
    }

    if (notes.audienceSignals) {
      const signals = notes.audienceSignals;
      sections.push(`
        <div class="notes-section notes-section-collapsed">
          <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">\ud83c\udf21\ufe0f Room Temperature</h4>
          <div class="notes-section-body">
            ${signals.losingThem ? `
              <div class="signal-block signal-losing">
                <h5>\u26a0\ufe0f Losing Them</h5>
                <p><strong>Watch for:</strong> ${signals.losingThem.signs?.join(', ') || 'N/A'}</p>
                <p><strong>Pivot:</strong> ${this._escapeHtml(signals.losingThem.pivotStrategy)}</p>
                ${signals.losingThem.emergencyBridge ? `<p class="emergency-bridge"><strong>Emergency exit:</strong> "${this._escapeHtml(signals.losingThem.emergencyBridge)}"</p>` : ''}
              </div>
            ` : ''}
            ${signals.winningThem ? `
              <div class="signal-block signal-winning">
                <h5>\u2705 Winning Them</h5>
                <p><strong>Look for:</strong> ${signals.winningThem.signs?.join(', ') || 'N/A'}</p>
                <p><strong>Accelerate:</strong> ${this._escapeHtml(signals.winningThem.accelerationOption)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (notes.quickReference) {
      const qr = notes.quickReference;
      const quickRefSection = `
        <div class="notes-section quick-reference-section">
          <h4 class="notes-section-title">\u26a1 Quick Reference</h4>
          <div class="cheat-sheet">
            ${qr.keyNumber ? `<div class="cheat-item cheat-number"><span class="cheat-label">Key Number</span>${this._escapeHtml(qr.keyNumber)}</div>` : ''}
            ${qr.keyPhrase ? `<div class="cheat-item cheat-phrase"><span class="cheat-label">Key Phrase</span>"${this._escapeHtml(qr.keyPhrase)}"</div>` : ''}
            ${qr.keyProof ? `<div class="cheat-item cheat-proof"><span class="cheat-label">Proof Point</span>${this._escapeHtml(qr.keyProof)}</div>` : ''}
            ${qr.keyAsk ? `<div class="cheat-item cheat-ask"><span class="cheat-label">Ask For</span>${this._escapeHtml(qr.keyAsk)}</div>` : ''}
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
          <p class="reasoning-value">${this._escapeHtml(reasoning.presentationNarrativeArc)}</p>
        </div>
      `);
    }

    if (reasoning.audienceProfile) {
      const profile = reasoning.audienceProfile;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">\ud83d\udc64 Audience Profile</h5>
          ${profile.primaryStakeholder ? `<p><strong>Decision Maker:</strong> ${this._escapeHtml(profile.primaryStakeholder)}</p>` : ''}
          ${profile.painPoints?.length ? `
            <p><strong>Pain Points:</strong></p>
            <ul class="reasoning-list">
              ${profile.painPoints.map(p => `<li>${this._escapeHtml(p)}</li>`).join('')}
            </ul>
          ` : ''}
          ${profile.decisionCriteria?.length ? `
            <p><strong>Decision Criteria:</strong></p>
            <ul class="reasoning-list">
              ${profile.decisionCriteria.map(c => `<li>${this._escapeHtml(c)}</li>`).join('')}
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
              <p><strong>Evidence:</strong> ${this._escapeHtml(chain.evidence)}</p>
              <p><strong>Insight:</strong> ${this._escapeHtml(chain.insight)}</p>
              ${chain.anticipatedQuestion ? `<p><strong>Q:</strong> ${this._escapeHtml(chain.anticipatedQuestion)}</p>` : ''}
              ${chain.preparedResponse ? `<p><strong>A:</strong> ${this._escapeHtml(chain.preparedResponse)}</p>` : ''}
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
              <p class="source-name"><strong>${this._escapeHtml(src.sourceName)}</strong>
                <span class="confidence-badge confidence-${src.confidenceLevel}">${src.confidenceLevel}</span>
              </p>
              ${src.keyFindings?.length ? `
                <ul class="findings-list">
                  ${src.keyFindings.map(f => `<li>${this._escapeHtml(f)}</li>`).join('')}
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
              <span class="pushback-type-badge">${pb.pushbackType?.replace(/_/g, ' ')}</span>
              <p class="objection"><strong>Objection:</strong> "${this._escapeHtml(pb.specificObjection)}"</p>
              <p><strong>Counter:</strong> ${this._escapeHtml(pb.evidenceToCounter)}</p>
              <p><strong>Reframe:</strong> ${this._escapeHtml(pb.reframingStrategy)}</p>
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
                  <p class="competitor-name"><strong>${this._escapeHtml(comp.name)}</strong></p>
                  <p class="competitor-strength"><em>Their strength:</em> ${this._escapeHtml(comp.theirStrength)}</p>
                  <p class="our-counter"><em>Our counter:</em> ${this._escapeHtml(comp.ourCounter)}</p>
                  <p class="bridge-phrase">"${this._escapeHtml(comp.bridgePhrase)}"</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${cp.internalTeamResponse ? `
            <div class="internal-team-block">
              <strong>If they ask "why not in-house?":</strong>
              <p>${this._escapeHtml(cp.internalTeamResponse)}</p>
            </div>
          ` : ''}
          ${cp.doNothingRisk ? `
            <div class="do-nothing-risk">
              <strong>Cost of inaction:</strong>
              <p>${this._escapeHtml(cp.doNothingRisk)}</p>
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
            ${bp.dontKnowAnswer?.length ? `
              <div class="phrase-category">
                <h6>Don't Know Answer</h6>
                <ul>${bp.dontKnowAnswer.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.hostileInterruption?.length ? `
              <div class="phrase-category phrase-hostile">
                <h6>Hostile Interruption</h6>
                <ul>${bp.hostileInterruption.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.goingOffTopic?.length ? `
              <div class="phrase-category">
                <h6>Going Off Topic</h6>
                <ul>${bp.goingOffTopic.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.technicalDive?.length ? `
              <div class="phrase-category">
                <h6>Technical Deep-Dive</h6>
                <ul>${bp.technicalDive.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.losingTheRoom?.length ? `
              <div class="phrase-category phrase-warning">
                <h6>Losing the Room</h6>
                <ul>${bp.losingTheRoom.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
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

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
