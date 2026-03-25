/**
 * Family Tree data model for RAP analysis.
 * Represents persons and their relationships (parent-child, spousal).
 */

let nextId = 1;
export function generateId() {
  return `person_${nextId++}`;
}
export function resetIdCounter(val = 1) {
  nextId = val;
}

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 * @property {boolean} alive
 * @property {number|null} birthYear
 * @property {number|null} deathYear
 * @property {'male'|'female'|'unknown'} gender
 * @property {string[]} spouseIds
 * @property {string[]} parentIds
 * @property {string[]} childIds
 */

/**
 * Create a new Person object.
 */
export function createPerson({
  id = null,
  name,
  alive = true,
  birthYear = null,
  deathYear = null,
  gender = 'unknown',
}) {
  return {
    id: id || generateId(),
    name,
    alive,
    birthYear,
    deathYear,
    gender,
    spouseIds: [],
    parentIds: [],
    childIds: [],
  };
}

/**
 * @typedef {Object} FamilyTree
 * @property {Map<string, Person>} persons
 * @property {string|null} testatorId
 * @property {Date|null} dateOfWill
 * @property {Date|null} dateOfDeath
 */

/**
 * Create an empty FamilyTree.
 */
export function createFamilyTree({ dateOfWill = null, dateOfDeath = null } = {}) {
  return {
    persons: new Map(),
    testatorId: null,
    dateOfWill,
    dateOfDeath,
  };
}

/**
 * Add a person to the family tree.
 */
export function addPerson(tree, person) {
  if (tree.persons.has(person.id)) {
    throw new Error(`Person with id ${person.id} already exists`);
  }
  tree.persons.set(person.id, { ...person });
  return tree;
}

/**
 * Remove a person and clean up all relationship references.
 */
export function removePerson(tree, personId) {
  const person = tree.persons.get(personId);
  if (!person) throw new Error(`Person ${personId} not found`);

  // Remove from spouses
  for (const spouseId of person.spouseIds) {
    const spouse = tree.persons.get(spouseId);
    if (spouse) {
      spouse.spouseIds = spouse.spouseIds.filter((id) => id !== personId);
    }
  }

  // Remove from parents' child lists
  for (const parentId of person.parentIds) {
    const parent = tree.persons.get(parentId);
    if (parent) {
      parent.childIds = parent.childIds.filter((id) => id !== personId);
    }
  }

  // Remove from children's parent lists
  for (const childId of person.childIds) {
    const child = tree.persons.get(childId);
    if (child) {
      child.parentIds = child.parentIds.filter((id) => id !== personId);
    }
  }

  tree.persons.delete(personId);
  if (tree.testatorId === personId) {
    tree.testatorId = null;
  }
  return tree;
}

/**
 * Create a parent-child relationship.
 */
export function addChild(tree, parentId, childId) {
  const parent = tree.persons.get(parentId);
  const child = tree.persons.get(childId);
  if (!parent) throw new Error(`Parent ${parentId} not found`);
  if (!child) throw new Error(`Child ${childId} not found`);
  if (parent.childIds.includes(childId)) return tree;

  parent.childIds.push(childId);
  child.parentIds.push(parentId);
  return tree;
}

/**
 * Create a spousal relationship.
 */
export function addSpouse(tree, personId1, personId2) {
  const p1 = tree.persons.get(personId1);
  const p2 = tree.persons.get(personId2);
  if (!p1) throw new Error(`Person ${personId1} not found`);
  if (!p2) throw new Error(`Person ${personId2} not found`);
  if (p1.spouseIds.includes(personId2)) return tree;

  p1.spouseIds.push(personId2);
  p2.spouseIds.push(personId1);
  return tree;
}

/**
 * Set the testator for this family tree.
 */
export function setTestator(tree, personId) {
  if (!tree.persons.has(personId)) {
    throw new Error(`Person ${personId} not found`);
  }
  tree.testatorId = personId;
  return tree;
}

/**
 * Get all descendants of a person (recursive).
 */
