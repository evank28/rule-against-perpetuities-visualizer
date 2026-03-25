/**
 * Rule-based natural language parser for family trees and wills.
 * Extracts structured data from guided input formats.
 *
 * === FAMILY PARSER ===
 * Handles:
 * - "Alice (alive, age 45)" or "Bob (deceased)"
 * - "son/daughter/child of X" inside parenthetical attributes
 * - "X's son/daughter/child Y"
 * - "X is married to Y"
 * - "X has N children: A, B, and C"
 * - "They have children: ..."
 * - "X's friend Y" / "friend of X" (parses person, no family edge)
 *
 * === WILL PARSER ===
 * Handles:
 * - "to A for life" → Life Estate
 * - "then to B" → Vested Remainder
 * - "then to A's children" → VRSO
 * - "then to A's children who reach age 25" → Contingent Remainder
 * - "but if [condition], then to B" → Executory Interest
 * - "to X when X turns/reaches N" → Contingent with age condition
 * - "to X if/only if [condition]" → Contingent with event condition
 * - Multiple dispositions via "I also devise" or sentence boundaries
 * - Preamble stripping ("I, Thomas, devise [Property] to")
 * - Compound conditions ("when X turns N and/only if Y")
 */

import {
  createPerson, createFamilyTree, addPerson, addChild, addSpouse, setTestator, generateId
} from '../models/familyTree.js';
import {
  createInterest, createWill, InterestType, BeneficiaryType
} from '../models/will.js';

// ═══════════════════════════════════════════════════════════
// FAMILY TREE PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Parse a natural language family description into a FamilyTree.
 */
