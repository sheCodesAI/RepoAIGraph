import neo4j, { Driver, Session } from 'neo4j-driver';
import { GraphNode, GraphEdge, DependencyCycle } from './types.js';

export interface Neo4jStatus {
  connected: boolean;
  uri: string;
  database: string;
  mode: 'neo4j' | 'memory-fallback';
  error?: string;
  nodeCount?: number;
  relationshipCount?: number;
}

export function normalizeNeo4jUri(rawUri?: string | null): string {
  if (!rawUri || typeof rawUri !== 'string') return '';
  const trimmed = rawUri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';

  // Already has scheme (bolt://, neo4j://, neo4j+s://, bolt+s://)
  if (/^[a-zA-Z0-9+]+:\/\//.test(trimmed)) {
    return trimmed;
  }

  // Aura instance ID format: 8-character hex (e.g. "f30b0f09")
  if (/^[a-f0-9]{8}$/i.test(trimmed)) {
    return `neo4j+s://${trimmed}.databases.neo4j.io`;
  }

  // Aura domain ending with .databases.neo4j.io
  if (trimmed.endsWith('.databases.neo4j.io')) {
    return `neo4j+s://${trimmed}`;
  }

  // Localhost or IP with port (e.g. localhost:7687 or 127.0.0.1:7687)
  if (trimmed.includes(':')) {
    return `bolt://${trimmed}`;
  }

  // Default fallback if host only
  return `neo4j+s://${trimmed}.databases.neo4j.io`;
}

class Neo4jService {
  private driver: Driver | null = null;
  private isConnected = false;
  private connectionError: string | null = null;
  private uri: string = normalizeNeo4jUri(process.env.NEO4J_URI) || 'bolt://localhost:7687';
  private user: string = process.env.NEO4J_USERNAME || 'neo4j';
  private password: string = process.env.NEO4J_PASSWORD || '';

  // In-memory graph storage fallback (preserves all data, queries, and cycle analysis)
  private memoryNodes: Map<string, GraphNode> = new Map();
  private memoryEdges: Map<string, GraphEdge> = new Map();

  constructor() {
    this.initDriver();
  }

