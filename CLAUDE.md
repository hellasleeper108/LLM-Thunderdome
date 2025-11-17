# CLAUDE.md - AI Assistant Developer Guide

**LLM Thunderdome** - A sophisticated multi-agent simulation platform where AI agents interact, battle, cooperate, and evolve in a dynamic 2D world.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Codebase Structure](#codebase-structure)
4. [Key Systems & Components](#key-systems--components)
5. [Development Workflows](#development-workflows)
6. [Code Conventions & Patterns](#code-conventions--patterns)
7. [Common Development Tasks](#common-development-tasks)
8. [Testing & Quality Assurance](#testing--quality-assurance)
9. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## Project Overview

### What is LLM Thunderdome?

A real-time simulation environment where multiple AI agents (powered by LLMs or scripted logic) interact within a 2D grid-based world. Agents can:
- Gather resources (food, water, materials)
- Form and break alliances
- Engage in combat
- Negotiate and communicate
- Evolve their personalities based on experiences

### Key Features

- **Multi-Agent System**: Support for LLM-powered and rule-based scripted agents
- **Advanced Memory System**: Episodic (experiences) + Semantic (facts) memory with consolidation
- **Social Dynamics**: Multi-dimensional relationship tracking (trust, fear, respect, rivalry, loyalty)
- **Dynamic Trait Drift**: Personality traits evolve based on actions and outcomes
- **Alliance Mechanics**: Form strategic partnerships with strength tracking
- **Negotiation Engine**: Trade, alliance formation, threats, aid requests
- **Real-Time Dashboard**: React-based frontend with WebSocket updates
- **Preset Scenarios**: 3 pre-configured simulations (Cooperative, Competitive, Diplomatic)

### Project Goals

1. Study emergent behaviors in multi-agent systems
2. Test negotiation and cooperation algorithms
3. Benchmark LLM reasoning capabilities
4. Provide educational demonstrations of AI decision-making
5. Enable AI tournament competitions

---

## Architecture & Technology Stack

### Backend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | v18+ |
| **TypeScript** | Type-safe development | ^5.3.3 |
| **Express.js** | HTTP server & REST API | ^4.18.2 |
| **WebSocket (ws)** | Real-time bidirectional communication | ^8.16.0 |
| **Zod** | Runtime schema validation | ^3.22.4 |
| **uuid** | Unique ID generation | ^9.0.1 |
| **tsx** | TypeScript executor for dev | ^4.7.0 |
| **Jest** | Testing framework | ^29.7.0 |

**Server Port**: 3001 (configurable via `PORT` env var)

### Frontend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | ^18.2.0 |
| **TypeScript** | Type-safe development | ^5.3.3 |
| **Vite** | Build tool & dev server | ^5.0.12 |
| **Zustand** | State management | ^4.4.7 |
| **Tailwind CSS** | Utility-first styling | ^3.4.1 |
| **ESLint** | Code linting | ^8.56.0 |

**Dev Server Port**: 3000 (auto-proxied to backend)

### Workspace Structure

This is a **monorepo** using npm workspaces:
- Root: Build orchestration and concurrent dev mode
- `backend/`: Server application
- `frontend/`: React application

---

## Codebase Structure

### Complete Directory Tree

```
LLM-Thunderdome/
├── backend/                          # Node.js/Express/TypeScript server
│   ├── src/
│   │   ├── index.ts                  # Main server (REST + WebSocket)
│   │   ├── agents/                   # Agent system
│   │   │   ├── BaseAgent.ts          # Abstract base class (446 lines)
│   │   │   ├── LLMAgent.ts           # LLM-powered with mock fallback (281 lines)
│   │   │   ├── ScriptedAgent.ts      # Rule-based, 5 strategies (405 lines)
│   │   │   ├── AllianceManager.ts    # Alliance lifecycle management
│   │   │   ├── SocialGraph.ts        # Relationship tracking
│   │   │   ├── TraitDrift.ts         # Dynamic personality evolution
│   │   │   ├── personalities.ts      # 8 predefined profiles
│   │   │   ├── index.ts              # Module exports
│   │   │   └── memory/               # Advanced memory subsystem
│   │   │       ├── MemoryManager.ts  # Orchestrates episodic + semantic
│   │   │       ├── EpisodicMemory.ts # Specific experiences (max 100)
│   │   │       ├── SemanticMemory.ts # General facts (max 50)
│   │   │       └── index.ts
│   │   ├── world/
│   │   │   ├── World.ts              # 2D grid with resources/obstacles (334 lines)
│   │   │   └── index.ts
│   │   ├── engine/
│   │   │   ├── SimulationEngine.ts   # Turn-based orchestrator (400+ lines)
│   │   │   ├── NegotiationEngine.ts  # Trade/alliance/threat handling
│   │   │   └── index.ts
│   │   ├── state/
│   │   │   ├── StateManager.ts       # Centralized state + pub/sub
│   │   │   └── index.ts
│   │   ├── logging/
│   │   │   ├── EventLogger.ts        # Event logging + exports
│   │   │   └── index.ts
│   │   ├── events/
│   │   │   ├── CommunicationProtocol.ts
│   │   │   └── index.ts
│   │   ├── schemas/
│   │   │   └── types.ts              # All TypeScript type definitions (200+ lines)
│   │   └── simulations/
│   │       ├── presets.ts            # 3 preset scenarios
│   │       └── index.ts
│   ├── dist/                         # Compiled JavaScript output
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # React/Vite/Tailwind app
│   ├── src/
│   │   ├── App.tsx                   # Main app orchestrator (135 lines)
│   │   ├── main.tsx                  # Entry point
│   │   ├── store.ts                  # Zustand global state (52 lines)
│   │   ├── api.ts                    # Backend API client (162 lines)
│   │   ├── types.ts                  # Frontend type definitions
│   │   ├── index.css                 # Tailwind styles
│   │   └── components/
│   │       ├── ArenaView.tsx         # Grid visualization
│   │       ├── AgentInspector.tsx    # Agent details panel
│   │       ├── EventLog.tsx          # Scrollable event history
│   │       └── SimulationControls.tsx # UI buttons + preset selector
│   ├── index.html
│   ├── vite.config.ts                # Vite config with API proxy
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .eslintrc.cjs
│   └── package.json
│
├── package.json                      # Root workspace config
├── README.md                         # User-facing documentation
├── CLAUDE.md                         # This file (AI assistant guide)
└── .gitignore
```

### Critical Path Files

When working on this codebase, these are the most frequently modified files:

| File | Purpose | Modification Frequency |
|------|---------|------------------------|
| `backend/src/agents/BaseAgent.ts` | Core agent behavior | High |
| `backend/src/agents/ScriptedAgent.ts` | Strategy implementation | High |
| `backend/src/engine/SimulationEngine.ts` | Turn execution logic | Medium |
| `backend/src/schemas/types.ts` | Type definitions (affects both BE & FE) | Medium |
| `frontend/src/components/ArenaView.tsx` | Visualization | Medium |
| `backend/src/simulations/presets.ts` | New scenarios | Low |
| `backend/src/agents/personalities.ts` | New agent types | Low |

---

## Key Systems & Components

### 1. Agent System (`backend/src/agents/`)

**Architecture**: Abstract base class with two concrete implementations

```
BaseAgent (abstract)
├── LLMAgent (calls real LLM or intelligent mock)
└── ScriptedAgent (5 deterministic strategies)
```

**Core Stats (0-100)**:
- `energy`: Depletes with actions, restored by resting
- `aggression`: Likelihood to attack, damage dealt
- `cooperation`: Willingness to form alliances and share
- `riskTolerance`: Probability of taking dangerous actions
- `curiosity`: Drive to explore unknown areas
- `empathy`: Consideration for other agents' well-being

**Decision-Making Flow**:
1. Receive `Observation` (nearby agents, tiles, messages)
2. Call `decideAction(observation)` (implemented by subclass)
3. Return `Action` (type, target, payload)
4. Engine executes action and broadcasts result

**Key Methods**:
- `decideAction(observation: Observation): Promise<Action>` - Abstract, must implement
- `observe(observation: Observation): void` - Update memory
- `addToMemory(entry: MemoryEntry, term: 'short' | 'long'): void`
- `updateStats(changes: Partial<AgentStats>): void`
- `getState(): AgentState` - Returns immutable copy

**8 Predefined Personalities** (`personalities.ts`):
1. **Cooperative Helper** - High empathy & cooperation
2. **Resource Hoarder** - Greedy, low empathy
3. **Curious Explorer** - High curiosity & risk tolerance
4. **Diplomat** - Master negotiator
5. **Aggressive Warrior** - High aggression, dominance-focused
6. **Cautious Survivor** - Risk-averse, defensive
7. **Charismatic Leader** - Natural leader who inspires
8. **Lone Wolf** - Independent, distrustful

### 2. Memory System (`backend/src/agents/memory/`)

**Two-Tier Architecture**:

**Episodic Memory** (`EpisodicMemory.ts`):
- Stores specific events with decay
- Max 100 episodes (configurable)
- Each episode has: content, timestamp, importance (0-100), emotional valence (-100 to 100)
- Decay: 0.5 strength per turn
- Important memories (importance > 50) retained longer

**Semantic Memory** (`SemanticMemory.ts`):
- Stores general facts about agents, relationships, strategies
- Max 50 facts (configurable)
- Each fact has: content, confidence (0-100), timestamps
- Reinforcement: facts gain confidence when re-observed
- Decay: slowly lose confidence if not reinforced

**Memory Manager** (`MemoryManager.ts`):
- Orchestrates both tiers
- **Consolidation**: Every 10 turns, high-importance episodes → semantic facts
- Querying: `queryRecent()`, `queryImportant()`, `queryAboutAgent()`

**Usage Pattern**:
```typescript
// Record episodic memory
memoryManager.recordEpisode({
  content: "Formed alliance with Agent-123",
  importance: 80,
  emotionalValence: 60,
  context: { agentId: "Agent-123" }
});

// Query memories
const recentMemories = memoryManager.queryRecent(5);
const importantMemories = memoryManager.queryImportant(10);

// Consolidation (called by engine every 10 turns)
memoryManager.consolidate(currentTurn);
```

### 3. Social Graph System (`backend/src/agents/SocialGraph.ts`)

**Multi-Dimensional Relationship Tracking**:

Each agent-to-agent relationship has 5 dimensions (0-100):
- `trust`: Reliability, likelihood to cooperate
- `fear`: Threat perception, avoidance behavior
- `respect`: Admiration for capabilities
- `rivalry`: Competitive tension
- `loyalty`: Commitment to alliance

**Key Features**:
- **Directed Graph**: Trust(A→B) ≠ Trust(B→A)
- **Auto-Decay**: All relationships decay 1 point per turn (prevents stagnation)
- **Manual Adjustments**: Actions modify specific dimensions
- **Asymmetric**: Enables realistic, emergent social dynamics

**Usage Pattern**:
```typescript
// Initialize
const socialGraph = new SocialGraph(agentId);

// Modify relationships
socialGraph.adjustTrust(targetId, 15);   // Increase trust
socialGraph.adjustFear(attackerId, 30);  // Increase fear
socialGraph.adjustRivalry(competitorId, -10); // Reduce rivalry

// Query relationships
const relationship = socialGraph.getRelationship(targetId);
console.log(relationship.trust);  // 75

// Decay per turn
socialGraph.decay();
```

### 4. Alliance System (`backend/src/agents/AllianceManager.ts`)

**Alliance Lifecycle**:
1. **Formation**: Based on personality compatibility + social graph bonus
2. **Tracking**: Strength (0-100), conditions (protection, sharing, exclusivity)
3. **Breaking**: Reduces trust/loyalty, increases rivalry

**Compatibility Calculation**:
```
compatibility = (
  personality_match * 0.6 +
  social_trust * 0.3 +
  social_loyalty * 0.1
)
```

**Alliance Conditions**:
- `mutualProtection`: Members defend each other in combat
- `resourceSharing`: Share resources when requested
- `exclusivity`: Cannot form competing alliances

**Usage Pattern**:
```typescript
const allianceManager = new AllianceManager(agentId);

// Form alliance
const success = allianceManager.formAlliance(
  targetAgent,
  socialGraph,
  { mutualProtection: true, resourceSharing: true }
);

// Check alliance
const isAllied = allianceManager.isAlliedWith(targetId);
const strength = allianceManager.getAllianceStrength(targetId);

// Break alliance
allianceManager.breakAlliance(targetId, socialGraph);
```

### 5. Trait Drift System (`backend/src/agents/TraitDrift.ts`)

**Dynamic Personality Evolution**:

Personality traits evolve based on:
- **Actions Taken**: Aggressive actions → increase aggression
- **Outcomes**: Successful cooperation → increase cooperation
- **Relationships**: Strong alliances → increase empathy
- **Experiences**: Dangerous events → adjust risk tolerance

**Constraints**:
- Max ±5 change per turn (prevents wild swings)
- All traits bounded [0, 100]
- Gradual drift creates realistic character arcs

**Usage Pattern**:
```typescript
const traitDrift = new TraitDrift(agentId);

// Adjust based on action
traitDrift.adjustFromAction('ATTACK', { success: true });
// Result: aggression +2, cooperation -1

// Adjust based on relationship
traitDrift.adjustFromRelationship(
  'alliance_formed',
  { trust: 80, loyalty: 70 }
);
// Result: cooperation +3, empathy +2

// Apply drift to agent stats
const newStats = traitDrift.applyDrift(currentStats);
```

### 6. Negotiation Engine (`backend/src/engine/NegotiationEngine.ts`)

**Protocols Supported**:
1. **TRADE**: Exchange resources
2. **ALLIANCE**: Form partnership
3. **THREAT**: Coerce behavior
4. **REQUEST_AID**: Ask for help

**Evaluation Logic**:
- Considers personality traits (cooperation, empathy, risk tolerance)
- Factors in relationship (trust, fear, loyalty)
- Calculates resource needs and strategic value
- Generates counter-offers if initial offer rejected

**Usage Pattern**:
```typescript
const negotiationEngine = new NegotiationEngine();

// Evaluate offer
const response = negotiationEngine.evaluateOffer({
  protocol: 'TRADE',
  initiator: agentA,
  recipient: agentB,
  offer: { give: { food: 10 }, receive: { water: 5 } },
  relationship: socialGraph.getRelationship(agentB.id)
});

if (response.accepted) {
  // Execute trade
} else if (response.counterOffer) {
  // Present counter-offer
}
```

### 7. World System (`backend/src/world/World.ts`)

**2D Grid-Based Environment**:

**Tile Types**:
- `EMPTY`: Traversable, no resources
- `RESOURCE_FOOD/WATER/MATERIAL`: Gatherable resources (value: 5-15 units)
- `OBSTACLE`: Impassable barrier
- `EVENT_STORM/ANOMALY/BOON`: Random events with effects

**Configuration**:
```typescript
const world = new World({
  width: 20,
  height: 20,
  resourceDensity: 0.15,    // 15% of tiles have resources
  obstacleDensity: 0.10,    // 10% are obstacles
  eventFrequency: 0.05      // 5% chance of events per turn
});
```

**Key Methods**:
- `getTile(position: Position): Tile | null`
- `gatherResource(position: Position, amount: number): number`
- `getAdjacentTiles(position: Position): Tile[]`
- `spawnEvent(): void` - Random event generation
- `regenerateResources(): void` - 5% of empty tiles repopulated

**Distance Calculation**: Manhattan distance (|x1-x2| + |y1-y2|)

### 8. Simulation Engine (`backend/src/engine/SimulationEngine.ts`)

**Turn-Based Orchestration**:

**Execution Flow**:
1. Increment turn counter
2. For each alive agent:
   - Generate observation (vision radius = 3)
   - Call `agent.decideAction(observation)`
   - Execute action (MOVE, GATHER, ATTACK, etc.)
   - Log result
3. Update world state (events, resource regeneration)
4. Memory consolidation (every 10 turns)
5. Trait drift application
6. Social graph decay
7. Broadcast state to all clients
8. Check win/end conditions

**Action Types**:
- `MOVE`: Change position (±1 tile)
- `GATHER`: Collect resources from current tile
- `ATTACK`: Damage another agent (range ≤ 1)
- `COMMUNICATE`: Send message to nearby agents
- `REST`: Restore energy (+10)
- `SHARE`: Transfer resources to ally
- `EXPLORE`: Move to unvisited tiles
- `NEGOTIATE`: Initiate negotiation protocol
- `FORM_ALLIANCE`: Propose alliance
- `BREAK_ALLIANCE`: Terminate alliance

**Status States**:
- `idle`: Not yet created
- `running`: Executing turns automatically
- `paused`: Halted, can resume
- `completed`: Reached max turns or win condition

### 9. State Management (`backend/src/state/StateManager.ts`)

**Pub/Sub Pattern**:
- Centralized state store
- Subscribers notified on changes
- Supports multiple concurrent viewers

**Usage Pattern**:
```typescript
const stateManager = new StateManager();

// Subscribe to updates
stateManager.subscribe((newState) => {
  console.log('State updated:', newState);
});

// Update state
stateManager.setState({ status: 'running' });
```

### 10. Event Logging (`backend/src/logging/EventLogger.ts`)

**Log Types**:
- `action`: Agent actions (MOVE, GATHER, ATTACK, etc.)
- `interaction`: Agent-to-agent interactions
- `resource_change`: Resource gathering/sharing
- `dialogue`: Communication between agents
- `state_update`: World/simulation state changes
- `event`: Random world events

**Export Formats**:
1. **JSON**: Structured data for analysis
2. **Transcript**: Human-readable narrative

**Usage Pattern**:
```typescript
const logger = new EventLogger();

// Log event
logger.log({
  turn: 5,
  type: 'action',
  agentId: 'agent-123',
  message: 'Gathered 10 food'
});

// Query logs
const recentLogs = logger.query({ turn: 5, limit: 10 });

// Export
const jsonExport = logger.exportJSON();
const transcript = logger.exportTranscript();
```

---

## Development Workflows

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd LLM-Thunderdome

# Install all dependencies
npm run install:all

# OR manually:
npm install           # Root dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Development Mode

**Option 1: Concurrent (Recommended)**
```bash
# From root directory
npm run dev

# This runs:
# - Backend on http://localhost:3001
# - Frontend on http://localhost:3000 (auto-proxied)
```

**Option 2: Separate Terminals**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Building for Production

```bash
# Build both backend and frontend
npm run build

# OR separately:
cd backend && npm run build   # Outputs to backend/dist/
cd frontend && npm run build  # Outputs to frontend/dist/
```

### Running Production Build

```bash
# Backend
cd backend
npm start  # Runs node dist/index.js

# Frontend (preview)
cd frontend
npm run preview
```

### Common Development Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `npm run dev` | Root | Start both servers concurrently |
| `npm run build` | Root | Build both projects |
| `npm run dev:backend` | Root | Start only backend |
| `npm run dev:frontend` | Root | Start only frontend |
| `npm run dev` | Backend | Start backend with tsx watch |
| `npm run build` | Backend | Compile TypeScript to dist/ |
| `npm run test` | Backend | Run Jest tests |
| `npm run dev` | Frontend | Start Vite dev server |
| `npm run build` | Frontend | Build production bundle |
| `npm run lint` | Frontend | Run ESLint |

### Git Workflow

**Commit Message Convention**:
```
feat: Add feature description
fix: Fix bug description
refactor: Refactor description
docs: Documentation update
test: Add/update tests
chore: Maintenance tasks
```

**Examples from History**:
```
feat: Add comprehensive memory subsystem with episodic and semantic memory
feat: Add dynamic psychological trait drift system
feat: Add SocialGraph system for multi-dimensional relationship tracking
```

**Branching**:
- Work on feature branches: `claude/feature-name-*`
- Push to designated branch (provided in task context)
- Never push directly to main without permission

---

## Code Conventions & Patterns

### TypeScript Configuration

**Backend** (`backend/tsconfig.json`):
- Target: ES2022
- Module: CommonJS
- Strict mode: ON
- Source maps: Generated
- Declaration files: Generated
- Output: `dist/` directory

**Frontend** (`frontend/tsconfig.json`):
- Target: ES2020
- Module: ESNext
- Strict mode: ON
- JSX: react-jsx
- No emit (Vite handles compilation)
- Unused locals/parameters: Error

### Code Style

**Naming Conventions**:
- **Classes**: PascalCase (`BaseAgent`, `MemoryManager`)
- **Interfaces**: PascalCase (`AgentState`, `Personality`)
- **Enums**: PascalCase with UPPER_CASE values (`ActionType.MOVE`)
- **Functions/Methods**: camelCase (`decideAction`, `gatherResource`)
- **Constants**: UPPER_SNAKE_CASE for config (`MAX_EPISODES`)
- **Files**: PascalCase for classes (`BaseAgent.ts`), camelCase for modules (`types.ts`)

**Import Organization**:
```typescript
// 1. External dependencies
import { v4 as uuidv4 } from 'uuid';
import express from 'express';

// 2. Internal type definitions
import { AgentState, Action, Observation } from '../schemas/types';

// 3. Internal modules
import { MemoryManager } from './memory/MemoryManager';
```

**JSDoc Comments**:
```typescript
/**
 * Brief description of the function
 * @param observation - Current observation of the world
 * @returns The action to perform
 */
abstract decideAction(observation: Observation): Promise<Action>;
```

**File Headers**:
```typescript
/**
 * Brief description of the file's purpose
 */
```

### Type Safety

**Strict Typing**:
- Always define interfaces for complex objects
- Use `enum` for fixed sets of values
- Avoid `any` type (use `unknown` if type is truly unknown)
- Use `Partial<T>` for optional property updates
- Use `Record<string, any>` for dynamic metadata objects

**Example**:
```typescript
// Good
interface UpdateStats {
  energy?: number;
  aggression?: number;
}

function updateStats(changes: Partial<AgentStats>): void {
  // ...
}

// Avoid
function updateStats(changes: any): void {
  // ...
}
```

### Async/Await

**Pattern**: All agent decisions are async (supports real LLM calls)

```typescript
// Agent decision-making
async decideAction(observation: Observation): Promise<Action> {
  // May call external API
  const decision = await this.callLLM(observation);
  return this.parseAction(decision);
}

// Engine execution
async executeTurn(): Promise<void> {
  for (const agent of this.agents) {
    const action = await agent.decideAction(observation);
    this.executeAction(action);
  }
}
```

### Immutability

**Pattern**: Return copies, never expose internal state

```typescript
// Good
getState(): AgentState {
  return JSON.parse(JSON.stringify(this.state));
}

// Avoid
getState(): AgentState {
  return this.state; // Direct reference, mutable!
}
```

### Error Handling

**Pattern**: Try-catch with fallbacks

```typescript
// LLMAgent with fallback
async decideAction(observation: Observation): Promise<Action> {
  try {
    const response = await this.callRealLLM(observation);
    return this.parseResponse(response);
  } catch (error) {
    console.error('LLM call failed, using mock:', error);
    return this.mockDecision(observation);
  }
}
```

**API Endpoints**: Return appropriate HTTP status codes
```typescript
app.post('/api/simulation/start', (req, res) => {
  try {
    engine.start();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Memory Management

**Episodic Memory Limits**:
```typescript
const MAX_EPISODES = 100;
const EPISODE_DECAY_RATE = 0.5; // per turn

// Prune weak memories
if (episodes.length > MAX_EPISODES) {
  episodes.sort((a, b) => b.importance - a.importance);
  episodes = episodes.slice(0, MAX_EPISODES);
}
```

**Short-Term Memory Limits**:
```typescript
const MAX_SHORT_TERM = 20;

if (this.state.memory.shortTerm.length > MAX_SHORT_TERM) {
  const archived = this.state.memory.shortTerm.shift()!;
  // Promote important memories to long-term
  if (archived.type === 'interaction') {
    this.state.memory.longTerm.push(archived);
  }
}
```

### WebSocket Broadcasting

**Pattern**: Broadcast to all connected clients

```typescript
wss.clients.forEach((client) => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'state_update',
      payload: newState
    }));
  }
});
```

### React Component Patterns

**Zustand State Management**:
```typescript
// store.ts
export const useSimulationStore = create<SimulationStore>((set) => ({
  simulation: null,
  world: null,
  logs: [],
  setSimulation: (simulation) => set({ simulation }),
  // ...
}));

// Component
function ArenaView() {
  const world = useSimulationStore((state) => state.world);
  // ...
}
```

**API Calls**:
```typescript
// api.ts - Centralized API client
export async function createSimulation(preset: string) {
  const response = await fetch(`${API_BASE}/simulation/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset })
  });
  return response.json();
}

// Component
async function handleCreate() {
  try {
    const result = await createSimulation('cooperative');
    console.log('Created:', result);
  } catch (error) {
    console.error('Failed:', error);
  }
}
```

---

## Common Development Tasks

### Task 1: Add a New Agent Personality

**Location**: `backend/src/agents/personalities.ts`

```typescript
// 1. Define personality
export const MY_NEW_PERSONALITY: Personality = {
  name: 'Chaotic Neutral',
  traits: {
    energy: 80,
    aggression: 50,
    cooperation: 50,
    riskTolerance: 90,
    curiosity: 85,
    empathy: 40,
  },
  description: 'Unpredictable agent that keeps everyone guessing.'
};

// 2. Add to personality list
export const ALL_PERSONALITIES = [
  COOPERATIVE_HELPER,
  RESOURCE_HOARDER,
  // ... existing personalities
  MY_NEW_PERSONALITY, // Add here
];

// 3. Export for use
export { MY_NEW_PERSONALITY };
```

**Usage**:
```typescript
import { MY_NEW_PERSONALITY } from './agents/personalities';

const agent = new LLMAgent(
  "Chaos Bot",
  MY_NEW_PERSONALITY,
  { x: 10, y: 10 },
  goals,
  { mock: true }
);
```

### Task 2: Add a New Action Type

**Step 1**: Update `ActionType` enum in `backend/src/schemas/types.ts`
```typescript
export enum ActionType {
  MOVE = 'move',
  GATHER = 'gather',
  // ... existing actions
  BUILD_SHELTER = 'build_shelter', // NEW
}
```

**Step 2**: Update `Action` interface if needed
```typescript
export interface Action {
  type: ActionType;
  agentId: string;
  target?: Position | string;
  payload?: {
    // Add specific payload for new action
    shelterType?: 'basic' | 'advanced';
  };
}
```

**Step 3**: Implement execution in `SimulationEngine.ts`
```typescript
executeAction(action: Action): void {
  switch (action.type) {
    case ActionType.BUILD_SHELTER:
      this.executeBuildShelter(action);
      break;
    // ... other cases
  }
}

private executeBuildShelter(action: Action): void {
  const agent = this.getAgent(action.agentId);
  const materials = agent.inventory.material;

  if (materials >= 10) {
    // Build logic
    agent.updateInventory({ material: -10 });
    this.logger.log({
      turn: this.currentTurn,
      type: 'action',
      agentId: agent.id,
      message: `Built shelter at ${agent.position.x},${agent.position.y}`
    });
  }
}
```

**Step 4**: Update agent decision logic in `ScriptedAgent.ts` or `LLMAgent.ts`

### Task 3: Create a New Simulation Preset

**Location**: `backend/src/simulations/presets.ts`

```typescript
export const BATTLE_ROYALE: PresetConfig = {
  name: 'Battle Royale',
  description: '10 agents fight until only one remains',
  worldWidth: 30,
  worldHeight: 30,
  resourceDensity: 0.1,  // Scarce resources
  obstacleDensity: 0.2,  // More obstacles
  maxTurns: 200,
  turnDuration: 1000,
  agentPersonalities: [
    AGGRESSIVE_WARRIOR,
    AGGRESSIVE_WARRIOR,
    AGGRESSIVE_WARRIOR,
    CAUTIOUS_SURVIVOR,
    CAUTIOUS_SURVIVOR,
    LONE_WOLF,
    LONE_WOLF,
    DIPLOMAT,
    CURIOUS_EXPLORER,
    COOPERATIVE_HELPER,
  ],
  globalGoals: [
    {
      id: uuidv4(),
      description: 'Be the last one standing',
      priority: 'primary',
      completed: false,
    }
  ],
};

// Add to exports
export const PRESETS = {
  cooperative: COOPERATIVE_CHALLENGE,
  competitive: COMPETITIVE_SURVIVAL,
  diplomatic: EMERGENT_DIPLOMACY,
  battle_royale: BATTLE_ROYALE, // NEW
};
```

**Update API**: Ensure new preset is accessible via `GET /api/presets`

### Task 4: Add a New Scripted Agent Strategy

**Location**: `backend/src/agents/ScriptedAgent.ts`

```typescript
// Add to StrategyType
export type StrategyType =
  | 'aggressive'
  | 'defensive'
  | 'gatherer'
  | 'explorer'
  | 'social'
  | 'opportunist'; // NEW

// Implement strategy
private executeOpportunistStrategy(observation: Observation): Action {
  // Strategy logic: switch behavior based on context

  // If resources nearby and no threats
  const nearbyResources = observation.visibleTiles.filter(
    tile => tile.type.startsWith('resource_')
  );
  const threats = observation.nearbyAgents.filter(
    agent => agent.stats.aggression > 70
  );

  if (nearbyResources.length > 0 && threats.length === 0) {
    // Gather
    return this.createGatherAction(nearbyResources[0]);
  }

  // If weak agents with resources
  const weakTargets = observation.nearbyAgents.filter(
    agent => agent.health < 50 && this.hasResources(agent)
  );

  if (weakTargets.length > 0) {
    // Attack
    return this.createAttackAction(weakTargets[0]);
  }

  // Otherwise explore
  return this.executeExplorerStrategy(observation);
}

// Update decideAction
async decideAction(observation: Observation): Promise<Action> {
  switch (this.strategy) {
    case 'aggressive':
      return this.executeAggressiveStrategy(observation);
    case 'opportunist':
      return this.executeOpportunistStrategy(observation);
    // ... other strategies
  }
}
```

### Task 5: Add a New Frontend Component

**Example**: Add an AgentStatsChart component

```typescript
// frontend/src/components/AgentStatsChart.tsx
import React from 'react';
import { AgentStats } from '../types';

interface Props {
  stats: AgentStats;
}

export function AgentStatsChart({ stats }: Props) {
  return (
    <div className="stats-chart">
      <h3 className="text-lg font-bold mb-2">Stats</h3>
      <div className="space-y-1">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-24 text-sm capitalize">{key}:</span>
            <div className="flex-1 bg-gray-200 rounded h-4">
              <div
                className="bg-blue-500 h-full rounded"
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="w-8 text-sm text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Usage in parent component**:
```typescript
import { AgentStatsChart } from './AgentStatsChart';

function AgentInspector() {
  const selectedAgent = useSimulationStore(state => state.selectedAgent);

  if (!selectedAgent) return null;

  return (
    <div className="agent-inspector">
      <h2>{selectedAgent.name}</h2>
      <AgentStatsChart stats={selectedAgent.stats} />
      {/* Other details */}
    </div>
  );
}
```

### Task 6: Add Real LLM Integration

**Location**: `backend/src/agents/LLMAgent.ts`

```typescript
// Configure LLM options
const agent = new LLMAgent(
  "GPT Agent",
  DIPLOMAT,
  { x: 15, y: 15 },
  goals,
  {
    mock: false,                          // Use real LLM
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,  // From env var
    model: 'gpt-4'
  }
);

// Add .env to backend/
// OPENAI_API_KEY=sk-...

// Update .gitignore to exclude .env (already done)
```

**LLMAgent Implementation** (already supports this):
```typescript
private async callRealLLM(prompt: string): Promise<string> {
  const response = await fetch(this.options.endpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.options.apiKey}`
    },
    body: JSON.stringify({
      model: this.options.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

---

## Testing & Quality Assurance

### Testing Framework

**Backend**: Jest (`backend/package.json`)

```bash
cd backend
npm test
```

**Configuration**: Tests should be placed in `__tests__/` directories or `*.test.ts` files

### Writing Tests

**Example Test** (to be created):
```typescript
// backend/src/agents/__tests__/BaseAgent.test.ts
import { LLMAgent } from '../LLMAgent';
import { COOPERATIVE_HELPER } from '../personalities';

describe('LLMAgent', () => {
  let agent: LLMAgent;

  beforeEach(() => {
    agent = new LLMAgent(
      'Test Agent',
      COOPERATIVE_HELPER,
      { x: 0, y: 0 },
      [],
      { mock: true }
    );
  });

  test('should initialize with correct personality', () => {
    const state = agent.getState();
    expect(state.personality.name).toBe('Cooperative Helper');
  });

  test('should update stats correctly', () => {
    agent.updateStats({ energy: 50 });
    const state = agent.getState();
    expect(state.stats.energy).toBe(50);
  });
});
```

### Linting

**Frontend**: ESLint configured

```bash
cd frontend
npm run lint
```

**Rules** (`.eslintrc.cjs`):
- TypeScript recommended rules
- React hooks rules
- React refresh rules

### Type Checking

**Backend**:
```bash
cd backend
npx tsc --noEmit
```

**Frontend**:
```bash
cd frontend
npx tsc --noEmit
```

### Manual Testing Workflow

1. **Start dev servers**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Create simulation**: Select preset, click "Create Simulation"
4. **Test controls**:
   - Start → Verify turns execute
   - Pause → Verify execution stops
   - Step → Verify single turn execution
   - Reset → Verify state clears
5. **Inspect agents**: Click agent in grid, verify details panel
6. **Review logs**: Check Event Log for action history
7. **Test WebSocket**: Open multiple browser tabs, verify sync

---

## AI Assistant Guidelines

### When Modifying This Codebase

**1. Understand the System Architecture**:
- This is a multi-agent simulation with complex interactions
- Changes to one system (e.g., agents) may affect others (e.g., engine, world)
- Always consider cascading effects

**2. Maintain Type Safety**:
- Update `backend/src/schemas/types.ts` when adding new data structures
- Ensure frontend types (`frontend/src/types.ts`) mirror backend types
- Run type checking before committing: `npx tsc --noEmit`

**3. Follow Existing Patterns**:
- Study similar implementations before adding new features
- Maintain consistency in naming, structure, and style
- Use existing helper functions and utilities

**4. Test Incrementally**:
- Test changes in isolation before integration
- Use mock mode for agents during development (faster)
- Verify WebSocket updates work correctly

**5. Document Changes**:
- Update JSDoc comments for modified functions
- Update README.md if user-facing features change
- Update this CLAUDE.md if architectural changes occur

**6. Common Pitfalls to Avoid**:
- **Don't** directly mutate agent state (use getState() for copies)
- **Don't** forget to broadcast state changes via WebSocket
- **Don't** add actions without updating SimulationEngine execution logic
- **Don't** ignore memory limits (max episodes, max facts)
- **Don't** skip relationship decay (social graph, alliances)

**7. Performance Considerations**:
- Vision radius affects observation size (default 3 tiles)
- Memory consolidation runs every 10 turns (configurable)
- WebSocket broadcasts should be throttled for large state objects
- Consider pagination for large event logs

**8. Security Considerations**:
- Never commit API keys (use environment variables)
- Validate all user inputs (presets, configurations)
- Sanitize agent names and messages to prevent XSS
- Limit resource values to prevent overflow attacks

### Reading Code

**Start Here**:
1. `README.md` - User-facing overview
2. `backend/src/schemas/types.ts` - All type definitions
3. `backend/src/agents/BaseAgent.ts` - Agent architecture
4. `backend/src/engine/SimulationEngine.ts` - Turn execution logic
5. `frontend/src/App.tsx` - UI orchestration

**Trace a Feature**:
Example: "How do agents form alliances?"

1. `backend/src/schemas/types.ts` → Find `ActionType.FORM_ALLIANCE`
2. `backend/src/agents/ScriptedAgent.ts` → Search for alliance formation logic
3. `backend/src/agents/AllianceManager.ts` → Study alliance lifecycle
4. `backend/src/engine/SimulationEngine.ts` → Find alliance execution
5. `backend/src/agents/SocialGraph.ts` → Understand relationship impact

### Making Changes

**Small Change** (e.g., adjust stat value):
1. Locate file (e.g., `personalities.ts`)
2. Make change
3. Test in dev mode
4. Commit with descriptive message

**Medium Change** (e.g., add new action):
1. Update `types.ts` (add to ActionType)
2. Implement execution in `SimulationEngine.ts`
3. Update agent decision logic (`ScriptedAgent.ts`, `LLMAgent.ts`)
4. Test thoroughly
5. Update documentation if needed
6. Commit

**Large Change** (e.g., add new subsystem):
1. Design system architecture (diagram if complex)
2. Create new files in appropriate directory
3. Update `types.ts` with new interfaces
4. Integrate with existing systems
5. Add tests
6. Update README.md and CLAUDE.md
7. Commit with detailed message

### Commit Workflow

```bash
# 1. Make changes
# 2. Review changes
git status
git diff

# 3. Stage changes
git add <files>

# 4. Commit with conventional message
git commit -m "feat: Add new feature description"

# 5. Push to designated branch
git push -u origin <branch-name>
```

### Code Review Checklist

Before finalizing changes, verify:

- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] ESLint passes (frontend: `npm run lint`)
- [ ] No console errors in browser
- [ ] WebSocket updates work correctly
- [ ] Agents behave as expected in simulation
- [ ] Memory limits are respected
- [ ] Social relationships update correctly
- [ ] Event logs capture new actions
- [ ] Code follows existing conventions
- [ ] JSDoc comments are updated
- [ ] No sensitive data (API keys) in code
- [ ] `.gitignore` excludes build artifacts

---

## Quick Reference

### Key File Locations

| What | Where |
|------|-------|
| Agent types | `backend/src/agents/BaseAgent.ts`, `LLMAgent.ts`, `ScriptedAgent.ts` |
| Personalities | `backend/src/agents/personalities.ts` |
| Memory system | `backend/src/agents/memory/` |
| Social graph | `backend/src/agents/SocialGraph.ts` |
| Alliances | `backend/src/agents/AllianceManager.ts` |
| Trait drift | `backend/src/agents/TraitDrift.ts` |
| Negotiation | `backend/src/engine/NegotiationEngine.ts` |
| World/tiles | `backend/src/world/World.ts` |
| Simulation engine | `backend/src/engine/SimulationEngine.ts` |
| Type definitions | `backend/src/schemas/types.ts` |
| API server | `backend/src/index.ts` |
| Presets | `backend/src/simulations/presets.ts` |
| React app | `frontend/src/App.tsx` |
| State management | `frontend/src/store.ts` |
| API client | `frontend/src/api.ts` |
| Components | `frontend/src/components/` |

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Episodic Memory** | Specific experiences with decay (max 100) |
| **Semantic Memory** | General facts with confidence (max 50) |
| **Consolidation** | Episodic → Semantic conversion (every 10 turns) |
| **Social Graph** | 5D relationships (trust, fear, respect, rivalry, loyalty) |
| **Trait Drift** | Dynamic personality evolution based on actions |
| **Alliance** | Partnership with conditions (protection, sharing, exclusivity) |
| **Negotiation** | Trade, alliance, threat, aid protocols |
| **Vision Radius** | How far agents can see (default 3 tiles) |
| **Turn Duration** | Milliseconds per turn (default 1000ms) |
| **Manhattan Distance** | |x1-x2| + |y1-y2| for range calculations |

### Environment Variables

```bash
# Backend (.env in backend/)
PORT=3001                    # Server port
OPENAI_API_KEY=sk-...       # For real LLM integration (optional)
```

### API Endpoints Quick List

```
POST /api/simulation/create    - Create simulation
POST /api/simulation/start     - Start execution
POST /api/simulation/pause     - Pause
POST /api/simulation/resume    - Resume
POST /api/simulation/step      - Single turn
POST /api/simulation/reset     - Clear state
GET  /api/simulation/state     - Get current state
GET  /api/presets              - List presets
GET  /api/personalities        - List personalities
GET  /api/logs                 - Query logs
POST /api/logs/export          - Export logs
GET  /api/relations            - Social graph data
GET  /api/agents/:id/memory    - Agent memory
POST /api/agents/add           - Add agent
```

### WebSocket Events

```
initial_state          - Full state on connection
simulation_created     - New simulation created
simulation_started     - Simulation started
simulation_paused      - Simulation paused
simulation_resumed     - Simulation resumed
simulation_reset       - Simulation reset
turn_complete          - Turn execution finished
state_update           - World state changed
agent_added            - New agent joined
```

---

## Appendix: Advanced Topics

### Memory Consolidation Algorithm

```typescript
// Every 10 turns
consolidate(currentTurn: number): void {
  if (currentTurn % 10 !== 0) return;

  // Get high-importance episodes
  const importantEpisodes = this.episodicMemory
    .getAll()
    .filter(ep => ep.importance > 70);

  // Convert to semantic facts
  importantEpisodes.forEach(episode => {
    const fact = {
      content: `Learned: ${episode.content}`,
      confidence: episode.importance,
      category: this.categorize(episode),
    };

    this.semanticMemory.addFact(fact);
  });

  // Decay all memories
  this.episodicMemory.decay();
}
```

### Social Graph Decay

```typescript
// Called every turn
decay(): void {
  for (const [agentId, relationship] of this.relationships.entries()) {
    relationship.trust = Math.max(0, relationship.trust - 1);
    relationship.fear = Math.max(0, relationship.fear - 1);
    relationship.respect = Math.max(0, relationship.respect - 1);
    relationship.rivalry = Math.max(0, relationship.rivalry - 1);
    relationship.loyalty = Math.max(0, relationship.loyalty - 1);
  }
}
```

### Trait Drift Calculation

```typescript
// Based on action outcome
adjustFromAction(actionType: ActionType, outcome: { success: boolean }): void {
  const drift: Partial<AgentStats> = {};

  switch (actionType) {
    case 'ATTACK':
      if (outcome.success) {
        drift.aggression = 2;
        drift.cooperation = -1;
      } else {
        drift.aggression = -1;
        drift.riskTolerance = -1;
      }
      break;

    case 'FORM_ALLIANCE':
      if (outcome.success) {
        drift.cooperation = 3;
        drift.empathy = 2;
      }
      break;

    // ... other actions
  }

  // Apply with constraints
  this.applyDrift(drift, MAX_DRIFT_PER_TURN);
}
```

### Alliance Strength Formula

```typescript
calculateStrength(
  agentA: AgentState,
  agentB: AgentState,
  relationship: Relationship
): number {
  // Personality compatibility (0-1)
  const personalityMatch = this.calculatePersonalityMatch(
    agentA.personality,
    agentB.personality
  );

  // Social factors (0-1)
  const socialBonus = (
    relationship.trust * 0.4 +
    relationship.loyalty * 0.4 +
    (100 - relationship.rivalry) * 0.2
  ) / 100;

  // Combined strength (0-100)
  return Math.min(100, (personalityMatch * 0.6 + socialBonus * 0.4) * 100);
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Maintainer**: Claude (AI Assistant)

For questions or clarifications about this guide, refer to the README.md or examine the codebase directly.