export function getDescendants(tree, personId) {
  const result = [];
  const visited = new Set();

  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const person = tree.persons.get(id);
    if (!person) return;
    for (const childId of person.childIds) {
      result.push(childId);
      walk(childId);
    }
  }

  walk(personId);
  return result;
}

/**
 * Get all ancestors of a person (recursive).
 */
export function getAncestors(tree, personId) {
  const result = [];
  const visited = new Set();

  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const person = tree.persons.get(id);
    if (!person) return;
    for (const parentId of person.parentIds) {
      result.push(parentId);
      walk(parentId);
    }
  }

  walk(personId);
  return result;
}

/**
 * Compute the set of lives in being at the testator's death.
 * These are all persons alive when the testator dies.
 */
export function getLivesInBeing(tree) {
  const lives = [];
  for (const [id, person] of tree.persons) {
    if (id === tree.testatorId) continue; // testator is dead
    if (person.alive) {
      lives.push(id);
    }
  }
  return lives;
}

/**
 * Check if there are any circular relationships in the tree.
 */
export function hasCycle(tree) {
  const visited = new Set();
  const inStack = new Set();

  function dfs(id) {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);

    const person = tree.persons.get(id);
    if (person) {
      for (const childId of person.childIds) {
        if (dfs(childId)) return true;
      }
    }

    inStack.delete(id);
    return false;
  }

  for (const id of tree.persons.keys()) {
    if (dfs(id)) return true;
  }
  return false;
}

/**
 * Validate the family tree for consistency.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTree(tree) {
  const errors = [];

  // Check for cycles
  if (hasCycle(tree)) {
    errors.push('Family tree contains a cycle in parent-child relationships');
  }

  // Check bidirectional consistency
  for (const [id, person] of tree.persons) {
    // Each child should list this person as parent
    for (const childId of person.childIds) {
      const child = tree.persons.get(childId);
      if (!child) {
        errors.push(`${person.name} references non-existent child ${childId}`);
      } else if (!child.parentIds.includes(id)) {
        errors.push(`${person.name} lists ${child.name} as child but ${child.name} doesn't list ${person.name} as parent`);
      }
    }

    // Each parent should list this person as child
    for (const parentId of person.parentIds) {
      const parent = tree.persons.get(parentId);
      if (!parent) {
        errors.push(`${person.name} references non-existent parent ${parentId}`);
      } else if (!parent.childIds.includes(id)) {
        errors.push(`${person.name} lists ${parent.name} as parent but ${parent.name} doesn't list ${person.name} as child`);
      }
    }

    // Spousal reciprocity
    for (const spouseId of person.spouseIds) {
      const spouse = tree.persons.get(spouseId);
      if (!spouse) {
        errors.push(`${person.name} references non-existent spouse ${spouseId}`);
      } else if (!spouse.spouseIds.includes(id)) {
        errors.push(`${person.name} lists ${spouse.name} as spouse but not reciprocated`);
      }
    }

    // Dead person consistency
    if (!person.alive && person.deathYear && person.birthYear && person.deathYear < person.birthYear) {
      errors.push(`${person.name} has death year before birth year`);
    }
  }

  // Check testator
  if (tree.testatorId && !tree.persons.has(tree.testatorId)) {
    errors.push('Testator ID references a non-existent person');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Deep clone a family tree (for scenario simulation).
 */
export function cloneTree(tree) {
  const newTree = {
    persons: new Map(),
    testatorId: tree.testatorId,
    dateOfWill: tree.dateOfWill,
    dateOfDeath: tree.dateOfDeath,
  };
  for (const [id, person] of tree.persons) {
    newTree.persons.set(id, {
      ...person,
      spouseIds: [...person.spouseIds],
      parentIds: [...person.parentIds],
      childIds: [...person.childIds],
    });
  }
  return newTree;
}

/**
 * Get children of a person.
 */
export function getChildren(tree, personId) {
  const person = tree.persons.get(personId);
  if (!person) return [];
  return person.childIds;
}

/**
 * Get the person object for a given id.
 */
export function getPerson(tree, personId) {
  return tree.persons.get(personId) || null;
}

/**
 * Get all person IDs in the tree.
 */
export function getAllPersonIds(tree) {
  return Array.from(tree.persons.keys());
}
