/**
 * Interest cards UI component.
 * Displays each interest from the will as a styled card with RAP status
 * and plain-English analysis summaries.
 */

import { InterestType, getInterestTypeLabel, getVestingConditionLabel, isSubjectToRap } from '../models/will.js';

/**
 * Generate a concise, plain-English explanation of the RAP result
 * aimed at a law student who is learning the rule.
 */
function generateAnalysisSummary(interest, rapResult, ruleId) {
  if (!rapResult) return null;

  const typeLabel = getInterestTypeLabel(interest.type);

  // EXEMPT — not subject to RAP
  if (!rapResult.subjectToRap) {
    switch (interest.type) {
      case InterestType.FEE_SIMPLE_ABSOLUTE:
        return `This is a fee simple absolute — the most complete form of ownership. It vests immediately, so the Rule Against Perpetuities does not apply.`;
      case InterestType.LIFE_ESTATE:
        return `A life estate vests immediately at the testator's death. The estate simply ends when the life tenant dies. RAP only tests interests that might vest too far in the future.`;
      case InterestType.VESTED_REMAINDER:
        return `This interest is already vested — the beneficiary is identified and there's no condition precedent to their taking. Vested interests are exempt from RAP.`;
      case InterestType.FEE_SIMPLE_SUBJECT_TO_EL:
        return `This is the present possessory estate that's subject to being cut short by the executory interest. It vests immediately, so RAP does not apply to it directly — but RAP will test the executory interest that follows.`;
      case InterestType.REVERSION:
      case InterestType.POSSIBILITY_OF_REVERTER:
      case InterestType.RIGHT_OF_ENTRY:
        return `This is a retained interest belonging to the grantor. Retained interests are never subject to the Rule Against Perpetuities.`;
      default:
        return `${typeLabel} is not one of the interest types tested under the Rule Against Perpetuities.`;
    }
  }

  // VALID under RAP
  if (rapResult.valid) {
    const ml = rapResult.validatingLife;

    // Handle alternative rules (e.g., USRAP Wait-and-See, Cy Pres) that don't output a classical measuring life
    if (!ml) {
      if (rapResult.usrapStep === 'passed_wait_and_see') {
        text = `✅ Valid. The interest satisfies the USRAP 90-year Wait-and-See period. It is guaranteed to actually vest or fail within 90 years of creation.`;
      } else if (rapResult.usrapStep === 'passed_cy_pres') {
        text = `✅ Valid (Reformed). The interest violates classic RAP but is validated through Cy Pres statutory reformation.`;
      } else {
        text = `✅ Valid. The interest satisfies the rule requirements.`;
      }
    } else if (vc && vc.type === 'age') {
      const hasEvent = vc.eventDescription;
      if (hasEvent) {
        text = `<strong>Valid.</strong> ${ml} is the measuring life. The beneficiary must reach age ${vc.ageRequirement} (and ${vc.eventDescription}). Because ${ml} is the measuring life, it is mathematically impossible for these conditions to remain pending more than 21 years after their death.`;
      } else {
        text = `<strong>Valid.</strong> ${ml} is the measuring life. The beneficiary must reach age ${vc.ageRequirement}. Because ${ml} is the measuring life, it is mathematically impossible for this condition to remain pending more than 21 years after their death.`;
      }
    } else if (interest.beneficiaryType === 'class') {
      const rel = interest.classDescriptor?.relationship || 'members';
      text = `<strong>Valid.</strong> ${ml} is the measuring life. The class of ${rel} will close when ${ml} dies (natural class closing). All members must be born by that time, and any conditions must resolve within 21 years after.`;
    } else {
      text = `<strong>Valid.</strong> ${ml} serves as the measuring life. The interest must vest or fail within 21 years of ${ml}'s death, which is guaranteed under these circumstances.`;
    }

    if (ruleId === 'cy_pres' && rapResult.reformation != null) {
      text += `<br><br><span style="opacity: 0.85;"><em>Wait-and-See Note (e.g., MA M.G.L. c. 184A):</em> Before this Cy Pres reformation is applied, a court would first wait up to 90 years to see if the interest naturally vests.</span>`;
    }
    return text;
  }

  // INVALID under RAP
  const vc = interest.vestingCondition;
  const traps = rapResult.traps || [];
  let text = '';

  // Administrative contingency
  if (vc && (vc.type === 'administrative' || vc.type === 'event')) {
    const condition = vc.eventDescription || 'the specified event';
    if (vc.type === 'administrative') {
      text = `<strong>Violates RAP.</strong> The condition "${condition}" is an administrative contingency — it could potentially occur decades or centuries from now, far beyond any life in being + 21 years. No living person's death can serve as a measuring point, because the condition is not tied to any human life.`;
    } else {
      text = `<strong>Violates RAP.</strong> The condition "${condition}" could occur at any time in the future — there is no life in being whose death guarantees this event will resolve within 21 years. Under the classic rule's strict "what-if" test, this possibility of remote vesting makes the interest void.`;
    }
  }
  // Age > 21 with class
  else if (vc && vc.type === 'age' && vc.ageRequirement > 21 && interest.beneficiaryType === 'class') {
    const trap = traps.find(t => t.trap === 'fertile_octogenarian' || t.trap === 'precocious_toddler');
    const rel = interest.classDescriptor?.relationship || 'children';
    const age = vc.ageRequirement;
    text = `<strong>Violates RAP.</strong> The class of ${rel} could include afterborn members. Under the "fertile octogenarian" presumption, the parent could have another child after all current lives in being die. That afterborn child would need to reach age ${age}, which is more than 21 years after the last life in being's death. The "what-if" scenario invalidates the entire class gift.`;
  }
  // Survival condition (unborn widow, etc.)
  else if (traps.find(t => t.trap === 'unborn_widow')) {
    text = `<strong>Violates RAP — "Unborn Widow" trap.</strong> The spouse referenced might not yet be born at the testator's death. If the current spouse dies and the beneficiary remarries someone not yet born, that new spouse is not a life in being, and interests depending on the new spouse's death could vest too remotely.`;
  }
  // Generic invalid
  else {
    text = `<strong>Violates RAP.</strong> No person alive at the testator's death can serve as a measuring life that guarantees this interest will vest (or fail) within 21 years. Under the strict "what-if" approach, there exists a possible future where vesting occurs too remotely.`;
  }

  if (ruleId === 'cy_pres') {
    text += `<br><br><span style="opacity: 0.85;"><em>Wait-and-See Note (e.g., MA M.G.L. c. 184A):</em> Although Cy Pres reformation cannot immediately validate this interest, Massachusetts law dictates a court must first 'Wait-and-See' for 90 years before declaring it void. If the interest still hasn't vested by then, the court will attempt a final reformation at that time.</span>`;
  }
  return text;
}

