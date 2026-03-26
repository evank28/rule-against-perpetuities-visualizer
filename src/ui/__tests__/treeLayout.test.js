/**
 * Integration tests for the tree visualization layout logic.
 * Tests that the computed layout places nodes in correct generational rows.
 */
import { describe, it, expect } from 'vitest';
import {
  createPerson, createFamilyTree, addPerson, addChild, addSpouse,
  setTestator, computeGenerations, resetIdCounter,
} from '../../models/familyTree.js';

function makeTree(people, relationships, testatorId = null) {
  resetIdCounter(400);
  const tree = createFamilyTree({ dateOfDeath: new Date(2024, 0, 1) });
  for (const p of people) {
    addPerson(tree, createPerson(p));
  }
  for (const r of relationships) {
    if (r.type === 'child') addChild(tree, r.parent, r.child);
    if (r.type === 'spouse') addSpouse(tree, r.person1, r.person2);
  }
  if (testatorId) setTestator(tree, testatorId);
  return tree;
}

/**
 * Simulate the layout computation from treeVisualization.js
 * (duplicated here so tests don't need DOM/D3).
 */
function computeLayout(tree, width = 700, height = 500) {
  const generations = computeGenerations(tree);
  const nodes = [];
  for (const [id, person] of tree.persons) {
    nodes.push({ id, name: person.name, generation: generations.get(id) ?? 0 });
  }

  const genGroups = new Map();
  for (const node of nodes) {
    if (!genGroups.has(node.generation)) genGroups.set(node.generation, []);
    genGroups.get(node.generation).push(node);
  }

  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);
  const rowHeight = Math.min(120, (height - 100) / Math.max(sortedGens.length, 1));
  const topPadding = 60;

  // Order spouses adjacent
  for (const gen of sortedGens) {
    const group = genGroups.get(gen);
    const ordered = [];
    const placed = new Set();
    for (const node of group) {
      if (placed.has(node.id)) continue;
      ordered.push(node);
      placed.add(node.id);
      const person = tree.persons.get(node.id);
      if (person) {
        for (const spouseId of person.spouseIds) {
          const spouseNode = group.find(n => n.id === spouseId);
          if (spouseNode && !placed.has(spouseId)) {
            ordered.push(spouseNode);
            placed.add(spouseId);
          }
        }
      }
    }
    genGroups.set(gen, ordered);
  }

  for (let i = 0; i < sortedGens.length; i++) {
    const gen = sortedGens[i];
    const group = genGroups.get(gen);
    const y = topPadding + i * rowHeight;
    const spacing = Math.min(140, (width - 80) / Math.max(group.length, 1));
    const totalWidth = (group.length - 1) * spacing;
    const startX = (width - totalWidth) / 2;
    for (let j = 0; j < group.length; j++) {
      group[j].x = startX + j * spacing;
      group[j].y = y;
    }
  }

  return new Map(nodes.map(n => [n.id, n]));
}

describe('Tree Layout Integration', () => {
  it('3-generation family: grandparent at top, parent in middle, child at bottom', () => {
    const tree = makeTree(
      [
        { id: 'gp', name: 'Grandpa', alive: false },
        { id: 'mom', name: 'Mom', alive: true },
        { id: 'kid', name: 'Kid', alive: true },
      ],
      [
        { type: 'child', parent: 'gp', child: 'mom' },
        { type: 'child', parent: 'mom', child: 'kid' },
      ],
      'gp'
    );
    const layout = computeLayout(tree);
    expect(layout.get('gp').y).toBeLessThan(layout.get('mom').y);
    expect(layout.get('mom').y).toBeLessThan(layout.get('kid').y);
  });

  it('siblings appear on the same row', () => {
    const tree = makeTree(
      [
        { id: 'p', name: 'Parent', alive: false },
        { id: 'c1', name: 'Alice', alive: true },
        { id: 'c2', name: 'Bob', alive: true },
        { id: 'c3', name: 'Carol', alive: true },
      ],
      [
        { type: 'child', parent: 'p', child: 'c1' },
        { type: 'child', parent: 'p', child: 'c2' },
        { type: 'child', parent: 'p', child: 'c3' },
      ],
      'p'
    );
    const layout = computeLayout(tree);
    expect(layout.get('c1').y).toBe(layout.get('c2').y);
    expect(layout.get('c2').y).toBe(layout.get('c3').y);
    expect(layout.get('p').y).toBeLessThan(layout.get('c1').y);
  });

  it('spouses are on the same row and adjacent horizontally', () => {
    const tree = makeTree(
      [
        { id: 'gp', name: 'Grandpa', alive: false },
        { id: 'dad', name: 'Dad', alive: true },
        { id: 'mom', name: 'Mom', alive: true },
        { id: 'kid', name: 'Kid', alive: true },
      ],
      [
        { type: 'child', parent: 'gp', child: 'dad' },
        { type: 'spouse', person1: 'dad', person2: 'mom' },
        { type: 'child', parent: 'dad', child: 'kid' },
        { type: 'child', parent: 'mom', child: 'kid' },
      ],
      'gp'
    );
    const layout = computeLayout(tree);
    // Same row
    expect(layout.get('dad').y).toBe(layout.get('mom').y);
    // Adjacent (no one between them)
    const dadX = layout.get('dad').x;
    const momX = layout.get('mom').x;
    expect(Math.abs(dadX - momX)).toBeGreaterThan(0);
    expect(Math.abs(dadX - momX)).toBeLessThanOrEqual(140); // within spacing
  });

  it('full 4-gen family with testator and spouses', () => {
    const tree = makeTree(
      [
        { id: 'ggp', name: 'GreatGrandpa', alive: false },
        { id: 'gp', name: 'Grandpa', alive: false },
        { id: 'gm', name: 'Grandma', alive: false },
        { id: 'dad', name: 'Dad', alive: true },
        { id: 'mom', name: 'Mom', alive: true },
        { id: 'kid', name: 'Kid', alive: true },
      ],
      [
        { type: 'child', parent: 'ggp', child: 'gp' },
        { type: 'spouse', person1: 'gp', person2: 'gm' },
        { type: 'child', parent: 'gp', child: 'dad' },
        { type: 'child', parent: 'gm', child: 'dad' },
        { type: 'spouse', person1: 'dad', person2: 'mom' },
        { type: 'child', parent: 'dad', child: 'kid' },
        { type: 'child', parent: 'mom', child: 'kid' },
      ],
      'ggp'
    );
    const layout = computeLayout(tree);

    // Generational ordering: ggp < gp/gm < dad/mom < kid
    expect(layout.get('ggp').y).toBeLessThan(layout.get('gp').y);
    expect(layout.get('gp').y).toBe(layout.get('gm').y);
    expect(layout.get('gp').y).toBeLessThan(layout.get('dad').y);
    expect(layout.get('dad').y).toBe(layout.get('mom').y);
    expect(layout.get('dad').y).toBeLessThan(layout.get('kid').y);
  });

  it('disconnected person (friend) appears at generation 0', () => {
    const tree = makeTree(
      [
        { id: 'T', name: 'Testator', alive: false },
        { id: 'c1', name: 'Child', alive: true },
        { id: 'friend', name: 'Friend', alive: true },
      ],
      [
        { type: 'child', parent: 'T', child: 'c1' },
      ],
      'T'
    );
    const layout = computeLayout(tree);
    // Friend has no family links, should be at same row as testator (gen 0)
    expect(layout.get('friend').y).toBe(layout.get('T').y);
    expect(layout.get('T').y).toBeLessThan(layout.get('c1').y);
  });
});
