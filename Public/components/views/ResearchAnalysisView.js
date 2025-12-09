export class ResearchAnalysisView {
  constructor(analysisData = null, sessionId = null) {
    this.analysisData = analysisData;
    this.sessionId = sessionId;
    this.container = null;
    this.expandedThemes = new Set(); // Track expanded theme cards
  }
  render() {
    this.container = document.createElement('div');
    this.container.className = 'research-analysis-view';
    if (!this.analysisData) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }
    this.container.appendChild(this._renderHeader());
    const mainContent = document.createElement('div');
    mainContent.className = 'analysis-main-content';
    mainContent.appendChild(this._renderSummarySection());
    mainContent.appendChild(this._renderGanttReadiness());
    if (this.analysisData.criticalGaps && this.analysisData.criticalGaps.length > 0) {
      mainContent.appendChild(this._renderCriticalGaps());
    }
    mainContent.appendChild(this._renderThemesSection());
    mainContent.appendChild(this._renderDataCompleteness());
    if (this.analysisData.actionItems && this.analysisData.actionItems.length > 0) {
      mainContent.appendChild(this._renderActionItems());
    }
    if (this.analysisData.suggestedSources && this.analysisData.suggestedSources.length > 0) {
      mainContent.appendChild(this._renderSuggestedSources());
    }
    this.container.appendChild(mainContent);
    return this.container;
  }
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'analysis-empty-state';
    emptyState.innerHTML = `
      <div class="empty-state-icon">📊</div>
      <h2>No Analysis Available</h2>
      <p>Research quality analysis has not been generated yet.</p>
      <p>This analysis evaluates how well your research supports Gantt chart creation.</p>
    `;
    return emptyState;
  }
  _renderHeader() {
    const header = document.createElement('div');
    header.className = 'analysis-header';
    const titleSection = document.createElement('div');
    titleSection.className = 'analysis-title-section';
    const title = document.createElement('h1');
    title.className = 'analysis-title';
    title.textContent = this.analysisData.title || 'Research Quality Analysis';
    titleSection.appendChild(title);
    if (this.analysisData.generatedAt) {
      const timestamp = document.createElement('span');
      timestamp.className = 'analysis-timestamp';
      timestamp.textContent = `Generated: ${new Date(this.analysisData.generatedAt).toLocaleString()}`;
      titleSection.appendChild(timestamp);
    }
    header.appendChild(titleSection);
    const scoreSection = document.createElement('div');
    scoreSection.className = 'analysis-score-section';
    const scoreBadge = this._createScoreBadge(
      this.analysisData.overallScore,
      this.analysisData.overallRating,
      'large'
    );
    scoreSection.appendChild(scoreBadge);
    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'score-label';
    scoreLabel.textContent = 'Overall Research Fitness';
    scoreSection.appendChild(scoreLabel);
    header.appendChild(scoreSection);
    return header;
  }
  _renderSummarySection() {
    const section = document.createElement('section');
    section.className = 'analysis-section summary-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Executive Summary';
    section.appendChild(sectionTitle);
    if (this.analysisData.summary) {
      const summary = document.createElement('p');
      summary.className = 'summary-text';
      summary.textContent = this.analysisData.summary;
      section.appendChild(summary);
    }
    if (this.analysisData.keyFindings && this.analysisData.keyFindings.length > 0) {
      const findingsTitle = document.createElement('h3');
      findingsTitle.className = 'subsection-title';
      findingsTitle.textContent = 'Key Findings';
      section.appendChild(findingsTitle);
      const findingsList = document.createElement('ul');
      findingsList.className = 'key-findings-list';
      this.analysisData.keyFindings.forEach(finding => {
        const li = document.createElement('li');
        li.textContent = finding;
        findingsList.appendChild(li);
      });
      section.appendChild(findingsList);
    }
    return section;
  }
  _renderGanttReadiness() {
    const readiness = this.analysisData.ganttReadiness;
    if (!readiness) return document.createElement('div');
    const section = document.createElement('section');
    section.className = 'analysis-section gantt-readiness-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Gantt Chart Readiness';
    section.appendChild(sectionTitle);
    const verdictContainer = document.createElement('div');
    verdictContainer.className = `readiness-verdict verdict-${readiness.readinessVerdict}`;
    const verdictIcon = document.createElement('span');
    verdictIcon.className = 'verdict-icon';
    verdictIcon.textContent = this._getVerdictIcon(readiness.readinessVerdict);
    verdictContainer.appendChild(verdictIcon);
    const verdictText = document.createElement('span');
    verdictText.className = 'verdict-text';
    verdictText.textContent = this._getVerdictText(readiness.readinessVerdict);
    verdictContainer.appendChild(verdictText);
    section.appendChild(verdictContainer);
    const statsGrid = document.createElement('div');
    statsGrid.className = 'readiness-stats-grid';
    statsGrid.appendChild(this._createStatCard('Ready Themes', `${readiness.readyThemes}/${readiness.totalThemes}`, 'themes'));
    statsGrid.appendChild(this._createStatCard('Estimated Tasks', readiness.estimatedTasks, 'tasks'));
    statsGrid.appendChild(this._createStatCard('Recommended Interval', this._formatInterval(readiness.recommendedTimeInterval), 'interval'));
    section.appendChild(statsGrid);
    return section;
  }
  _renderCriticalGaps() {
    const section = document.createElement('section');
    section.className = 'analysis-section critical-gaps-section';
    const alert = document.createElement('div');
    alert.className = 'critical-gaps-alert';
    const alertHeader = document.createElement('div');
    alertHeader.className = 'alert-header';
    alertHeader.innerHTML = `
      <span class="alert-icon">⚠️</span>
      <span class="alert-title">Critical Gaps to Address</span>
    `;
    alert.appendChild(alertHeader);
    const gapsList = document.createElement('ul');
    gapsList.className = 'gaps-list';
    this.analysisData.criticalGaps.forEach(gap => {
      const li = document.createElement('li');
      li.textContent = gap;
      gapsList.appendChild(li);
    });
    alert.appendChild(gapsList);
    section.appendChild(alert);
    return section;
  }
  _renderThemesSection() {
    const section = document.createElement('section');
    section.className = 'analysis-section themes-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Theme Analysis';
    section.appendChild(sectionTitle);
    const themesContainer = document.createElement('div');
    themesContainer.className = 'themes-container';
    if (this.analysisData.themes && this.analysisData.themes.length > 0) {
      this.analysisData.themes.forEach((theme, index) => {
        themesContainer.appendChild(this._renderThemeCard(theme, index));
      });
    }
    section.appendChild(themesContainer);
    return section;
  }
  _renderThemeCard(theme, index) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.setAttribute('data-theme-index', index);
    const header = document.createElement('button');
    header.className = 'theme-card-header';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', `theme-content-${index}`);
    const headerLeft = document.createElement('div');
    headerLeft.className = 'theme-header-left';
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    expandIcon.textContent = '▶';
    headerLeft.appendChild(expandIcon);
    const themeName = document.createElement('span');
    themeName.className = 'theme-name';
    themeName.textContent = theme.name;
    headerLeft.appendChild(themeName);
    header.appendChild(headerLeft);
    const headerRight = document.createElement('div');
    headerRight.className = 'theme-header-right';
    const scoreBadge = this._createScoreBadge(theme.fitnessScore, theme.eventDataQuality, 'small');
    headerRight.appendChild(scoreBadge);
    const inclusionBadge = document.createElement('span');
    inclusionBadge.className = `inclusion-badge ${theme.includeableInGantt ? 'included' : 'excluded'}`;
    inclusionBadge.textContent = theme.includeableInGantt ? '✓ In Gantt' : '✗ Not in Gantt';
    headerRight.appendChild(inclusionBadge);
    header.appendChild(headerRight);
    card.appendChild(header);
    const content = document.createElement('div');
    content.className = 'theme-card-content collapsed';
    content.id = `theme-content-${index}`;
    if (theme.description) {
      const desc = document.createElement('p');
      desc.className = 'theme-description';
      desc.textContent = theme.description;
      content.appendChild(desc);
    }
    const statsRow = document.createElement('div');
    statsRow.className = 'theme-stats-row';
    statsRow.innerHTML = `
      <span class="stat"><strong>${theme.datesCounted || 0}</strong> dates found</span>
      <span class="stat"><strong>${theme.tasksPotential || 0}</strong> potential tasks</span>
      <span class="stat">Quality: <strong>${this._formatQuality(theme.eventDataQuality)}</strong></span>
    `;
    content.appendChild(statsRow);
    if (theme.strengths && theme.strengths.length > 0) {
      content.appendChild(this._createListSection('Strengths', theme.strengths, 'strengths'));
    }
    if (theme.gaps && theme.gaps.length > 0) {
      content.appendChild(this._createListSection('Gaps', theme.gaps, 'gaps'));
    }
    if (theme.recommendations && theme.recommendations.length > 0) {
      content.appendChild(this._createListSection('Recommendations', theme.recommendations, 'recommendations'));
    }
    if (theme.sampleEvents && theme.sampleEvents.length > 0) {
      content.appendChild(this._renderSampleEventsTable(theme.sampleEvents));
    }
    card.appendChild(content);
    header.addEventListener('click', () => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('collapsed');
      expandIcon.textContent = isExpanded ? '▶' : '▼';
      if (!isExpanded) {
        this.expandedThemes.add(index);
      } else {
        this.expandedThemes.delete(index);
      }
    });
    return card;
  }
  _renderSampleEventsTable(events) {
    const container = document.createElement('div');
    container.className = 'sample-events-container';
    const title = document.createElement('h4');
    title.className = 'events-title';
    title.textContent = 'Sample Events Found';
    container.appendChild(title);
    const table = document.createElement('table');
    table.className = 'sample-events-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Event</th>
        <th>Date Info</th>
        <th>Quality</th>
      </tr>
    `;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    events.slice(0, 5).forEach(event => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this._escapeHtml(event.event)}</td>
        <td>${this._escapeHtml(event.dateInfo)}</td>
        <td><span class="quality-badge quality-${event.quality}">${this._formatQuality(event.quality)}</span></td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    return container;
  }
  _renderDataCompleteness() {
    const data = this.analysisData.dataCompleteness;
    if (!data) return document.createElement('div');
    const section = document.createElement('section');
    section.className = 'analysis-section data-completeness-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Data Completeness';
    section.appendChild(sectionTitle);
    const metricsGrid = document.createElement('div');
    metricsGrid.className = 'completeness-metrics-grid';
    metricsGrid.appendChild(this._createMetricCard('Total Dates Found', data.totalDatesFound));
    metricsGrid.appendChild(this._createMetricCard('Events Identified', data.totalEventsIdentified));
    metricsGrid.appendChild(this._createMetricCard('Events with Dates', data.eventsWithDates));
    metricsGrid.appendChild(this._createMetricCard('Events without Dates', data.eventsWithoutDates));
    section.appendChild(metricsGrid);
    if (data.dateSpecificityBreakdown) {
      section.appendChild(this._renderDateSpecificityChart(data.dateSpecificityBreakdown));
    }
    if (data.timelineSpan) {
      const timelineInfo = document.createElement('div');
      timelineInfo.className = 'timeline-span-info';
      timelineInfo.innerHTML = `
        <span class="timeline-label">Timeline Span:</span>
        <span class="timeline-value">${this._escapeHtml(data.timelineSpan.spanDescription)}</span>
        <span class="timeline-range">(${this._escapeHtml(data.timelineSpan.earliestDate)} - ${this._escapeHtml(data.timelineSpan.latestDate)})</span>
      `;
      section.appendChild(timelineInfo);
    }
    return section;
  }
  _renderDateSpecificityChart(breakdown) {
    const container = document.createElement('div');
    container.className = 'date-specificity-chart';
    const title = document.createElement('h3');
    title.className = 'chart-title';
    title.textContent = 'Date Specificity Breakdown';
    container.appendChild(title);
    const chartBars = document.createElement('div');
    chartBars.className = 'chart-bars';
    const categories = [
      { key: 'specific', label: 'Specific', color: '#22c55e' },
      { key: 'quarterly', label: 'Quarterly', color: '#84cc16' },
      { key: 'monthly', label: 'Monthly', color: '#eab308' },
      { key: 'yearly', label: 'Yearly', color: '#f97316' },
      { key: 'relative', label: 'Relative', color: '#ef4444' },
      { key: 'vague', label: 'Vague', color: '#dc2626' }
    ];
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
    categories.forEach(cat => {
      const value = breakdown[cat.key] || 0;
      const percent = Math.round((value / total) * 100);
      const barContainer = document.createElement('div');
      barContainer.className = 'bar-container';
      barContainer.innerHTML = `
        <div class="bar-label">${cat.label}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${percent}%; background-color: ${cat.color};"></div>
        </div>
        <div class="bar-value">${value} (${percent}%)</div>
      `;
      chartBars.appendChild(barContainer);
    });
    container.appendChild(chartBars);
    return container;
  }
  _renderActionItems() {
    const section = document.createElement('section');
    section.className = 'analysis-section action-items-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Recommended Actions';
    section.appendChild(sectionTitle);
    const itemsList = document.createElement('div');
    itemsList.className = 'action-items-list';
    this.analysisData.actionItems.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = `action-item impact-${item.impact || 'medium'}`;
      itemEl.innerHTML = `
        <div class="action-content">
          <span class="action-text">${this._escapeHtml(item.action)}</span>
        </div>
        <div class="action-badges">
          <span class="impact-badge impact-${item.impact}">${item.impact} impact</span>
          <span class="effort-badge effort-${item.effort}">${item.effort} effort</span>
        </div>
      `;
      itemsList.appendChild(itemEl);
    });
    section.appendChild(itemsList);
    return section;
  }
  _renderSuggestedSources() {
    const section = document.createElement('section');
    section.className = 'analysis-section suggested-sources-section';
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = 'Suggested Additional Sources';
    section.appendChild(sectionTitle);
    const sourcesList = document.createElement('div');
    sourcesList.className = 'sources-list';
    this.analysisData.suggestedSources.forEach(source => {
      const sourceEl = document.createElement('div');
      sourceEl.className = 'source-item';
      sourceEl.innerHTML = `
        <div class="source-header">
          <span class="source-type">${this._escapeHtml(source.sourceType)}</span>
          <span class="priority-badge priority-${source.priority}">${source.priority}</span>
        </div>
        <div class="source-reason">${this._escapeHtml(source.reason)}</div>
        <div class="source-improvement">
          <strong>Expected improvement:</strong> ${this._escapeHtml(source.expectedImprovement)}
        </div>
      `;
      sourcesList.appendChild(sourceEl);
    });
    section.appendChild(sourcesList);
    return section;
  }
  _createScoreBadge(score, rating, size = 'medium') {
    const badge = document.createElement('div');
    badge.className = `score-badge score-${this._getRatingClass(rating || this._scoreToRating(score))} size-${size}`;
    badge.innerHTML = `
      <span class="score-value">${score}</span>
      <span class="score-max">/10</span>
    `;
    return badge;
  }
  _createStatCard(label, value, type) {
    const card = document.createElement('div');
    card.className = `stat-card stat-${type}`;
    card.innerHTML = `
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    `;
    return card;
  }
  _createMetricCard(label, value) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-value">${value}</div>
      <div class="metric-label">${label}</div>
    `;
    return card;
  }
  _createListSection(title, items, type) {
    const container = document.createElement('div');
    container.className = `list-section list-${type}`;
    const titleEl = document.createElement('h4');
    titleEl.className = 'list-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);
    const list = document.createElement('ul');
    list.className = 'list-items';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);
    return container;
  }
  _getVerdictIcon(verdict) {
    switch (verdict) {
      case 'ready': return '✅';
      case 'needs-improvement': return '⚠️';
      case 'insufficient': return '❌';
      default: return '❓';
    }
  }
  _getVerdictText(verdict) {
    switch (verdict) {
      case 'ready': return 'Ready for Gantt Chart Creation';
      case 'needs-improvement': return 'Needs Improvement Before Gantt Creation';
      case 'insufficient': return 'Insufficient Data for Gantt Chart';
      default: return 'Unknown';
    }
  }
  _formatInterval(interval) {
    const formats = {
      weeks: 'Weeks',
      months: 'Months',
      quarters: 'Quarters',
      years: 'Years'
    };
    return formats[interval] || interval;
  }
  _formatQuality(quality) {
    const formats = {
      excellent: 'Excellent',
      good: 'Good',
      adequate: 'Adequate',
      poor: 'Poor',
      inadequate: 'Inadequate',
      specific: 'Specific',
      approximate: 'Approximate',
      vague: 'Vague',
      missing: 'Missing'
    };
    return formats[quality] || quality;
  }
  _scoreToRating(score) {
    if (score >= 9) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 5) return 'adequate';
    if (score >= 3) return 'poor';
    return 'inadequate';
  }
  _getRatingClass(rating) {
    return rating || 'adequate';
  }
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  destroy() {
    this.expandedThemes.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.analysisData = null;
  }
}
export default ResearchAnalysisView;
