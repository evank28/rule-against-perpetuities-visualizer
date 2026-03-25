import { createFamilyTree, createPerson, addPerson, setTestator, addChild } from './src/models/familyTree.js';
import { createWill, createInterest, InterestType, BeneficiaryType } from './src/models/will.js';
import { analyzeWithRule } from './src/engine/rapAnalyzer.js';

const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1974, gender: 'male' });
// Note: Bob has no children currently

addPerson(tree, thomas);
addPerson(tree, bob);
setTestator(tree, 'thomas');

const interests = [
  createInterest({
    id: 'springing_bob_child',
    type: InterestType.EXECUTORY_INTEREST_SPRINGING,
    beneficiaryType: BeneficiaryType.CLASS,
    classDescriptor: {
      parentId: 'bob',
      relationship: 'children',
      classClosed: false,
      currentMembers: []
    },
    vestingCondition: { type: 'age', ageRequirement: 28, eventDescription: 'goes to college', survivalOf: null },
    rawText: 'to Bob\'s first born child when the child turns 28',
    label: 'Contingent Interest to Bob',
  })
];

const will = createWill({ testatorId: 'thomas', dateOfWill: tree.dateOfDeath, interests });
const results = analyzeWithRule('classic', will, tree);

console.log(JSON.stringify(results, null, 2));