export function parseFamilyTree(text) {
  const errors = [];
  const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
  const personsByName = new Map();
  const deferredRelationships = []; // { type: 'child'|'spouse', parentName, childName }

  // Normalize text
  const normalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // ─── PASS 1: Extract persons with parenthetical attributes ───
  // Pattern: Name (attributes)
  // Uses a NON-case-insensitive regex so [A-Z] only matches uppercase
  const personPattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\(([^)]+)\)/g;
  let match;

  while ((match = personPattern.exec(normalized)) !== null) {
    const name = match[1].trim();
    const attrs = match[2].toLowerCase();

    if (personsByName.has(name.toLowerCase())) continue;

    const alive = !attrs.includes('deceased') && !attrs.includes('dead');
    const ageMatch = attrs.match(/age\s*(\d+)/);
    const age = ageMatch ? parseInt(ageMatch[1]) : null;
    const birthYear = age !== null ? 2024 - age : null;
    const deathYear = !alive ? (birthYear ? birthYear + (age || 70) : 2024) : null;

    let gender = 'unknown';
    if (attrs.includes('son') || attrs.includes('husband') || attrs.includes('father') || attrs.includes('brother')) {
      gender = 'male';
    } else if (attrs.includes('daughter') || attrs.includes('wife') || attrs.includes('mother') || attrs.includes('sister')) {
      gender = 'female';
    }

    const isTestator = attrs.includes('testator');

    const id = generateId();
    const person = createPerson({ id, name, alive, birthYear, deathYear, gender });
    addPerson(tree, person);
    personsByName.set(name.toLowerCase(), id);

    if (isTestator) {
      person.alive = false;
      setTestator(tree, id);
    }

    // ─── Extract relationships from inside parenthetical ───
    // "son of Thomas", "daughter of Alice", "child of Bob"
    const childOfMatch = attrs.match(/(?:son|daughter|child)\s+of\s+([a-z]+(?:\s[a-z]+)?)/i);
    if (childOfMatch) {
      const parentName = childOfMatch[1].toLowerCase();
      deferredRelationships.push({ type: 'child', parentName, childName: name.toLowerCase() });
    }

    // "wife of X", "husband of X", "married to X"
    const spouseOfMatch = attrs.match(/(?:wife|husband|spouse)\s+of\s+([a-z]+(?:\s[a-z]+)?)/i);
    if (spouseOfMatch) {
      deferredRelationships.push({ type: 'spouse', person1Name: name.toLowerCase(), person2Name: spouseOfMatch[1].toLowerCase() });
    }
    const marriedToMatch = attrs.match(/married\s+to\s+([a-z]+(?:\s[a-z]+)?)/i);
    if (marriedToMatch) {
      deferredRelationships.push({ type: 'spouse', person1Name: name.toLowerCase(), person2Name: marriedToMatch[1].toLowerCase() });
    }

    // "friend of X" — no family edge, but person is parsed (which is what we want)
    // "X's friend" pattern will also be matched below
  }

  // ─── PASS 2: Apply deferred relationships ───
  for (const rel of deferredRelationships) {
    if (rel.type === 'child') {
      const parentId = personsByName.get(rel.parentName);
      const childId = personsByName.get(rel.childName);
      if (parentId && childId) {
        try { addChild(tree, parentId, childId); } catch (e) { /* already added */ }
      }
    }
    if (rel.type === 'spouse') {
      const id1 = personsByName.get(rel.person1Name);
      const id2 = personsByName.get(rel.person2Name);
      if (id1 && id2) {
        try { addSpouse(tree, id1, id2); } catch (e) { /* already added */ }
      }
    }
  }

  // ─── PASS 3: Extract relationships from text outside parentheses ───

  // "X is married to Y"
  const marriagePattern = /([A-Z][a-z]+)\s+is\s+married\s+to\s+([A-Z][a-z]+)/g;
  while ((match = marriagePattern.exec(normalized)) !== null) {
    const id1 = personsByName.get(match[1].toLowerCase());
    const id2 = personsByName.get(match[2].toLowerCase());
    if (id1 && id2) {
      try { addSpouse(tree, id1, id2); } catch (e) {}
    }
  }

  // "X has N children: A, B, and C" or "X has one child: A"
  const childrenPattern = /([A-Z][a-z]+)\s+(?:has|have)\s+(?:\w+\s+)?child(?:ren)?[:\s]+([^.]+)/g;
  while ((match = childrenPattern.exec(normalized)) !== null) {
    const parentName = match[1].toLowerCase();
    const parentId = personsByName.get(parentName);
    if (!parentId) continue;
    const childNames = match[2].match(/[A-Z][a-z]+/g) || [];
    for (const childName of childNames) {
      const childId = personsByName.get(childName.toLowerCase());
      if (childId) {
        try { addChild(tree, parentId, childId); } catch (e) {}
      }
    }
  }

  // "X's son/daughter/child Y"  (NOT case-insensitive to avoid matching lowercase)
  const possessiveChildPattern = /([A-Z][a-z]+)'s\s+(?:son|daughter|child)\s+([A-Z][a-z]+)/g;
  while ((match = possessiveChildPattern.exec(normalized)) !== null) {
    const parentId = personsByName.get(match[1].toLowerCase());
    const childId = personsByName.get(match[2].toLowerCase());
    if (parentId && childId) {
      try { addChild(tree, parentId, childId); } catch (e) {}
    }
  }

  // "They have children: ..."
  const theyChildrenPattern = /[Tt]hey\s+have\s+(?:\w+\s+)?child(?:ren)?[:\s]+([^.]+)/g;
  while ((match = theyChildrenPattern.exec(normalized)) !== null) {
    const textBefore = normalized.substring(0, match.index);
    const coupleMatch = textBefore.match(/([A-Z][a-z]+)\s+(?:is\s+married\s+to|and)\s+([A-Z][a-z]+)/g);
    if (coupleMatch) {
      const lastCouple = coupleMatch[coupleMatch.length - 1];
      const names = lastCouple.match(/[A-Z][a-z]+/g);
      if (names && names.length >= 2) {
        const parent1Id = personsByName.get(names[0].toLowerCase());
        const parent2Id = personsByName.get(names[names.length - 1].toLowerCase());
        const childNames = match[1].match(/[A-Z][a-z]+/g) || [];
        for (const childName of childNames) {
          const childId = personsByName.get(childName.toLowerCase());
          if (childId) {
            if (parent1Id) try { addChild(tree, parent1Id, childId); } catch (e) {}
            if (parent2Id) try { addChild(tree, parent2Id, childId); } catch (e) {}
          }
        }
      }
    }
  }

  if (tree.persons.size === 0) {
    errors.push('No persons could be extracted from the family description.');
  }
  if (!tree.testatorId) {
    errors.push('No testator identified. Include "(testator)" or "(testator, deceased)" after the testator\'s name.');
  }

  return { tree, errors, personsByName };
}

