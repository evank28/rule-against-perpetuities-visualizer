/**
 * Scenario simulator for RAP "what-if" analysis.
 *
 * Given a family tree and a candidate validating life, enumerates
 * hypothetical future events (births, deaths, marriages) and checks
 * whether an interest could possibly vest or fail to vest too remotely.
 */

import { cloneTree, addPerson, addChild, createPerson, getChildren, getPerson, getDescendants, addSpouse, generateId } from '../models/familyTree.js';

/**
 * Determine if a class is "closed" — no more members can be added.
 * A class closes when the class-generating person is dead.
 * Under the Rule of Convenience, a class can also close when any
 * member is entitled to distribution.
 */
export function isClassClosed(tree, classDescriptor) {
  if (classDescriptor.classClosed) return true;
  const parent = tree.persons.get(classDescriptor.parentId);
  if (!parent) return true;
  return !parent.alive; // class closes when parent dies
}

/**
 * Get current members of a class at a given point in the simulation.
 */
export function getClassMembers(tree, classDescriptor) {
  const parentId = classDescriptor.parentId;
  if (classDescriptor.relationship === 'children') {
    return getChildren(tree, parentId);
  }
  if (classDescriptor.relationship === 'grandchildren') {
    const children = getChildren(tree, parentId);
    const grandchildren = [];
    for (const childId of children) {
      grandchildren.push(...getChildren(tree, childId));
    }
    return grandchildren;
  }
  if (classDescriptor.relationship === 'issue') {
    return getDescendants(tree, parentId);
  }
  return classDescriptor.currentMembers || [];
}

/**
 * Check if a vesting condition is satisfied for a specific person at a given time.
 *
 * @param {Object} condition - The vesting condition
 * @param {Object} person - The potential beneficiary
 * @param {number} currentYear - The current year in the simulation
 * @param {Object} tree - The family tree state
 * @returns {'vested'|'failed'|'pending'}
 */
export function checkCondition(condition, person, currentYear, tree) {
  if (!condition || condition.type === 'none') {
    return 'vested';
  }

  if (condition.type === 'age') {
    if (!person.birthYear) return 'pending';
    
    // The year the person would reach the required age
    const vestingYear = person.birthYear + condition.ageRequirement;
    
    // Did they die before reaching that age?
    if (!person.alive && person.deathYear !== undefined && person.deathYear < vestingYear) {
      return 'failed';
    }
    
    // Have we reached the vesting year in our simulation?
    if (currentYear >= vestingYear) {
      return 'vested';
    }
    
    return 'pending';
  }

  if (condition.type === 'survival') {
    const targetPerson = tree.persons.get(condition.survivalOf);
    if (targetPerson && !targetPerson.alive) {
      // The person we must survive has died
      if (person.alive) return 'vested';
      return 'failed';
    }
    return 'pending';
  }

  if (condition.type === 'event') {
    // Events are unpredictable — they remain pending
    // Under classic RAP, we assume they may never happen
    return 'pending';
  }

  if (condition.type === 'administrative') {
    // Administrative conditions may never resolve
    return 'pending';
  }

  return 'pending';
}

/**
 * For a given interest and scenario, determine if the interest has vested,
 * failed, or is still pending.
 *
 * For class gifts: ALL members must vest for the gift to be "vested."
 * If any member has failed and class is closed, those members just drop out.
 * The gift is considered "vested" when class is closed and all surviving
 * members meet the condition.
 */
