import { escapeHtml } from '../../utils/dom.js';
import { alignSpeakerNotes } from '../../shared/speaker-notes-align.js';

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

    const notes = this._getNotesForCurrentSlide();

    if (!notes) {
      const { bound, contentSlides } = this._alignment();
      contentEl.innerHTML = _placeholderHTML('warning',
        'No speaker notes for this slide.',
        bound < contentSlides
          ? `Notes were generated for ${bound} of ${contentSlides} content slides. Regenerate to cover the rest.`
          : 'Notes may not have been generated for this specific slide.'
      );
      return;
    }

    try {
      const reasoningHTML = this._renderReasoningSection();
      const slideNotesHTML = this._renderNotesHTML(notes);

      contentEl.innerHTML = reasoningHTML + slideNotesHTML;
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

  /**
   * Bind the whole notes payload to the deck once, then reuse it while both are unchanged.
   * Recomputed when either object identity changes \u2014 regenerating notes replaces the payload.
   */
  _alignment() {
    const notes = this.speakerNotes?.slides;
    const slides = this.slides;
    if (this._alignCache?.notes === notes && this._alignCache?.slides === slides) {
      return this._alignCache.result;
    }
    const result = alignSpeakerNotes(notes, slides);
    this._alignCache = { notes, slides, result };
    return result;
  }

  /** The notes for the slide on screen, or null when the deck outran the notes. */
  _getNotesForCurrentSlide() {
    const currentSlide = this.slides[this.index];
    if (!currentSlide || currentSlide.layout === 'sectionTitle') return null;
    return this._alignment().byIndex.get(this.index) ?? null;
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