// ═══════════════════════════════════════════════════════════
// WILL PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Helper: find a person name (uppercase-starting word) in the personsByName map.
 * Returns { name, id } or null.
 */
function findBeneficiary(text, personsByName) {
  // Try multi-word names first, then single-word
  for (const [name, id] of personsByName) {
    if (text.toLowerCase().includes(name)) {
      // Capitalize for display
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      return { name: displayName, id };
    }
  }

  // Fallback: find first capitalized word that looks like a name (2+ chars, uppercase start)
  const nameMatch = text.match(/(?:to\s+(?:my\s+(?:friend|son|daughter|child|wife|husband|nephew|niece)\s+)?)([A-Z][a-z]{1,})/);
  if (nameMatch) {
    const name = nameMatch[1];
    const id = personsByName.get(name.toLowerCase());
    return { name, id: id || null };
  }

  return null;
}

/**
 * Detect age conditions in various phrasings:
 * - "when X turns/reaches N"
 * - "when X reaches the age of N"
 * - "who reach/attain age N"
 * - "upon reaching age N"
 */
function extractAgeCondition(text) {
  const patterns = [
    /(?:when|if)\s+\w+\s+(?:turns|reaches|attains|hits)\s+(\d+)/i,
    /(?:when|if)\s+\w+\s+reaches?\s+(?:the\s+)?age\s+(?:of\s+)?(\d+)/i,
    /(?:who|that|which)\s+(?:reach|attain|achieve)\s+(?:the\s+)?age\s+(?:of\s+)?(\d+)/i,
    /upon\s+(?:reaching|attaining)\s+(?:the\s+)?age\s+(?:of\s+)?(\d+)/i,
    /(?:turns|reaches)\s+(?:the\s+)?(?:age\s+(?:of\s+)?)?(\d+)\s+years?\s+old/i,
    /(?:turns|reaches)\s+(\d+)\s+years?\s+old/i,
    /turns\s+(\d+)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return parseInt(m[1]);
  }
  return null;
}

/**
 * Detect event/contingency conditions:
 * - "if X goes to college"
 * - "only if X graduates"
 * - "and only if X ..."
 * - "provided that X ..."
 */