/**
 * Render interest cards into the container.
 */
export function renderInterestCards(container, interests, rapResults = null, ruleId = null) {
  container.innerHTML = '';

  if (!interests || interests.length === 0) {
    container.innerHTML = '<div class="empty-state">No interests parsed yet. Enter a will and click Analyze.</div>';
    return;
  }

  const rapMap = new Map();
  if (rapResults) {
    for (const r of rapResults) {
      rapMap.set(r.interestId, r);
    }
  }

  for (const interest of interests) {
    const rapResult = rapMap.get(interest.id);
    const card = document.createElement('div');
    card.className = 'interest-card';

    let statusClass = 'status-neutral';
    let statusIcon = '⬜';
    let statusText = 'Not analyzed';

    if (rapResult) {
      if (!rapResult.subjectToRap) {
        statusClass = 'status-exempt';
        statusIcon = '🔵';
        statusText = 'Not subject to RAP';
      } else if (rapResult.valid) {
        statusClass = 'status-valid';
        statusIcon = '✅';
        statusText = 'Valid';
      } else {
        statusClass = 'status-invalid';
        statusIcon = '❌';
        statusText = 'Violates RAP';
      }
    }

    card.classList.add(statusClass);

    const typeLabel = getInterestTypeLabel(interest.type);
    const condLabel = getVestingConditionLabel(interest.vestingCondition);
    const subjectToRap = isSubjectToRap(interest);
    const analysisSummary = generateAnalysisSummary(interest, rapResult, ruleId);

    card.innerHTML = `
      <div class="card-header">
        <span class="status-icon">${statusIcon}</span>
        <span class="card-title">${interest.label || typeLabel}</span>
        <span class="rap-badge ${subjectToRap ? 'subject' : 'exempt'}">${subjectToRap ? 'RAP' : 'Exempt'}</span>
      </div>
      <div class="card-body">
        <div class="card-raw-text">"${interest.rawText}"</div>
        ${analysisSummary ? `<div class="card-analysis-summary">${analysisSummary}</div>` : ''}
          <span class="card-label">Type:</span>
          <span class="card-value">${typeLabel}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Condition:</span>
          <span class="card-value">${condLabel}</span>
        </div>
        ${interest.classDescriptor ? `
          <div class="card-row">
            <span class="card-label">Class:</span>
            <span class="card-value">${interest.classDescriptor.relationship} of parent</span>
          </div>
        ` : ''}
      </div>
      ${rapResult && rapResult.explanation ? `
        <details class="card-details">
          <summary>Full Analysis</summary>
          <div class="card-explanation">${formatExplanation(rapResult.explanation)}</div>
          ${rapResult.traps && rapResult.traps.length > 0 ? `
            <div class="card-traps">
              <strong>Detected Traps:</strong>
              ${rapResult.traps.map(t => `<div class="trap-badge">⚠️ ${t.name}</div>`).join('')}
            </div>
          ` : ''}
        </details>
      ` : ''}
    `;

    container.appendChild(card);
  }
}

function formatExplanation(text) {
  return text
    .replace(/✅/g, '<span class="icon-valid">✅</span>')
    .replace(/❌/g, '<span class="icon-invalid">❌</span>')
    .replace(/🔧/g, '<span class="icon-reform">🔧</span>')
    .replace(/⏳/g, '<span class="icon-wait">⏳</span>')
    .replace(/\n/g, '<br>');
}
