/**
 * Main application entry point.
 * Wires together parser, engine, UI components.
 */

import './index.css';
import { presets, getPreset } from './data/presets.js';
import { analyzeWithRule, getAllRules } from './engine/rapAnalyzer.js';
import { parseInputs } from './parser/nlParser.js';
import { renderFamilyTree } from './ui/treeVisualization.js';
import { renderInterestCards } from './ui/interestCards.js';
import { resetIdCounter } from './models/familyTree.js';
import { resetInterestIdCounter } from './models/will.js';

// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════

let currentTree = null;
let currentWill = null;
let currentRule = 'classic';
let currentPresetId = null;
let rapResults = null;

// ═══════════════════════════════════════════════════════════
// DOM References
// ═══════════════════════════════════════════════════════════

const familyInput = document.getElementById('familyInput');
const willInput = document.getElementById('willInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox = document.getElementById('errorBox');
const treeContainer = document.getElementById('treeContainer');
const scenarioDescription = document.getElementById('scenarioDescription');
const interestCardsContainer = document.getElementById('interestCardsContainer');
const resultsSummary = document.getElementById('resultsSummary');
const statusText = document.getElementById('statusText');
const presetBar = document.getElementById('presetBar');
const ruleToggle = document.getElementById('ruleToggle');

// ═══════════════════════════════════════════════════════════
// Initialize Preset Buttons
// ═══════════════════════════════════════════════════════════

function initPresets() {
  presetBar.innerHTML = '';
  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.className = `preset-btn ${preset.expectedResult === 'invalid' ? 'invalid' : 'valid'}`;
    btn.dataset.presetId = preset.id;
    btn.innerHTML = `
      <span class="preset-icon">${preset.expectedResult === 'invalid' ? '❌' : '✅'}</span>
      ${preset.name}
    `;
    btn.addEventListener('click', () => loadPreset(preset.id));
    presetBar.appendChild(btn);
  }
}

// ═══════════════════════════════════════════════════════════
// Load Preset
// ═══════════════════════════════════════════════════════════

function loadPreset(presetId) {
  const preset = getPreset(presetId);
  if (!preset) return;

  currentPresetId = presetId;

  // Update active state
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.presetId === presetId);
  });

  // Fill text areas
  familyInput.value = preset.familyText;
  willInput.value = preset.willText;

  // Reset ID counters for cached forms
  resetIdCounter(100);
  resetInterestIdCounter(100);

  // Use cached symbolic form
  const { tree, will } = preset.build();
  currentTree = tree;
  currentWill = will;

  // Show description
  scenarioDescription.innerHTML = `<strong>${preset.trapName || preset.name}:</strong> ${preset.description}`;

  // Run analysis
  runAnalysis();

  statusText.textContent = `Loaded preset: ${preset.name}`;
}

// ═══════════════════════════════════════════════════════════
// Parse & Analyze
// ═══════════════════════════════════════════════════════════

function parseAndAnalyze() {
  const familyText = familyInput.value.trim();
  const willText = willInput.value.trim();

  if (!familyText || !willText) {
    showError('Please enter both a family description and a will.');
    // Clear stale results
    interestCardsContainer.innerHTML = '<div class="empty-state">No interests parsed yet. Enter a will and click Analyze.</div>';
    resultsSummary.innerHTML = '';
    treeContainer.innerHTML = '';
    scenarioDescription.innerHTML = '';
    rapResults = null;
    currentTree = null;
    currentWill = null;
    return;
  }

  hideError();
  statusText.textContent = 'Parsing inputs...';

  // Reset ID counters
  resetIdCounter(1);
  resetInterestIdCounter(1);

  // Parse
  const result = parseInputs(familyText, willText);

  if (result.errors.length > 0) {
    showError(result.errors.join('\n'));
    // Still proceed if we got some data
    if (!result.tree || result.tree.persons.size === 0) {
      interestCardsContainer.innerHTML = '<div class="empty-state">Could not parse the input. Please check the format.</div>';
      resultsSummary.innerHTML = '';
      treeContainer.innerHTML = '';
      scenarioDescription.innerHTML = '';
      return;
    }
  }

  currentTree = result.tree;
  currentWill = result.will;
  currentPresetId = null;

  // Clear preset selection
  document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));

  scenarioDescription.innerHTML = '<strong>Custom Scenario:</strong> Your custom family and will have been parsed. Review the tree and interest cards, then check the analysis results.';

  runAnalysis();
}

function runAnalysis() {
  if (!currentTree || !currentWill) return;

  statusText.textContent = `Analyzing under ${getRuleName(currentRule)}...`;

  try {
    rapResults = analyzeWithRule(currentRule, currentWill, currentTree);
  } catch (e) {
    console.error('Analysis error:', e);
    showError(`Analysis error: ${e.message}`);
    return;
  }

  // Render tree with RAP annotations
  renderFamilyTree(treeContainer, currentTree, {
    rapResults,
    onTreeChange: (updatedTree) => {
      currentTree = updatedTree;
      runAnalysis();
    },
  });

  // Render interest cards
  renderInterestCards(interestCardsContainer, currentWill.interests, rapResults, currentRule);

  // Update summary
  updateSummary();

  statusText.textContent = `Analysis complete — ${getRuleName(currentRule)}`;
}

function updateSummary() {
  resultsSummary.innerHTML = '';
  if (!rapResults) return;

  const rapSubject = rapResults.filter(r => r.subjectToRap);
  const exemptCount = rapResults.filter(r => !r.subjectToRap).length;
  const validCount = rapSubject.filter(r => r.valid).length;
  const invalidCount = rapSubject.filter(r => !r.valid).length;

  if (validCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'summary-badge valid';
    badge.textContent = `${validCount} Valid`;
    resultsSummary.appendChild(badge);
  }
  if (invalidCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'summary-badge invalid';
    badge.textContent = `${invalidCount} Invalid`;
    resultsSummary.appendChild(badge);
  }
  if (exemptCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'summary-badge exempt';
    badge.textContent = `${exemptCount} Exempt`;
    resultsSummary.appendChild(badge);
  }
}

function getRuleName(ruleId) {
  const rules = getAllRules();
  const rule = rules.find(r => r.id === ruleId);
  return rule ? rule.name : ruleId;
}

// ═══════════════════════════════════════════════════════════
// Rule Toggle
// ═══════════════════════════════════════════════════════════

function initRuleToggle() {
  ruleToggle.querySelectorAll('button[data-rule]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRule = btn.dataset.rule;
      ruleToggle.querySelectorAll('button[data-rule]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (currentTree && currentWill) {
        runAnalysis();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// Error Handling
// ═══════════════════════════════════════════════════════════

function showError(msg) {
  errorBox.style.display = 'block';
  errorBox.textContent = msg;
}

function hideError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

// ═══════════════════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════════════════

analyzeBtn.addEventListener('click', parseAndAnalyze);

// Allow Ctrl+Enter to analyze
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    parseAndAnalyze();
  }
});

// ═══════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════

initPresets();
initRuleToggle();

// Load first preset by default
loadPreset(presets[0].id);
