import { escapeHtml } from '../../utils/dom.js';

export class SwotAnalysisView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'swot-analysis-view';

    if (!this.data) {
      this.container.innerHTML = '<div class="empty-state"><h2>No SWOT Analysis Available</h2><p>Generate content to see the SWOT analysis.</p></div>';
      return this.container;
    }

    this.container.appendChild(this._renderHeader());
    this.container.appendChild(this._renderMatrix());

    if (this.data.strategicImplications?.length > 0) {
      this.container.appendChild(this._renderImplications());
    }
    if (this.data.priorityActions?.length > 0) {
      this.container.appendChild(this._renderActions());
    }

    return this.container;
  }

  _renderHeader() {
    const header = document.createElement('div');
    header.className = 'swot-header';
    const title = document.createElement('h1');
    title.className = 'swot-title';
    title.textContent = this.data.title || 'SWOT Analysis';
    header.appendChild(title);
    if (this.data.subject) {
      const subject = document.createElement('p');
      subject.className = 'swot-subject';
      subject.textContent = this.data.subject;
      header.appendChild(subject);
    }
    return header;
  }

  _renderMatrix() {
    const matrix = document.createElement('div');
    matrix.className = 'swot-matrix';

    const quadrants = [
      { key: 'strengths', label: 'Strengths', icon: 'S', className: 'quadrant-strengths' },
      { key: 'weaknesses', label: 'Weaknesses', icon: 'W', className: 'quadrant-weaknesses' },
      { key: 'opportunities', label: 'Opportunities', icon: 'O', className: 'quadrant-opportunities' },
      { key: 'threats', label: 'Threats', icon: 'T', className: 'quadrant-threats' }
    ];

    for (const q of quadrants) {
      const quadrant = document.createElement('div');
      quadrant.className = `swot-quadrant ${q.className}`;

      const header = document.createElement('div');
      header.className = 'quadrant-header';
      header.innerHTML = `<span class="quadrant-icon">${q.icon}</span><span class="quadrant-label">${q.label}</span>`;
      quadrant.appendChild(header);

      const items = this.data[q.key] || [];
      const list = document.createElement('div');
      list.className = 'quadrant-items';

      for (const item of items) {
        const el = document.createElement('div');
        el.className = `quadrant-item impact-${item.impact}`;
        el.innerHTML = `
          <div class="item-point">${escapeHtml(item.point)}</div>
          <div class="item-evidence">${escapeHtml(item.evidence)}</div>
          <div class="item-meta">
            <span class="impact-badge impact-${item.impact}">${item.impact}</span>
            ${item.timeframe ? `<span class="timeframe">${escapeHtml(item.timeframe)}</span>` : ''}
            ${item.likelihood ? `<span class="likelihood">Likelihood: ${item.likelihood}</span>` : ''}
          </div>
        `;
        list.appendChild(el);
      }

      quadrant.appendChild(list);
      matrix.appendChild(quadrant);
    }

    return matrix;
  }

  _renderImplications() {
    const section = document.createElement('section');
    section.className = 'swot-section implications-section';
    section.innerHTML = `<h2>Strategic Implications</h2>`;
    const list = document.createElement('ul');
    list.className = 'implications-list';
    for (const item of this.data.strategicImplications) {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  _renderActions() {
    const section = document.createElement('section');
    section.className = 'swot-section actions-section';
    section.innerHTML = `<h2>Priority Actions</h2>`;
    const grid = document.createElement('div');
    grid.className = 'actions-grid';

    const quadrantLabels = {
      'strength-opportunity': 'SO Strategy',
      'strength-threat': 'ST Strategy',
      'weakness-opportunity': 'WO Strategy',
      'weakness-threat': 'WT Strategy'
    };

    for (const action of this.data.priorityActions) {
      const card = document.createElement('div');
      card.className = `action-card quadrant-${action.quadrant}`;
      card.innerHTML = `
        <div class="action-type">${quadrantLabels[action.quadrant] || action.quadrant}</div>
        <div class="action-text">${escapeHtml(action.action)}</div>
        <div class="action-rationale">${escapeHtml(action.rationale)}</div>
      `;
      grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.data = null;
  }
}
