/**
 * Civilization module exports
 * Higher-level social structures: factions, laws, and beliefs
 */

export {
  Faction,
  FactionManager,
} from './FactionManager';

export {
  Law,
  LawType,
  LawViolation,
  LawSystem,
} from './LawSystem';

export {
  Belief,
  Ritual,
  RitualTriggerCondition,
  BeliefSystem,
  getBeliefSystem,
  setBeliefSystem,
} from './BeliefSystem';

export {
  CulturePack,
  CultureTraits,
  CULTURE_PACKS,
  getCulturePack,
  getAllCulturePacks,
  applyCultureTraits,
  shouldCreateLaw,
  shouldCreateBelief,
  getStartingBeliefs,
} from './CulturePacks';
