import { escapeHtml } from '../../utils/dom.js';

export class RiskRegisterView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
    this.sortField = 'riskScore';
    this.sortAsc = false;
    this.filterCategory = 'all';
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'risk-register-view';

    if (!this.data) {
      this.container.innerHTML = '<div class="empty-state"><h2>No Risk Register Available</h2><p>Generate content to see the risk register.</p></div>';
      return this.container;
    }

    this.container.appendChild(this._renderHeader());
    this.container.appendChild(this._renderSummary());
    this.container.appendChild(this._renderHeatMap());
    this.container.appendChild(this._renderCategoryBreakdown());
    this.container.appendChild(this._renderRiskTable());
    if (this.data.keyInsights?.length > 0) {
      this.container.appendChild(this._renderInsights());
    }

    return this.container;
  }

  _renderHeader() {
    const header = document.createElement('div');
    header.className = 'rr-header';
    const title = document.createElement('h1');
    title.className = 'rr-title';
    title.textContent = this.data.title || 'Risk Register';
    header.appendChild(title);

    if (this.data.riskAppetite) {
      const appetite = document.createElement('div');
      appetite.className = `risk-appetite appetite-${this.data.riskAppetite}`;
      appetite.innerHTML = `<span class="appetite-label">Risk Appetite:</span> <span class="appetite-value">${this.data.riskAppetite}</span>`;
      header.appendChild(appetite);
    }

    return header;
  }

  _renderSummary() {
    if (!this.data.summary) return document.createElement('div');
    const section = document.createElement('section');
    section.className = 'rr-section summary-section';
    const p = document.createElement('p');
    p.className = 'rr-summary';
    p.textContent = this.data.summary;
    section.appendChild(p);
    return section;
  }

  _renderHeatMap() {
    const section = document.createElement('section');
    section.className = 'rr-section heatmap-section';
    section.innerHTML = `<h2>Risk Heat Map</h2>`;

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    // Build 5x5 grid (impact on X, likelihood on Y — Y inverted so 5 is top)
    for (let likelihood = 5; likelihood >= 1; likelihood--) {
      for (let impact = 1; impact <= 5; impact++) {
        const cell = document.createElement('div');
        const score = likelihood * impact;
        let zone = 'low';
        if (score >= 15) zone = 'critical';
        else if (score >= 10) zone = 'high';
        else if (score >= 5) zone = 'medium';

        const risksInCell = (this.data.risks || []).filter(r => r.likelihood === likelihood && r.impact === impact);
        cell.className = `heatmap-cell zone-${zone} ${risksInCell.length > 0 ? 'has-risks' : ''}`;
        cell.title = `Likelihood: ${likelihood}, Impact: ${impact} (Score: ${score})`;

        if (risksInCell.length > 0) {
          cell.innerHTML = risksInCell.map(r => `<span class="risk-dot" title="${escapeHtml(r.id + ': ' + r.title)}">${escapeHtml(r.id)}</span>`).join('');
        }

        grid.appendChild(cell);
      }
    }

    // Axis labels
    const wrapper = document.createElement('div');
    wrapper.className = 'heatmap-wrapper';
    wrapper.innerHTML = `<div class="heatmap-y-label">Likelihood</div>`;
    wrapper.appendChild(grid);
    wrapper.innerHTML += `<div class="heatmap-x-label">Impact</div>`;
    section.appendChild(wrapper);

    return section;
  }

  _renderCategoryBreakdown() {
    if (!this.data.categoryBreakdown?.length) return document.createElement('div');

    const section = document.createElement('section');
    section.className = 'rr-section categories-section';
    section.innerHTML = `<h2>Risk Categories</h2>`;

    const grid = document.createElement('div');
    grid.className = 'category-grid';

    for (const cat of this.data.categoryBreakdown) {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <div class="cat-name">${escapeHtml(cat.category)}</div>
        <div class="cat-stats">
          <span class="cat-count">${cat.count} risks</span>
          <span class="cat-avg">Avg: ${(cat.avgScore || 0).toFixed(1)}</span>
        </div>
        <div class="cat-top">Top: ${escapeHtml(cat.topRisk)}</div>
      `;
      grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
  }

  _renderRiskTable() {
    const section = document.createElement('section');
    section.className = 'rr-section risks-section';
    section.innerHTML = `<h2>Risk Details</h2>`;

    const risks = [...(this.data.risks || [])].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

    const table = document.createElement('table');
    table.className = 'risk-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Risk</th>
          <th>Category</th>
          <th>L</th>
          <th>I</th>
          <th>Score</th>
          <th>Status</th>
          <th>Horizon</th>
          <th>Owner</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    for (const risk of risks) {
      let zone = 'low';
      if (risk.riskScore >= 15) zone = 'critical';
      else if (risk.riskScore >= 10) zone = 'high';
      else if (risk.riskScore >= 5) zone = 'medium';

      const row = document.createElement('tr');
      row.className = `risk-row zone-${zone}`;
      row.innerHTML = `
        <td class="risk-id">${escapeHtml(risk.id)}</td>
        <td class="risk-title-cell">
          <div class="risk-title">${escapeHtml(risk.title)}</div>
          <div class="risk-desc">${escapeHtml(risk.description)}</div>
          <div class="risk-evidence">${escapeHtml(risk.evidence)}</div>
          <div class="risk-mitigations">
            <strong>Mitigations:</strong>
            <ul>${(risk.mitigations || []).map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
          </div>
        </td>
        <td><span class="category-tag">${escapeHtml(risk.category)}</span></td>
        <td class="score-cell">${risk.likelihood}</td>
        <td class="score-cell">${risk.impact}</td>
        <td class="score-cell score-${zone}">${risk.riskScore}</td>
        <td><span class="status-badge status-${risk.status}">${risk.status}</span></td>
        <td>${escapeHtml(risk.timeHorizon)}</td>
        <td>${escapeHtml(risk.owner || 'TBD')}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.appendChild(table);
    section.appendChild(wrapper);
    return section;
  }

  _renderInsights() {
    const section = document.createElement('section');
    section.className = 'rr-section insights-section';
    section.innerHTML = `<h2>Key Risk Insights</h2>`;
    const list = document.createElement('ul');
    list.className = 'insights-list';
    for (const insight of this.data.keyInsights) {
      const li = document.createElement('li');
      li.textContent = insight;
      list.appendChild(li);
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
