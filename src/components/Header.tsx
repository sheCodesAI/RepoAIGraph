import React from 'react';
import { ViewMode, RepositoryMetadata, Neo4jStatus } from '../types/client';
import { Network, Database, Layers, GitBranch, AlertCircle, BookOpen, RefreshCw, Server } from 'lucide-react';

interface HeaderProps {
  currentRepo: RepositoryMetadata | null;
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  neo4jStatus: Neo4jStatus | null;
  onOpenNeo4jSettings: () => void;
  onResetToLanding: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRepo,
  viewMode,
  onSelectViewMode,
  neo4jStatus,
  onOpenNeo4jSettings,
  onResetToLanding,
}) => {
  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'dna', label: 'Repository DNA', icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'architecture', label: 'Architecture', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'apis', label: 'APIs', icon: <Server className="w-3.5 h-3.5" /> },
    { id: 'dependencies', label: 'Dependencies', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'cycles', label: 'Cycles', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { id: 'readme', label: 'README ↔ Code', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Zone 1: Wordmark & Repo Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onResetToLanding}
          className="flex items-center gap-2 group text-left transition-opacity hover:opacity-80"
          title="Return to Repository Input"
        >
          <div className="w-7 h-7 rounded-md bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:border-indigo-400">
            <Database className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-100 tracking-tight text-sm whitespace-nowrap">
            RepoGraph <span className="text-indigo-400">AI</span>
          </span>
        </button>

        {currentRepo && (
          <div className="hidden sm:flex items-center text-xs text-slate-500 gap-1.5 pl-2 border-l border-slate-800">
            <span>{currentRepo.owner}</span>
            <span>/</span>
            <span className="text-slate-300 font-medium">{currentRepo.name}</span>
            <span className="text-slate-600">({currentRepo.language})</span>
          </div>
        )}
      </div>

      {/* Zone 2: Navigation Modes */}
      {currentRepo && (
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
          {tabs.map(tab => {
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectViewMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Zone 3: Neo4j Status & Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenNeo4jSettings}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
            neo4jStatus?.connected
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
              : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
          title="Click to view Neo4j connection configuration"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              neo4jStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="hidden sm:inline">
            {neo4jStatus?.connected ? 'Neo4j Live' : 'Neo4j Engine'}
          </span>
        </button>

        {currentRepo && (
          <button
            onClick={onResetToLanding}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-colors"
            title="Analyze a different repository"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Switch Repo</span>
          </button>
        )}
      </div>
    </header>
  );
};
