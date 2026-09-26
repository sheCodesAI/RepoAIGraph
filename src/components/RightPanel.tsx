import React, { useState } from 'react';
import {
  FileCode,
  Server,
  Code2,
  ExternalLink,
  GitBranch,
  Sparkles,
  Layers,
  Tag,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Eye,
  Crosshair,
  Loader2,
  Database,
} from 'lucide-react';
import { GraphNode } from '../types/client';

interface NodeDetailsData {
  node: GraphNode;
  dependencies: GraphNode[];
  dependents: GraphNode[];
  relatedEntities: { node: GraphNode; relationship: string; direction: 'in' | 'out' }[];
}

interface RightPanelProps {
  node: GraphNode | null;
  nodeDetails: NodeDetailsData | null;
  isLoadingDetails: boolean;
  onSelectNode: (node: GraphNode) => void;
  onExpandDependencies: (fileId: string) => void;
  onShowDependents: (fileId: string) => void;
  onTraceAPI: (apiId: string) => void;
  onFocusNode: (nodeId: string) => void;
  repoUrl: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  node,
  nodeDetails,
  isLoadingDetails,
  onSelectNode,
  onExpandDependencies,
  onShowDependents,
  onTraceAPI,
  onFocusNode,
  repoUrl,
}) => {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Clear AI explanation when selected node changes
  React.useEffect(() => {
    setAiExplanation(null);
  }, [node?.id]);

  const handleGenerateAiExplanation = async () => {
    if (!node) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node,
          dependencies: nodeDetails?.dependencies || [],
          dependents: nodeDetails?.dependents || [],
          relatedEntities: nodeDetails?.relatedEntities || [],
        }),
      });
      const data = await res.json();
      setAiExplanation(data.explanation || 'No explanation generated.');
    } catch {
      setAiExplanation('Failed to generate AI explanation.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (!node) {
    return (
      <aside className="w-80 h-full border-l border-slate-800 bg-slate-950/70 p-6 flex flex-col items-center justify-center text-center text-slate-500 z-20 select-none">
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
          <Crosshair className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-slate-300 mb-1">No Entity Selected</p>
        <p className="text-[11px] text-slate-500 max-w-[200px]">
          Click any file, API route, function, or layer in the graph to inspect relationships and dependencies.
        </p>
      </aside>
    );
  }

  const isFile = node.type === 'File';
  const isAPI = node.type === 'API';
  const githubFileUrl = isFile && node.metadata?.path ? `${repoUrl}/blob/master/${node.metadata.path}` : null;

  return (
    <aside className="w-84 h-full border-l border-slate-800 bg-slate-950/70 flex flex-col z-20 overflow-y-auto divide-y divide-slate-900 select-none">
      {/* Node Header */}
      <div className="p-4 bg-slate-900/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700">
            {node.type}
          </span>
          {node.layer && (
            <span className="text-[10px] text-indigo-400 font-medium">
              Layer: {node.layer}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-slate-100 break-words mb-1">
          {node.name}
        </h3>

        {node.metadata?.path && (
          <p className="text-[11px] font-mono text-slate-400 break-all mb-3">
            {node.metadata.path}
          </p>
        )}

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {isFile && (
            <>
              <button
                onClick={() => onExpandDependencies(node.id)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
                title="Highlight what this file imports"
              >
                <GitBranch className="w-3 h-3 text-cyan-400" />
                <span>Dependencies</span>
              </button>

              <button
                onClick={() => onShowDependents(node.id)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
                title="Highlight who imports this file"
              >
                <Eye className="w-3 h-3 text-indigo-400" />
                <span>Dependents</span>
              </button>
            </>
          )}

          {isAPI && (
            <button
              onClick={() => onTraceAPI(node.id)}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-medium text-white transition-colors flex items-center gap-1 shadow-sm"
            >
              <Server className="w-3 h-3" />
              <span>Trace API Path</span>
            </button>
          )}

          <button
            onClick={() => onFocusNode(node.id)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 border border-slate-700 transition-colors flex items-center gap-1"
          >
            <Crosshair className="w-3 h-3" />
            <span>Focus</span>
          </button>

          {githubFileUrl && (
            <a
              href={githubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 border border-slate-700 transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>GitHub</span>
            </a>
          )}
        </div>
      </div>

      {/* API Specific Metadata */}
      {isAPI && (
        <div className="p-4 space-y-2 text-xs">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            API Endpoint Details
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 block">Method:</span>
              <span className="text-indigo-400 font-bold">{node.metadata?.method}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Framework:</span>
              <span className="text-slate-300">{node.metadata?.framework}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block">Handler Function:</span>
              <span className="text-emerald-400 font-bold">{node.metadata?.handlerName}</span>
            </div>
            {node.metadata?.dbOperations?.length > 0 && (
              <div className="col-span-2 text-rose-300 flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>{node.metadata.dbOperations.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Grounded Explanation Card */}
      <div className="p-4 bg-indigo-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Architecture Explanation</span>
          </div>
          <button
            onClick={handleGenerateAiExplanation}
            disabled={isGeneratingAi}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1 transition-colors"
          >
            {isGeneratingAi ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
            <span>{aiExplanation ? 'Regenerate' : 'Explain'}</span>
          </button>
        </div>

        {aiExplanation ? (
          <div className="p-3 bg-slate-900/80 rounded-lg border border-indigo-900/50 text-[11px] text-slate-300 leading-relaxed font-sans">
            {aiExplanation}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Generate an architectural role and flow explanation grounded strictly in the Neo4j graph facts for this entity.
          </p>
        )}
      </div>

      {/* Direct Dependencies (Files this imports) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Dependencies (Imports)</span>
          <span className="font-mono text-slate-500 text-[11px] tabular-nums">
            {nodeDetails?.dependencies.length || 0}
          </span>
        </div>

        {isLoadingDetails ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading dependencies...
          </div>
        ) : nodeDetails?.dependencies.length ? (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {nodeDetails.dependencies.map(dep => (
              <button
                key={dep.id}
                onClick={() => onSelectNode(dep)}
                className="w-full text-left p-1.5 rounded bg-slate-900/60 hover:bg-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
              >
                <span className="truncate">{dep.name}</span>
                <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">No outgoing file dependencies.</p>
        )}
      </div>

      {/* Direct Dependents (Who imports this) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Dependents (Imported by)</span>
          <span className="font-mono text-slate-500 text-[11px] tabular-nums">
            {nodeDetails?.dependents.length || 0}
          </span>
        </div>

        {isLoadingDetails ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading dependents...
          </div>
        ) : nodeDetails?.dependents.length ? (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {nodeDetails.dependents.map(dep => (
              <button
                key={dep.id}
                onClick={() => onSelectNode(dep)}
                className="w-full text-left p-1.5 rounded bg-slate-900/60 hover:bg-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
              >
                <span className="truncate">{dep.name}</span>
                <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">No downstream files depend on this entity.</p>
        )}
      </div>

      {/* Connected Entities (Functions, APIs, Classes, Technologies) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Connected Graph Entities</span>
          <span className="font-mono text-slate-500 text-[11px] tabular-nums">
            {nodeDetails?.relatedEntities.length || 0}
          </span>
        </div>

        {nodeDetails?.relatedEntities.length ? (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {nodeDetails.relatedEntities.map((rel, idx) => (
              <button
                key={`${rel.node.id}-${idx}`}
                onClick={() => onSelectNode(rel.node)}
                className="w-full text-left p-1.5 rounded bg-slate-900/60 hover:bg-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
              >
                <div className="truncate">
                  <span className="text-[10px] text-indigo-400 font-mono mr-1.5">
                    [{rel.relationship}]
                  </span>
                  <span>{rel.node.name}</span>
                </div>
                <span className="text-[9px] text-slate-500 shrink-0 ml-1">
                  {rel.node.type}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">No direct sub-entities defined.</p>
        )}
      </div>
    </aside>
  );
};
