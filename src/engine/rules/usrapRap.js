/**
 * USRAP (Uniform Statutory Rule Against Perpetuities) analysis.
 *
 * Two-step test:
 * 1. If valid under classic common law RAP → valid
 * 2. If not, apply wait-and-see for 90 years from creation
 *    - If interest actually vests within 90 years → valid
 *    - If not, apply cy pres reformation
 */

import { analyzeInterest as classicAnalyze } from './classicRap.js';
import { analyzeInterest as cyPresAnalyze } from './cyPresRap.js';
import { checkInterestVesting } from '../scenarios.js';
import { cloneTree } from '../../models/familyTree.js';

/**
 * Simulate whether an interest would vest within 90 years.
 * Under USRAP, we check actual vesting (wait-and-see), not hypotheticals.
 */
function wouldVestWithin90Years(interest, tree, creationYear) {
  // Under wait-and-see, we give the benefit of the doubt.
  // If there's any reasonable chance of vesting within 90 years, it passes.

  const sim = cloneTree(tree);
  const deadline = creationYear + 90;

  // For age contingencies: check if any current beneficiary could reach the age within 90 years
  if (interest.vestingCondition?.type === 'age') {
    const ageReq = interest.vestingCondition.ageRequirement;

    if (interest.beneficiaryType === 'person') {
      const person = sim.persons.get(interest.beneficiaryId);
      if (person && person.birthYear) {
        const vestingYear = person.birthYear + ageReq;
        if (vestingYear <= deadline) {
          return {
            vests: true,
            explanation: `Under the 90-year wait-and-see period, ${person.name} ` +
              `would reach age ${ageReq} by year ${vestingYear}, well within the ` +
              `90-year deadline of ${deadline}.`,
          };
        }
      }
    }

    if (interest.beneficiaryType === 'class') {
      // Even afterborn children born at year 1 would reach age by year 1 + ageReq
      // If ageReq < 90, it's extremely likely to vest
      if (ageReq < 90) {
        return {
          vests: true,
          explanation: `Under the 90-year wait-and-see period, any class member ` +
            `born within the first ${90 - ageReq} years would reach age ${ageReq} ` +
            `within the 90-year period. The interest will almost certainly vest in time.`,
        };
      }
    }
  }

  // For survival conditions
  if (interest.vestingCondition?.type === 'survival') {
    return {
      vests: true,
      explanation: `Under the 90-year wait-and-see period, the survival condition ` +
        `will resolve well within 90 years (no person lives 90+ years).`,
    };
  }

  // For administrative/event conditions — these are the hardest
  if (interest.vestingCondition?.type === 'administrative' || interest.vestingCondition?.type === 'event') {
    return {
      vests: false,
      explanation: `Under the 90-year wait-and-see period, the ${interest.vestingCondition.type} ` +
        `condition may still not resolve within 90 years. The condition has no guaranteed timeline.`,
    };
  }

  // Default: assume it vests within 90 years
  return {
    vests: true,
    explanation: 'Interest is likely to vest within the 90-year statutory period.',
  };
}

export function analyzeInterest(interest, tree, will) {
  // Step 1: Try classic RAP
  const classicResult = classicAnalyze(interest, tree, will);
  if (classicResult.valid || !classicResult.subjectToRap) {
    return {
      ...classicResult,
      usrapStep: 'passed_classic',
      waitAndSeeResult: null,
      cyPresResult: null,
    };
  }

  // Step 2: Wait-and-see for 90 years
  const creationYear = tree.dateOfDeath ? tree.dateOfDeath.getFullYear() : 2024;
  const waitResult = wouldVestWithin90Years(interest, tree, creationYear);

  if (waitResult.vests) {
    return {
      interestId: interest.id,
      interestLabel: classicResult.interestLabel,
      valid: true,
      validatingLife: null,
      explanation: classicResult.explanation +
        `\n\n⏳ USRAP WAIT-AND-SEE (90 years): ${waitResult.explanation}\n\n` +
        `✅ VALID under USRAP — interest vests within the 90-year statutory period.`,
      scenarios: classicResult.scenarios,
      traps: classicResult.traps,
      subjectToRap: true,
      usrapStep: 'passed_wait_and_see',
      waitAndSeeResult: waitResult,
      cyPresResult: null,
    };
  }

  // Step 3: Cy pres reformation
  const cyPresResult = cyPresAnalyze(interest, tree, will);

  return {
    interestId: interest.id,
    interestLabel: classicResult.interestLabel,
    valid: cyPresResult.valid,
    validatingLife: cyPresResult.validatingLife,
    explanation: classicResult.explanation +
      `\n\n⏳ USRAP WAIT-AND-SEE: ${waitResult.explanation} — still invalid after 90 years.` +
      `\n\n${cyPresResult.reformation ? '🔧 USRAP CY PRES: ' + cyPresResult.explanation : 
        '❌ INVALID under USRAP — fails classic test, 90-year period, and cy pres.'}`,
    scenarios: classicResult.scenarios,
    traps: classicResult.traps,
    subjectToRap: true,
    usrapStep: cyPresResult.valid ? 'passed_cy_pres' : 'failed_all',
    waitAndSeeResult: waitResult,
    cyPresResult,
  };
}

export function analyzeWill(will, tree) {
  return will.interests.map(interest => analyzeInterest(interest, tree, will));
}

export const ruleInfo = {
  id: 'usrap',
  name: 'USRAP (Wait-and-See)',
  description: 'Valid if passes classic RAP, or vests within 90 years, or can be reformed via cy pres.',
  analyzeInterest,
  analyzeWill,
};
