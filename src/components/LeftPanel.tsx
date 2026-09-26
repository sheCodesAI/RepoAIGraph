import React, { useState, useMemo } from 'react';
import {
  Search,
  FileCode,
  Server,
  Layers,
  GitBranch,
  AlertCircle,
  Tag,
  Dna,
  BookOpen,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { GraphNode, NodeType, DependencyCycle, ViewMode } from '../types/client';

interface LeftPanelProps {
  nodes: GraphNode[];
  cycles: DependencyCycle[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode) => void;
  onSelectCycle: (cycle: DependencyCycle) => void;
  viewMode: ViewMode;
  selectedCycleId: string | null;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  nodes,
  cycles,
  selectedNode,
  onSelectNode,
  onSelectCycle,
  viewMode,
  selectedCycleId,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Metrics counts
  const stats = useMemo(() => {
    return {
      files: nodes.filter(n => n.type === 'File').length,
      apis: nodes.filter(n => n.type === 'API').length,
      functions: nodes.filter(n => n.type === 'Function').length,
      classes: nodes.filter(n => n.type === 'Class').length,
      technologies: nodes.filter(n => n.type === 'Technology').length,
      layers: nodes.filter(n => n.type === 'ArchitectureLayer').length,
      cycles: cycles.length,
    };
  }, [nodes, cycles]);

  // Filtered nodes list based on viewMode, filterType, and search
  const displayItems = useMemo(() => {
    return nodes.filter(n => {
      // Filter by search
      if (search) {
        const q = search.toLowerCase();
        const matchName = n.name.toLowerCase().includes(q);
        const matchPath = (n.metadata?.path || '').toLowerCase().includes(q);
        if (!matchName && !matchPath) return false;
      }

      // Filter by viewMode specific context
      if (viewMode === 'apis') {
        return n.type === 'API';
      }
      if (viewMode === 'architecture') {
        return n.type === 'ArchitectureLayer' || n.type === 'File';
      }
      if (viewMode === 'dependencies') {
        return n.type === 'File';
      }
      if (viewMode === 'readme') {
        return n.type === 'ReadmeSection' || n.type === 'Feature';
      }

      // In DNA view, honor filterType
      if (filterType !== 'all') {
        return n.type === filterType;
      }

      return true;
    });
  }, [nodes, viewMode, filterType, search]);

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'File': return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
      case 'API': return <Server className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Function': return <Code2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ArchitectureLayer': return <Layers className="w-3.5 h-3.5 text-rose-400" />;
      case 'Technology': return <Tag className="w-3.5 h-3.5 text-violet-400" />;
      case 'ReadmeSection':
      case 'Feature': return <BookOpen className="w-3.5 h-3.5 text-sky-400" />;
      default: return <Dna className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <aside className="w-80 h-full border-r border-slate-800 bg-slate-950/70 flex flex-col z-20 select-none">
      {/* Search Input */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repository..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/30 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          <FileCode className="w-3 h-3 text-cyan-400" />
          <span className="text-slate-200 tabular-nums">{stats.files}</span> files
        </span>
        <span className="flex items-center gap-1">
          <Server className="w-3 h-3 text-indigo-400" />
          <span className="text-slate-200 tabular-nums">{stats.apis}</span> APIs
        </span>
        <span className="flex items-center gap-1">
          <AlertCircle className={`w-3 h-3 ${stats.cycles > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className={`tabular-nums ${stats.cycles > 0 ? 'text-amber-300 font-semibold' : 'text-slate-200'}`}>
            {stats.cycles}
          </span> cycles
        </span>
      </div>

      {/* Special View: Cycles List if in cycles view or cycles exist */}
      {viewMode === 'cycles' && (
        <div className="p-3 border-b border-slate-800 bg-amber-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Detected Cycles ({cycles.length})
            </span>
          </div>
          {cycles.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No circular dependency cycles detected in this codebase.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {cycles.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelectCycle(c)}
                  className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                    selectedCycleId === c.id
                      ? 'bg-amber-900/40 border-amber-500 text-amber-200 font-medium'
                      : 'bg-slate-900/60 border-amber-800/40 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[11px] text-amber-400">{c.id}</span>
                    <span className="text-[10px] text-slate-400">{c.length} nodes loop</span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-400 truncate">
                    {c.files.map(f => f.split('/').pop()).join(' → ')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs for DNA view */}
      {viewMode === 'dna' && (
        <div className="p-2 border-b border-slate-800 flex gap-1 overflow-x-auto text-[11px]">
          {['all', 'File', 'API', 'Function', 'Technology'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                filterType === t
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'all' ? 'All Entities' : t}
            </button>
          ))}
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
        {displayItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No entities match current filters.
          </div>
        ) : (
          displayItems.map((n) => {
            const isSelected = selectedNode?.id === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onSelectNode(n)}
                className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-indigo-950/40 border-l-2 border-indigo-400 text-slate-100'
                    : 'hover:bg-slate-900/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0">{getNodeIcon(n.type)}</div>
                  <div className="truncate">
                    <p className="text-xs font-medium truncate">{n.name}</p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      {n.metadata?.path || n.type}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {/* Explorer Footer */}
      <div className="p-2.5 border-t border-slate-800/80 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Showing {displayItems.length} entities</span>
        <span className="font-mono text-slate-400">{viewMode.toUpperCase()} VIEW</span>
      </div>
    </aside>
  );
};
