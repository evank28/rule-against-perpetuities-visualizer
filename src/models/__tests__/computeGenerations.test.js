/**
 * Unit tests for computeGenerations in familyTree.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPerson, createFamilyTree, addPerson, addChild, addSpouse,
  setTestator, computeGenerations, resetIdCounter,
} from '../familyTree.js';

function makeTree(people, relationships, testatorId = null) {
  resetIdCounter(100);
  const tree = createFamilyTree();
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

describe('computeGenerations', () => {
  it('simple chain: grandparent → parent → child gives generations 0, 1, 2', () => {
    const tree = makeTree(
      [
        { id: 'gp', name: 'Grandparent', alive: false },
        { id: 'p', name: 'Parent', alive: true },
        { id: 'c', name: 'Child', alive: true },
      ],
      [
        { type: 'child', parent: 'gp', child: 'p' },
        { type: 'child', parent: 'p', child: 'c' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('gp')).toBe(0);
    expect(gens.get('p')).toBe(1);
    expect(gens.get('c')).toBe(2);
  });

  it('multiple children share the same generation', () => {
    const tree = makeTree(
      [
        { id: 'p', name: 'Parent', alive: true },
        { id: 'c1', name: 'Child1', alive: true },
        { id: 'c2', name: 'Child2', alive: true },
        { id: 'c3', name: 'Child3', alive: true },
      ],
      [
        { type: 'child', parent: 'p', child: 'c1' },
        { type: 'child', parent: 'p', child: 'c2' },
        { type: 'child', parent: 'p', child: 'c3' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('p')).toBe(0);
    expect(gens.get('c1')).toBe(1);
    expect(gens.get('c2')).toBe(1);
    expect(gens.get('c3')).toBe(1);
  });

  it('spouses are placed at the same generation as their partner', () => {
    const tree = makeTree(
      [
        { id: 'gp', name: 'Grandparent', alive: false },
        { id: 'dad', name: 'Dad', alive: true },
        { id: 'mom', name: 'Mom', alive: true },
        { id: 'kid', name: 'Kid', alive: true },
      ],
      [
        { type: 'child', parent: 'gp', child: 'dad' },
        { type: 'spouse', person1: 'dad', person2: 'mom' },
        { type: 'child', parent: 'dad', child: 'kid' },
        { type: 'child', parent: 'mom', child: 'kid' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('gp')).toBe(0);
    expect(gens.get('dad')).toBe(1);
    expect(gens.get('mom')).toBe(1); // same as dad
    expect(gens.get('kid')).toBe(2);
  });

  it('four-generation tree has correct depths', () => {
    const tree = makeTree(
      [
        { id: 'ggp', name: 'GreatGrandparent', alive: false },
        { id: 'gp', name: 'Grandparent', alive: false },
        { id: 'p', name: 'Parent', alive: true },
        { id: 'c', name: 'Child', alive: true },
      ],
      [
        { type: 'child', parent: 'ggp', child: 'gp' },
        { type: 'child', parent: 'gp', child: 'p' },
        { type: 'child', parent: 'p', child: 'c' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('ggp')).toBe(0);
    expect(gens.get('gp')).toBe(1);
    expect(gens.get('p')).toBe(2);
    expect(gens.get('c')).toBe(3);
  });

  it('disconnected person with no relationships gets generation 0', () => {
    const tree = makeTree(
      [
        { id: 'p', name: 'Parent', alive: true },
        { id: 'c', name: 'Child', alive: true },
        { id: 'loner', name: 'Loner', alive: true },
      ],
      [
        { type: 'child', parent: 'p', child: 'c' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('p')).toBe(0);
    expect(gens.get('c')).toBe(1);
    expect(gens.get('loner')).toBe(0);
  });

  it('diamond family: two parents share a child, child is one generation below both', () => {
    const tree = makeTree(
      [
        { id: 'dad', name: 'Dad', alive: true },
        { id: 'mom', name: 'Mom', alive: true },
        { id: 'kid', name: 'Kid', alive: true },
      ],
      [
        { type: 'spouse', person1: 'dad', person2: 'mom' },
        { type: 'child', parent: 'dad', child: 'kid' },
        { type: 'child', parent: 'mom', child: 'kid' },
      ]
    );
    const gens = computeGenerations(tree);
    expect(gens.get('dad')).toBe(0);
    expect(gens.get('mom')).toBe(0);
    expect(gens.get('kid')).toBe(1);
  });

  it('empty tree returns empty map', () => {
    const tree = createFamilyTree();
    const gens = computeGenerations(tree);
    expect(gens.size).toBe(0);
  });

  it('single person tree returns generation 0', () => {
    const tree = makeTree(
      [{ id: 'solo', name: 'Solo', alive: true }],
      []
    );
    const gens = computeGenerations(tree);
    expect(gens.get('solo')).toBe(0);
  });
});
