import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { AnalysisModal } from './components/AnalysisModal';
import { LeftPanel } from './components/LeftPanel';
import { GraphCanvas } from './components/GraphCanvas';
import { RightPanel } from './components/RightPanel';
import { Neo4jSettingsModal } from './components/Neo4jSettingsModal';
import { safeFetchJson, analyzeRepositoryInBrowser } from './services/clientAnalyzer';
import { AlertTriangle, X } from 'lucide-react';
import {
  GraphNode,
  GraphEdge,
  RepositoryMetadata,
  DependencyCycle,
  Neo4jStatus,
  ViewMode,
} from './types/client';

export default function App() {
  // Navigation & View Mode
  const [currentRepo, setCurrentRepo] = useState<RepositoryMetadata | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dna');
  const [searchQuery, setSearchQuery] = useState('');

  // Graph Data
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [cycles, setCycles] = useState<DependencyCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Selected Node & Details
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Highlighted IDs (for API trace, cycle focus, dependency drill-down)
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Neo4j & Samples
  const [neo4jStatus, setNeo4jStatus] = useState<Neo4jStatus | null>(null);
  const [isNeo4jModalOpen, setIsNeo4jModalOpen] = useState(false);
  const [sampleRepos, setSampleRepos] = useState<RepositoryMetadata[]>([]);

  // Fetch initial samples & Neo4j status
  const fetchNeo4jStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/neo4j/status');
      if (res.ok) {
        const data = await res.json();
        setNeo4jStatus(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchNeo4jStatus();

    fetch('/api/repositories/samples')
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSampleRepos(data.samples);
      })
      .catch(() => {});
  }, [fetchNeo4jStatus]);

  // Load Graph for Current Repository based on ViewMode
  const loadGraphForView = useCallback(async (repo: RepositoryMetadata, mode: ViewMode) => {
    try {
      const [owner, name] = repo.id.split('/');

      if (mode === 'architecture') {
        const res = await fetch(`/api/repositories/${owner}/${name}/architecture`);
        if (res.ok) {
          const data = await res.json();
          // Merge layer nodes with top-level component files
          const graphRes = await fetch(`/api/repositories/${owner}/${name}/graph?limit=150`);
          const fullGraph = await graphRes.json();
          const fileAndLayerNodes = [
            ...data.layerNodes,
            ...fullGraph.nodes.filter((n: GraphNode) => n.type === 'File'),
          ];
          setNodes(fileAndLayerNodes);
          setEdges([...data.layerEdges, ...fullGraph.edges.filter((e: GraphEdge) => e.type === 'BELONGS_TO_LAYER')]);
          return;
        }
      }

      if (mode === 'apis') {
        const res = await fetch(`/api/repositories/${owner}/${name}/apis`);
        if (res.ok) {
          const data = await res.json();
          const graphRes = await fetch(`/api/repositories/${owner}/${name}/graph?limit=150`);
          const fullGraph = await graphRes.json();
          const apiAndRelated = fullGraph.nodes.filter(
            (n: GraphNode) => n.type === 'API' || n.type === 'Function' || n.layer === 'API'
          );
          const apiEdges = fullGraph.edges.filter(
            (e: GraphEdge) => e.type === 'IMPLEMENTED_BY' || e.type === 'CALLS'
          );
          setNodes(apiAndRelated.length ? apiAndRelated : fullGraph.nodes);
          setEdges(apiEdges.length ? apiEdges : fullGraph.edges);
          return;
        }
      }

      if (mode === 'readme') {
        const res = await fetch(`/api/repositories/${owner}/${name}/readme-connections`);
        if (res.ok) {
          const data = await res.json();
          if (data.nodes?.length) {
            setNodes(data.nodes);
            setEdges(data.edges);
            return;
          }
        }
      }

      // Default DNA / Dependencies / Cycles: fetch core graph
      const res = await fetch(`/api/repositories/${owner}/${name}/graph?limit=250`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch (err) {
      console.error('Failed to load graph view:', err);
    }
  }, []);

  // Fetch cycles for repository
  const loadCycles = useCallback(async (repo: RepositoryMetadata) => {
    try {
      const [owner, name] = repo.id.split('/');
      const res = await fetch(`/api/repositories/${owner}/${name}/cycles`);
      if (res.ok) {
        const data = await res.json();
        setCycles(data.cycles || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Switch view mode handler
  const handleSelectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setHighlightedNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
    setSelectedCycleId(null);
    if (currentRepo) {
      loadGraphForView(currentRepo, mode);
    }
  };

  // Select Node and fetch its detailed relationship info
  const handleSelectNode = async (node: GraphNode | null) => {
    setSelectedNode(node);
    if (!node || !currentRepo) {
      setNodeDetails(null);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const [owner, name] = currentRepo.id.split('/');
      const res = await fetch(`/api/repositories/${owner}/${name}/nodes/${encodeURIComponent(node.id)}`);
      if (res.ok) {
        const data = await res.json();
        setNodeDetails(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Expand file dependencies action (Feature 3)
  const handleExpandDependencies = async (fileId: string) => {
    if (!currentRepo) return;
    try {
      const [owner, name] = currentRepo.id.split('/');
      const res = await fetch(`/api/repositories/${owner}/${name}/dependencies/${encodeURIComponent(fileId)}`);
      if (res.ok) {
        const data = await res.json();
        const nodeIds = new Set<string>(data.nodes.map((n: GraphNode) => n.id));
        const edgeIds = new Set<string>(data.edges.map((e: GraphEdge) => e.id));
        nodeIds.add(fileId);
        setHighlightedNodeIds(nodeIds);
        setHighlightedEdgeIds(edgeIds);
      }
    } catch {
      // ignore
    }
  };

  // Show file dependents action (Feature 3)
  const handleShowDependents = async (fileId: string) => {
    if (!currentRepo) return;
    try {
      const [owner, name] = currentRepo.id.split('/');
      const res = await fetch(`/api/repositories/${owner}/${name}/dependents/${encodeURIComponent(fileId)}`);
      if (res.ok) {
        const data = await res.json();
        const nodeIds = new Set<string>(data.nodes.map((n: GraphNode) => n.id));
        const edgeIds = new Set<string>(data.edges.map((e: GraphEdge) => e.id));
        nodeIds.add(fileId);
        setHighlightedNodeIds(nodeIds);
        setHighlightedEdgeIds(edgeIds);
      }
    } catch {
      // ignore
    }
  };

  // Trace API execution path (Feature 6)
  const handleTraceAPI = async (apiId: string) => {
    if (!currentRepo) return;
    try {
      const [owner, name] = currentRepo.id.split('/');
      const res = await fetch(`/api/repositories/${owner}/${name}/apis/${encodeURIComponent(apiId)}/graph`);
      if (res.ok) {
        const data = await res.json();
        const nodeIds = new Set<string>(data.nodes.map((n: GraphNode) => n.id));
        const edgeIds = new Set<string>(data.edges.map((e: GraphEdge) => e.id));
        nodeIds.add(apiId);
        setHighlightedNodeIds(nodeIds);
        setHighlightedEdgeIds(edgeIds);
      }
    } catch {
      // ignore
    }
  };

  // Select Cycle & highlight loop in graph (Feature 4)
  const handleSelectCycle = (cycle: DependencyCycle) => {
    setSelectedCycleId(cycle.id);
    const nodeIds = new Set(cycle.files);
    const edgeIds = new Set<string>();

    for (let i = 0; i < cycle.cyclePath.length - 1; i++) {
      const src = cycle.cyclePath[i];
      const tgt = cycle.cyclePath[i + 1];
      const matchingEdge = edges.find(
        e => (e.source === src || (typeof e.source === 'object' && (e.source as any).id === src)) &&
             (e.target === tgt || (typeof e.target === 'object' && (e.target as any).id === tgt))
      );
      if (matchingEdge) edgeIds.add(matchingEdge.id);
    }

    setHighlightedNodeIds(nodeIds);
    setHighlightedEdgeIds(edgeIds);

    // Select the first node in the cycle for inspection
    const firstNode = nodes.find(n => n.id === cycle.files[0]);
    if (firstNode) handleSelectNode(firstNode);
  };

  // Focus single node
  const handleFocusNode = (nodeId: string) => {
    const nodeIds = new Set([nodeId]);
    const edgeIds = new Set<string>();

    for (const edge of edges) {
      const s = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const t = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      if (s === nodeId || t === nodeId) {
        nodeIds.add(s);
        nodeIds.add(t);
        edgeIds.add(edge.id);
      }
    }

    setHighlightedNodeIds(nodeIds);
    setHighlightedEdgeIds(edgeIds);
  };

  // Analyze GitHub Repository
  const handleAnalyzeRepository = async (repoUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisMessage('Connecting to GitHub API...');
    setAnalysisError(null);

    // Simulated progress ticks during long operations
    const timer = setInterval(() => {
      setAnalysisProgress(p => {
        if (p < 85) return p + 12;
        return p;
      });
    }, 800);

    try {
      let result: any;
      try {
        result = await safeFetchJson('/api/repositories/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: repoUrl }),
        });
      } catch (backendErr: any) {
        console.warn('Backend analysis endpoint returned error, switching to direct GitHub parser:', backendErr.message);
        setAnalysisMessage('Analyzing directly via GitHub API...');
        result = await analyzeRepositoryInBrowser(repoUrl, (pct, msg) => {
          setAnalysisProgress(pct);
          setAnalysisMessage(msg);
        });
      }

      clearInterval(timer);
      setAnalysisProgress(100);
      setAnalysisMessage('Knowledge graph created successfully!');

      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentRepo(result.repository);
        if (result.nodes) setNodes(result.nodes);
        if (result.edges) setEdges(result.edges);
        setCycles(result.cycles || []);
        if (result.repository) loadGraphForView(result.repository, 'dna');
        fetchNeo4jStatus();
      }, 500);
    } catch (err: any) {
      clearInterval(timer);
      setIsAnalyzing(false);
      setAnalysisError(err.message || 'Failed to analyze repository. Please verify the GitHub URL.');
    }
  };

  // Quick load sample repository (for fast 3-minute demo flow)
  const handleQuickLoadSample = async (repoId: string) => {
    setIsAnalyzing(true);
    setAnalysisProgress(30);
    setAnalysisMessage(`Loading verified graph for ${repoId}...`);
    setAnalysisError(null);

    try {
      let data: any;
      try {
        data = await safeFetchJson('/api/repositories/sample/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoId }),
        });
      } catch (loadErr: any) {
        console.warn('Backend sample load unavailable, loading directly:', loadErr.message);
        data = await analyzeRepositoryInBrowser(
          `https://github.com/${repoId}`,
          (pct, msg) => {
            setAnalysisProgress(pct);
            setAnalysisMessage(msg);
          }
        );
      }

      setAnalysisProgress(100);
      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentRepo(data.repository);
        setNodes(data.nodes);
        setEdges(data.edges);
        setCycles(data.cycles || []);
        fetchNeo4jStatus();
      }, 300);
    } catch (err: any) {
      setIsAnalyzing(false);
      setAnalysisError(err.message || 'Failed to load sample repository');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Bar Header */}
      <Header
        currentRepo={currentRepo}
        viewMode={viewMode}
        onSelectViewMode={handleSelectViewMode}
        neo4jStatus={neo4jStatus}
        onOpenNeo4jSettings={() => setIsNeo4jModalOpen(true)}
        onResetToLanding={() => {
          setCurrentRepo(null);
          setSelectedNode(null);
          setNodes([]);
          setEdges([]);
          setCycles([]);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* In-UI Error Banner (replaces window.alert) */}
      {analysisError && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 py-2 text-xs text-rose-200 flex items-center justify-between z-40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{analysisError}</span>
          </div>
          <button
            onClick={() => setAnalysisError(null)}
            className="p-1 hover:bg-rose-900/60 rounded text-rose-400 hover:text-rose-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!currentRepo ? (
        <LandingView
          onAnalyze={handleAnalyzeRepository}
          onQuickLoadSample={handleQuickLoadSample}
          isLoading={isAnalyzing}
          sampleRepos={sampleRepos}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT: Repository Explorer */}
          <LeftPanel
            nodes={nodes}
            cycles={cycles}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
            onSelectCycle={handleSelectCycle}
            viewMode={viewMode}
            selectedCycleId={selectedCycleId}
          />

          {/* CENTER: Neo4j Graph Canvas */}
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
            highlightedNodeIds={highlightedNodeIds}
            highlightedEdgeIds={highlightedEdgeIds}
            viewMode={viewMode}
            repoId={currentRepo.id}
          />

          {/* RIGHT: Selected Node Inspector */}
          <RightPanel
            node={selectedNode}
            nodeDetails={nodeDetails}
            isLoadingDetails={isLoadingDetails}
            onSelectNode={handleSelectNode}
            onExpandDependencies={handleExpandDependencies}
            onShowDependents={handleShowDependents}
            onTraceAPI={handleTraceAPI}
            onFocusNode={handleFocusNode}
            repoUrl={currentRepo.url}
          />
        </div>
      )}

      {/* Analysis Progress Screen */}
      <AnalysisModal
        isOpen={isAnalyzing}
        progressPercent={analysisProgress}
        currentMessage={analysisMessage}
      />

      {/* Neo4j Settings & Connection Modal */}
      <Neo4jSettingsModal
        isOpen={isNeo4jModalOpen}
        onClose={() => setIsNeo4jModalOpen(false)}
        status={neo4jStatus}
        onRefreshStatus={fetchNeo4jStatus}
      />
    </div>
  );
}
