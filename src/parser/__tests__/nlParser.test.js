/**
 * Parser regression tests — ensures the NL parser handles
 * real-world inputs correctly.
 */

import { describe, it, expect } from 'vitest';
import { parseFamilyTree, parseWill, parseInputs } from '../../parser/nlParser.js';
import { InterestType } from '../../models/will.js';
import { resetIdCounter } from '../../models/familyTree.js';
import { resetInterestIdCounter } from '../../models/will.js';

function reset() {
  resetIdCounter(500);
  resetInterestIdCounter(500);
}

describe('Family Tree Parser', () => {
  it('parses "son of X" pattern inside parentheses', () => {
    reset();
    const { tree, personsByName, errors } = parseFamilyTree(
      'Thomas (testator, deceased). Bob (Thomas\'s friend, alive, age 50). Dylon (son of Thomas, alive, age 5)'
    );
    expect(tree.persons.size).toBe(3);
    expect(personsByName.has('thomas')).toBe(true);
    expect(personsByName.has('bob')).toBe(true);
    expect(personsByName.has('dylon')).toBe(true);

    // Thomas → Dylon parent-child relationship
    const thomasId = personsByName.get('thomas');
    const dylonId = personsByName.get('dylon');
    const dylon = tree.persons.get(dylonId);
    expect(dylon.parentIds).toContain(thomasId);
    const thomas = tree.persons.get(thomasId);
    expect(thomas.childIds).toContain(dylonId);
  });

  it('parses "daughter of X" pattern inside parentheses', () => {
    reset();
    const { tree, personsByName } = parseFamilyTree(
      'Martha (testator, deceased, age 70). Sarah (daughter of Martha, alive, age 40)'
    );
    const marthaId = personsByName.get('martha');
    const sarahId = personsByName.get('sarah');
    expect(tree.persons.get(sarahId).parentIds).toContain(marthaId);
  });

  it('parses "wife of X" pattern inside parentheses', () => {
    reset();
    const { tree, personsByName } = parseFamilyTree(
      'John (testator, deceased). Mary (wife of John, alive, age 50)'
    );
    const johnId = personsByName.get('john');
    const maryId = personsByName.get('mary');
    expect(tree.persons.get(johnId).spouseIds).toContain(maryId);
    expect(tree.persons.get(maryId).spouseIds).toContain(johnId);
  });

  it('parses standard "X has N children" format', () => {
    reset();
    const { tree, personsByName } = parseFamilyTree(
      'Thomas (testator, deceased). Thomas has two children: Alice (alive, age 30) and Bob (alive, age 25).'
    );
    const thomasId = personsByName.get('thomas');
    const aliceId = personsByName.get('alice');
    const bobId = personsByName.get('bob');
    expect(tree.persons.get(thomasId).childIds).toContain(aliceId);
    expect(tree.persons.get(thomasId).childIds).toContain(bobId);
  });

  it('correctly sets testator from parenthetical', () => {
    reset();
    const { tree, personsByName } = parseFamilyTree(
      'Grandpa (testator, deceased, age 90). Alice (alive, age 60)'
    );
    expect(tree.testatorId).toBe(personsByName.get('grandpa'));
    expect(tree.persons.get(personsByName.get('grandpa')).alive).toBe(false);
  });

  it('includes persons with no family relationship (e.g. friends)', () => {
    reset();
    const { tree, personsByName } = parseFamilyTree(
      'Thomas (testator, deceased). Charlie (Thomas\'s friend, alive, age 35)'
    );
    expect(personsByName.has('charlie')).toBe(true);
    expect(tree.persons.size).toBe(2);
  });
});

