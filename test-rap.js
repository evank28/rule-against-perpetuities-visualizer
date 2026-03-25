import { createFamilyTree, createPerson, addPerson, setTestator, addChild } from './src/models/familyTree.js';
import { createWill, createInterest, InterestType, BeneficiaryType } from './src/models/will.js';
import { analyzeWithRule } from './src/engine/rapAnalyzer.js';

const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
const thomas = createPerson({ id: 'thomas', name: 'Thomas', alive: false, birthYear: 1960, deathYear: 2024, gender: 'male' });
const bob    = createPerson({ id: 'bob',    name: 'Bob',    alive: true,  birthYear: 1974, gender: 'male' });
const dylon  = createPerson({ id: 'dylon',  name: 'Dylon',  alive: true,  birthYear: 2019, gender: 'male' });

addPerson(tree, thomas);
addPerson(tree, bob);
addPerson(tree, dylon);
addChild(tree, 'thomas', 'dylon');
setTestator(tree, 'thomas');

const interests = [
  createInterest({
    id: 'springing_dylon',
    type: InterestType.EXECUTORY_INTEREST_SPRINGING,
    beneficiaryType: BeneficiaryType.PERSON,
    beneficiaryId: 'dylon',
    vestingCondition: { type: 'age', ageRequirement: 28, eventDescription: 'goes to college', survivalOf: null },
    rawText: 'to Dylon when he turns 28',
    label: 'Contingent Interest to Dylon',
  })
];

const will = createWill({ testatorId: 'thomas', dateOfWill: tree.dateOfDeath, interests });
const results = analyzeWithRule('classic', will, tree);

console.log(JSON.stringify(results, null, 2));

