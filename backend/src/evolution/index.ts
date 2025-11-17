/**
 * Evolution module exports
 */

export {
  EvolutionEngine,
  type FitnessCriteria,
  type AgentGenome,
  type GenerationResult,
  type AgentStats,
} from './EvolutionEngine';

export {
  GenealogyTracker,
  getGenealogyTracker,
  setGenealogyTracker,
  type GenealogyNode,
  type GenealogyTree,
} from './GenealogyTracker';
