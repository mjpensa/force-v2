/**
 * Analysis section builders for task analysis modal
 * These functions generate HTML for various analysis sections
 */

import { isSafeUrl } from './dom.js';

/**
 * Build a simple analysis section with title and content
 */
export function buildAnalysisSection(title, content) {
  if (!content) return '';
  const safeTitle = DOMPurify.sanitize(title);
  const safeContent = DOMPurify.sanitize(content);
  return `
    <div class="analysis-section">
      <h4>${safeTitle}</h4>
      <p>${safeContent}</p>
    </div>
  `;
}

/**
 * Build an analysis list with items and sources
 */
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
  const safeTitle = DOMPurify.sanitize(title);
  return `
    <div class="analysis-section">
      <h4>${safeTitle}</h4>
      <ul class="analysis-list">
        ${listItems}
      </ul>
    </div>
  `;
}

/**
 * Build timeline scenarios section
 */
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
    const factorItems = likelyDelayFactors.map(factor =>
      `<li>${DOMPurify.sanitize(factor)}</li>`
    ).join('');
    delayFactorsHTML = `
      <div class="delay-factors">
        <h5>Most Likely Delay Factors:</h5>
        <ul>${factorItems}</ul>
      </div>
    `;
  }

  return `
    <div class="analysis-section timeline-scenarios-section">
      <h4>📅 Timeline Scenarios</h4>
      <div class="scenarios-container">
        ${scenariosHTML}
      </div>
      ${delayFactorsHTML}
    </div>
  `;
}

/**
 * Build risk analysis section
 */
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
  return `
    <div class="analysis-section risks-section">
      <h4>🚨 Risks & Roadblocks</h4>
      <div class="risks-container">
        ${riskCards}
      </div>
    </div>
  `;
}

/**
 * Build impact analysis section
 */
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
  return `
    <div class="analysis-section impact-section">
      <h4>📊 Impact Analysis</h4>
      <div class="impact-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * Build scheduling context section
 */
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

  if (schedulingContext.predecessors && schedulingContext.predecessors.length > 0) {
    const predList = schedulingContext.predecessors.map(p =>
      `<li>${DOMPurify.sanitize(p)}</li>`
    ).join('');
    contentHTML += `
      <div class="scheduling-item">
        <strong>Depends On:</strong>
        <ul class="dependency-list">${predList}</ul>
      </div>
    `;
  }

  if (schedulingContext.successors && schedulingContext.successors.length > 0) {
    const succList = schedulingContext.successors.map(s =>
      `<li>${DOMPurify.sanitize(s)}</li>`
    ).join('');
    contentHTML += `
      <div class="scheduling-item">
        <strong>Blocks:</strong>
        <ul class="dependency-list">${succList}</ul>
      </div>
    `;
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
  return `
    <div class="analysis-section scheduling-section">
      <h4>🎯 Why This Task Starts Now</h4>
      <div class="scheduling-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * Build progress indicators section
 */
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
    const blockerItems = progress.activeBlockers.map(blocker =>
      `<li>🚫 ${DOMPurify.sanitize(blocker)}</li>`
    ).join('');
    contentHTML += `
      <div class="blockers-section">
        <h5>Active Blockers</h5>
        <ul class="blockers-list">${blockerItems}</ul>
      </div>
    `;
  }

  if (!contentHTML) return '';
  return `
    <div class="analysis-section progress-section">
      <h4>📈 Progress Tracking</h4>
      <div class="progress-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * Build accelerators section
 */
export function buildAccelerators(accelerators) {
  if (!accelerators) return '';
  let contentHTML = '';

  if (accelerators.externalDrivers && accelerators.externalDrivers.length > 0) {
    const driverItems = accelerators.externalDrivers.map(driver =>
      `<li>${DOMPurify.sanitize(driver)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>External Drivers</h5>
        <ul class="accelerator-list">${driverItems}</ul>
      </div>
    `;
  }

  if (accelerators.internalIncentives && accelerators.internalIncentives.length > 0) {
    const incentiveItems = accelerators.internalIncentives.map(incentive =>
      `<li>${DOMPurify.sanitize(incentive)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Internal Incentives</h5>
        <ul class="accelerator-list">${incentiveItems}</ul>
      </div>
    `;
  }

  if (accelerators.efficiencyOpportunities && accelerators.efficiencyOpportunities.length > 0) {
    const opportunityItems = accelerators.efficiencyOpportunities.map(opportunity =>
      `<li>${DOMPurify.sanitize(opportunity)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Efficiency Opportunities</h5>
        <ul class="accelerator-list">${opportunityItems}</ul>
      </div>
    `;
  }

  if (accelerators.successFactors && accelerators.successFactors.length > 0) {
    const factorItems = accelerators.successFactors.map(factor =>
      `<li>${DOMPurify.sanitize(factor)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Success Factors</h5>
        <ul class="accelerator-list">${factorItems}</ul>
      </div>
    `;
  }

  if (!contentHTML) return '';
  return `
    <div class="analysis-section accelerators-section">
      <h4>⚡ Motivators & Accelerators</h4>
      <div class="accelerators-content">
        ${contentHTML}
      </div>
    </div>
  `;
}