export function checkInterestVesting(interest, tree, currentYear) {
  if (interest.beneficiaryType === 'person') {
    const person = tree.persons.get(interest.beneficiaryId);
    if (!person) return { status: 'failed', reason: 'Beneficiary does not exist' };
    return {
      status: checkCondition(interest.vestingCondition, person, currentYear, tree),
      reason: null,
    };
  }

  if (interest.beneficiaryType === 'class') {
    const cd = interest.classDescriptor;
    const members = getClassMembers(tree, cd);
    const closed = isClassClosed(tree, cd);

    if (members.length === 0 && closed) {
      return { status: 'failed', reason: 'Class is empty and closed' };
    }

    let allVested = true;
    let anyPending = false;

    for (const memberId of members) {
      const member = tree.persons.get(memberId);
      if (!member) continue;
      const result = checkCondition(interest.vestingCondition, member, currentYear, tree);
      if (result === 'pending') {
        anyPending = true;
        allVested = false;
      } else if (result === 'failed') {
        // Member failed — they drop out, but doesn't invalidate others
      }
    }

    // If class is still open, new members could be added → pending
    if (!closed) {
      return { status: 'pending', reason: 'Class is still open (parent alive)' };
    }

    if (allVested && !anyPending) {
      return { status: 'vested', reason: 'All class members meet condition' };
    }
    if (anyPending) {
      return { status: 'pending', reason: 'Some class members have not yet met condition' };
    }

    return { status: 'vested', reason: 'Class closed and conditions resolved' };
  }

  return { status: 'failed', reason: 'Unknown beneficiary type' };
}

/**
 * Simulate worst-case scenarios for RAP analysis.
 *
 * The key insight: under classic RAP, we must find a VALIDATING LIFE —
 * a person alive at creation such that no matter what happens,
 * the interest must vest or fail within 21 years of that person's death.
 *
 * To DISPROVE a candidate validating life, we construct a scenario where:
 * 1. The candidate dies
 * 2. 21 years pass
 * 3. The interest is still pending
 *
 * @param {Object} interest - The interest to analyze
 * @param {Object} tree - The family tree at testator's death
 * @param {string} candidateLifeId - ID of the candidate validating life
 * @param {number} creationYear - Year the interest was created
 * @returns {Object} { valid: boolean, scenario: string }
 */
export function simulateForCandidate(interest, tree, candidateLifeId, creationYear) {
  const sim = cloneTree(tree);
  const candidate = sim.persons.get(candidateLifeId);
  if (!candidate) {
    return {
      valid: false,
      scenario: `Candidate ${candidateLifeId} not found in tree`,
    };
  }

  const candidateName = candidate.name;
  const steps = [];

  // ─── STEP 1: Simulate afterborn children for class interests ───
  // Under the "fertile octogenarian" presumption, ANY living person can have
  // children regardless of age. We must consider afterborn children even when
  // the class parent IS the candidate validating life.

  if (interest.beneficiaryType === 'class' && interest.classDescriptor) {
    const cd = interest.classDescriptor;
    const classParent = sim.persons.get(cd.parentId);

    if (classParent && classParent.alive) {
      const isCandidateTheClassParent = (cd.parentId === candidateLifeId);

      // Fertile octogenarian: class parent has a new child before dying.
      // This child is NOT a life in being (born after creation).
      const afterbornId = generateId();
      const afterbornBirthYear = isCandidateTheClassParent
        ? creationYear       // born exactly when candidate class parent dies
        : creationYear + 2;  // born after creation
      const afterborn = createPerson({
        id: afterbornId,
        name: `Afterborn child of ${classParent.name}`,
        alive: true,
        birthYear: afterbornBirthYear,
        gender: 'unknown',
      });
      addPerson(sim, afterborn);
      addChild(sim, cd.parentId, afterbornId);
      steps.push(`${classParent.name} has a new child (${afterborn.name}) in ${afterbornBirthYear} [Fertile Octogenarian presumption]`);

      // If grandchildren or issue class: the afterborn child can then have children
      // These grandchildren are NOT lives in being and are born well after creation.
      if (cd.relationship === 'grandchildren' || cd.relationship === 'issue') {
        const afterbornGrandchildId = generateId();
        // Grandchild born well after the candidate validating life dies
        const grandchildBirthYear = isCandidateTheClassParent
          ? creationYear + 3   // born 2 years after candidate dies
          : creationYear + 20; // born much later
        const afterbornGrandchild = createPerson({
          id: afterbornGrandchildId,
          name: `Afterborn grandchild via ${afterborn.name}`,
          alive: true,
          birthYear: grandchildBirthYear,
          gender: 'unknown',
        });
        addPerson(sim, afterbornGrandchild);
        addChild(sim, afterbornId, afterbornGrandchildId);
        steps.push(`${afterborn.name} has a child (${afterbornGrandchild.name}) in ${grandchildBirthYear}`);
      }

      // If the class parent is NOT the candidate, kill the parent
      if (!isCandidateTheClassParent) {
        classParent.alive = false;
        classParent.deathYear = creationYear + 3;
        steps.push(`${classParent.name} dies in ${creationYear + 3}`);
      }
    }
  }

  // ─── STEP 2: Kill the candidate validating life ───
  // We use immediate death (creationYear) for a tighter RAP boundary test
  const candidateDeathYear = creationYear;
  const candidateInSim = sim.persons.get(candidateLifeId);
  candidateInSim.alive = false;
  candidateInSim.deathYear = candidateDeathYear;
  steps.push(`${candidateName} dies in ${candidateDeathYear}`);

  // ─── STEP 3: Let other lives in being remain alive ───
  // To construct the adversarial case (verifying they don't stay pending), 
  // we let all other lives live indefinitely unless their death was already 
  // triggered in Step 1.
  steps.push(`Other lives in being remain alive indefinitely`);

  // ─── STEP 4: Check vesting at 21 years after candidate's death ───
  const checkYear = candidateDeathYear + 21;
  steps.push(`Check vesting at ${checkYear} (21 years after ${candidateName}'s death)`);

  const result = checkInterestVesting(interest, sim, checkYear);

  if (result.status === 'vested' || result.status === 'failed') {
    return {
      valid: true,
      scenario: `${candidateName} is a valid measuring life. ` +
        `Interest ${result.status} by ${checkYear}. Steps: ${steps.join('; ')}`,
    };
  }

  return {
    valid: false,
    scenario: `${candidateName} is NOT a valid measuring life. ` +
      `Interest still pending at ${checkYear}. ${result.reason || ''}. Steps: ${steps.join('; ')}`,
  };
}

