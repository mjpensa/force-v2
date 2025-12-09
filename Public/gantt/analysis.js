/**
 * GanttAnalysis - Handles research analysis display
 */
export class GanttAnalysis {
  /**
   * Add research analysis section to the chart
   * @param {HTMLElement} container - The main container element
   * @param {Object} ganttData - Chart data with researchAnalysis
   */
  addResearchAnalysis(container, ganttData) {
    if (!ganttData.researchAnalysis) {
      return;
    }

    const analysis = ganttData.researchAnalysis;

    const analysisWrapper = document.createElement('div');
    analysisWrapper.className = 'research-analysis-wrapper';
    analysisWrapper.id = 'research-analysis';

    const collapseHeader = this._createCollapseHeader(analysis);
    const analysisContent = this._createAnalysisContent(analysis);

    collapseHeader.addEventListener('click', () => {
      const isExpanded = collapseHeader.getAttribute('aria-expanded') === 'true';
      collapseHeader.setAttribute('aria-expanded', !isExpanded);
      analysisContent.classList.toggle('collapsed');
      collapseHeader.classList.toggle('expanded');
    });

    analysisWrapper.appendChild(collapseHeader);
    analysisWrapper.appendChild(analysisContent);
    container.appendChild(analysisWrapper);
  }

  /**
   * Create the collapse header button
   */
  _createCollapseHeader(analysis) {
    const collapseHeader = document.createElement('button');
    collapseHeader.className = 'research-analysis-collapse-header';
    collapseHeader.setAttribute('aria-expanded', 'false');
    collapseHeader.setAttribute('aria-controls', 'research-analysis-content');

    const scoreClass = this._getScoreClass(analysis.overallScore);
    collapseHeader.innerHTML = `
      <span class="collapse-icon">&#9654;</span>
      <span class="collapse-title">Research Quality Analysis</span>
      <span class="collapse-score ${scoreClass}">${analysis.overallScore}/10</span>
    `;

    return collapseHeader;
  }

  /**
   * Create the analysis content section
   */
  _createAnalysisContent(analysis) {
    const analysisContent = document.createElement('div');
    analysisContent.className = 'research-analysis-content collapsed';
    analysisContent.id = 'research-analysis-content';

    if (analysis.summary) {
      const summary = document.createElement('div');
      summary.className = 'research-analysis-summary';
      summary.textContent = analysis.summary;
      analysisContent.appendChild(summary);
    }

    if (analysis.topics && analysis.topics.length > 0) {
      const tableContainer = this._createTopicsTable(analysis.topics);
      analysisContent.appendChild(tableContainer);
    }

    const legend = this._createScoreLegend();
    analysisContent.appendChild(legend);

    return analysisContent;
  }

  /**
   * Create the topics analysis table
   */
  _createTopicsTable(topics) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'research-analysis-table-container';

    const table = document.createElement('table');
    table.className = 'research-analysis-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Topic</th>
        <th>Fitness Score</th>
        <th>Tasks Found</th>
        <th>In Chart</th>
        <th>Issues</th>
        <th>Recommendation</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    topics.forEach(topic => {
      const row = document.createElement('tr');
      const topicScoreClass = this._getScoreClass(topic.fitnessScore);
      const includedClass = topic.includedinChart ? 'included-yes' : 'included-no';
      const includedText = topic.includedinChart ? 'Yes' : 'No';
      const issuesList = topic.issues && topic.issues.length > 0
        ? topic.issues.map(issue => `<li>${this._escapeHtml(issue)}</li>`).join('')
        : '<li>None</li>';

      row.innerHTML = `
        <td class="topic-name">${this._escapeHtml(topic.name)}</td>
        <td class="topic-score"><span class="score-badge ${topicScoreClass}">${topic.fitnessScore}/10</span></td>
        <td class="topic-task-count">${topic.taskCount}</td>
        <td class="topic-included ${includedClass}">${includedText}</td>
        <td class="topic-issues"><ul>${issuesList}</ul></td>
        <td class="topic-recommendation">${this._escapeHtml(topic.recommendation)}</td>
      `;

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    return tableContainer;
  }

  /**
   * Create the score legend
   */
  _createScoreLegend() {
    const legend = document.createElement('div');
    legend.className = 'research-analysis-legend';
    legend.innerHTML = `
      <div class="legend-title">Score Guide:</div>
      <div class="legend-items">
        <span class="legend-item"><span class="score-badge score-excellent">9-10</span> Excellent - Clear dates & milestones</span>
        <span class="legend-item"><span class="score-badge score-good">7-8</span> Good - Some gaps in timeline</span>
        <span class="legend-item"><span class="score-badge score-adequate">5-6</span> Adequate - Vague dates</span>
        <span class="legend-item"><span class="score-badge score-poor">3-4</span> Poor - Lacks specific dates</span>
        <span class="legend-item"><span class="score-badge score-inadequate">1-2</span> Inadequate - No timeline data</span>
      </div>
    `;
    return legend;
  }

  /**
   * Get CSS class for score styling
   */
  _getScoreClass(score) {
    if (score >= 9) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-adequate';
    if (score >= 3) return 'score-poor';
    return 'score-inadequate';
  }

  /**
   * Escape HTML entities for safe display
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
