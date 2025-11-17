/**
 * Planning Engine
 * Generates, evaluates, and manages multi-step plans for agents
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentState,
  Goal,
  Plan,
  PlanStep,
  PlanStatus,
  Action,
  ActionType,
  Position,
  Tile,
  TileType,
} from '../../schemas/types';
import { World } from '../../world/World';

export class PlanningEngine {
  /**
   * Generate a multi-step plan for an agent to achieve a goal
   * Plans are 2-6 steps long
   */
  generatePlan(agent: AgentState, goals: Goal[], world: World, currentTurn: number): Plan | null {
    // Find the highest priority incomplete goal
    const primaryGoal = goals.find(g => g.priority === 'primary' && !g.completed);
    const targetGoal = primaryGoal || goals.find(g => !g.completed);

    if (!targetGoal) {
      return null; // No goals to plan for
    }

    // Determine plan length based on agent personality
    const planLength = this.determinePlanLength(agent);

    // Generate steps based on goal type and agent state
    const steps = this.generatePlanSteps(agent, targetGoal, world, planLength);

    if (steps.length === 0) {
      return null; // Could not generate a valid plan
    }

    // Calculate plan metadata
    const riskLevel = this.calculateRiskLevel(steps, agent);
    const adaptability = this.calculateAdaptability(agent);

    const plan: Plan = {
      id: uuidv4(),
      agentId: agent.id,
      goalId: targetGoal.id,
      steps,
      currentStepIndex: 0,
      status: PlanStatus.ACTIVE,
      createdAt: Date.now(),
      createdAtTurn: currentTurn,
      expectedDuration: steps.length,
      successRate: 0,
      metadata: {
        priority: targetGoal.priority === 'primary' ? 'high' : 'medium',
        adaptability,
        riskLevel,
      },
    };

    return plan;
  }

  /**
   * Evaluate a plan's viability given current conditions
   * Returns a score from 0-100 indicating plan quality
   */
  evaluatePlan(agent: AgentState, plan: Plan, world: World): number {
    let score = 50; // Base score

    // Check if goal is still valid
    const goal = agent.goals.find(g => g.id === plan.goalId);
    if (!goal || goal.completed) {
      return 0; // Plan is obsolete
    }

    // Evaluate current step feasibility
    const currentStep = plan.steps[plan.currentStepIndex];
    if (currentStep) {
      const stepFeasibility = this.evaluateStepFeasibility(currentStep, agent, world);
      score += stepFeasibility * 0.4; // 40% weight on current step
    }

    // Check if agent has sufficient resources for next few steps
    const resourceAdequacy = this.checkResourceAdequacy(agent, plan);
    score += resourceAdequacy * 0.3; // 30% weight on resources

    // Factor in agent's current health and energy
    const agentReadiness = (agent.health / 100 + agent.stats.energy / 100) / 2;
    score += agentReadiness * 0.2; // 20% weight on agent condition

    // Consider plan's current success rate
    score += plan.successRate * 0.1; // 10% weight on historical success

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Execute the next step of an agent's active plan
   * Returns the action to execute
   */
  executePlanStep(agent: AgentState): Action | null {
    if (!agent.activePlan || agent.activePlan.status !== PlanStatus.ACTIVE) {
      return null;
    }

    const plan = agent.activePlan;
    const currentStep = plan.steps[plan.currentStepIndex];

    if (!currentStep) {
      // Plan is complete
      this.completePlan(agent);
      return null;
    }

    // Return the action from the current step
    return currentStep.action;
  }

  /**
   * Mark a plan step as completed and advance to next step
   */
  advancePlan(agent: AgentState, stepSuccess: boolean): void {
    if (!agent.activePlan) return;

    const plan = agent.activePlan;

    // Update success rate
    const totalSteps = plan.currentStepIndex + 1;
    const successfulSteps = Math.floor(plan.successRate * plan.currentStepIndex / 100) + (stepSuccess ? 1 : 0);
    plan.successRate = (successfulSteps / totalSteps) * 100;

    // Move to next step
    plan.currentStepIndex++;

    // Check if plan is complete
    if (plan.currentStepIndex >= plan.steps.length) {
      this.completePlan(agent);
    }
  }

  /**
   * Mark a plan as completed
   */
  private completePlan(agent: AgentState): void {
    if (!agent.activePlan) return;

    const plan = agent.activePlan;
    plan.status = PlanStatus.COMPLETED;
    plan.completedAt = Date.now();
    plan.actualDuration = plan.currentStepIndex;

    // Move to history
    agent.planHistory.completedPlans.push({ ...plan });
    agent.planHistory.totalPlansCreated++;
    this.updateHistoryStats(agent);

    // Clear active plan
    agent.activePlan = undefined;
  }

  /**
   * Mark a plan as failed
   */
  failPlan(agent: AgentState, reason?: string): void {
    if (!agent.activePlan) return;

    const plan = agent.activePlan;
    plan.status = PlanStatus.FAILED;
    plan.completedAt = Date.now();
    plan.actualDuration = plan.currentStepIndex;

    // Move to history
    agent.planHistory.failedPlans.push({ ...plan });
    agent.planHistory.totalPlansCreated++;
    this.updateHistoryStats(agent);

    // Clear active plan
    agent.activePlan = undefined;
  }

  /**
   * Abandon a plan (e.g., when switching to a better plan)
   */
  abandonPlan(agent: AgentState): void {
    if (!agent.activePlan) return;

    const plan = agent.activePlan;
    plan.status = PlanStatus.ABANDONED;
    plan.completedAt = Date.now();
    plan.actualDuration = plan.currentStepIndex;

    // Move to history
    agent.planHistory.abandonedPlans.push({ ...plan });
    agent.planHistory.totalPlansCreated++;
    this.updateHistoryStats(agent);

    // Clear active plan
    agent.activePlan = undefined;
  }

  /**
   * Generate plan steps based on goal and context
   */
  private generatePlanSteps(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    // Analyze goal to determine strategy
    const goalLower = goal.description.toLowerCase();

    // Resource gathering goals
    if (goalLower.includes('gather') || goalLower.includes('resource') || goalLower.includes('collect')) {
      return this.generateResourceGatheringPlan(agent, goal, world, planLength);
    }

    // Combat/survival goals
    if (goalLower.includes('survive') || goalLower.includes('last') || goalLower.includes('standing')) {
      return this.generateSurvivalPlan(agent, goal, world, planLength);
    }

    // Alliance/cooperation goals
    if (goalLower.includes('alliance') || goalLower.includes('cooperate') || goalLower.includes('team')) {
      return this.generateAlliancePlan(agent, goal, world, planLength);
    }

    // Exploration goals
    if (goalLower.includes('explore') || goalLower.includes('discover') || goalLower.includes('map')) {
      return this.generateExplorationPlan(agent, goal, world, planLength);
    }

    // Default: balanced approach
    return this.generateBalancedPlan(agent, goal, world, planLength);
  }

  /**
   * Generate a resource gathering plan
   */
  private generateResourceGatheringPlan(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];
    const nearbyResources = this.findNearbyResources(agent.position, world, 5);

    for (let i = 0; i < planLength && i < nearbyResources.length * 2; i++) {
      if (i % 2 === 0 && nearbyResources.length > 0) {
        // Move towards resource
        const resource = nearbyResources[Math.floor(i / 2)];
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.MOVE,
            agentId: agent.id,
            target: resource.position,
          },
          expectedOutcome: `Move towards ${resource.type} at (${resource.position.x},${resource.position.y})`,
          reasoning: 'Positioning for resource gathering',
        });
      } else {
        // Gather resource
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.GATHER,
            agentId: agent.id,
          },
          expectedOutcome: 'Collect resources from current tile',
          reasoning: 'Gathering resources to fulfill goal',
          fallbackAction: {
            type: ActionType.REST,
            agentId: agent.id,
          },
        });
      }
    }

    return steps;
  }

  /**
   * Generate a survival-focused plan
   */
  private generateSurvivalPlan(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    // Prioritize safety and resource gathering
    for (let i = 0; i < planLength; i++) {
      if (agent.stats.energy < 50 && i < 2) {
        // Rest if energy is low
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.REST,
            agentId: agent.id,
          },
          expectedOutcome: 'Restore energy',
          reasoning: 'Low energy - need to rest for survival',
        });
      } else if (agent.inventory.food < 20 || agent.inventory.water < 20) {
        // Gather resources if supplies are low
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.GATHER,
            agentId: agent.id,
          },
          expectedOutcome: 'Collect food and water',
          reasoning: 'Low supplies - need resources to survive',
          fallbackAction: {
            type: ActionType.EXPLORE,
            agentId: agent.id,
          },
        });
      } else {
        // Explore for better positions
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.EXPLORE,
            agentId: agent.id,
          },
          expectedOutcome: 'Find strategic position',
          reasoning: 'Exploring for safer location or resources',
        });
      }
    }

    return steps;
  }

  /**
   * Generate an alliance-building plan
   */
  private generateAlliancePlan(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    // Strategy: communicate, build trust, form alliance
    const stepsNeeded = Math.min(planLength, 4);

    for (let i = 0; i < stepsNeeded; i++) {
      if (i === 0) {
        steps.push({
          stepNumber: 1,
          action: {
            type: ActionType.EXPLORE,
            agentId: agent.id,
          },
          expectedOutcome: 'Find potential allies',
          reasoning: 'Need to locate other agents to form alliance',
        });
      } else if (i === 1) {
        steps.push({
          stepNumber: 2,
          action: {
            type: ActionType.COMMUNICATE,
            agentId: agent.id,
            payload: { message: 'Seeking cooperation' },
          },
          expectedOutcome: 'Establish communication with nearby agents',
          reasoning: 'Building rapport for alliance',
        });
      } else if (i === 2) {
        steps.push({
          stepNumber: 3,
          action: {
            type: ActionType.SHARE,
            agentId: agent.id,
            payload: { resourceType: 'food', amount: 5 },
          },
          expectedOutcome: 'Share resources to build trust',
          reasoning: 'Demonstrating cooperation and goodwill',
          fallbackAction: {
            type: ActionType.COMMUNICATE,
            agentId: agent.id,
          },
        });
      } else {
        steps.push({
          stepNumber: 4,
          action: {
            type: ActionType.FORM_ALLIANCE,
            agentId: agent.id,
          },
          expectedOutcome: 'Form formal alliance',
          reasoning: 'Completing alliance formation',
        });
      }
    }

    return steps;
  }

  /**
   * Generate an exploration plan
   */
  private generateExplorationPlan(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    for (let i = 0; i < planLength; i++) {
      steps.push({
        stepNumber: i + 1,
        action: {
          type: ActionType.EXPLORE,
          agentId: agent.id,
        },
        expectedOutcome: 'Discover new areas of the world',
        reasoning: 'Systematic exploration to achieve goal',
        fallbackAction: {
          type: ActionType.MOVE,
          agentId: agent.id,
          target: this.getRandomPosition(world),
        },
      });
    }

    return steps;
  }

  /**
   * Generate a balanced plan
   */
  private generateBalancedPlan(
    agent: AgentState,
    goal: Goal,
    world: World,
    planLength: number
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    // Mix of gathering, exploring, and resting
    for (let i = 0; i < planLength; i++) {
      if (i % 3 === 0) {
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.GATHER,
            agentId: agent.id,
          },
          expectedOutcome: 'Collect available resources',
          reasoning: 'Maintaining resource supplies',
        });
      } else if (i % 3 === 1) {
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.EXPLORE,
            agentId: agent.id,
          },
          expectedOutcome: 'Explore surrounding area',
          reasoning: 'Gathering information and finding opportunities',
        });
      } else {
        steps.push({
          stepNumber: i + 1,
          action: {
            type: ActionType.REST,
            agentId: agent.id,
          },
          expectedOutcome: 'Restore energy',
          reasoning: 'Maintaining operational capacity',
        });
      }
    }

    return steps;
  }

  /**
   * Determine optimal plan length based on agent personality
   */
  private determinePlanLength(agent: AgentState): number {
    // Base length
    let length = 3;

    // Curious agents prefer longer plans
    if (agent.stats.curiosity > 70) {
      length += 1;
    }

    // Risk-averse agents prefer shorter plans
    if (agent.stats.riskTolerance < 30) {
      length -= 1;
    }

    // Cooperative agents plan moderately
    if (agent.stats.cooperation > 60) {
      length = 4;
    }

    // Ensure within bounds (2-6)
    return Math.max(2, Math.min(6, length));
  }

  /**
   * Calculate risk level of a plan
   */
  private calculateRiskLevel(steps: PlanStep[], agent: AgentState): number {
    let riskScore = 0;

    steps.forEach(step => {
      if (step.action.type === ActionType.ATTACK) {
        riskScore += 30;
      } else if (step.action.type === ActionType.EXPLORE) {
        riskScore += 15;
      } else if (step.action.type === ActionType.NEGOTIATE) {
        riskScore += 10;
      } else if (step.action.type === ActionType.REST) {
        riskScore -= 5;
      }
    });

    // Adjust based on agent's risk tolerance
    riskScore = riskScore * (1 - agent.stats.riskTolerance / 100);

    return Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Calculate plan adaptability
   */
  private calculateAdaptability(agent: AgentState): number {
    // Based on agent's flexibility and intelligence stats
    const baseAdaptability = 50;
    const curiosityBonus = agent.stats.curiosity * 0.3;
    const cooperationBonus = agent.stats.cooperation * 0.2;

    return Math.min(100, baseAdaptability + curiosityBonus + cooperationBonus);
  }

  /**
   * Evaluate feasibility of a single step
   */
  private evaluateStepFeasibility(step: PlanStep, agent: AgentState, world: World): number {
    let feasibility = 50;

    // Check energy requirements
    if (agent.stats.energy < 20 && step.action.type !== ActionType.REST) {
      feasibility -= 30;
    }

    // Check if target position is valid
    if (step.action.target && typeof step.action.target !== 'string') {
      const target = step.action.target as Position;
      const tile = world.getTile(target);
      if (!tile || tile.type === TileType.OBSTACLE) {
        feasibility -= 40;
      }
    }

    // Actions that require resources
    if (step.action.type === ActionType.SHARE || step.action.type === ActionType.ATTACK) {
      if (agent.inventory.food < 10 && agent.inventory.water < 10) {
        feasibility -= 20;
      }
    }

    return Math.max(0, Math.min(100, feasibility));
  }

  /**
   * Check if agent has adequate resources for plan
   */
  private checkResourceAdequacy(agent: AgentState, plan: Plan): number {
    const remainingSteps = plan.steps.length - plan.currentStepIndex;
    const avgResourceCost = 5; // Estimated cost per step

    const totalResources = agent.inventory.food + agent.inventory.water + agent.inventory.material;
    const estimatedNeed = remainingSteps * avgResourceCost;

    if (totalResources >= estimatedNeed * 1.5) {
      return 100; // Plenty of resources
    } else if (totalResources >= estimatedNeed) {
      return 70; // Adequate resources
    } else if (totalResources >= estimatedNeed * 0.5) {
      return 40; // Low resources
    } else {
      return 10; // Critically low
    }
  }

  /**
   * Find nearby resources
   */
  private findNearbyResources(position: Position, world: World, radius: number): Tile[] {
    const resources: Tile[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tile = world.getTile({ x: position.x + dx, y: position.y + dy });
        if (tile && (
          tile.type === TileType.RESOURCE_FOOD ||
          tile.type === TileType.RESOURCE_WATER ||
          tile.type === TileType.RESOURCE_MATERIAL
        )) {
          resources.push(tile);
        }
      }
    }

    return resources;
  }

  /**
   * Get a random position in the world
   * Uses a fallback approach since World dimensions are private
   */
  private getRandomPosition(world: World): Position {
    // Generate a position in a reasonable range (assuming typical world size)
    // This is used as a fallback for explore actions
    return {
      x: Math.floor(Math.random() * 30),
      y: Math.floor(Math.random() * 30),
    };
  }

  /**
   * Update agent's planning history statistics
   */
  private updateHistoryStats(agent: AgentState): void {
    const history = agent.planHistory;

    // Calculate average success rate
    const allPlans = [
      ...history.completedPlans,
      ...history.failedPlans,
      ...history.abandonedPlans,
    ];

    if (allPlans.length > 0) {
      const totalSuccess = allPlans.reduce((sum, plan) => sum + plan.successRate, 0);
      history.averageSuccessRate = totalSuccess / allPlans.length;

      // Calculate preferred plan length
      const totalLength = allPlans.reduce((sum, plan) => sum + plan.steps.length, 0);
      history.preferredPlanLength = Math.round(totalLength / allPlans.length);
    }
  }
}
