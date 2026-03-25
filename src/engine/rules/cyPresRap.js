/**
 * Cy Pres Reform RAP analysis.
 *
 * "As near as possible" — if an interest violates classic RAP,
 * the court reforms it to comply while staying as close as possible
 * to the grantor's original intent.
 *
 * Common reformations:
 * - Age contingency > 21 → reduce to 21
 * - Open class → close class at testator's death
 * - Add "if at all" savings clause
 */

import { analyzeInterest as classicAnalyze } from './classicRap.js';

/**
 * Attempt to reform an interest to comply with RAP.
 * Returns the reformed interest and explanation, or null if unreformable.
 */
function attemptReformation(interest) {
  const reforms = [];
  let reformed = JSON.parse(JSON.stringify(interest));

  // Reform 1: Reduce age contingency to 21
  if (reformed.vestingCondition?.type === 'age' && reformed.vestingCondition.ageRequirement > 21) {
    const originalAge = reformed.vestingCondition.ageRequirement;
    reformed.vestingCondition.ageRequirement = 21;
    reforms.push(
      `Age contingency reduced from ${originalAge} to 21 years. ` +
      `The court modifies the instrument to require the beneficiary to reach age 21 ` +
      `instead of ${originalAge}, bringing it within the perpetuities period.`
    );
  }

  // Reform 2: Close the class at testator's death
  if (reformed.beneficiaryType === 'class' && reformed.classDescriptor && !reformed.classDescriptor.classClosed) {
    reformed.classDescriptor.classClosed = true;
    reforms.push(
      `Class closed at testator's death. The court limits the class to only those ` +
      `members identifiable at the time of testator's death, preventing afterborn ` +
      `members from disrupting the perpetuities period.`
    );
  }

  // Reform 3: Administrative/event conditions → add time limit
  if (reformed.vestingCondition?.type === 'administrative' || reformed.vestingCondition?.type === 'event') {
    reformed.vestingCondition = { type: 'none', ageRequirement: null, eventDescription: null, survivalOf: null };
    reforms.push(
      `Administrative/event condition removed. The court eliminates the open-ended ` +
      `condition and treats the interest as immediately vesting, honoring the grantor's ` +
      `intent to benefit the named party.`
    );
  }

  if (reforms.length === 0) return null;

  return { reformed, reforms };
}

/**
 * Analyze under cy pres: run classic first, if invalid, try to reform.
 */
export function analyzeInterest(interest, tree, will) {
  const classicResult = classicAnalyze(interest, tree, will);

  // If valid under classic, no need for cy pres
  if (classicResult.valid) {
    return {
      ...classicResult,
      reformation: null,
      reformedResult: null,
    };
  }

  // Try reformation
  const reformation = attemptReformation(interest);
  if (!reformation) {
    return {
      ...classicResult,
      explanation: classicResult.explanation +
        '\n\n🔧 CY PRES: No applicable reformation available for this type of violation.' +
        '\n\n⏳ NOTE (Massachusetts): Under M.G.L. c. 184A, § 2, before treating an interest as invalid, a court would first apply a "Wait-and-See" period of 90 years to see if it vests naturally. If it still fails, the court would attempt a final reformation at that time.',
      reformation: null,
      reformedResult: null,
    };
  }

  // Analyze the reformed interest
  const reformedResult = classicAnalyze(reformation.reformed, tree, will);

  return {
    ...classicResult,
    valid: reformedResult.valid,
    explanation: classicResult.explanation +
      `\n\n🔧 CY PRES REFORMATION:\n` +
      reformation.reforms.map((r, i) => `  ${i + 1}. ${r}`).join('\n') +
      `\n\nAfter reformation: ${reformedResult.valid ? '✅ VALID' : '❌ Still invalid'}. ` +
      reformedResult.explanation +
      `\n\n⏳ NOTE (Massachusetts): Under M.G.L. c. 184A, § 2, a court would not immediately reform this interest. It would first apply a "Wait-and-See" approach, allowing up to 90 years for the interest to actually vest. Only if it remains unresolved after 90 years would the court actually apply this cy pres reformation.`,
    reformation,
    reformedResult,
  };
}

export function analyzeWill(will, tree) {
  return will.interests.map(interest => analyzeInterest(interest, tree, will));
}

export const ruleInfo = {
  id: 'cy_pres',
  name: 'Cy Pres Reform',
  description: 'If invalid under classic RAP, court reforms "as near as possible" to grantor\'s intent.',
  analyzeInterest,
  analyzeWill,
};