function extractEventCondition(text) {
  const patterns = [
    /(?:and\s+)?only\s+if\s+(.+?)(?:\.|$)/i,
    /(?:and\s+)?if\s+([A-Z][a-z]+\s+(?:goes|graduates|marries|passes|completes|finishes|enrolls|attends|becomes).+?)(?:\.|$)/i,
    /provided\s+(?:that\s+)?(.+?)(?:\.|$)/i,
    /on\s+(?:the\s+)?condition\s+(?:that\s+)?(.+?)(?:\.|$)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Detect "but if" executory interest pattern in a text block.
 * Returns { condition, beneficiaryText, isAdmin } or null.
 */
function extractExecutoryInterest(text) {
  // "but if [condition], (then) to [person]"
  const m = text.match(/but\s+if\s+(.+?)(?:,\s*(?:then\s+)?to\s+(.+?)(?:\.|$)|,\s*then\s+to\s+(.+?)(?:\.|$))/i);
  if (m) {
    const condition = m[1].trim();
    const benefText = (m[2] || m[3] || '').trim();
    const isAdmin = /ever|never|always|no longer|ceases|not used|stops being|estate.*(?:distributed|settled)/i.test(condition);
    return { condition, beneficiaryText: benefText, isAdmin };
  }

  // Alternative: condition may span to "then to" without a comma
  const m2 = text.match(/but\s+if\s+(.+?)\s+then\s+to\s+(.+?)(?:\.|$)/i);
  if (m2) {
    const condition = m2[1].trim();
    const benefText = m2[2].trim();
    const isAdmin = /ever|never|always|no longer|ceases|not used|stops being|estate.*(?:distributed|settled)/i.test(condition);
    return { condition, beneficiaryText: benefText, isAdmin };
  }

  return null;
}

/**
 * Strip will preamble like "I, Thomas, devise Greenacre to" or "I devise my home to"
 * Returns the text after the preamble.
 */
function stripPreamble(text) {
  // "I, Name, devise [Property] to ..."
  const m1 = text.match(/^I,?\s*[A-Z][a-z]+,?\s*(?:devise|bequeath|leave|give|grant)\s+(?:[\w\s]+?\s+)?to\s+/i);
  if (m1) return text.slice(m1[0].length);

  // "I devise [Property] to ..."
  const m2 = text.match(/^I\s+(?:also\s+)?(?:devise|bequeath|leave|give|grant)\s+(?:[\w\s]+?\s+)?to\s+/i);
  if (m2) return text.slice(m2[0].length);

  // "devise [Property] to ..."
  const m3 = text.match(/^(?:devise|bequeath|leave|give|grant)\s+(?:[\w\s]+?\s+)?to\s+/i);
  if (m3) return text.slice(m3[0].length);

  return text;
}

/**
 * Parse a will text into interests.
 */
export function parseWill(text, personsByName) {
  const errors = [];
  const interests = [];

  const normalized = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // ─── STEP 1: Split into separate dispositions ───
  // Split on "I also devise", sentence boundaries with new dispositions, etc.
  const dispositions = splitDispositions(normalized);

  for (const rawDisposition of dispositions) {
    const parsedInterests = parseDisposition(rawDisposition.trim(), personsByName);
    interests.push(...parsedInterests);
  }

  if (interests.length === 0) {
    errors.push('Could not parse any interests from the will text. Try using patterns like "to A for life, then to B" or "to A, but if [condition], then to B".');
  }

  return { interests, errors };
}

/**
 * Split will text into separate dispositions.
 */
function splitDispositions(text) {
  // Split on "I also devise/bequeath/leave/give/grant" or "I further devise"
  const parts = text.split(/(?:\.\s*I\s+(?:also|further)\s+(?:devise|bequeath|leave|give|grant)|\bI\s+also\s+(?:devise|bequeath|leave|give|grant))/i);

  // For single dispositions, also try splitting on periods that start new sentences
  // with "I" or a devise-like verb
  if (parts.length === 1) {
    // Try splitting on period+space where next sentence starts with a capital letter
    // and contains a devise-like structure
    return [text];
  }

  return parts;
}

/**
 * Parse a single disposition into one or more interests.
 */
function parseDisposition(text, personsByName) {
  const interests = [];
  let previousId = null;

  // ─── Strip preamble ───
  // Remove "I, Thomas, devise Greenacre to" etc.
  let cleaned = stripPreamble(text);

  // ─── Check for executory interest pattern FIRST ───
  // "to [entity], but if [condition], then to [person]"
  // This must be checked BEFORE splitting on "then to" because
  // "but if ... then to" is a single construct.
  const execInfo = extractExecutoryInterest(cleaned);
  if (execInfo) {
    // Everything before "but if" is the primary interest
    const beforeButIf = cleaned.split(/\s*but\s+if\s+/i)[0].trim();

    // Parse the primary interest (fee simple subject to executory limitation)
    if (beforeButIf) {
      const primaryBenef = findBeneficiary(beforeButIf, personsByName);
      const primaryInterest = createInterest({
        type: InterestType.FEE_SIMPLE_SUBJECT_TO_EL,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: primaryBenef ? primaryBenef.id : null,
        rawText: beforeButIf,
        label: `Fee Simple Subject to Executory Limitation${primaryBenef ? ` (${primaryBenef.name})` : ''}`,
      });
      interests.push(primaryInterest);
      previousId = primaryInterest.id;
    }

    // Parse the executory interest
    const execBenef = findBeneficiary(execInfo.beneficiaryText, personsByName);
    const execInterest = createInterest({
      type: InterestType.EXECUTORY_INTEREST_SHIFTING,
      beneficiaryType: BeneficiaryType.PERSON,
      beneficiaryId: execBenef ? execBenef.id : null,
      vestingCondition: {
        type: execInfo.isAdmin ? 'administrative' : 'event',
        ageRequirement: null,
        eventDescription: execInfo.condition,
        survivalOf: null,
      },
      precedingInterestId: previousId,
      rawText: `but if ${execInfo.condition}, then to ${execInfo.beneficiaryText}`,
      label: `Shifting Executory Interest to ${execBenef ? execBenef.name : execInfo.beneficiaryText}`,
    });
    interests.push(execInterest);
    return interests;
  }

  // ─── Split on "then to" for life estate → remainder chains ───
  // But only split on ", then to" or "; then to" — NOT inside "but if...then to"
  const clauses = cleaned.split(/(?:,\s*then\s+to|;\s*then\s+to|\.\s*[Tt]hen\s+to)/);

  for (let i = 0; i < clauses.length; i++) {
    let clause = clauses[i].trim();
    if (!clause) continue;

    // ─── Life estate: "X for life" ───
    const lifeEstateMatch = clause.match(/^(?:to\s+)?([A-Z][a-z]+)\s+for\s+life/);
    if (lifeEstateMatch) {
      const name = lifeEstateMatch[1].toLowerCase();
      const personId = personsByName.get(name);
      const interest = createInterest({
        type: InterestType.LIFE_ESTATE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: personId || null,
        precedingInterestId: previousId,
        rawText: clause,
        label: `Life Estate to ${lifeEstateMatch[1]}`,
      });
      interests.push(interest);
      previousId = interest.id;
      continue;
    }

    // ─── Class or Unascertained Relation (e.g. "X's children", "X's first born child") ───
    const relationMatch = clause.match(/(?:to\s+)?([A-Z][a-z]+)'s\s+(first\s+born\s+child|child(?:ren)?|grandchild(?:ren)?|son|daughter|issue)\b/i);
    if (relationMatch) {
      const parentName = relationMatch[1].toLowerCase();
      const rawRel = relationMatch[2].toLowerCase();
      const parentId = personsByName.get(parentName);
      
      let relationship = 'children';
      if (rawRel.includes('grandchild')) relationship = 'grandchildren';
      else if (rawRel === 'issue') relationship = 'issue';

      const ageCondition = extractAgeCondition(clause);
      const eventCondition = extractEventCondition(clause);

      let vestingCondition = { type: 'none', ageRequirement: null, eventDescription: null, survivalOf: null };
      
      if (ageCondition && eventCondition) {
        vestingCondition = { type: 'age', ageRequirement: ageCondition, eventDescription: eventCondition, survivalOf: null };
      } else if (ageCondition) {
        vestingCondition = { type: 'age', ageRequirement: ageCondition, eventDescription: null, survivalOf: null };
      } else if (eventCondition) {
        vestingCondition = { type: 'event', ageRequirement: null, eventDescription: eventCondition, survivalOf: null };
      }

      const isContingent = ageCondition !== null || eventCondition !== null;
      const type = isContingent 
        ? (previousId ? InterestType.CONTINGENT_REMAINDER : InterestType.EXECUTORY_INTEREST_SPRINGING)
        : (previousId ? InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN : InterestType.EXECUTORY_INTEREST_SPRINGING);

      let label = `Remainder to ${relationMatch[1]}'s ${rawRel}`;
      if (isContingent) {
        if (ageCondition && !eventCondition) {
          label = `Contingent Remainder to ${relationMatch[1]}'s ${rawRel} (age ${ageCondition})`;
        } else {
          label = `Contingent Interest to ${relationMatch[1]}'s ${rawRel}`;
        }
      }

      const interest = createInterest({
        type,
        beneficiaryType: BeneficiaryType.CLASS,
        classDescriptor: { parentId: parentId || null, relationship, classClosed: false, currentMembers: [] },
        vestingCondition,
        precedingInterestId: previousId,
        rawText: clause,
        label,
      });
      interests.push(interest);
      previousId = interest.id;
      continue;
    }

    // ─── Interest with age + event conditions: "to X when X turns N and only if Y" ───
    const ageCondition = extractAgeCondition(clause);
    const eventCondition = extractEventCondition(clause);

    if (ageCondition || eventCondition) {
      const benef = findBeneficiary(clause, personsByName);
      const vestingConditions = [];
      let vestingCondition;

      if (ageCondition && eventCondition) {
        // Compound condition: both age AND event must be satisfied
        // Under RAP, we use the MORE RESTRICTIVE condition
        // An age > 21 + event condition is essentially a contingent interest
        vestingCondition = {
          type: 'age',
          ageRequirement: ageCondition,
          eventDescription: eventCondition,
          survivalOf: null,
        };
      } else if (ageCondition) {
        vestingCondition = {
          type: 'age',
          ageRequirement: ageCondition,
          eventDescription: null,
          survivalOf: null,
        };
      } else {
        vestingCondition = {
          type: 'event',
          ageRequirement: null,
          eventDescription: eventCondition,
          survivalOf: null,
        };
      }

      const condLabel = ageCondition
        ? (eventCondition ? `age ${ageCondition} + ${eventCondition}` : `age ${ageCondition}`)
        : eventCondition;

      // Determine interest type
      const interestType = previousId
        ? InterestType.CONTINGENT_REMAINDER
        : InterestType.EXECUTORY_INTEREST_SPRINGING;

      const interest = createInterest({
        type: interestType,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: benef ? benef.id : null,
        vestingCondition,
        precedingInterestId: previousId,
        rawText: clause,
        label: `Contingent Interest to ${benef ? benef.name : 'unknown'} (${condLabel})`,
      });
      interests.push(interest);
      previousId = interest.id;
      continue;
    }

    // ─── Simple remainder: "to X" or "X" ───
    // Find beneficiary by looking for known persons first, then capitalized words
    const benef = findBeneficiary(clause, personsByName);
    if (benef) {
      const isFeeSA = /and\s+(?:his|her|their)\s+heirs/i.test(clause);

      if (isFeeSA && i === 0 && !previousId) {
        const interest = createInterest({
          type: InterestType.FEE_SIMPLE_ABSOLUTE,
          beneficiaryType: BeneficiaryType.PERSON,
          beneficiaryId: benef.id,
          rawText: clause,
          label: `Fee Simple Absolute to ${benef.name}`,
        });
        interests.push(interest);
        previousId = interest.id;
      } else {
        const interest = createInterest({
          type: InterestType.VESTED_REMAINDER,
          beneficiaryType: BeneficiaryType.PERSON,
          beneficiaryId: benef.id,
          precedingInterestId: previousId,
          rawText: clause,
          label: `Vested Remainder to ${benef.name}`,
        });
        interests.push(interest);
        previousId = interest.id;
      }
      continue;
    }

    // ─── Unrecognized clause — still record it as best-effort ───
    if (clause.length > 5 && i > 0) {
      // Might be a remainder to an entity (e.g., "the City of Springfield")
      const entityLabel = clause.replace(/^to\s+/i, '').substring(0, 50);
      const interest = createInterest({
        type: previousId ? InterestType.VESTED_REMAINDER : InterestType.FEE_SIMPLE_ABSOLUTE,
        beneficiaryType: BeneficiaryType.PERSON,
        beneficiaryId: null,
        precedingInterestId: previousId,
        rawText: clause,
        label: previousId ? `Remainder (${entityLabel})` : `Fee Simple (${entityLabel})`,
      });
      interests.push(interest);
      previousId = interest.id;
    }
  }

  return interests;
}

/**
 * Full parse pipeline.
 */
export function parseInputs(familyText, willText) {
  const familyResult = parseFamilyTree(familyText);
  const willResult = parseWill(willText, familyResult.personsByName);

  const will = createWill({
    testatorId: familyResult.tree.testatorId,
    dateOfWill: familyResult.tree.dateOfWill,
    interests: willResult.interests,
    rawText: willText,
  });

  return {
    tree: familyResult.tree,
    will,
    errors: [...familyResult.errors, ...willResult.errors],
  };
}
