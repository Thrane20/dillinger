// Streaming graph storage service

import fs from 'fs-extra';
import path from 'path';
import { parseVersionedData, serializeVersionedData } from '@dillinger/shared';
import type { StreamingGraphStore } from '@dillinger/shared';
import { DEFAULT_STREAMING_GRAPH_STORE } from '@dillinger/shared';

// Use the same DILLINGER_ROOT logic as settings/storage
export const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
export const STREAMING_GRAPH_PATH = path.join(DILLINGER_ROOT, 'storage', 'streaming-graph.json');

export class StreamingGraphService {
  private static instance: StreamingGraphService;
  private graph: StreamingGraphStore | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): StreamingGraphService {
    if (!StreamingGraphService.instance) {
      StreamingGraphService.instance = new StreamingGraphService();
    }
    return StreamingGraphService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fs.ensureDir(path.dirname(STREAMING_GRAPH_PATH));

    if (await fs.pathExists(STREAMING_GRAPH_PATH)) {
      const raw = await fs.readJson(STREAMING_GRAPH_PATH);
      const parseResult = parseVersionedData<StreamingGraphStore>(raw, {
        strict: false,
        autoMigrate: false,
      });
      this.graph = parseResult.data;
    } else {
      const versioned = serializeVersionedData(DEFAULT_STREAMING_GRAPH_STORE);
      await fs.writeJson(STREAMING_GRAPH_PATH, versioned, { spaces: 2 });
      this.graph = versioned;
    }

    this.initialized = true;
  }

  async getGraphStore(): Promise<StreamingGraphStore> {
    await this.ensureInitialized();
    return { ...(this.graph as StreamingGraphStore) };
  }

  async saveGraphStore(store: StreamingGraphStore): Promise<void> {
    await this.ensureInitialized();

    const versioned = serializeVersionedData(store);
    await fs.writeJson(STREAMING_GRAPH_PATH, versioned, { spaces: 2 });
    this.graph = versioned;
  }
}
