/**
 * World System
 * Manages the 2D grid world with tiles, resources, and events
 */

import { Tile, TileType, Position } from '../schemas/types';

export interface WorldConfig {
  width: number;
  height: number;
  resourceDensity?: number; // 0-1, default 0.2
  obstacleDensity?: number; // 0-1, default 0.1
  eventFrequency?: number; // 0-1, default 0.05
}

export class World {
  private tiles: Tile[][];
  private width: number;
  private height: number;
  private config: Required<WorldConfig>;

  constructor(config: WorldConfig) {
    this.width = config.width;
    this.height = config.height;
    this.config = {
      width: config.width,
      height: config.height,
      resourceDensity: config.resourceDensity ?? 0.2,
      obstacleDensity: config.obstacleDensity ?? 0.1,
      eventFrequency: config.eventFrequency ?? 0.05,
    };

    this.tiles = [];
    this.initialize();
  }

  /**
   * Initialize the world grid
   */
  private initialize(): void {
    // Create empty grid
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = {
          type: TileType.EMPTY,
          position: { x, y },
        };
      }
    }

    // Populate with resources and obstacles
    this.populateWorld();
  }

  /**
   * Populate world with resources, obstacles, and events
   */
  private populateWorld(): void {
    const totalTiles = this.width * this.height;

    // Add resources
    const resourceCount = Math.floor(totalTiles * this.config.resourceDensity);
    const resourceTypes = [
      TileType.RESOURCE_FOOD,
      TileType.RESOURCE_WATER,
      TileType.RESOURCE_MATERIAL,
    ];

    for (let i = 0; i < resourceCount; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
        this.tiles[pos.y][pos.x] = {
          type: resourceType,
          position: pos,
          value: Math.floor(Math.random() * 10) + 5, // 5-15 units
        };
      }
    }

    // Add obstacles
    const obstacleCount = Math.floor(totalTiles * this.config.obstacleDensity);
    for (let i = 0; i < obstacleCount; i++) {
      const pos = this.getRandomEmptyPosition();
      if (pos) {
        this.tiles[pos.y][pos.x] = {
          type: TileType.OBSTACLE,
          position: pos,
        };
      }
    }
  }

  /**
   * Get tile at position
   */
  getTile(position: Position): Tile | null {
    if (!this.isValidPosition(position)) {
      return null;
    }
    return this.tiles[position.y][position.x];
  }

  /**
   * Set tile at position
   */
  setTile(position: Position, tile: Tile): void {
    if (this.isValidPosition(position)) {
      this.tiles[position.y][position.x] = tile;
    }
  }

  /**
   * Get all tiles
   */
  getAllTiles(): Tile[][] {
    return this.tiles.map(row => row.map(tile => ({ ...tile })));
  }

  /**
   * Get tiles in radius around position
   */
  getTilesInRadius(position: Position, radius: number): Tile[] {
    const tiles: Tile[] = [];

    for (let y = position.y - radius; y <= position.y + radius; y++) {
      for (let x = position.x - radius; x <= position.x + radius; x++) {
        const pos = { x, y };
        if (this.isValidPosition(pos)) {
          const distance = Math.abs(x - position.x) + Math.abs(y - position.y);
          if (distance <= radius) {
            tiles.push(this.tiles[y][x]);
          }
        }
      }
    }

    return tiles;
  }

  /**
   * Check if position is valid (within bounds)
   */
  isValidPosition(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < this.width &&
      position.y >= 0 &&
      position.y < this.height
    );
  }

  /**
   * Check if position is walkable (not obstacle)
   */
  isWalkable(position: Position): boolean {
    if (!this.isValidPosition(position)) {
      return false;
    }

    const tile = this.tiles[position.y][position.x];
    return tile.type !== TileType.OBSTACLE;
  }

  /**
   * Gather resource from tile
   */
  gatherResource(position: Position, amount: number = 1): { type: TileType; amount: number } | null {
    const tile = this.getTile(position);

    if (!tile || !tile.type.startsWith('resource') || !tile.value || tile.value <= 0) {
      return null;
    }

    const gathered = Math.min(amount, tile.value);
    tile.value -= gathered;

    // If depleted, turn into empty tile
    if (tile.value <= 0) {
      tile.type = TileType.EMPTY;
      tile.value = undefined;
    }

    this.setTile(position, tile);

    return {
      type: tile.type,
      amount: gathered,
    };
  }

  /**
   * Spawn event at random location
   */
  spawnEvent(): Position | null {
    const pos = this.getRandomEmptyPosition();
    if (!pos) {
      return null;
    }

    const eventTypes = [
      TileType.EVENT_STORM,
      TileType.EVENT_ANOMALY,
      TileType.EVENT_BOON,
    ];

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    this.tiles[pos.y][pos.x] = {
      type: eventType,
      position: pos,
      metadata: {
        spawnTime: Date.now(),
        duration: Math.floor(Math.random() * 10) + 5, // 5-15 turns
      },
    };

    return pos;
  }

  /**
   * Clear event at position
   */
  clearEvent(position: Position): void {
    const tile = this.getTile(position);
    if (tile && tile.type.startsWith('event')) {
      this.tiles[position.y][position.x] = {
        type: TileType.EMPTY,
        position,
      };
    }
  }

  /**
   * Regenerate resources (called periodically)
   */
  regenerateResources(): void {
    const emptyTiles = this.getEmptyTiles();
    const regenerateCount = Math.floor(emptyTiles.length * 0.05); // Regenerate 5% of empty tiles

    for (let i = 0; i < regenerateCount; i++) {
      if (emptyTiles.length === 0) break;

      const randomIndex = Math.floor(Math.random() * emptyTiles.length);
      const pos = emptyTiles[randomIndex].position;
      emptyTiles.splice(randomIndex, 1);

      const resourceTypes = [
        TileType.RESOURCE_FOOD,
        TileType.RESOURCE_WATER,
        TileType.RESOURCE_MATERIAL,
      ];

      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];

      this.tiles[pos.y][pos.x] = {
        type: resourceType,
        position: pos,
        value: Math.floor(Math.random() * 10) + 5,
      };
    }
  }

  /**
   * Get all empty tiles
   */
  private getEmptyTiles(): Tile[] {
    const empty: Tile[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x].type === TileType.EMPTY) {
          empty.push(this.tiles[y][x]);
        }
      }
    }

    return empty;
  }

  /**
   * Get random empty position
   */
  private getRandomEmptyPosition(): Position | null {
    const emptyTiles = this.getEmptyTiles();

    if (emptyTiles.length === 0) {
      return null;
    }

    const randomTile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    return randomTile.position;
  }

  /**
   * Get random position (can be any type)
   */
  getRandomPosition(): Position {
    return {
      x: Math.floor(Math.random() * this.width),
      y: Math.floor(Math.random() * this.height),
    };
  }

  /**
   * Get world dimensions
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Reset world (clear and repopulate)
   */
  reset(): void {
    this.initialize();
  }

  /**
   * Get world state as JSON
   */
  toJSON(): object {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
    };
  }
}
