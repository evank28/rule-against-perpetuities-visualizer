import { parseInputs } from './src/parser/nlParser.js';

const familyText = "Thomas (testator, deceased). Bob (Thomas's friend, alive, age 50). Dylon (son of Thomas, alive, age 5)";
const willText = "I, Thomas, devise Greenacre to the City of Springfield, but if the land is ever not used as a public park, then to my friend Bob. I also devise my home to Bob's first born child, if he has one, when the child turns 28 years old and only if the child goes to college.";
const result = parseInputs(familyText, willText);

console.log(JSON.stringify(result.will.interests, null, 2));

