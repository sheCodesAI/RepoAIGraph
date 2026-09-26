import { GraphNode, GraphEdge, RepositoryMetadata, DependencyCycle, NodeType } from '../types/client';

export async function safeFetchJson<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }
    throw new Error(`Invalid JSON response: ${text.slice(0, 100)}...`);
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export function parseGitHubUrl(inputUrl: string): { owner: string; repo: string; repoId: string } {
  let normalized = inputUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');

  const httpMatch = normalized.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (httpMatch) {
    return { owner: httpMatch[1], repo: httpMatch[2], repoId: `${httpMatch[1]}/${httpMatch[2]}` };
  }

  const shortMatch = normalized.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], repoId: `${shortMatch[1]}/${shortMatch[2]}` };
  }

  throw new Error(`Invalid GitHub repository URL: "${inputUrl}". Expected: https://github.com/owner/repo`);
}

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt',
  'out', 'venv', '.venv', 'env', '__pycache__', '.pytest_cache', '.idea', '.vscode'
]);

const IGNORED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4', '.mp3',
  '.pdf', '.zip', '.tar', '.gz', '.lock', '.log', '.map', '.min.js', '.min.css',
  '.woff', '.woff2', '.ttf', '.eot', '.exe', '.bin', '.dll', '.pyc'
]);

export function isRelevantFile(path: string): boolean {
  const parts = path.split('/');
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return false;
  }
  const extMatch = path.match(/\.[a-zA-Z0-9]+$/);
  if (extMatch && IGNORED_EXTS.has(extMatch[0].toLowerCase())) return false;
  return true;
}

export function categorizeLayer(filePath: string, content = ''): 'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services' {
  const p = filePath.toLowerCase();
  if (p.includes('/models/') || p.includes('/schema') || p.includes('/db/') || p.includes('repository') || p.includes('prisma') || /from\s+sqlalchemy|prisma|mongoose/i.test(content)) {
    return 'Database';
  }
  if (p.includes('/api/') || p.includes('/routes/') || p.includes('/controllers/') || p.includes('router') || /app\.(get|post)|router\.(get|post)|@app\.(get|post)/i.test(content)) {
    return 'API';
  }
  if (p.includes('/components/') || p.includes('/views/') || p.includes('/pages/') || p.endsWith('.tsx') || p.endsWith('.jsx') || /import React|className=/i.test(content)) {
    return 'Frontend';
  }
  if (p.includes('/client') || p.includes('/external/') || p.includes('stripe') || p.includes('mailer')) {
    return 'External Services';
  }
  return 'Backend/Services';
}

