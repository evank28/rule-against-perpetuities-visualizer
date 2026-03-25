/**
 * Classic Common Law RAP analysis.
 *
 * Strict "what-if" test: an interest is void if there is ANY possibility
 * that it might vest more than 21 years after the death of all lives in being
 * at the creation of the interest.
 *
 * Algorithm:
 * 1. Identify lives in being (S) at testator's death
 * 2. For each interest subject to RAP:
 *    a. Try each person in S as a candidate validating life
 *    b. Simulate worst-case scenario
 *    c. If ANY person validates → interest is VALID
 *    d. If NO person validates → interest VIOLATES RAP
 */

import { getLivesInBeing, getPerson } from '../../models/familyTree.js';
import { isSubjectToRap, getInterestTypeLabel, getVestingConditionLabel } from '../../models/will.js';
import { simulateForCandidate, detectKnownTraps } from '../scenarios.js';

/**
 * @typedef {Object} RapResult
 * @property {string} interestId
 * @property {string} interestLabel
 * @property {boolean} valid
 * @property {string|null} validatingLife - Name of the validating life if valid
 * @property {string} explanation
 * @property {Object[]} scenarios - Detailed scenario results
 * @property {Object[]} traps - Detected known traps
 * @property {boolean} subjectToRap - Whether this interest is subject to RAP at all
 */

/**
 * Analyze a single interest under classic RAP.
 *
 * @param {Object} interest - The interest to analyze
 * @param {Object} tree - The family tree at testator's death
 * @param {Object} will - The will containing the interest
 * @returns {RapResult}
 */
export function analyzeInterest(interest, tree, will) {
  const label = interest.label || getInterestTypeLabel(interest.type);

  // Not subject to RAP? Automatically valid.
  if (!isSubjectToRap(interest)) {
    return {
      interestId: interest.id,
      interestLabel: label,
      valid: true,
      validatingLife: null,
      explanation: `${label} is not subject to the Rule Against Perpetuities. ` +
        `Only contingent remainders, executory interests, and vested remainders ` +
        `subject to open are tested.`,
      scenarios: [],
      traps: [],
      subjectToRap: false,
    };
  }

  // Check for known traps
  const traps = detectKnownTraps(interest, tree);

  // Administrative/event contingencies are automatically invalid under classic RAP
  if (traps.some(t => t.trap === 'administrative_contingency' || t.trap === 'event_contingency')) {
    const trap = traps.find(t => t.trap === 'administrative_contingency' || t.trap === 'event_contingency');
    return {
      interestId: interest.id,
      interestLabel: label,
      valid: false,
      validatingLife: null,
      explanation: `❌ VIOLATES RAP (Classic). ${trap.explanation}`,
      scenarios: [],
      traps,
      subjectToRap: true,
    };
  }

  // Get lives in being
  const livesInBeing = getLivesInBeing(tree);
  const creationYear = tree.dateOfDeath ? tree.dateOfDeath.getFullYear() : 2024;

  if (livesInBeing.length === 0) {
    return {
      interestId: interest.id,
      interestLabel: label,
      valid: false,
      validatingLife: null,
      explanation: `❌ VIOLATES RAP (Classic). No lives in being at creation — ` +
        `interest must vest within 21 years of creation, which cannot be guaranteed.`,
      scenarios: [],
      traps,
      subjectToRap: true,
    };
  }

  // Try each life in being as validating life
  const scenarios = [];
  let validatingLifeId = null;
  let validatingScenario = null;

  for (const candidateId of livesInBeing) {
    const result = simulateForCandidate(interest, tree, candidateId, creationYear);
    const person = getPerson(tree, candidateId);
    scenarios.push({
      candidateId,
      candidateName: person ? person.name : candidateId,
      ...result,
    });

    if (result.valid) {
      validatingLifeId = candidateId;
      validatingScenario = result;
      break; // Found a validating life — no need to check others
    }
  }

  if (validatingLifeId) {
    const vlPerson = getPerson(tree, validatingLifeId);
    const vlName = vlPerson ? vlPerson.name : validatingLifeId;
    const condLabel = getVestingConditionLabel(interest.vestingCondition);
    return {
      interestId: interest.id,
      interestLabel: label,
      valid: true,
      validatingLife: vlName,
      explanation: `✅ VALID under RAP (Classic). ${vlName} serves as the validating ` +
        `(measuring) life. The interest "${condLabel}" must vest or fail within 21 years ` +
        `of ${vlName}'s death. ${validatingScenario.scenario}`,
      scenarios,
      traps,
      subjectToRap: true,
    };
  }

  // No validating life found → violation
  const failedScenario = scenarios[scenarios.length - 1];
  return {
    interestId: interest.id,
    interestLabel: label,
    valid: false,
    validatingLife: null,
    explanation: `❌ VIOLATES RAP (Classic). No life in being can serve as a validating ` +
      `life. ${failedScenario ? failedScenario.scenario : 'The interest could remain pending beyond all lives in being + 21 years.'}`,
    scenarios,
    traps,
    subjectToRap: true,
  };
}

/**
 * Analyze all interests in a will under classic RAP.
 */
export function analyzeWill(will, tree) {
  return will.interests.map(interest => analyzeInterest(interest, tree, will));
}

/**
 * Rule metadata for the registry.
 */
export const ruleInfo = {
  id: 'classic',
  name: 'Classic Common Law',
  description: 'Strict "what-if" test — void if any possibility of remote vesting beyond lives in being + 21 years.',
  analyzeInterest,
  analyzeWill,
};
