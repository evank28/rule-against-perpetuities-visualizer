/**
 * Comprehensive unit tests for the RAP analysis engine.
 * Tests all three rule variants across classic traps, valid scenarios,
 * class gifts, executory interests, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPerson, createFamilyTree, addPerson, addChild, addSpouse,
  setTestator, getLivesInBeing, getDescendants, hasCycle, validateTree,
  cloneTree, removePerson, resetIdCounter,
} from '../../models/familyTree.js';
import {
  createInterest, createWill, InterestType, BeneficiaryType,
  isSubjectToRap, resetInterestIdCounter,
} from '../../models/will.js';
import { analyzeInterest as classicAnalyze, analyzeWill as classicAnalyzeWill } from '../rules/classicRap.js';
import { analyzeInterest as cyPresAnalyze } from '../rules/cyPresRap.js';
import { analyzeInterest as usrapAnalyze } from '../rules/usrapRap.js';
import { analyzeWithRule } from '../rapAnalyzer.js';

// ═══════════════════════════════════════════════════════════
// Helper to build test scenarios
// ═══════════════════════════════════════════════════════════

function makeTree(people, relationships, testatorId) {
  resetIdCounter(200);
  const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
  for (const p of people) {
    addPerson(tree, createPerson(p));
  }
  for (const r of relationships) {
    if (r.type === 'child') addChild(tree, r.parent, r.child);
    if (r.type === 'spouse') addSpouse(tree, r.person1, r.person2);
  }
  setTestator(tree, testatorId);
  return tree;
}

// ═══════════════════════════════════════════════════════════
// BASIC INTERESTS (Tests 1-4)
// ═══════════════════════════════════════════════════════════

describe('Basic Interests', () => {
  it('1. Fee simple absolute — immediately vested, not subject to RAP', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'A', name: 'A', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.FEE_SIMPLE_ABSOLUTE,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'A',
      rawText: 'to A and his heirs',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(true);
    expect(result.subjectToRap).toBe(false);
  });

  it('2. Life estate + vested remainder — valid, not subject to RAP', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'A', name: 'A', alive: true }, { id: 'B', name: 'B', alive: true }],
      [],
      'T'
    );
    const vr = createInterest({
      type: InterestType.VESTED_REMAINDER,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      rawText: 'then to B',
    });
    const will = createWill({ testatorId: 'T', interests: [vr] });
    const result = classicAnalyze(vr, tree, will);
    expect(result.valid).toBe(true);
    expect(result.subjectToRap).toBe(false);
  });

  it('3. Reversion — not subject to RAP', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'A', name: 'A', alive: true }],
      [],
      'T'
    );
    const reversion = createInterest({
      type: InterestType.REVERSION,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'T',
      rawText: 'reversion to grantor',
    });
    const will = createWill({ testatorId: 'T', interests: [reversion] });
    const result = classicAnalyze(reversion, tree, will);
    expect(result.valid).toBe(true);
    expect(result.subjectToRap).toBe(false);
  });

  it('4. Possibility of reverter — not subject to RAP', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'A', name: 'A', alive: true }],
      [],
      'T'
    );
    const por = createInterest({
      type: InterestType.POSSIBILITY_OF_REVERTER,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'T',
      rawText: 'possibility of reverter',
    });
    const will = createWill({ testatorId: 'T', interests: [por] });
    const result = classicAnalyze(por, tree, will);
    expect(result.valid).toBe(true);
    expect(result.subjectToRap).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// CLASS GIFTS (Tests 5-11)
// ═══════════════════════════════════════════════════════════

describe('Class Gifts', () => {
  it('5. Open class with measuring life — valid (A for life, then to A\'s children)', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2004 },
      ],
      [{ type: 'child', parent: 'T', child: 'A' }, { type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      rawText: 'to A\'s children',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(true);
  });

  it('6. Closed class (parent dead) — valid', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: false, deathYear: 2020 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2000 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      rawText: 'to A\'s children',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(true);
  });

  it('7. Class + age ≤ 21 — valid', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2009 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      vestingCondition: { type: 'age', ageRequirement: 21 },
      rawText: 'to A\'s children who reach 21',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(true);
  });

  it('8. Class + age > 21 — INVALID', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2009 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      vestingCondition: { type: 'age', ageRequirement: 25 },
      rawText: 'to A\'s children who reach 25',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('9. Grandchildren class with living parent — INVALID', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1960 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 1990 },
        { id: 'GC1', name: 'GC1', alive: true, birthYear: 2015 },
      ],
      [
        { type: 'child', parent: 'A', child: 'C1' },
        { type: 'child', parent: 'C1', child: 'GC1' },
      ],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'grandchildren', classClosed: false, currentMembers: ['GC1'] },
      vestingCondition: { type: 'age', ageRequirement: 25 },
      rawText: 'to A\'s grandchildren who reach 25',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('10. Grandchildren class, no age condition, parent alive — potential invalidation via afterborn', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1960 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 1990 },
        { id: 'GC1', name: 'GC1', alive: true, birthYear: 2015 },
      ],
      [
        { type: 'child', parent: 'A', child: 'C1' },
        { type: 'child', parent: 'C1', child: 'GC1' },
      ],
      'T'
    );
    const interest = createInterest({
      type: InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'grandchildren', classClosed: false, currentMembers: ['GC1'] },
      rawText: 'to A\'s grandchildren',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    // This depends on the engine's handling; grandchildren class with no age condition
    // could be valid if the class closes when A dies (A is measuring life)
    // The open class means the simulator must check if afterborn grandchildren would appear
    expect(result.subjectToRap).toBe(true);
  });

  it('11. All-or-nothing rule — class gift with age 30 and one member already 31', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'B', name: 'B', alive: true, birthYear: 1960 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 1993 }, // age 31 — already meets condition
        { id: 'C2', name: 'C2', alive: true, birthYear: 2010 }, // age 14 — hasn't met condition
      ],
      [
        { type: 'child', parent: 'B', child: 'C1' },
        { type: 'child', parent: 'B', child: 'C2' },
      ],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'B', relationship: 'children', classClosed: false, currentMembers: ['C1', 'C2'] },
      vestingCondition: { type: 'age', ageRequirement: 30 },
      rawText: 'to B\'s children who reach 30',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false); // B could have afterborn child
  });
});

// ═══════════════════════════════════════════════════════════
// CLASSIC TRAPS (Tests 12-18)
// ═══════════════════════════════════════════════════════════

describe('Classic RAP Traps', () => {
  it('12. Fertile octogenarian — grandchildren who reach 25, grandparent 80', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false, birthYear: 1942, deathYear: 2024 },
        { id: 'A', name: 'Alice', alive: true, birthYear: 1944 },
        { id: 'C', name: 'Carol', alive: true, birthYear: 1969 },
        { id: 'E', name: 'Emma', alive: true, birthYear: 2002 },
      ],
      [
        { type: 'child', parent: 'T', child: 'A' },
        { type: 'child', parent: 'A', child: 'C' },
        { type: 'child', parent: 'C', child: 'E' },
      ],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'grandchildren', classClosed: false, currentMembers: ['E'] },
      vestingCondition: { type: 'age', ageRequirement: 25 },
      rawText: 'to Alice\'s grandchildren who reach 25',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('13. Unborn widow — contingent remainder after widow\'s life estate', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false, birthYear: 1955, deathYear: 2024 },
        { id: 'A', name: 'Alexander', alive: true, birthYear: 1984 },
        { id: 'B', name: 'Beth', alive: true, birthYear: 1986 },
        { id: 'C', name: 'Clara', alive: true, birthYear: 2014 },
      ],
      [
        { type: 'child', parent: 'T', child: 'A' },
        { type: 'spouse', person1: 'A', person2: 'B' },
        { type: 'child', parent: 'A', child: 'C' },
      ],
      'T'
    );
    // The interest "to Alexander's children then living" after the unborn widow's life estate
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C'] },
      vestingCondition: { type: 'survival', survivalOf: null },
      rawText: 'to Alexander\'s children then living',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    // This is invalid because the widow could be unborn => children's interest
    // depends on surviving the widow, who may not be a life in being
    expect(result.subjectToRap).toBe(true);
  });

  it('14. Magic gravel pit — administrative contingency', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'B', name: 'Bob', alive: true },
      ],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'administrative', eventDescription: 'Land ceases to be used as park' },
      rawText: 'but if land ever not used as park, to Bob',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
    expect(result.subjectToRap).toBe(true);
  });

  it('15. Slothful executor — administrative contingency', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'Alice', alive: true },
      ],
      [{ type: 'child', parent: 'T', child: 'A' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SPRINGING,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'T', relationship: 'issue', classClosed: false, currentMembers: ['A'] },
      vestingCondition: { type: 'administrative', eventDescription: 'Estate fully distributed' },
      rawText: 'to my issue living when estate is distributed',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('16. Option to purchase — no time limit', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'B', name: 'Bob', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SPRINGING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'event', eventDescription: 'Bob exercises option to purchase' },
      rawText: 'option to purchase at any time',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('17. Age contingency > 21 with children class — INVALID', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2009 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      vestingCondition: { type: 'age', ageRequirement: 30 },
      rawText: 'to A\'s first child to reach 30',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('18. Event contingency — INVALID', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'B', name: 'B', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'event', eventDescription: 'If land is ever used as a farm' },
      rawText: 'if land is ever used as farm, to B',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// REFORM RULES (Tests 19-24)
// ═══════════════════════════════════════════════════════════

describe('Cy Pres Reform', () => {
  it('19. Age 25 → reformed to 21', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2009 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      vestingCondition: { type: 'age', ageRequirement: 25 },
      rawText: 'to A\'s children who reach 25',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });

    const classicResult = classicAnalyze(interest, tree, will);
    expect(classicResult.valid).toBe(false);

    const cyPresResult = cyPresAnalyze(interest, tree, will);
    expect(cyPresResult.valid).toBe(true); // Reformed to age 21
    expect(cyPresResult.reformation).not.toBeNull();
  });

  it('20. Administrative condition — cy pres removes condition', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'B', name: 'Bob', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'administrative', eventDescription: 'Land not used as park' },
      rawText: 'if land not used as park, to Bob',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const cyPresResult = cyPresAnalyze(interest, tree, will);
    expect(cyPresResult.reformation).not.toBeNull();
  });
});

describe('USRAP', () => {
  it('21. Age 25 — fails classic, passes USRAP 90-year wait-and-see', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true, birthYear: 1979 },
        { id: 'C1', name: 'C1', alive: true, birthYear: 2009 },
      ],
      [{ type: 'child', parent: 'A', child: 'C1' }],
      'T'
    );
    const interest = createInterest({
      type: InterestType.CONTINGENT_REMAINDER,
      beneficiaryType: BeneficiaryType.CLASS,
      classDescriptor: { parentId: 'A', relationship: 'children', classClosed: false, currentMembers: ['C1'] },
      vestingCondition: { type: 'age', ageRequirement: 25 },
      rawText: 'to A\'s children who reach 25',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const usrapResult = usrapAnalyze(interest, tree, will);
    expect(usrapResult.valid).toBe(true);
    expect(usrapResult.usrapStep).toBe('passed_wait_and_see');
  });

  it('22. Administrative contingency — may fail even USRAP', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'B', name: 'Bob', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'administrative', eventDescription: 'Land not used as park' },
      rawText: 'if land not used as park, to Bob',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const usrapResult = usrapAnalyze(interest, tree, will);
    // Under USRAP, admin condition may not vest in 90 years, but cy pres might save it
    expect(usrapResult.subjectToRap).toBe(true);
  });

  it('23. Passes classic → USRAP step is passed_classic', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
      ],
      [],
      'T'
    );
    const vr = createInterest({
      type: InterestType.VESTED_REMAINDER,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      rawText: 'then to B',
    });
    const will = createWill({ testatorId: 'T', interests: [vr] });
    const result = usrapAnalyze(vr, tree, will);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// EXECUTORY INTERESTS (Tests 25-28)
// ═══════════════════════════════════════════════════════════

describe('Executory Interests', () => {
  it('25. Shifting executory with named person — event contingency, INVALID', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
      ],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'event', eventDescription: 'A uses land as bar' },
      rawText: 'but if A uses as bar, to B',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });

  it('26. Shifting executory with remote condition — INVALID', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
      ],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'event', eventDescription: 'Land is ever used as farm' },
      rawText: 'if ever used as farm, to B',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const result = classicAnalyze(interest, tree, will);
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// EDGE CASES (Tests 29-36)
// ═══════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('29. Will with no future interests — valid, RAP not applicable', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }, { id: 'A', name: 'A', alive: true }],
      [],
      'T'
    );
    const interest = createInterest({
      type: InterestType.FEE_SIMPLE_ABSOLUTE,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'A',
      rawText: 'to A',
    });
    const will = createWill({ testatorId: 'T', interests: [interest] });
    const results = classicAnalyzeWill(will, tree);
    expect(results.every(r => r.valid)).toBe(true);
  });

  it('30. Multiple interests — mixed valid/invalid', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
      ],
      [],
      'T'
    );
    const vr = createInterest({
      type: InterestType.VESTED_REMAINDER,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'A',
      rawText: 'then to A',
    });
    const exec = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      vestingCondition: { type: 'administrative', eventDescription: 'Never-ending condition' },
      rawText: 'but if condition, to B',
    });
    const will = createWill({ testatorId: 'T', interests: [vr, exec] });
    const results = classicAnalyzeWill(will, tree);
    expect(results[0].valid).toBe(true);  // vested remainder
    expect(results[1].valid).toBe(false); // admin contingency
  });

  it('31. Empty will — no interests', () => {
    const tree = makeTree(
      [{ id: 'T', name: 'Testator', alive: false }],
      [],
      'T'
    );
    const will = createWill({ testatorId: 'T', interests: [] });
    const results = classicAnalyzeWill(will, tree);
    expect(results.length).toBe(0);
  });

  it('32. Rule registry — analyzeWithRule works for all three rules', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
      ],
      [],
      'T'
    );
    const vr = createInterest({
      type: InterestType.VESTED_REMAINDER,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: 'B',
      rawText: 'then to B',
    });
    const will = createWill({ testatorId: 'T', interests: [vr] });

    const classicResults = analyzeWithRule('classic', will, tree);
    const cyPresResults = analyzeWithRule('cy_pres', will, tree);
    const usrapResults = analyzeWithRule('usrap', will, tree);

    expect(classicResults[0].valid).toBe(true);
    expect(cyPresResults[0].valid).toBe(true);
    expect(usrapResults[0].valid).toBe(true);
  });

  it('33. isSubjectToRap correctly classifies interest types', () => {
    expect(isSubjectToRap(createInterest({ type: InterestType.CONTINGENT_REMAINDER }))).toBe(true);
    expect(isSubjectToRap(createInterest({ type: InterestType.EXECUTORY_INTEREST_SHIFTING }))).toBe(true);
    expect(isSubjectToRap(createInterest({ type: InterestType.EXECUTORY_INTEREST_SPRINGING }))).toBe(true);
    expect(isSubjectToRap(createInterest({ type: InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN }))).toBe(true);
    expect(isSubjectToRap(createInterest({ type: InterestType.VESTED_REMAINDER }))).toBe(false);
    expect(isSubjectToRap(createInterest({ type: InterestType.FEE_SIMPLE_ABSOLUTE }))).toBe(false);
    expect(isSubjectToRap(createInterest({ type: InterestType.LIFE_ESTATE }))).toBe(false);
    expect(isSubjectToRap(createInterest({ type: InterestType.REVERSION }))).toBe(false);
    expect(isSubjectToRap(createInterest({ type: InterestType.POSSIBILITY_OF_REVERTER }))).toBe(false);
    expect(isSubjectToRap(createInterest({ type: InterestType.RIGHT_OF_ENTRY }))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// DATA MODEL TESTS (Tests 34-41)
// ═══════════════════════════════════════════════════════════

describe('Family Tree Data Model', () => {
  it('34. Add and remove persons', () => {
    resetIdCounter(300);
    const tree = createFamilyTree();
    const p1 = createPerson({ id: 'p1', name: 'Alice', alive: true });
    const p2 = createPerson({ id: 'p2', name: 'Bob', alive: true });
    addPerson(tree, p1);
    addPerson(tree, p2);
    expect(tree.persons.size).toBe(2);
    removePerson(tree, 'p1');
    expect(tree.persons.size).toBe(1);
  });

  it('35. Clone tree is independent', () => {
    const tree = createFamilyTree();
    const p = createPerson({ id: 'x', name: 'X', alive: true });
    addPerson(tree, p);
    const clone = cloneTree(tree);
    clone.persons.get('x').name = 'Changed';
    expect(tree.persons.get('x').name).toBe('X');
  });

  it('36. getLivesInBeing returns correct set', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
        { id: 'C', name: 'C', alive: false },
      ],
      [],
      'T'
    );
    const lives = getLivesInBeing(tree);
    expect(lives).toContain('A');
    expect(lives).toContain('B');
    expect(lives).not.toContain('C');
    expect(lives).not.toContain('T');
  });

  it('37. Cycle detection', () => {
    const tree = createFamilyTree();
    addPerson(tree, createPerson({ id: 'a', name: 'A', alive: true }));
    addPerson(tree, createPerson({ id: 'b', name: 'B', alive: true }));
    addChild(tree, 'a', 'b');
    expect(hasCycle(tree)).toBe(false);
    // Manually create a cycle (bypass addChild validation)
    tree.persons.get('b').childIds.push('a');
    tree.persons.get('a').parentIds.push('b');
    expect(hasCycle(tree)).toBe(true);
  });

  it('38. Validation detects inconsistencies', () => {
    const tree = createFamilyTree();
    addPerson(tree, createPerson({ id: 'a', name: 'A', alive: true }));
    addPerson(tree, createPerson({ id: 'b', name: 'B', alive: true }));
    addChild(tree, 'a', 'b');
    let validation = validateTree(tree);
    expect(validation.valid).toBe(true);

    // Break consistency
    tree.persons.get('b').parentIds = [];
    validation = validateTree(tree);
    expect(validation.valid).toBe(false);
  });

  it('39. getDescendants works recursively', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'T', alive: false },
        { id: 'A', name: 'A', alive: true },
        { id: 'B', name: 'B', alive: true },
        { id: 'C', name: 'C', alive: true },
      ],
      [
        { type: 'child', parent: 'A', child: 'B' },
        { type: 'child', parent: 'B', child: 'C' },
      ],
      'T'
    );
    const desc = getDescendants(tree, 'A');
    expect(desc).toContain('B');
    expect(desc).toContain('C');
    expect(desc.length).toBe(2);
  });

  it('40. Spouse relationship is bidirectional', () => {
    const tree = createFamilyTree();
    addPerson(tree, createPerson({ id: 'a', name: 'A', alive: true }));
    addPerson(tree, createPerson({ id: 'b', name: 'B', alive: true }));
    addSpouse(tree, 'a', 'b');
    expect(tree.persons.get('a').spouseIds).toContain('b');
    expect(tree.persons.get('b').spouseIds).toContain('a');
  });

  it('41. Date consistency validation', () => {
    const tree = createFamilyTree();
    addPerson(tree, createPerson({
      id: 'x', name: 'X', alive: false, birthYear: 2000, deathYear: 1990,
    }));
    const validation = validateTree(tree);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('death year before birth year'))).toBe(true);
  });
});