export async function analyzeRepositoryInBrowser(
  repoUrl: string,
  onProgress?: (percent: number, msg: string) => void
): Promise<{
  repository: RepositoryMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: DependencyCycle[];
}> {
  const { owner, repo, repoId } = parseGitHubUrl(repoUrl);

  onProgress?.(15, `Fetching repository info for ${owner}/${repo}...`);
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (repoRes.status === 404) {
    throw new Error(`Repository "${owner}/${repo}" was not found or is private.`);
  }
  if (repoRes.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Please wait a moment or try a sample repo.');
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub error: ${repoRes.statusText}`);
  }

  const repoData = await repoRes.json();
  const metadata: RepositoryMetadata = {
    id: repoId,
    owner: repoData.owner?.login || owner,
    name: repoData.name || repo,
    description: repoData.description || 'Public repository',
    defaultBranch: repoData.default_branch || 'main',
    stars: repoData.stargazers_count || 0,
    forks: repoData.forks_count || 0,
    language: repoData.language || 'Unknown',
    url: repoData.html_url,
    analyzedAt: new Date().toISOString(),
  };

  onProgress?.(30, `Discovering files on branch ${metadata.defaultBranch}...`);
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${metadata.defaultBranch}?recursive=1`);
  if (!treeRes.ok) {
    throw new Error(`Failed to read file tree for ${owner}/${repo}`);
  }
  const treeData = await treeRes.json();
  const files: Array<{ path: string; size: number }> = (treeData.tree || [])
    .filter((item: any) => item.type === 'blob' && isRelevantFile(item.path))
    .map((item: any) => ({ path: item.path, size: item.size || 0 }));

  if (files.length === 0) {
    throw new Error(`Repository ${owner}/${repo} contains no relevant source files.`);
  }

  onProgress?.(50, `Parsing code & architecture patterns...`);
  const sourceFiles = files.filter(f => /\.(py|ts|tsx|js|jsx)$/i.test(f.path)).slice(0, 30);
  const parsedFileContents = new Map<string, string>();

  // Fetch key file contents in parallel batches
  await Promise.all(
    sourceFiles.map(async (file) => {
      try {
        const rawRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${metadata.defaultBranch}/${file.path}`);
        if (rawRes.ok) {
          const content = await rawRes.text();
          parsedFileContents.set(file.path, content);
        }
      } catch {
        // ignore
      }
    })
  );

  onProgress?.(80, `Synthesizing graph nodes & relationships...`);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const allFilePaths = files.map(f => f.path);

  // 1. Repo node
  nodes.push({
    id: repoId,
    name: metadata.name,
    type: 'Repository',
    repoId,
    metadata: { ...metadata },
  });

  // 2. 5 Architecture Layers
  const layerNames: Array<'Frontend' | 'API' | 'Backend/Services' | 'Database' | 'External Services'> = [
    'Frontend', 'API', 'Backend/Services', 'Database', 'External Services'
  ];
  for (const layer of layerNames) {
    nodes.push({
      id: `${repoId}#layer:${layer}`,
      name: layer,
      type: 'ArchitectureLayer',
      repoId,
      layer,
      metadata: { description: `${layer} architecture tier` },
    });
  }

  // Inter-layer edges
  edges.push(
    { id: `${repoId}#l1`, source: `${repoId}#layer:Frontend`, target: `${repoId}#layer:API`, type: 'CONNECTS_TO', label: 'HTTP / REST' },
    { id: `${repoId}#l2`, source: `${repoId}#layer:API`, target: `${repoId}#layer:Backend/Services`, type: 'CONNECTS_TO', label: 'Dispatches Logic' },
    { id: `${repoId}#l3`, source: `${repoId}#layer:Backend/Services`, target: `${repoId}#layer:Database`, type: 'CONNECTS_TO', label: 'Persists Data' },
    { id: `${repoId}#l4`, source: `${repoId}#layer:Backend/Services`, target: `${repoId}#layer:External Services`, type: 'CONNECTS_TO', label: 'External APIs' }
  );

  // 3. File nodes & dependencies
  const fileAdjacency = new Map<string, string[]>();

  for (const file of files) {
    const fileId = `${repoId}/${file.path}`;
    const content = parsedFileContents.get(file.path) || '';
    const layer = categorizeLayer(file.path, content);

    fileAdjacency.set(fileId, []);

    nodes.push({
      id: fileId,
      name: file.path.split('/').pop() || file.path,
      type: 'File',
      repoId,
      layer,
      metadata: { path: file.path, size: file.size },
    });

    // File BELONGS_TO_LAYER
    edges.push({
      id: `${fileId}#BELONGS_TO_LAYER`,
      source: fileId,
      target: `${repoId}#layer:${layer}`,
      type: 'BELONGS_TO_LAYER',
    });

    // Extract imports
    const importRegex = /(?:import\s+(?:[\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]|from\s+([a-zA-Z0-9_.]+)\s+import|require\(['"]([^'"]+)['"]\))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const src = match[1] || match[2] || match[3] || '';
      if (src.startsWith('.') || src.startsWith('@/')) {
        // Resolve target file
        const candidateBase = src.replace('@/', '').split('/').pop()?.split('.')[0] || '';
        const targetFile = allFilePaths.find(p => p.includes(candidateBase) && p !== file.path);
        if (targetFile) {
          const targetId = `${repoId}/${targetFile}`;
          edges.push({
            id: `${fileId}#IMPORTS#${targetId}`,
            source: fileId,
            target: targetId,
            type: 'IMPORTS',
            label: 'IMPORTS',
          });
          fileAdjacency.get(fileId)?.push(targetId);
        }
      }
    }

    // Extract functions
    const fnRegex = /(?:def\s+([a-zA-Z0-9_]+)|function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
    let fnMatch;
    while ((fnMatch = fnRegex.exec(content)) !== null) {
      const fnName = fnMatch[1] || fnMatch[2] || fnMatch[3];
      if (fnName && !['if', 'for', 'while', 'test'].includes(fnName)) {
        const fnId = `${fileId}#${fnName}`;
        nodes.push({
          id: fnId,
          name: fnName,
          type: 'Function',
          repoId,
          layer,
          metadata: { filePath: file.path },
        });
        edges.push({
          id: `${fileId}#DEFINES#${fnName}`,
          source: fileId,
          target: fnId,
          type: 'DEFINES',
        });
      }
    }

    // Extract APIs (FastAPI / Express)
    const apiRegex = /(?:@(app|router)\.(get|post|put|delete)\(['"]([^'"]+)['"]|router\.(get|post|put|delete)\(['"]([^'"]+)['"])/gi;
    let apiMatch;
    while ((apiMatch = apiRegex.exec(content)) !== null) {
      const method = (apiMatch[2] || apiMatch[4] || 'GET').toUpperCase();
      const path = apiMatch[3] || apiMatch[5] || '/';
      const apiId = `${repoId}#api:${method}:${path}`;

      if (!nodes.some(n => n.id === apiId)) {
        nodes.push({
          id: apiId,
          name: `${method} ${path}`,
          type: 'API',
          repoId,
          layer: 'API',
          metadata: { method, path, filePath: file.path, framework: file.path.endsWith('.py') ? 'FastAPI' : 'Express' },
        });
        edges.push({
          id: `${apiId}#IMPLEMENTED_BY#${file.path}`,
          source: apiId,
          target: fileId,
          type: 'IMPLEMENTED_BY',
          label: 'IMPLEMENTED_BY',
        });
      }
    }
  }

  // Detect circular dependency cycles
  const cycles: DependencyCycle[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const currentPath: string[] = [];

  const dfs = (curr: string) => {
    visited.add(curr);
    recStack.add(curr);
    currentPath.push(curr);

    const neighbors = fileAdjacency.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (recStack.has(next)) {
        const cycleStartIndex = currentPath.indexOf(next);
        if (cycleStartIndex !== -1) {
          const cycleFiles = currentPath.slice(cycleStartIndex);
          cycles.push({
            id: `cycle-${cycles.length + 1}`,
            length: cycleFiles.length,
            files: cycleFiles,
            cyclePath: [...cycleFiles, next],
          });
        }
      }
    }

    currentPath.pop();
    recStack.delete(curr);
  };

  for (const fileId of fileAdjacency.keys()) {
    if (!visited.has(fileId)) dfs(fileId);
  }

  onProgress?.(100, `Graph constructed with ${nodes.length} nodes!`);
  return { repository: metadata, nodes, edges, cycles };
}