describe('Will Parser', () => {
  it('parses executory interest with "but if... then to"', () => {
    reset();
    const personsByName = new Map([['bob', 'bob-id'], ['thomas', 'thomas-id']]);
    const { interests, errors } = parseWill(
      'I, Thomas, devise Greenacre to the City of Springfield, but if the land is ever not used as a public park, then to my friend Bob.',
      personsByName
    );
    // Should produce: fee simple subject to EL (to City) + shifting executory (to Bob)
    expect(interests.length).toBe(2);
    const exec = interests.find(i => i.type === InterestType.EXECUTORY_INTEREST_SHIFTING);
    expect(exec).toBeDefined();
    expect(exec.beneficiaryId).toBe('bob-id');
    expect(exec.vestingCondition.type).toBe('administrative');
    expect(exec.vestingCondition.eventDescription).toContain('not used as a public park');
  });

  it('parses age condition with "when X turns N"', () => {
    reset();
    const personsByName = new Map([['dylon', 'dylon-id']]);
    const { interests } = parseWill(
      'I also devise my home to Dylon when he turns 22 years old',
      personsByName
    );
    expect(interests.length).toBe(1);
    expect(interests[0].vestingCondition.type).toBe('age');
    expect(interests[0].vestingCondition.ageRequirement).toBe(22);
    expect(interests[0].beneficiaryId).toBe('dylon-id');
  });

  it('parses compound condition: age + event', () => {
    reset();
    const personsByName = new Map([['dylon', 'dylon-id']]);
    const { interests } = parseWill(
      'devise my home to Dylon when he turns 22 years old and only if Dylon goes to college.',
      personsByName
    );
    expect(interests.length).toBe(1);
    expect(interests[0].vestingCondition.ageRequirement).toBe(22);
    expect(interests[0].vestingCondition.eventDescription).toContain('goes to college');
  });

  it('parses the FULL user scenario correctly', () => {
    reset();
    const { tree, will, errors } = parseInputs(
      'Thomas (testator, deceased). Bob (Thomas\'s friend, alive, age 50). Dylon (son of Thomas, alive, age 5)',
      'I, Thomas, devise Greenacre to the City of Springfield, but if the land is ever not used as a public park, then to my friend Bob. I also devise my home to Dylon when he turns 22 years old and only if Dylon goes to college.'
    );

    // Tree should have 3 persons with correct relationships
    expect(tree.persons.size).toBe(3);

    // Will should have interests from BOTH dispositions
    // Disposition 1: fee simple to City + executory to Bob
    // Disposition 2: contingent interest to Dylon (age 22 + college)
    expect(will.interests.length).toBeGreaterThanOrEqual(2);

    // Check executory interest to Bob exists
    const execBob = will.interests.find(i =>
      i.type === InterestType.EXECUTORY_INTEREST_SHIFTING
    );
    expect(execBob).toBeDefined();

    // Check Dylon's contingent interest
    const dylonInterest = will.interests.find(i =>
      i.beneficiaryId && tree.persons.get(i.beneficiaryId)?.name === 'Dylon'
    );
    expect(dylonInterest).toBeDefined();
    expect(dylonInterest.vestingCondition.ageRequirement).toBe(22);
  });

  it('does NOT match lowercase words as beneficiary names', () => {
    reset();
    const personsByName = new Map([['alice', 'alice-id']]);
    const { interests } = parseWill(
      'to Alice for life',
      personsByName
    );
    expect(interests.length).toBe(1);
    expect(interests[0].label).not.toContain('my');
    expect(interests[0].label).not.toContain('the');
  });

  it('parses life estate → remainder chain', () => {
    reset();
    const personsByName = new Map([['alice', 'alice-id'], ['bob', 'bob-id']]);
    const { interests } = parseWill(
      'to Alice for life, then to Bob',
      personsByName
    );
    expect(interests.length).toBe(2);
    expect(interests[0].type).toBe(InterestType.LIFE_ESTATE);
    expect(interests[1].type).toBe(InterestType.VESTED_REMAINDER);
    expect(interests[1].beneficiaryId).toBe('bob-id');
  });

  it('strips preamble "I, Thomas, devise Blackacre to"', () => {
    reset();
    const personsByName = new Map([['alice', 'alice-id'], ['bob', 'bob-id']]);
    const { interests } = parseWill(
      'I, Thomas, devise Blackacre to Alice for life, then to Bob',
      personsByName
    );
    expect(interests.length).toBe(2);
    expect(interests[0].type).toBe(InterestType.LIFE_ESTATE);
    expect(interests[0].label).toContain('Alice');
  });
});
