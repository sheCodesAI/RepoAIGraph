import { ArchitectureLayerGroup, GraphNode, GraphEdge } from './types.js';

export function categorizeFileLayer(filePath: string, content = ''): 'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services' {
  const p = filePath.toLowerCase();

  // Database / Models layer
  if (
    p.includes('/models/') ||
    p.includes('/schema') ||
    p.includes('/entities') ||
    p.includes('/migrations/') ||
    p.includes('/db/') ||
    p.includes('repository') ||
    p.includes('prisma') ||
    p.includes('database') ||
    /from\s+sqlalchemy|sessionmaker|prisma|mongoose|drizzle/i.test(content)
  ) {
    return 'Database';
  }

  // API / Routing layer
  if (
    p.includes('/api/') ||
    p.includes('/routes/') ||
    p.includes('/controllers/') ||
    p.includes('/endpoints/') ||
    p.includes('router') ||
    /app\.(get|post|put|delete)|router\.(get|post)|@app\.(get|post)|@router\./i.test(content)
  ) {
    return 'API';
  }

  // Frontend layer
  if (
    p.includes('/components/') ||
    p.includes('/views/') ||
    p.includes('/pages/') ||
    p.includes('/ui/') ||
    p.includes('/layouts/') ||
    p.endsWith('.tsx') ||
    p.endsWith('.jsx') ||
    p.endsWith('.vue') ||
    p.endsWith('.svelte') ||
    p.endsWith('.html') ||
    p.endsWith('.css') ||
    /import React|className=|useState|useEffect/i.test(content)
  ) {
    return 'Frontend';
  }

  // External Services / Clients
  if (
    p.includes('/client') ||
    p.includes('/integrations/') ||
    p.includes('/external/') ||
    p.includes('/adapters/') ||
    p.includes('s3') ||
    p.includes('stripe') ||
    p.includes('mailer') ||
    /boto3|stripe|nodemailer|axios\.create/i.test(content)
  ) {
    return 'External Services';
  }

  // Backend / Services default for core logic
  return 'Backend/Services';
}

export function buildArchitectureLayers(
  repoId: string,
  files: { path: string; functions: string[]; content?: string }[]
): {
  groups: ArchitectureLayerGroup[];
  layerNodes: GraphNode[];
  layerEdges: GraphEdge[];
} {
  const layerDefs: Array<{
    name: ArchitectureLayerGroup['name'];
    description: string;
  }> = [
    { name: 'Frontend', description: 'UI presentation, client state, pages & interactive components' },
    { name: 'API', description: 'HTTP endpoints, route handlers, controllers, & request validation' },
    { name: 'Backend/Services', description: 'Core business logic, domain services, workers & workflows' },
    { name: 'Database', description: 'Data models, ORM schemas, queries, migrations & persistence' },
    { name: 'External Services', description: 'Third-party integrations, cloud clients, messaging & external APIs' },
  ];

  const layerMap = new Map<ArchitectureLayerGroup['name'], { files: string[]; components: { name: string; filePath: string; functions: string[] }[] }>();

  for (const def of layerDefs) {
    layerMap.set(def.name, { files: [], components: [] });
  }

  for (const file of files) {
    const layer = categorizeFileLayer(file.path, file.content);
    const group = layerMap.get(layer);
    if (group) {
      group.files.push(file.path);
      const componentName = file.path.split('/').pop()?.split('.')[0] || file.path;
      group.components.push({
        name: componentName,
        filePath: file.path,
        functions: file.functions || [],
      });
    }
  }

  const groups: ArchitectureLayerGroup[] = layerDefs.map(def => {
    const data = layerMap.get(def.name)!;
    return {
      name: def.name,
      description: def.description,
      filesCount: data.files.length,
      files: data.files,
      components: data.components,
    };
  });

  // Create High-Level Graph Representation for Architecture View
  const layerNodes: GraphNode[] = groups.map(g => ({
    id: `${repoId}#layer:${g.name}`,
    name: g.name,
    type: 'ArchitectureLayer',
    repoId,
    layer: g.name,
    metadata: {
      description: g.description,
      filesCount: g.filesCount,
      componentsCount: g.components.length,
      componentsSummary: g.components.slice(0, 5).map(c => c.name),
    },
  }));

  // Create inter-layer relationships:
  // Frontend -> API -> Backend/Services -> Database
  // Backend/Services -> External Services
  const layerEdges: GraphEdge[] = [
    {
      id: `${repoId}#edge:Frontend-API`,
      source: `${repoId}#layer:Frontend`,
      target: `${repoId}#layer:API`,
      type: 'CONNECTS_TO',
      label: 'HTTP / RPC Invocation',
    },
    {
      id: `${repoId}#edge:API-Services`,
      source: `${repoId}#layer:API`,
      target: `${repoId}#layer:Backend/Services`,
      type: 'CONNECTS_TO',
      label: 'Delegates Business Logic',
    },
    {
      id: `${repoId}#edge:Services-DB`,
      source: `${repoId}#layer:Backend/Services`,
      target: `${repoId}#layer:Database`,
      type: 'CONNECTS_TO',
      label: 'Queries & Persists State',
    },
    {
      id: `${repoId}#edge:Services-External`,
      source: `${repoId}#layer:Backend/Services`,
      target: `${repoId}#layer:External Services`,
      type: 'CONNECTS_TO',
      label: 'Invokes External SDKs',
    },
  ];

  return { groups, layerNodes, layerEdges };
}
