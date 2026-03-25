/**
 * Will and Interest data models for RAP analysis.
 *
 * Models testamentary dispositions as a collection of future interests,
 * each with conditions, beneficiaries, and vesting requirements.
 */

/**
 * Interest type enumeration.
 */
export const InterestType = {
  FEE_SIMPLE_ABSOLUTE: 'fee_simple_absolute',
  LIFE_ESTATE: 'life_estate',
  FEE_SIMPLE_DETERMINABLE: 'fee_simple_determinable',
  FEE_SIMPLE_SUBJECT_TO_CS: 'fee_simple_subject_to_condition_subsequent',
  FEE_SIMPLE_SUBJECT_TO_EL: 'fee_simple_subject_to_executory_limitation',
  VESTED_REMAINDER: 'vested_remainder',
  VESTED_REMAINDER_SUBJECT_TO_OPEN: 'vested_remainder_subject_to_open',
  VESTED_REMAINDER_SUBJECT_TO_DIVESTMENT: 'vested_remainder_subject_to_divestment',
  CONTINGENT_REMAINDER: 'contingent_remainder',
  EXECUTORY_INTEREST_SHIFTING: 'executory_interest_shifting',
  EXECUTORY_INTEREST_SPRINGING: 'executory_interest_springing',
  POSSIBILITY_OF_REVERTER: 'possibility_of_reverter',
  RIGHT_OF_ENTRY: 'right_of_entry',
  REVERSION: 'reversion',
};

/**
 * Which interest types are subject to RAP?
 * Retained interests (reversion, possibility of reverter, right of entry) are NOT subject.
 */
export const RAP_SUBJECT_TYPES = new Set([
  InterestType.CONTINGENT_REMAINDER,
  InterestType.EXECUTORY_INTEREST_SHIFTING,
  InterestType.EXECUTORY_INTEREST_SPRINGING,
  InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN,
]);

/**
 * Beneficiary type — either a specific person or a class descriptor.
 */
export const BeneficiaryType = {
  PERSON: 'person',       // specific named individual
  CLASS: 'class',         // class of persons (e.g., "A's children")
};

/**
 * @typedef {Object} VestingCondition
 * @property {'age'|'event'|'survival'|'administrative'|'none'} type
 * @property {number|null} ageRequirement - For age conditions
 * @property {string|null} eventDescription - For event conditions
 * @property {string|null} survivalOf - Person who must die for interest to vest
 */

/**
 * @typedef {Object} ClassDescriptor
 * @property {string} parentId - The person whose children/grandchildren form the class
 * @property {'children'|'grandchildren'|'issue'|'heirs'} relationship
 * @property {boolean} classClosed - Whether the class is closed (parent dead)
 * @property {string[]} currentMembers - IDs of current class members
 */

/**
 * @typedef {Object} Interest
 * @property {string} id
 * @property {string} type - One of InterestType values
 * @property {string} beneficiaryType - 'person' or 'class'
 * @property {string|null} beneficiaryId - If beneficiaryType is 'person'
 * @property {ClassDescriptor|null} classDescriptor - If beneficiaryType is 'class'
 * @property {VestingCondition} vestingCondition
 * @property {string|null} precedingInterestId - The interest that must end before this one takes effect
 * @property {string} rawText - The natural language text this was parsed from
 * @property {string|null} label - Short human-readable label
 */

let nextInterestId = 1;
export function resetInterestIdCounter(val = 1) {
  nextInterestId = val;
}

/**
 * Create a new Interest.
 */
export function createInterest({
  id = null,
  type,
  beneficiaryType = BeneficiaryType.PERSON,
  beneficiaryId = null,
  classDescriptor = null,
  vestingCondition = { type: 'none', ageRequirement: null, eventDescription: null, survivalOf: null },
  precedingInterestId = null,
  rawText = '',
  label = null,
}) {
  return {
    id: id || `interest_${nextInterestId++}`,
    type,
    beneficiaryType,
    beneficiaryId,
    classDescriptor,
    vestingCondition,
    precedingInterestId,
    rawText,
    label,
  };
}

/**
 * @typedef {Object} Will
 * @property {string} testatorId
 * @property {Date|null} dateOfWill
 * @property {Interest[]} interests
 * @property {string} rawText
 */

/**
 * Create a Will.
 */
export function createWill({
  testatorId,
  dateOfWill = null,
  interests = [],
  rawText = '',
}) {
  return {
    testatorId,
    dateOfWill,
    interests: [...interests],
    rawText,
  };
}

/**
 * Check if an interest is subject to RAP.
 */
export function isSubjectToRap(interest) {
  return RAP_SUBJECT_TYPES.has(interest.type);
}

/**
 * Get a human-readable description of an interest type.
 */
export function getInterestTypeLabel(type) {
  const labels = {
    [InterestType.FEE_SIMPLE_ABSOLUTE]: 'Fee Simple Absolute',
    [InterestType.LIFE_ESTATE]: 'Life Estate',
    [InterestType.FEE_SIMPLE_DETERMINABLE]: 'Fee Simple Determinable',
    [InterestType.FEE_SIMPLE_SUBJECT_TO_CS]: 'Fee Simple Subject to Condition Subsequent',
    [InterestType.FEE_SIMPLE_SUBJECT_TO_EL]: 'Fee Simple Subject to Executory Limitation',
    [InterestType.VESTED_REMAINDER]: 'Vested Remainder',
    [InterestType.VESTED_REMAINDER_SUBJECT_TO_OPEN]: 'Vested Remainder Subject to Open',
    [InterestType.VESTED_REMAINDER_SUBJECT_TO_DIVESTMENT]: 'Vested Remainder Subject to Divestment',
    [InterestType.CONTINGENT_REMAINDER]: 'Contingent Remainder',
    [InterestType.EXECUTORY_INTEREST_SHIFTING]: 'Shifting Executory Interest',
    [InterestType.EXECUTORY_INTEREST_SPRINGING]: 'Springing Executory Interest',
    [InterestType.POSSIBILITY_OF_REVERTER]: 'Possibility of Reverter',
    [InterestType.RIGHT_OF_ENTRY]: 'Right of Entry',
    [InterestType.REVERSION]: 'Reversion',
  };
  return labels[type] || type;
}

/**
 * Get a human-readable description of a vesting condition.
 */
export function getVestingConditionLabel(vc) {
  if (!vc || vc.type === 'none') return 'No condition (vested)';
  if (vc.type === 'age') return `Reach age ${vc.ageRequirement}`;
  if (vc.type === 'survival') return vc.survivalOf ? `Survive ${vc.survivalOf}` : 'Must survive preceding interest holder';
  if (vc.type === 'event') return vc.eventDescription || 'Event occurs';
  if (vc.type === 'administrative') return vc.eventDescription || 'Administrative condition';
  return 'Unknown condition';
}
