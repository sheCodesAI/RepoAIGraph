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

export type RelationshipType =
  | 'HAS_FOLDER'
  | 'CONTAINS'
  | 'DEFINES'
  | 'IMPORTS'
  | 'CALLS'
  | 'IMPLEMENTED_BY'
  | 'USES'
  | 'DOCUMENTS'
  | 'MENTIONS'
  | 'BELONGS_TO_LAYER'
  | 'CONNECTS_TO';

export interface GraphNode {
  id: string; // Stable ID, e.g. "owner/repo/src/auth.ts"
  name: string;
  type: NodeType;
  repoId: string;
  layer?: 'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services';
  metadata: Record<string, any>;
  // UI coordinates (optional / computed)
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
  metadata?: Record<string, any>;
}

export interface RepositoryMetadata {
  id: string; // "owner/repo"
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

export interface FileItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  language?: string;
  content?: string;
}

export interface ParsedFunction {
  id: string;
  name: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  parameters: string[];
  calls: string[];
  isAsync?: boolean;
}

export interface ParsedClass {
  id: string;
  name: string;
  filePath: string;
  startLine: number;
  methods: string[];
}

export interface ParsedImport {
  raw: string;
  source: string;
  importedItems: string[];
  resolvedFilePath?: string; // Resolved to target file in repo if internal
}

export interface ParsedAPI {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  path: string;
  framework: 'Express' | 'FastAPI' | 'Next.js' | 'Flask' | 'Unknown';
  handlerName: string;
  filePath: string;
  line: number;
  dbOperations?: string[];
  calls?: string[];
}

export interface ParsedFileResult {
  path: string;
  language: string;
  imports: ParsedImport[];
  functions: ParsedFunction[];
  classes: ParsedClass[];
  apis: ParsedAPI[];
  technologies: string[];
  linesCount: number;
}

export interface DependencyCycle {
  id: string;
  length: number;
  files: string[];
  cyclePath: string[]; // [fileA, fileB, fileC, fileA]
}

export interface ReadmeFeatureConcept {
  id: string;
  name: string;
  description: string;
  category: 'feature' | 'technology' | 'architecture';
  sectionTitle: string;
  relatedFilePaths: string[];
}

export interface ArchitectureLayerGroup {
  name: 'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services';
  description: string;
  filesCount: number;
  files: string[];
  components: {
    name: string;
    filePath: string;
    functions: string[];
  }[];
}

export interface AnalysisProgress {
  step: 'init' | 'fetching_repo' | 'tree_discovered' | 'parsing_code' | 'extracting_readme' | 'building_graph' | 'complete' | 'error';
  progressPercent: number;
  message: string;
  stats?: {
    filesCount: number;
    functionsCount: number;
    classesCount: number;
    apisCount: number;
    dependenciesCount: number;
    cyclesCount: number;
  };
}
