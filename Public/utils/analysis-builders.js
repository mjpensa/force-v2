import { isSafeUrl } from './dom.js';

function wrapSection(sectionClass, title, innerHTML) {
  return `
    <div class="analysis-section ${sectionClass}">
      <h4>${title}</h4>
      ${innerHTML}
    </div>
  `;
}

function buildSanitizedList(items, itemClass = '') {
  if (!items || items.length === 0) return '';
  const cls = itemClass ? ` class="${itemClass}"` : '';
  return items.map(item => `<li${cls}>${DOMPurify.sanitize(item)}</li>`).join('');
}

export function buildAnalysisSection(title, content) {
  if (!content) return '';
  return wrapSection('', DOMPurify.sanitize(title), `<p>${DOMPurify.sanitize(content)}</p>`);
}

export function buildAnalysisList(title, items, itemKey, sourceKey) {
  if (!items || items.length === 0) return '';
  const listItems = items.map(item => {
    const itemText = DOMPurify.sanitize(item[itemKey] || '');
    let sourceText = DOMPurify.sanitize(item[sourceKey] || 'Source not available');
    if (item.url && isSafeUrl(item.url)) {
      const safeUrl = DOMPurify.sanitize(item.url);
      sourceText = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${sourceText}</a>`;
    }
    return `
      <li>
        <p>${itemText}</p>
        <p class="source">${sourceText}</p>
      </li>
    `;
  }).join('');
  return wrapSection('', DOMPurify.sanitize(title), `<ul class="analysis-list">${listItems}</ul>`);
}

export function buildTimelineScenarios(timelineScenarios) {
  if (!timelineScenarios) return '';
  const { expected, bestCase, worstCase, likelyDelayFactors } = timelineScenarios;
  let scenariosHTML = '';

  if (bestCase && bestCase.date) {
    scenariosHTML += `
      <div class="timeline-scenario best-case">
        <div class="scenario-header">
          <span class="scenario-label">Best-Case:</span>
          <span class="scenario-date">${DOMPurify.sanitize(bestCase.date)}</span>
        </div>
        <div class="timeline-bar best-case-bar"></div>
        ${bestCase.assumptions ? `<p class="scenario-detail">${DOMPurify.sanitize(bestCase.assumptions)}</p>` : ''}
      </div>
    `;
  }

  if (expected && expected.date) {
    const confidenceBadge = expected.confidence ?
      `<span class="confidence-badge confidence-${expected.confidence}">${DOMPurify.sanitize(expected.confidence)} confidence</span>` : '';
    scenariosHTML += `
      <div class="timeline-scenario expected">
        <div class="scenario-header">
          <span class="scenario-label">Expected:</span>
          <span class="scenario-date">${DOMPurify.sanitize(expected.date)}</span>
          ${confidenceBadge}
        </div>
        <div class="timeline-bar expected-bar"></div>
      </div>
    `;
  }

  if (worstCase && worstCase.date) {
    scenariosHTML += `
      <div class="timeline-scenario worst-case">
        <div class="scenario-header">
          <span class="scenario-label">Worst-Case:</span>
          <span class="scenario-date">${DOMPurify.sanitize(worstCase.date)}</span>
        </div>
        <div class="timeline-bar worst-case-bar"></div>
        ${worstCase.risks ? `<p class="scenario-detail">${DOMPurify.sanitize(worstCase.risks)}</p>` : ''}
      </div>
    `;
  }

  let delayFactorsHTML = '';
  if (likelyDelayFactors && likelyDelayFactors.length > 0) {
    delayFactorsHTML = `
      <div class="delay-factors">
        <h5>Most Likely Delay Factors:</h5>
        <ul>${buildSanitizedList(likelyDelayFactors)}</ul>
      </div>
    `;
  }

  return wrapSection('timeline-scenarios-section', '📅 Timeline Scenarios',
    `<div class="scenarios-container">${scenariosHTML}</div>${delayFactorsHTML}`);
}

export function buildRiskAnalysis(risks) {
  if (!risks || risks.length === 0) return '';
  const riskCards = risks.map(risk => {
    const severityClass = risk.severity || 'low';
    const likelihoodClass = risk.likelihood || 'unlikely';
    return `
      <div class="risk-card risk-${severityClass}">
        <div class="risk-header">
          <span class="risk-severity-badge severity-${severityClass}">
            ${severityClass === 'high' ? '🔴' : severityClass === 'medium' ? '🟡' : '⚫'}
            ${DOMPurify.sanitize(severityClass.toUpperCase())}
          </span>
          <span class="risk-likelihood">[${DOMPurify.sanitize(likelihoodClass)}]</span>
          <span class="risk-name">${DOMPurify.sanitize(risk.name || '')}</span>
        </div>
        ${risk.impact ? `<p class="risk-impact"><strong>Impact:</strong> ${DOMPurify.sanitize(risk.impact)}</p>` : ''}
        ${risk.mitigation ? `<p class="risk-mitigation"><strong>Mitigation:</strong> ${DOMPurify.sanitize(risk.mitigation)}</p>` : ''}
      </div>
    `;
  }).join('');
  return wrapSection('risks-section', '🚨 Risks & Roadblocks',
    `<div class="risks-container">${riskCards}</div>`);
}

export function buildImpactAnalysis(impact) {
  if (!impact) return '';
  let contentHTML = '';

  if (impact.downstreamTasks !== undefined && impact.downstreamTasks !== null) {
    contentHTML += `
      <p class="impact-item">
        <strong>Downstream Tasks:</strong>
        <span class="impact-value">${impact.downstreamTasks} task${impact.downstreamTasks !== 1 ? 's' : ''} blocked if delayed</span>
      </p>
    `;
  }

  if (impact.businessImpact) {
    contentHTML += `
      <p class="impact-item">
        <strong>Business Impact:</strong>
        ${DOMPurify.sanitize(impact.businessImpact)}
      </p>
    `;
  }

  if (impact.strategicImpact) {
    contentHTML += `
      <p class="impact-item">
        <strong>Strategic Impact:</strong>
        ${DOMPurify.sanitize(impact.strategicImpact)}
      </p>
    `;
  }

  if (impact.stakeholders && impact.stakeholders.length > 0) {
    const stakeholderList = impact.stakeholders.map(s => DOMPurify.sanitize(s)).join(', ');
    contentHTML += `
      <p class="impact-item">
        <strong>Stakeholders:</strong>
        ${stakeholderList}
      </p>
    `;
  }

  if (!contentHTML) return '';
  return wrapSection('impact-section', '📊 Impact Analysis',
    `<div class="impact-content">${contentHTML}</div>`);
}

export function buildSchedulingContext(schedulingContext) {
  if (!schedulingContext) return '';
  let contentHTML = '';

  if (schedulingContext.rationale) {
    contentHTML += `
      <p class="scheduling-item">
        <strong>Scheduling Rationale:</strong>
        ${DOMPurify.sanitize(schedulingContext.rationale)}
      </p>
    `;
  }

  for (const [key, label] of [['predecessors', 'Depends On:'], ['successors', 'Blocks:']]) {
    if (schedulingContext[key] && schedulingContext[key].length > 0) {
      contentHTML += `
        <div class="scheduling-item">
          <strong>${label}</strong>
          <ul class="dependency-list">${buildSanitizedList(schedulingContext[key])}</ul>
        </div>
      `;
    }
  }

  if (schedulingContext.slackDays !== undefined && schedulingContext.slackDays !== null) {
    contentHTML += `
      <p class="scheduling-item">
        <strong>Schedule Slack:</strong>
        ${schedulingContext.slackDays} day${schedulingContext.slackDays !== 1 ? 's' : ''}
      </p>
    `;
  }

  if (!contentHTML) return '';
  return wrapSection('scheduling-section', '🎯 Why This Task Starts Now',
    `<div class="scheduling-content">${contentHTML}</div>`);
}

export function buildProgressIndicators(progress, taskStatus) {
  if (!progress || taskStatus !== 'in-progress') return '';
  let contentHTML = '';

  if (progress.percentComplete !== undefined && progress.percentComplete !== null) {
    const percent = Math.min(100, Math.max(0, progress.percentComplete));
    const velocityClass = progress.velocity || 'on-track';
    const velocityLabel = velocityClass === 'on-track' ? 'On Track' :
                          velocityClass === 'behind' ? 'Behind Schedule' : 'Ahead of Schedule';
    const velocityIcon = velocityClass === 'on-track' ? '✓' :
                         velocityClass === 'behind' ? '⚠️' : '⚡';
    contentHTML += `
      <div class="progress-bar-container">
        <div class="progress-header">
          <span class="progress-percent">${percent}% Complete</span>
          <span class="velocity-badge velocity-${velocityClass}">
            ${velocityIcon} ${velocityLabel}
          </span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill progress-${velocityClass}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }

  if (progress.milestones && progress.milestones.length > 0) {
    const milestoneItems = progress.milestones.map(milestone => {
      const statusIcon = milestone.completed ? '✅' : '⬜';
      const statusClass = milestone.completed ? 'completed' : 'pending';
      return `
        <li class="milestone-item milestone-${statusClass}">
          <span class="milestone-icon">${statusIcon}</span>
          <div class="milestone-details">
            <span class="milestone-name">${DOMPurify.sanitize(milestone.name)}</span>
            <span class="milestone-date">${DOMPurify.sanitize(milestone.date || 'TBD')}</span>
          </div>
        </li>
      `;
    }).join('');
    contentHTML += `
      <div class="milestones-section">
        <h5>Milestones</h5>
        <ul class="milestones-list">${milestoneItems}</ul>
      </div>
    `;
  }

  if (progress.activeBlockers && progress.activeBlockers.length > 0) {
    contentHTML += `
      <div class="blockers-section">
        <h5>Active Blockers</h5>
        <ul class="blockers-list">${progress.activeBlockers.map(b => `<li>🚫 ${DOMPurify.sanitize(b)}</li>`).join('')}</ul>
      </div>
    `;
  }

  if (!contentHTML) return '';
  return wrapSection('progress-section', '📈 Progress Tracking',
    `<div class="progress-content">${contentHTML}</div>`);
}

export function buildAccelerators(accelerators) {
  if (!accelerators) return '';

  const subsections = [
    ['externalDrivers', 'External Drivers'],
    ['internalIncentives', 'Internal Incentives'],
    ['efficiencyOpportunities', 'Efficiency Opportunities'],
    ['successFactors', 'Success Factors']
  ];

  const contentHTML = subsections.map(([key, title]) => {
    const items = accelerators[key];
    if (!items || items.length === 0) return '';
    return `
      <div class="accelerator-subsection">
        <h5>${title}</h5>
        <ul class="accelerator-list">${buildSanitizedList(items)}</ul>
      </div>
    `;
  }).join('');

  if (!contentHTML) return '';
  return wrapSection('accelerators-section', '⚡ Motivators & Accelerators',
    `<div class="accelerators-content">${contentHTML}</div>`);
}