  public async initDriver(customConfig?: { uri?: string; username?: string; password?: string }) {
    if (customConfig) {
      if (customConfig.uri !== undefined) this.uri = normalizeNeo4jUri(customConfig.uri);
      if (customConfig.username !== undefined) this.user = customConfig.username;
      if (customConfig.password !== undefined) this.password = customConfig.password;
    } else {
      this.uri = normalizeNeo4jUri(process.env.NEO4J_URI);
      this.user = process.env.NEO4J_USERNAME || 'neo4j';
      this.password = process.env.NEO4J_PASSWORD || '';
    }

    if (this.driver) {
      try {
        await this.driver.close();
      } catch {
        // ignore close errors
      }
      this.driver = null;
    }

    // Only attempt real connection if normalized URI and credentials exist and valid scheme
    if (this.uri && this.password && /^[a-zA-Z0-9+]+:\/\//.test(this.uri)) {
      try {
        this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password), {
          connectionTimeout: 5000,
          maxConnectionLifetime: 60000,
        });

        const serverInfo = await this.driver.getServerInfo();
        this.isConnected = true;
        this.connectionError = null;
        console.log(`[Neo4j] Connected successfully to ${this.uri} (${serverInfo.agent})`);
        await this.ensureSchema();
        return { success: true, message: `Connected to Neo4j (${serverInfo.agent})` };
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message || 'Failed to connect to Neo4j';
        console.warn(`[Neo4j] Live connection failed (${this.connectionError}). Using in-memory graph engine.`);
        return { success: false, message: this.connectionError };
      }
    } else {
      this.isConnected = false;
      this.connectionError = !this.uri
        ? 'NEO4J_URI not configured or invalid. Running on in-memory Neo4j graph engine.'
        : 'NEO4J_PASSWORD not configured. Running on in-memory Neo4j graph engine.';
      console.log(`[Neo4j] ${this.connectionError}`);
      return { success: false, message: this.connectionError };
    }
  }

  public async getStatus(): Promise<Neo4jStatus> {
    if (this.driver && this.isConnected) {
      try {
        const session = this.driver.session();
        try {
          const res = await session.run(
            'MATCH (n) RETURN count(n) AS nodeCount, 0 AS relCount'
          );
          const nodeCount = res.records[0]?.get('nodeCount')?.toNumber() || 0;
          return {
            connected: true,
            uri: this.uri,
            database: 'neo4j',
            mode: 'neo4j',
            nodeCount,
          };
        } finally {
          await session.close();
        }
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }

    return {
      connected: false,
      uri: this.uri,
      database: 'memory',
      mode: 'memory-fallback',
      error: this.connectionError || undefined,
      nodeCount: this.memoryNodes.size,
      relationshipCount: this.memoryEdges.size,
    };
  }

  private async ensureSchema() {
    if (!this.driver || !this.isConnected) return;
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT repo_id_unique IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE',
        'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT folder_id_unique IF NOT EXISTS FOR (f:Folder) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT func_id_unique IF NOT EXISTS FOR (fn:Function) REQUIRE fn.id IS UNIQUE',
        'CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT api_id_unique IF NOT EXISTS FOR (a:API) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT tech_id_unique IF NOT EXISTS FOR (t:Technology) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT feat_id_unique IF NOT EXISTS FOR (fe:Feature) REQUIRE fe.id IS UNIQUE',
        'CREATE CONSTRAINT readme_id_unique IF NOT EXISTS FOR (rm:ReadmeSection) REQUIRE rm.id IS UNIQUE',
      ];

      for (const c of constraints) {
        try {
          await session.run(c);
        } catch {
          // Schema constraints might already exist
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Save graph nodes and edges to Neo4j (and local memory cache)
   */
  public async saveGraph(repoId: string, nodes: GraphNode[], edges: GraphEdge[]) {
    // 1. Store in memory store
    for (const node of nodes) {
      this.memoryNodes.set(node.id, node);
    }
    for (const edge of edges) {
      this.memoryEdges.set(edge.id, edge);
    }

    // 2. Persist to real Neo4j if connected
    if (this.driver && this.isConnected) {
      const session = this.driver.session();
      try {
        // Clear previous graph for this repo to allow clean re-analysis
        await session.run(
          'MATCH (n {repoId: $repoId}) DETACH DELETE n',
          { repoId }
        );

        // Batch insert nodes in chunks
        const chunkSize = 200;
        for (let i = 0; i < nodes.length; i += chunkSize) {
          const chunk = nodes.slice(i, i + chunkSize).map(n => ({
            id: n.id,
            name: n.name,
            type: n.type,
            repoId: n.repoId,
            layer: n.layer || '',
            metadataJson: JSON.stringify(n.metadata || {}),
          }));

          await session.run(
            `UNWIND $batch AS item
             CALL apoc.create.node([item.type], {
               id: item.id,
               name: item.name,
               repoId: item.repoId,
               layer: item.layer,
               metadata: item.metadataJson
             }) YIELD node
             RETURN count(node)`,
            { batch: chunk }
          ).catch(async () => {
            // Standard Cypher fallback without APOC
            await session.run(
              `UNWIND $batch AS item
               MERGE (n:Entity {id: item.id})
               SET n.name = item.name,
                   n.type = item.type,
                   n.repoId = item.repoId,
                   n.layer = item.layer,
                   n.metadata = item.metadataJson`,
              { batch: chunk }
            );
          });
        }

        // Insert edges in chunks
        for (let i = 0; i < edges.length; i += chunkSize) {
          const chunk = edges.slice(i, i + chunkSize).map(e => ({
            source: e.source,
            target: e.target,
            type: e.type,
            label: e.label || e.type,
            metadataJson: JSON.stringify(e.metadata || {}),
          }));

          await session.run(
            `UNWIND $batch AS rel
             MATCH (a {id: rel.source}), (b {id: rel.target})
             MERGE (a)-[r:RELATED {type: rel.type, label: rel.label}]->(b)
             SET r.metadata = rel.metadataJson`,
            { batch: chunk }
          );
        }
        console.log(`[Neo4j] Persisted ${nodes.length} nodes and ${edges.length} edges for ${repoId}`);
      } catch (err) {
        console.error('[Neo4j] Write failed, stored in memory cache:', err);
      } finally {
        await session.close();
      }
    }
  }

  /**
   * Retrieve graph for repository with optional node type or limit filters
   */
  public async getGraph(repoId: string, options?: { limit?: number; types?: string[]; layer?: string }): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const limit = options?.limit || 300;

    // Filter from memory store
    const repoNodes = Array.from(this.memoryNodes.values()).filter(n => {
      if (n.repoId !== repoId) return false;
      if (options?.types && options.types.length > 0 && !options.types.includes(n.type)) return false;
      if (options?.layer && n.layer !== options.layer) return false;
      return true;
    }).slice(0, limit);

    const nodeIds = new Set(repoNodes.map(n => n.id));

    const repoEdges = Array.from(this.memoryEdges.values()).filter(e => {
      return nodeIds.has(e.source) && nodeIds.has(e.target);
    });

    return { nodes: repoNodes, edges: repoEdges };
  }

  /**
   * Get single node details along with its direct dependencies and dependents
   */
  public async getNodeDetails(repoId: string, nodeId: string): Promise<{
    node: GraphNode | null;
    dependencies: GraphNode[];
    dependents: GraphNode[];
    relatedEntities: { node: GraphNode; relationship: string; direction: 'in' | 'out' }[];
  }> {
    const node = this.memoryNodes.get(nodeId) || null;
    if (!node) {
      return { node: null, dependencies: [], dependents: [], relatedEntities: [] };
    }

    const dependencies: GraphNode[] = [];
    const dependents: GraphNode[] = [];
    const relatedEntities: { node: GraphNode; relationship: string; direction: 'in' | 'out' }[] = [];

    for (const edge of this.memoryEdges.values()) {
      if (edge.source === nodeId) {
        const targetNode = this.memoryNodes.get(edge.target);
        if (targetNode) {
          if (edge.type === 'IMPORTS') dependencies.push(targetNode);
          relatedEntities.push({ node: targetNode, relationship: edge.type, direction: 'out' });
        }
      } else if (edge.target === nodeId) {
        const sourceNode = this.memoryNodes.get(edge.source);
        if (sourceNode) {
          if (edge.type === 'IMPORTS') dependents.push(sourceNode);
          relatedEntities.push({ node: sourceNode, relationship: edge.type, direction: 'in' });
        }
      }
    }

    return { node, dependencies, dependents, relatedEntities };
  }

  /**
   * Traversal query: Get what this file imports
   */
  public async getFileDependencies(repoId: string, fileId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const directEdges = Array.from(this.memoryEdges.values()).filter(
      e => e.source === fileId && e.type === 'IMPORTS'
    );

    const targetIds = new Set(directEdges.map(e => e.target));
    targetIds.add(fileId);

    const nodes = Array.from(this.memoryNodes.values()).filter(n => targetIds.has(n.id));
    return { nodes, edges: directEdges };
  }

  /**
   * Traversal query: Get who imports this file
   */
  public async getFileDependents(repoId: string, fileId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const incomingEdges = Array.from(this.memoryEdges.values()).filter(
      e => e.target === fileId && e.type === 'IMPORTS'
    );

    const sourceIds = new Set(incomingEdges.map(e => e.source));
    sourceIds.add(fileId);

    const nodes = Array.from(this.memoryNodes.values()).filter(n => sourceIds.has(n.id));
    return { nodes, edges: incomingEdges };
  }

  /**
   * Circular dependency detector:
   * Finds cycles in IMPORTS graph (e.g. A -> B -> C -> A)
   */
  public async detectCycles(repoId: string): Promise<DependencyCycle[]> {
    // Collect all File nodes and IMPORTS edges for this repository
    const fileNodes = Array.from(this.memoryNodes.values()).filter(
      n => n.repoId === repoId && n.type === 'File'
    );

    const adjacency = new Map<string, string[]>();
    for (const file of fileNodes) {
      adjacency.set(file.id, []);
    }

    for (const edge of this.memoryEdges.values()) {
      if (edge.type === 'IMPORTS' && adjacency.has(edge.source)) {
        adjacency.get(edge.source)?.push(edge.target);
      }
    }

    const cycles: DependencyCycle[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const currentPath: string[] = [];
    const seenCycleSignatures = new Set<string>();

    const dfs = (curr: string) => {
      visited.add(curr);
      recStack.add(curr);
      currentPath.push(curr);

      const neighbors = adjacency.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (recStack.has(next)) {
          // Detected a cycle!
          const cycleStartIndex = currentPath.indexOf(next);
          if (cycleStartIndex !== -1) {
            const cycleFiles = currentPath.slice(cycleStartIndex);
            const cyclePath = [...cycleFiles, next];

            // Normalize cycle signature to prevent duplicate representations of same loop
            const sortedSignature = [...cycleFiles].sort().join('|');
            if (!seenCycleSignatures.has(sortedSignature)) {
              seenCycleSignatures.add(sortedSignature);
              cycles.push({
                id: `cycle-${cycles.length + 1}`,
                length: cycleFiles.length,
                files: cycleFiles,
                cyclePath,
              });
            }
          }
        }
      }

      currentPath.pop();
      recStack.delete(curr);
    };

    for (const file of fileNodes) {
      if (!visited.has(file.id)) {
        dfs(file.id);
      }
    }

    return cycles;
  }

  /**
   * API endpoints list and deep path traversal:
   * API -> IMPLEMENTED_BY -> Function -> CALLS -> Service/Database
   */
  public async getAPIs(repoId: string): Promise<GraphNode[]> {
    return Array.from(this.memoryNodes.values()).filter(
      n => n.repoId === repoId && n.type === 'API'
    );
  }

  public async getAPIGraph(repoId: string, apiId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const matchedNodeIds = new Set<string>([apiId]);
    const matchedEdges: GraphEdge[] = [];

    // 1-step outward: API IMPLEMENTED_BY Function/File
    for (const edge of this.memoryEdges.values()) {
      if (edge.source === apiId && edge.type === 'IMPLEMENTED_BY') {
        matchedNodeIds.add(edge.target);
        matchedEdges.push(edge);

        // 2-step outward from handler function: function CALLS other function or USES Database
        for (const subEdge of this.memoryEdges.values()) {
          if (subEdge.source === edge.target && (subEdge.type === 'CALLS' || subEdge.type === 'USES' || subEdge.type === 'DEFINES')) {
            matchedNodeIds.add(subEdge.target);
            matchedEdges.push(subEdge);

            // 3-step outward: deeper calls
            for (const deepEdge of this.memoryEdges.values()) {
              if (deepEdge.source === subEdge.target && (deepEdge.type === 'CALLS' || deepEdge.type === 'USES')) {
                matchedNodeIds.add(deepEdge.target);
                matchedEdges.push(deepEdge);
              }
            }
          }
        }
      }
    }

    const nodes = Array.from(this.memoryNodes.values()).filter(n => matchedNodeIds.has(n.id));
    return { nodes, edges: matchedEdges };
  }

  /**
   * README <-> Code Graph Connections
   */
  public async getReadmeConnections(repoId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const readmeNodes = Array.from(this.memoryNodes.values()).filter(
      n => n.repoId === repoId && (n.type === 'ReadmeSection' || n.type === 'Feature' || n.type === 'Technology')
    );

    const relatedIds = new Set<string>(readmeNodes.map(n => n.id));
    const edges: GraphEdge[] = [];

    for (const edge of this.memoryEdges.values()) {
      if (
        (edge.type === 'DOCUMENTS' || edge.type === 'MENTIONS' || edge.type === 'IMPLEMENTED_BY' || edge.type === 'USES') &&
        (relatedIds.has(edge.source) || relatedIds.has(edge.target))
      ) {
        relatedIds.add(edge.source);
        relatedIds.add(edge.target);
        edges.push(edge);
      }
    }

    const nodes = Array.from(this.memoryNodes.values()).filter(n => relatedIds.has(n.id));
    return { nodes, edges };
  }
}

export const neo4jService = new Neo4jService();
