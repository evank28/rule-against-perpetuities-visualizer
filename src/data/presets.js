/**
 * Preset scenarios for RAP analysis.
 * Each preset includes cached symbolic forms (pre-parsed family tree + interests)
 * so the parser is bypassed entirely for instant loading.
 */

import { createPerson, createFamilyTree, addPerson, addChild, addSpouse, setTestator } from '../models/familyTree.js';
import { createInterest, createWill, InterestType, BeneficiaryType } from '../models/will.js';

/**
 * Build a preset scenario with cached symbolic form.
 */
function buildPreset({ 
  id, name, description, familyText, willText, 
  buildFamily, buildInterests, expectedResult, trapName 
}) {
  return {
    id,
    name,
    description,
    familyText,
    willText,
    expectedResult,
    trapName,
    /** Build the cached symbolic form on demand */
    build() {
      const tree = buildFamily();
      const interests = buildInterests(tree);
      const will = createWill({
        testatorId: tree.testatorId,
        dateOfWill: tree.dateOfWill,
        interests,
        rawText: willText,
      });
      return { tree, will };
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PRESET 1: Fertile Octogenarian
// ─────────────────────────────────────────────────────────────
const fertileOctogenarian = buildPreset({
  id: 'fertile_octogenarian',
  name: 'Fertile Octogenarian',
  trapName: 'Fertile Octogenarian',
  description:
    'Thomas devises Blackacre "to Alice for life, then to such of Alice\'s grandchildren who reach the age of 25." ' +
    'Alice is 80 years old. Despite her age, the common law conclusively presumes that Alice can still have children. ' +
    'A hypothetical afterborn child of Alice could have a grandchild who would not reach 25 within 21 years of ' +
    'any life in being\'s death. The interest violates the classic RAP.',
  familyText:
    'Thomas (the testator, deceased, age 82) was married to Martha (deceased, age 78). ' +
    'They have one child: Alice (alive, age 80). Alice is married to Henry (alive, age 82). ' +
    'Alice has two children: Carol (alive, age 55) and David (alive, age 50). ' +
    'Carol has one child: Emma (alive, age 22).',
  willText:
    'I, Thomas, devise Blackacre to Alice for life, then to such of Alice\'s grandchildren who reach the age of 25.',
  expectedResult: 'invalid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas  = createPerson({ id: 'thomas',  name: 'Thomas',  alive: false, birthYear: 1942, deathYear: 2024, gender: 'male' });
    const martha  = createPerson({ id: 'martha',  name: 'Martha',  alive: false, birthYear: 1946, deathYear: 2020, gender: 'female' });
    const alice   = createPerson({ id: 'alice',   name: 'Alice',   alive: true,  birthYear: 1944, gender: 'female' });
    const henry   = createPerson({ id: 'henry',   name: 'Henry',   alive: true,  birthYear: 1942, gender: 'male' });
    const carol   = createPerson({ id: 'carol',   name: 'Carol',   alive: true,  birthYear: 1969, gender: 'female' });
    const david   = createPerson({ id: 'david',   name: 'David',   alive: true,  birthYear: 1974, gender: 'male' });
    const emma    = createPerson({ id: 'emma',    name: 'Emma',    alive: true,  birthYear: 2002, gender: 'female' });

    addPerson(tree, thomas);
    addPerson(tree, martha);
    addPerson(tree, alice);
    addPerson(tree, henry);
    addPerson(tree, carol);
    addPerson(tree, david);
    addPerson(tree, emma);

    addSpouse(tree, 'thomas', 'martha');
    addSpouse(tree, 'alice', 'henry');
    addChild(tree, 'thomas', 'alice');
    addChild(tree, 'martha', 'alice');
    addChild(tree, 'alice', 'carol');
    addChild(tree, 'alice', 'david');
    addChild(tree, 'henry', 'carol');
    addChild(tree, 'henry', 'david');
    addChild(tree, 'carol', 'emma');

    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'life_estate_alice',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alice',
        rawText: 'to Alice for life',
        label: 'Life Estate to Alice',
      }),
      createInterest({
        id: 'grandchildren_25',
        type: InterestType.CONTINGENT_REMAINDER,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'alice',
          relationship: 'grandchildren',
          classClosed: false,
          currentMembers: ['emma'],
        },
        vestingCondition: { type: 'age', ageRequirement: 25, eventDescription: null, survivalOf: null },
        precedingInterestId: 'life_estate_alice',
        rawText: 'then to such of Alice\'s grandchildren who reach the age of 25',
        label: 'Contingent Remainder to Alice\'s Grandchildren (age 25)',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 2: Unborn Widow
// ─────────────────────────────────────────────────────────────
const unbornWidow = buildPreset({
  id: 'unborn_widow',
  name: 'Unborn Widow',
  trapName: 'Unborn Widow',
  description:
    'Thomas devises "to my son Alexander for life, then to Alexander\'s widow for life, then to ' +
    'Alexander\'s children then living." Alexander\'s current wife may predecease him or they may divorce, ' +
    'and Alexander could marry someone not yet born at the time of Thomas\'s death. That "unborn widow" ' +
    'would not be a life in being, and Alexander\'s children living at the widow\'s death may not be ' +
    'identifiable within any life in being + 21 years.',
  familyText:
    'Thomas (testator, deceased). Alexander (Thomas\'s son, alive, age 40). ' +
    'Beth (Alexander\'s wife, alive, age 38). ' +
    'They have one child: Clara (alive, age 10).',
  willText:
    'I, Thomas, devise Blackacre to my son Alexander for life, then to Alexander\'s widow for life, ' +
    'then to Alexander\'s children then living.',
  expectedResult: 'invalid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas    = createPerson({ id: 'thomas',    name: 'Thomas',    alive: false, birthYear: 1955, deathYear: 2024, gender: 'male' });
    const alexander = createPerson({ id: 'alexander', name: 'Alexander', alive: true,  birthYear: 1984, gender: 'male' });
    const beth      = createPerson({ id: 'beth',      name: 'Beth',      alive: true,  birthYear: 1986, gender: 'female' });
    const clara     = createPerson({ id: 'clara',     name: 'Clara',     alive: true,  birthYear: 2014, gender: 'female' });

    addPerson(tree, thomas);
    addPerson(tree, alexander);
    addPerson(tree, beth);
    addPerson(tree, clara);

    addChild(tree, 'thomas', 'alexander');
    addSpouse(tree, 'alexander', 'beth');
    addChild(tree, 'alexander', 'clara');
    addChild(tree, 'beth', 'clara');

    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'le_alexander',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alexander',
        rawText: 'to Alexander for life',
        label: 'Life Estate to Alexander',
      }),
      createInterest({
        id: 'le_widow',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: null, // unknown widow
        vestingCondition: { type: 'survival', ageRequirement: null, eventDescription: null, survivalOf: 'alexander' },
        precedingInterestId: 'le_alexander',
        rawText: 'then to Alexander\'s widow for life',
        label: 'Life Estate to Alexander\'s Widow',
      }),
      createInterest({
        id: 'children_at_widow_death',
        type: InterestType.CONTINGENT_REMAINDER,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'alexander',
          relationship: 'children',
          classClosed: false,
          currentMembers: ['clara'],
        },
        vestingCondition: { type: 'survival', ageRequirement: null, eventDescription: null, survivalOf: null },
        precedingInterestId: 'le_widow',
        rawText: 'then to Alexander\'s children then living',
        label: 'Contingent Remainder to Alexander\'s Children (surviving widow)',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 3: Magic Gravel Pit / Administrative Contingency
// ─────────────────────────────────────────────────────────────
const magicGravelPit = buildPreset({
  id: 'magic_gravel_pit',
  name: 'Magic Gravel Pit',
  trapName: 'Administrative Contingency',
  description:
    'Thomas devises "to the City of Springfield, but if the land is ever not used as a public park, ' +
    'then to my friend Bob." The condition ("ever not used as a park") is an administrative contingency ' +
    'with no tie to any life in being. It could occur 200 years from now. Under classic RAP, this ' +
    'executory interest is void.',
  familyText:
    'Thomas (testator, deceased). Bob (Thomas\'s friend, alive, age 50).',
  willText:
    'I, Thomas, devise Greenacre to the City of Springfield, but if the land is ever not used ' +
    'as a public park, then to my friend Bob.',
  expectedResult: 'invalid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1974, gender: 'male' });
    addPerson(tree, thomas);
    addPerson(tree, bob);
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'fsd_city',
        type: InterestType.FEE_SIMPLE_SUBJECT_TO_EL,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: null,
        rawText: 'to the City of Springfield (so long as used as park)',
        label: 'Fee Simple Subject to Executory Limitation (City)',
      }),
      createInterest({
        id: 'exec_bob',
        type: InterestType.EXECUTORY_INTEREST_SHIFTING,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'bob',
        vestingCondition: { type: 'administrative', ageRequirement: null, eventDescription: 'Land is no longer used as a public park', survivalOf: null },
        precedingInterestId: 'fsd_city',
        rawText: 'but if ever not used as a park, then to Bob',
        label: 'Shifting Executory Interest to Bob',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 4: Slothful Executor
// ─────────────────────────────────────────────────────────────
const slothfulExecutor = buildPreset({
  id: 'slothful_executor',
  name: 'Slothful Executor',
  trapName: 'Slothful Executor',
  description:
    'Thomas devises "to my issue living when my estate is fully distributed." Estate administration ' +
    'can theoretically take an indefinite amount of time. The distribution could occur beyond the lifetime ' +
    'of all persons alive at Thomas\'s death + 21 years.',
  familyText:
    'Thomas (testator, deceased). Alice (daughter, alive, age 35). Bob (son, alive, age 30).',
  willText:
    'I, Thomas, devise Whiteacre to my issue living when my estate is fully distributed.',
  expectedResult: 'invalid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
    const alice  = createPerson({ id: 'alice',  name: 'Alice',  alive: true,  birthYear: 1989, gender: 'female' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1994, gender: 'male' });
    addPerson(tree, thomas);
    addPerson(tree, alice);
    addPerson(tree, bob);
    addChild(tree, 'thomas', 'alice');
    addChild(tree, 'thomas', 'bob');
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'issue_at_distribution',
        type: InterestType.EXECUTORY_INTEREST_SPRINGING,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'thomas',
          relationship: 'issue',
          classClosed: false,
          currentMembers: ['alice', 'bob'],
        },
        vestingCondition: { type: 'administrative', ageRequirement: null, eventDescription: 'Estate is fully distributed', survivalOf: null },
        rawText: 'to my issue living when my estate is fully distributed',
        label: 'Springing Executory Interest to Thomas\'s Issue',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 5: Precocious Toddler
// ─────────────────────────────────────────────────────────────
const precociousToddler = buildPreset({
  id: 'precocious_toddler',
  name: 'Precocious Toddler',
  trapName: 'Precocious Toddler',
  description:
    'Thomas devises "income to Alice for life, then principal to Alice\'s grandchildren who reach 21." ' +
    'Alice is a 65-year-old widow with two children and one grandchild. Despite her age, Alice could ' +
    'hypothetically have another child (fertile octogenarian). That afterborn child could then have a child ' +
    '(the "precocious toddler") who would be an afterborn grandchild. This grandchild would need to reach ' +
    '21, but might not do so within 21 years of any life in being\'s death.',
  familyText:
    'Thomas (testator, deceased). Alice (alive, age 65, widow). ' +
    'Alice has two children: Bob (alive, age 40), Carol (alive, age 38). ' +
    'Bob has one child: Danny (alive, age 15).',
  willText:
    'I, Thomas, devise: pay income from Blackacre to Alice for life, then pay the principal to ' +
    'such of Alice\'s grandchildren who reach the age of 21.',
  expectedResult: 'invalid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1950, deathYear: 2024, gender: 'male' });
    const alice  = createPerson({ id: 'alice',  name: 'Alice',  alive: true,  birthYear: 1959, gender: 'female' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1984, gender: 'male' });
    const carol  = createPerson({ id: 'carol',  name: 'Carol',  alive: true,  birthYear: 1986, gender: 'female' });
    const danny  = createPerson({ id: 'danny',  name: 'Danny',  alive: true,  birthYear: 2009, gender: 'male' });
    addPerson(tree, thomas);
    addPerson(tree, alice);
    addPerson(tree, bob);
    addPerson(tree, carol);
    addPerson(tree, danny);
    addChild(tree, 'thomas', 'alice');
    addChild(tree, 'alice', 'bob');
    addChild(tree, 'alice', 'carol');
    addChild(tree, 'bob', 'danny');
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'le_alice',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alice',
        rawText: 'income to Alice for life',
        label: 'Life Estate (income) to Alice',
      }),
      createInterest({
        id: 'grandchildren_21',
        type: InterestType.CONTINGENT_REMAINDER,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'alice',
          relationship: 'grandchildren',
          classClosed: false,
          currentMembers: ['danny'],
        },
        vestingCondition: { type: 'age', ageRequirement: 21, eventDescription: null, survivalOf: null },
        precedingInterestId: 'le_alice',
        rawText: 'then principal to Alice\'s grandchildren who reach 21',
        label: 'Contingent Remainder to Alice\'s Grandchildren (age 21)',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 6: Simple Valid Remainder
// ─────────────────────────────────────────────────────────────
const simpleValidRemainder = buildPreset({
  id: 'simple_valid',
  name: 'Simple Valid Remainder',
  trapName: null,
  description:
    'Thomas devises "to Alice for life, then to Bob." This is a textbook valid disposition. ' +
    'Bob has a vested remainder — his interest is ascertained and not subject to any condition precedent. ' +
    'Vested remainders are not subject to RAP, so this is automatically valid.',
  familyText:
    'Thomas (testator, deceased). Alice (alive, age 60). Bob (alive, age 55).',
  willText:
    'I, Thomas, devise Blackacre to Alice for life, then to Bob.',
  expectedResult: 'valid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
    const alice  = createPerson({ id: 'alice',  name: 'Alice',  alive: true,  birthYear: 1964, gender: 'female' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1969, gender: 'male' });
    addPerson(tree, thomas);
    addPerson(tree, alice);
    addPerson(tree, bob);
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'le_alice',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alice',
        rawText: 'to Alice for life',
        label: 'Life Estate to Alice',
      }),
      createInterest({
        id: 'vr_bob',
        type: InterestType.VESTED_REMAINDER,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'bob',
        precedingInterestId: 'le_alice',
        rawText: 'then to Bob',
        label: 'Vested Remainder to Bob',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 7: Class Gift (Open Class, Valid)
// ─────────────────────────────────────────────────────────────
const classGiftValid = buildPreset({
  id: 'class_gift_valid',
  name: 'Class Gift (Valid)',
  trapName: null,
  description:
    'Thomas devises "to Alice for life, then to Alice\'s children." Alice is alive. ' +
    'Alice herself serves as the measuring life. Her class of children will close at her death, ' +
    'and all children are ascertainable at that point. The interest vests no later than Alice\'s death — ' +
    'well within the perpetuities period.',
  familyText:
    'Thomas (testator, deceased). Alice (alive, age 45). ' +
    'Alice has two children: Bob (alive, age 20) and Carol (alive, age 18).',
  willText:
    'I, Thomas, devise Blackacre to Alice for life, then to Alice\'s children.',
  expectedResult: 'valid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
    const alice  = createPerson({ id: 'alice',  name: 'Alice',  alive: true,  birthYear: 1979, gender: 'female' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 2004, gender: 'male' });
    const carol  = createPerson({ id: 'carol',  name: 'Carol',  alive: true,  birthYear: 2006, gender: 'female' });
    addPerson(tree, thomas);
    addPerson(tree, alice);
    addPerson(tree, bob);
    addPerson(tree, carol);
    addChild(tree, 'thomas', 'alice');
    addChild(tree, 'alice', 'bob');
    addChild(tree, 'alice', 'carol');
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'le_alice',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alice',
        rawText: 'to Alice for life',
        label: 'Life Estate to Alice',
      }),
      createInterest({
        id: 'vrso_children',
        type: InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'alice',
          relationship: 'children',
          classClosed: false,
          currentMembers: ['bob', 'carol'],
        },
        precedingInterestId: 'le_alice',
        rawText: 'then to Alice\'s children',
        label: 'Vested Remainder Subject to Open (Alice\'s Children)',
      }),
    ];
  },
});

// ─────────────────────────────────────────────────────────────
// PRESET 8: Age Contingency ≤ 21 (Valid)
// ─────────────────────────────────────────────────────────────
const ageContingencyValid = buildPreset({
  id: 'age_contingency_valid',
  name: 'Age Contingency ≤ 21 (Valid)',
  trapName: null,
  description:
    'Thomas devises "to Alice for life, then to Alice\'s children who reach 21." ' +
    'Alice is alive and serves as the measuring life. Any child of Alice must reach 21 (if ever) ' +
    'within 21 years of Alice\'s death. The latest a child could be born is the moment Alice dies. ' +
    'That child would reach 21 exactly 21 years later. Valid under RAP.',
  familyText:
    'Thomas (testator, deceased). Alice (alive, age 45). ' +
    'Alice has one child: Bob (alive, age 15).',
  willText:
    'I, Thomas, devise Blackacre to Alice for life, then to Alice\'s children who reach the age of 21.',
  expectedResult: 'valid',
  buildFamily() {
    const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
    const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
    const alice  = createPerson({ id: 'alice',  name: 'Alice',  alive: true,  birthYear: 1979, gender: 'female' });
    const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 2009, gender: 'male' });
    addPerson(tree, thomas);
    addPerson(tree, alice);
    addPerson(tree, bob);
    addChild(tree, 'thomas', 'alice');
    addChild(tree, 'alice', 'bob');
    setTestator(tree, 'thomas');
    return tree;
  },
  buildInterests(tree) {
    return [
      createInterest({
        id: 'le_alice',
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: 'alice',
        rawText: 'to Alice for life',
        label: 'Life Estate to Alice',
      }),
      createInterest({
        id: 'cr_children_21',
        type: InterestType.CONTINGENT_REMAINDER,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: {
          parentId: 'alice',
          relationship: 'children',
          classClosed: false,
          currentMembers: ['bob'],
        },
        vestingCondition: { type: 'age', ageRequirement: 21, eventDescription: null, survivalOf: null },
        precedingInterestId: 'le_alice',
        rawText: 'then to Alice\'s children who reach 21',
        label: 'Contingent Remainder to Alice\'s Children (age 21)',
      }),
    ];
  },
});

/**
 * All preset scenarios.
 */
export const presets = [
  fertileOctogenarian,
  unbornWidow,
  magicGravelPit,
  slothfulExecutor,
  precociousToddler,
  simpleValidRemainder,
  classGiftValid,
  ageContingencyValid,
];

/**
 * Get a preset by ID.
 */
export function getPreset(presetId) {
  return presets.find((p) => p.id === presetId) || null;
}
