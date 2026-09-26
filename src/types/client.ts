export type ViewMode = 'dna' | 'architecture' | 'apis' | 'dependencies' | 'cycles' | 'readme';

export type NodeType =
  | 'Repository'
  | 'Folder'
  | 'File'
  | 'Function'
  | 'Class'
  | 'API'
  | 'Technology'
  | 'Feature'
  | 'ReadmeSection'
  | 'ArchitectureLayer';

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  repoId: string;
  layer?: 'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services';
  metadata: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  metadata?: Record<string, any>;
}

export interface RepositoryMetadata {
  id: string;
  owner: string;
  name: string;
  description: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  language: string;
  url: string;
  analyzedAt: string;
}

export interface DependencyCycle {
  id: string;
  length: number;
  files: string[];
  cyclePath: string[];
}

export interface Neo4jStatus {
  connected: boolean;
  uri: string;
  database: string;
  mode: 'neo4j' | 'memory-fallback';
  error?: string;
  nodeCount?: number;
  relationshipCount?: number;
}
