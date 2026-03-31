import { escapeHtml } from '../../utils/dom.js';

export class CompetitiveAnalysisView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'competitive-analysis-view';

    if (!this.data) {
      this.container.innerHTML = '<div class="empty-state"><h2>No Competitive Analysis Available</h2><p>Generate content to see the competitive analysis.</p></div>';
      return this.container;
    }

    this.container.appendChild(this._renderHeader());
    this.container.appendChild(this._renderMarketOverview());
    this.container.appendChild(this._renderCompetitorCards());
    if (this.data.comparisonDimensions?.length > 0) {
      this.container.appendChild(this._renderComparisonTable());
    }
    if (this.data.competitiveAdvantages?.length > 0) {
      this.container.appendChild(this._renderAdvantages());
    }
    if (this.data.strategicRecommendations?.length > 0) {
      this.container.appendChild(this._renderRecommendations());
    }

    return this.container;
  }

  _renderHeader() {
    const header = document.createElement('div');
    header.className = 'ca-header';
    const title = document.createElement('h1');
    title.className = 'ca-title';
    title.textContent = this.data.title || 'Competitive Analysis';
    header.appendChild(title);
    return header;
  }

  _renderMarketOverview() {
    const section = document.createElement('section');
    section.className = 'ca-section market-overview';
    section.innerHTML = `<h2>Market Overview</h2>`;

    const overview = this.data.marketOverview;
    if (!overview) return section;

    const summary = document.createElement('p');
    summary.className = 'market-summary';
    summary.textContent = overview.summary;
    section.appendChild(summary);

    const stats = document.createElement('div');
    stats.className = 'market-stats';
    if (overview.marketSize) {
      stats.innerHTML += `<div class="market-stat"><span class="stat-label">Market Size</span><span class="stat-value">${escapeHtml(overview.marketSize)}</span></div>`;
    }
    if (overview.growthRate) {
      stats.innerHTML += `<div class="market-stat"><span class="stat-label">Growth Rate</span><span class="stat-value">${escapeHtml(overview.growthRate)}</span></div>`;
    }
    section.appendChild(stats);

    if (overview.keyTrends?.length > 0) {
      const trends = document.createElement('div');
      trends.className = 'key-trends';
      trends.innerHTML = `<h3>Key Trends</h3><ul>${overview.keyTrends.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
      section.appendChild(trends);
    }

    return section;
  }

  _renderCompetitorCards() {
    const section = document.createElement('section');
    section.className = 'ca-section competitors-section';
    section.innerHTML = `<h2>Competitor Profiles</h2>`;

    const grid = document.createElement('div');
    grid.className = 'competitor-grid';

    for (const comp of (this.data.competitors || [])) {
      const card = document.createElement('div');
      card.className = `competitor-card position-${comp.marketPosition} threat-${comp.threatLevel}`;
      card.innerHTML = `
        <div class="comp-header">
          <span class="comp-name">${escapeHtml(comp.name)}</span>
          <span class="position-badge">${comp.marketPosition}</span>
        </div>
        <p class="comp-description">${escapeHtml(comp.description)}</p>
        <div class="comp-differentiator"><strong>Differentiator:</strong> ${escapeHtml(comp.differentiator)}</div>
        <div class="comp-sw">
          <div class="comp-strengths">
            <h4>Strengths</h4>
            <ul>${comp.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </div>
          <div class="comp-weaknesses">
            <h4>Weaknesses</h4>
            <ul>${comp.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="threat-indicator threat-${comp.threatLevel}">Threat: ${comp.threatLevel}</div>
      `;
      grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
  }

  _renderComparisonTable() {
    const section = document.createElement('section');
    section.className = 'ca-section comparison-section';
    section.innerHTML = `<h2>Competitive Comparison</h2>`;

    const competitors = this.data.competitors || [];
    const dimensions = this.data.comparisonDimensions || [];

    const table = document.createElement('table');
    table.className = 'comparison-table';

    // Header row
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>Dimension</th>${competitors.map(c => `<th>${escapeHtml(c.name)}</th>`).join('')}</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const dim of dimensions) {
      const row = document.createElement('tr');
      row.innerHTML = `<td class="dim-name">${escapeHtml(dim.dimension)}</td>`;

      for (const comp of competitors) {
        const ranking = dim.rankings?.find(r => r.competitor === comp.name);
        const score = ranking?.score || 0;
        const note = ranking?.note || '';
        const cell = document.createElement('td');
        cell.className = 'score-cell';
        cell.innerHTML = `<div class="score-bar"><div class="score-fill" style="width: ${score * 20}%"></div><span class="score-num">${score}/5</span></div><div class="score-note">${escapeHtml(note)}</div>`;
        row.appendChild(cell);
      }

      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.appendChild(table);
    section.appendChild(wrapper);
    return section;
  }

  _renderAdvantages() {
    const section = document.createElement('section');
    section.className = 'ca-section advantages-section';
    section.innerHTML = `<h2>Competitive Advantages</h2>`;
    const list = document.createElement('ul');
    list.className = 'advantages-list';
    for (const adv of this.data.competitiveAdvantages) {
      const li = document.createElement('li');
      li.textContent = adv;
      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  _renderRecommendations() {
    const section = document.createElement('section');
    section.className = 'ca-section recommendations-section';
    section.innerHTML = `<h2>Strategic Recommendations</h2>`;
    const list = document.createElement('div');
    list.className = 'recommendations-list';

    for (const rec of this.data.strategicRecommendations) {
      const card = document.createElement('div');
      card.className = `recommendation-card priority-${rec.priority}`;
      card.innerHTML = `
        <div class="rec-header">
          <span class="rec-text">${escapeHtml(rec.recommendation)}</span>
          <span class="priority-badge priority-${rec.priority}">${rec.priority}</span>
        </div>
        <p class="rec-rationale">${escapeHtml(rec.rationale)}</p>
      `;
      list.appendChild(card);
    }

    section.appendChild(list);
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
