import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { repositoryAnalyzer } from './server/analyzer.js';
import { neo4jService } from './server/neo4j.js';
import { aiService } from './server/ai.js';
import { buildArchitectureLayers } from './server/architecture.js';
import { SAMPLE_REPOSITORIES, seedSampleRepository } from './server/sampleData.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// ==========================================
// API ROUTES
// ==========================================

// Neo4j Status & Config
app.get('/api/neo4j/status', async (req: Request, res: Response) => {
  try {
    const status = await neo4jService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/neo4j/configure', async (req: Request, res: Response) => {
  const { uri, username, password } = req.body;
  try {
    const result = await neo4jService.initDriver({ uri, username, password });
    const status = await neo4jService.getStatus();
    res.json({ ...result, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sample Repositories (for fast 3-minute demo & testing)
app.get('/api/repositories/samples', (req: Request, res: Response) => {
  res.json({ samples: SAMPLE_REPOSITORIES });
});

app.post('/api/repositories/sample/load', async (req: Request, res: Response) => {
  try {
    const { repoId } = req.body;
    const result = await seedSampleRepository(repoId || 'tiangolo/fastapi-realworld-example-app');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze GitHub Repository
app.post('/api/repositories/analyze', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid GitHub repository URL.' });
  }

  try {
    console.log(`[API] Starting analysis for: ${url}`);
    const result = await repositoryAnalyzer.analyze(url);
    res.json(result);
  } catch (err: any) {
    console.error('[API] Analysis error:', err.message);
    res.status(400).json({ error: err.message || 'Analysis failed.' });
  }
});

// Get Repository Graph
app.get('/api/repositories/:owner/:repo/graph', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
  const types = req.query.types ? (req.query.types as string).split(',') : undefined;
  const layer = req.query.layer as string | undefined;

  try {
    const graph = await neo4jService.getGraph(repoId, { limit, types, layer });
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Node Details
app.get('/api/repositories/:owner/:repo/nodes/:nodeId(*)', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  const nodeId = req.params.nodeId;

  try {
    const details = await neo4jService.getNodeDetails(repoId, nodeId);
    if (!details.node) {
      return res.status(404).json({ error: `Node "${nodeId}" not found in graph.` });
    }
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// File Dependencies (Who does this file import?)
app.get('/api/repositories/:owner/:repo/dependencies/:nodeId(*)', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  const fileId = req.params.nodeId;

  try {
    const deps = await neo4jService.getFileDependencies(repoId, fileId);
    res.json(deps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// File Dependents (Who imports this file?)
app.get('/api/repositories/:owner/:repo/dependents/:nodeId(*)', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  const fileId = req.params.nodeId;

  try {
    const deps = await neo4jService.getFileDependents(repoId, fileId);
    res.json(deps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Detect Cycles
app.get('/api/repositories/:owner/:repo/cycles', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  try {
    const cycles = await neo4jService.detectCycles(repoId);
    res.json({ cycles, count: cycles.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get APIs
app.get('/api/repositories/:owner/:repo/apis', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  try {
    const apis = await neo4jService.getAPIs(repoId);
    res.json({ apis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trace API Execution Graph
app.get('/api/repositories/:owner/:repo/apis/:apiId(*)/graph', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  const apiId = req.params.apiId;

  try {
    const result = await neo4jService.getAPIGraph(repoId, apiId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Architecture View
app.get('/api/repositories/:owner/:repo/architecture', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  try {
    const fullGraph = await neo4jService.getGraph(repoId, { limit: 1000 });
    const fileNodes = fullGraph.nodes.filter(n => n.type === 'File');
    const components = fileNodes.map(f => ({
      path: f.metadata?.path || f.name,
      functions: fullGraph.nodes.filter(fn => fn.type === 'Function' && fn.id.startsWith(f.id)).map(fn => fn.name),
    }));

    const architecture = buildArchitectureLayers(repoId, components);
    res.json(architecture);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// README ↔ Code Connections
app.get('/api/repositories/:owner/:repo/readme-connections', async (req: Request, res: Response) => {
  const repoId = `${req.params.owner}/${req.params.repo}`;
  try {
    const connections = await neo4jService.getReadmeConnections(repoId);
    res.json(connections);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Grounded Explanation
app.post('/api/ai/explain', async (req: Request, res: Response) => {
  const { node, dependencies = [], dependents = [], relatedEntities = [], cycles = [] } = req.body;
  if (!node) {
    return res.status(400).json({ error: 'Node is required for explanation.' });
  }

  try {
    const explanation = await aiService.explainGraphNode(node, dependencies, dependents, relatedEntities, cycles);
    res.json({ explanation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// VITE DEV / PRODUCTION STATIC SERVER
// ==========================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Server] RepoGraph AI listening on port ${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
});