/**
 * Special-case detection for known RAP traps.
 * Returns early analysis results for common patterns.
 */
export function detectKnownTraps(interest, tree) {
  const traps = [];

  // Administrative contingency
  if (interest.vestingCondition?.type === 'administrative') {
    traps.push({
      trap: 'administrative_contingency',
      name: 'Administrative Contingency / Magic Gravel Pit',
      explanation: 'The vesting condition depends on an administrative event that may never occur. ' +
        'No measuring life can guarantee resolution within lives + 21 years.',
    });
  }

  // Event contingency with no tie to a life in being
  if (interest.vestingCondition?.type === 'event') {
    traps.push({
      trap: 'event_contingency',
      name: 'Remote Event Contingency',
      explanation: 'The vesting condition depends on an event with no guaranteed timeline. ' +
        'This may occur beyond any life in being + 21 years.',
    });
  }

  // Age > 21 with open class
  if (interest.vestingCondition?.type === 'age' &&
      interest.vestingCondition.ageRequirement > 21 &&
      interest.beneficiaryType === 'class' &&
      interest.classDescriptor) {
    const parent = tree.persons.get(interest.classDescriptor.parentId);
    if (parent && parent.alive) {
      traps.push({
        trap: 'age_contingency_open_class',
        name: 'Age Contingency > 21 with Open Class',
        explanation: `The class is still open (${parent.name} is alive) and the age requirement ` +
          `is ${interest.vestingCondition.ageRequirement}. An afterborn child might not reach ` +
          `that age within 21 years of any life in being's death.`,
      });
    }
  }

  // Unborn widow detection
  if (interest.vestingCondition?.type === 'survival' && interest.precedingInterestId) {
    // Check if the preceding interest is a life estate to a "widow" type
    traps.push({
      trap: 'potential_unborn_widow',
      name: 'Potential Unborn Widow/Widower',
      explanation: 'The interest depends on surviving a person who may not yet be born at creation.',
    });
  }

  return traps;
}
