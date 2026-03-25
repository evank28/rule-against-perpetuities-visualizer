/**
 * Rule Registry — extensible system for RAP rule variants.
 * Add new rules by importing and registering them here.
 */

import { ruleInfo as classicRule } from './rules/classicRap.js';
import { ruleInfo as cyPresRule } from './rules/cyPresRap.js';
import { ruleInfo as usrapRule } from './rules/usrapRap.js';

const registry = new Map();

/**
 * Register a rule variant.
 */
export function registerRule(ruleInfo) {
  registry.set(ruleInfo.id, ruleInfo);
}

/**
 * Get a rule by ID.
 */
export function getRule(ruleId) {
  return registry.get(ruleId);
}

/**
 * Get all registered rules.
 */
export function getAllRules() {
  return Array.from(registry.values());
}

/**
 * Analyze a will under a specific rule variant.
 */
export function analyzeWithRule(ruleId, will, tree) {
  const rule = registry.get(ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
  return rule.analyzeWill(will, tree);
}

// Register built-in rules
registerRule(classicRule);
registerRule(cyPresRule);
registerRule(usrapRule);
