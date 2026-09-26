import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Terminal,
  HelpCircle,
  FileCode,
  Server,
  Code2,
  Layers,
  Tag,
  BookOpen,
  Dna,
} from 'lucide-react';
import { GraphNode, GraphEdge, NodeType, ViewMode } from '../types/client';

interface SimNode extends SimulationNodeDatum, GraphNode {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  source: string | SimNode;
  target: string | SimNode;
  type: string;
  label?: string;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  viewMode: ViewMode;
  repoId: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  selectedNode,
  onSelectNode,
  highlightedNodeIds,
  highlightedEdgeIds,
  viewMode,
  repoId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<SimNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<SimLink | null>(null);

  // Simulation state
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  // Calculate layout or run force simulation
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) {
      setSimNodes([]);
      setSimLinks([]);
      return;
    }

    const { clientWidth: width, clientHeight: height } = containerRef.current;

    // Clone data for D3 force simulation
    const nodeMap = new Map<string, SimNode>();
    const clonedNodes: SimNode[] = nodes.map(n => {
      // If Architecture view, arrange in distinct horizontal or vertical layered ranks!
      let initialX = width / 2 + (Math.random() - 0.5) * 300;
      let initialY = height / 2 + (Math.random() - 0.5) * 300;

      if (viewMode === 'architecture') {
        const layerRanks: Record<string, number> = {
          'Frontend': 0.15,
          'API': 0.35,
          'Backend/Services': 0.55,
          'Database': 0.75,
          'External Services': 0.88,
        };
        const rank = layerRanks[n.layer || 'Backend/Services'] || 0.5;
        initialY = height * rank;
      }

      const nodeObj: SimNode = {
        ...n,
        x: n.x ?? initialX,
        y: n.y ?? initialY,
      };
      nodeMap.set(n.id, nodeObj);
      return nodeObj;
    });

    const validLinks: SimLink[] = [];
    for (const e of edges) {
      if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
        validLinks.push({
          id: e.id,
          source: nodeMap.get(e.source)!,
          target: nodeMap.get(e.target)!,
          type: e.type,
          label: e.label,
        });
      }
    }

    // Configure simulation
    const simulation = forceSimulation<SimNode>(clonedNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(validLinks)
          .id(d => d.id)
          .distance(viewMode === 'architecture' ? 120 : 90)
      )
      .force('charge', forceManyBody().strength(viewMode === 'architecture' ? -250 : -180))
      .force('center', forceCenter(width / 2, height / 2).strength(0.08))
      .force('collision', forceCollide().radius(32));

    simulation.on('tick', () => {
      setSimNodes([...clonedNodes]);
      setSimLinks([...validLinks]);
    });

    simulation.alpha(0.8).restart();

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, viewMode]);

  // Center & Fit graph view
  const handleFitView = useCallback(() => {
    if (!containerRef.current || simNodes.length === 0) return;
    const { clientWidth: w, clientHeight: h } = containerRef.current;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x !== undefined && n.y !== undefined) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      }
    }

    const graphWidth = Math.max(maxX - minX + 120, 200);
    const graphHeight = Math.max(maxY - minY + 120, 200);
    const scale = Math.min(Math.min(w / graphWidth, h / graphHeight), 1.6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setTransform({
      k: scale,
      x: w / 2 - cx * scale,
      y: h / 2 - cy * scale,
    });
  }, [simNodes]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    // Canvas drag (if not clicking node)
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    } else if (draggedNode) {
      // Node drag
      const nodeX = (e.clientX - transform.x) / transform.k;
      const nodeY = (e.clientY - transform.y) / transform.k;
      draggedNode.fx = nodeX;
      draggedNode.fy = nodeY;
      setSimNodes([...simNodes]);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    if (draggedNode) {
      draggedNode.fx = null;
      draggedNode.fy = null;
      setDraggedNode(null);
    }
  };

  // Zoom controls
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newK = Math.max(0.2, Math.min(transform.k * zoomFactor, 3.5));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setTransform(prev => ({
        k: newK,
        x: mouseX - (mouseX - prev.x) * (newK / prev.k),
        y: mouseY - (mouseY - prev.y) * (newK / prev.k),
      }));
    }
  };

  // Cypher Query display based on viewMode
  const activeCypher = useMemo(() => {
    switch (viewMode) {
      case 'dna':
        return `MATCH (n {repoId: "${repoId}"})-[r]->(m) RETURN n, r, m LIMIT 150;`;
      case 'architecture':
        return `MATCH (l:ArchitectureLayer)-[r:CONNECTS_TO]->(target) RETURN l, r, target;`;
      case 'apis':
        return `MATCH (a:API)-[r:IMPLEMENTED_BY*1..3]->(target) RETURN a, r, target;`;
      case 'dependencies':
        return selectedNode
          ? `MATCH (f:File {id: "${selectedNode.id}"})-[r:IMPORTS]->(dep:File) RETURN f, r, dep;`
          : `MATCH (f:File)-[r:IMPORTS]->(dep:File) RETURN f, r, dep;`;
      case 'cycles':
        return `MATCH path = (f:File {repoId: "${repoId}"})-[:IMPORTS*1..8]->(f) RETURN path;`;
      case 'readme':
        return `MATCH (rm:ReadmeSection)-[r:DOCUMENTS|MENTIONS]->(target) RETURN rm, r, target;`;
      default:
        return `MATCH (n) RETURN n LIMIT 100;`;
    }
  }, [viewMode, repoId, selectedNode]);

  const getNodeColors = (type: NodeType) => {
    switch (type) {
      case 'File':
        return { fill: '#083344', stroke: '#06b6d4', text: '#67e8f9' }; // Cyan
      case 'API':
        return { fill: '#1e1b4b', stroke: '#6366f1', text: '#a5b4fc' }; // Indigo
      case 'Function':
        return { fill: '#064e3b', stroke: '#10b981', text: '#6ee7b7' }; // Emerald
      case 'Class':
        return { fill: '#451a03', stroke: '#f59e0b', text: '#fcd34d' }; // Amber
      case 'ArchitectureLayer':
        return { fill: '#4c0519', stroke: '#f43f5e', text: '#fda4af' }; // Rose
      case 'Technology':
        return { fill: '#2e1065', stroke: '#8b5cf6', text: '#c4b5fd' }; // Violet
      case 'ReadmeSection':
      case 'Feature':
        return { fill: '#0c4a6e', stroke: '#0284c7', text: '#7dd3fc' }; // Sky
      default:
        return { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' }; // Slate
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="flex-1 h-full relative overflow-hidden bg-slate-950 graph-grid-bg cursor-grab active:cursor-grabbing select-none"
    >
      {/* Zoom / Pan Controls Floating Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 backdrop-blur-md shadow-lg">
        <button
          onClick={() => setTransform(t => ({ ...t, k: Math.min(t.k * 1.2, 3.5) }))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform(t => ({ ...t, k: Math.max(t.k * 0.8, 0.2) }))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitView}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Fit Graph to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Indicator & Active Filter Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800/90 backdrop-blur-md text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-semibold text-slate-200">
            {viewMode.toUpperCase()} PERSPECTIVE
          </span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-slate-400">{nodes.length} nodes · {edges.length} relationships</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg className="w-full h-full">
        <defs>
          {/* Arrow markers for directed edges */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569" />
          </marker>
          <marker
            id="arrow-highlight"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#818cf8" />
          </marker>
          <marker
            id="arrow-cycle"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
          {simLinks.map(link => {
            const sourceNode = link.source as SimNode;
            const targetNode = link.target as SimNode;
            if (!sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null;

            const isHighlighted = highlightedEdgeIds.has(link.id);
            const isHovered = hoveredEdge?.id === link.id;
            const isCycleEdge = link.type === 'IMPORTS' && highlightedEdgeIds.has(link.id) && viewMode === 'cycles';

            return (
              <g key={link.id}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={
                    isCycleEdge
                      ? '#f59e0b'
                      : isHighlighted
                      ? '#818cf8'
                      : isHovered
                      ? '#94a3b8'
                      : '#334155'
                  }
                  strokeWidth={isCycleEdge ? 2.5 : isHighlighted || isHovered ? 2 : 1.2}
                  strokeDasharray={link.type === 'DOCUMENTS' || link.type === 'USES' ? '4 3' : undefined}
                  markerEnd={
                    isCycleEdge
                      ? 'url(#arrow-cycle)'
                      : isHighlighted
                      ? 'url(#arrow-highlight)'
                      : 'url(#arrow)'
                  }
                  className="transition-colors duration-150"
                  onMouseEnter={() => setHoveredEdge(link)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />

                {/* Edge Label on hover or highlight */}
                {(isHovered || isHighlighted || isCycleEdge) && (
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2 - 4}
                    fill={isCycleEdge ? '#f59e0b' : '#cbd5e1'}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="pointer-events-none select-none bg-slate-950 px-1"
                  >
                    {link.label || link.type}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {simNodes.map(node => {
            if (node.x === undefined || node.y === undefined) return null;

            const isSelected = selectedNode?.id === node.id;
            const isHighlighted = highlightedNodeIds.has(node.id);
            const isHovered = hoveredNode?.id === node.id;
            const colors = getNodeColors(node.type);

            const isLayerNode = node.type === 'ArchitectureLayer';
            const nodeRadius = isLayerNode ? 24 : node.type === 'API' ? 18 : 14;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedNode(node);
                }}
                className="cursor-pointer"
              >
                {/* Glow ring on select / highlight */}
                {(isSelected || isHighlighted || isHovered) && (
                  <circle
                    r={nodeRadius + 6}
                    fill="none"
                    stroke={isSelected ? '#818cf8' : '#38bdf8'}
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    className="animate-pulse"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={nodeRadius}
                  fill={colors.fill}
                  stroke={isSelected ? '#ffffff' : colors.stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Node Icon inside */}
                <g transform="translate(-6, -6)" pointerEvents="none" className="text-slate-300">
                  {node.type === 'API' && <Server className="w-3 h-3 text-indigo-300" />}
                  {node.type === 'File' && <FileCode className="w-3 h-3 text-cyan-300" />}
                  {node.type === 'Function' && <Code2 className="w-3 h-3 text-emerald-300" />}
                  {node.type === 'ArchitectureLayer' && <Layers className="w-3 h-3 text-rose-300" />}
                  {node.type === 'Technology' && <Tag className="w-3 h-3 text-violet-300" />}
                  {(node.type === 'ReadmeSection' || node.type === 'Feature') && (
                    <BookOpen className="w-3 h-3 text-sky-300" />
                  )}
                  {node.type === 'Repository' && <Dna className="w-3 h-3 text-white" />}
                </g>

                {/* Node Label Below */}
                <text
                  y={nodeRadius + 12}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : colors.text}
                  fontSize={isLayerNode ? '11' : '10'}
                  fontWeight={isSelected || isLayerNode ? '600' : '400'}
                  fontFamily="system-ui, sans-serif"
                  className="pointer-events-none select-none drop-shadow-md"
                >
                  {node.name.length > 20 ? `${node.name.slice(0, 18)}...` : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredNode && hoveredNode.x !== undefined && hoveredNode.y !== undefined && (
        <div
          className="absolute pointer-events-none z-30 p-2.5 rounded-lg bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs max-w-xs transition-opacity"
          style={{
            left: `${hoveredNode.x * transform.k + transform.x + 20}px`,
            top: `${hoveredNode.y * transform.k + transform.y - 30}px`,
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-slate-100 mb-1">
            <span>{hoveredNode.name}</span>
            <span className="text-[10px] text-slate-400 font-normal">({hoveredNode.type})</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mb-1 truncate">
            {hoveredNode.metadata?.path || hoveredNode.id}
          </p>
          {hoveredNode.layer && (
            <p className="text-[10px] text-indigo-400 font-medium">Layer: {hoveredNode.layer}</p>
          )}
        </div>
      )}

      {/* Minimap (bottom right) */}
      <div className="absolute bottom-14 right-4 z-20 w-36 h-28 bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 hidden sm:block backdrop-blur-md shadow-lg pointer-events-none">
        <div className="text-[9px] font-mono text-slate-500 mb-1 flex items-center justify-between">
          <span>MINIMAP</span>
          <span className="text-indigo-400 font-semibold">{simNodes.length}</span>
        </div>
        <div className="w-full h-20 bg-slate-950/80 rounded relative overflow-hidden">
          {simNodes.map(n => {
            const rx = Math.max(0, Math.min(((n.x || 0) / 1000) * 100, 95));
            const ry = Math.max(0, Math.min(((n.y || 0) / 1000) * 100, 95));
            return (
              <div
                key={n.id}
                className="w-1.5 h-1.5 rounded-full absolute bg-indigo-500/80"
                style={{ left: `${rx}%`, top: `${ry}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Cypher Query Inspector Bar */}
      <div className="absolute bottom-2 left-4 right-4 z-20 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/90 text-xs backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2 text-slate-400 font-mono min-w-0">
          <Terminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-slate-500 shrink-0 select-none">Cypher:</span>
          <code className="text-indigo-300 truncate text-[11px]">{activeCypher}</code>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-[11px] text-slate-500">
          <span>Source: <strong className="text-slate-300">Neo4j Driver</strong></span>
        </div>
      </div>
    </div>
  );
};
