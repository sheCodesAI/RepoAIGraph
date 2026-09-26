import React, { useState } from 'react';
import { Database, Search, ArrowRight, Dna, GitBranch, Layers, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { RepositoryMetadata } from '../types/client';

interface LandingViewProps {
  onAnalyze: (url: string) => void;
  onQuickLoadSample: (repoId: string) => void;
  isLoading: boolean;
  sampleRepos: RepositoryMetadata[];
}

export const LandingView: React.FC<LandingViewProps> = ({
  onAnalyze,
  onQuickLoadSample,
  isLoading,
  sampleRepos,
}) => {
  const [inputUrl, setInputUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onAnalyze(inputUrl.trim());
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between relative overflow-hidden bg-slate-950 graph-grid-bg">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[250px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 flex-1 flex flex-col items-center justify-center text-center relative z-10">
        {/* Domain Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-indigo-300 mb-6">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>Neo4j Graph Database & Code Intelligence</span>
        </div>

        {/* Headline & Subtext */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5 max-w-3xl leading-[1.12]">
          Understand any codebase as a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-cyan-400">living graph</span>.
        </h1>
        <p className="text-base sm:text-lg text-slate-400 mb-10 max-w-2xl leading-relaxed">
          Turn GitHub repositories into interactive architecture maps. Traverse dependencies, isolate circular loops, trace API routes to storage, and ground AI explanations in graph truth.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-6">
          <div className="relative flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-2xl shadow-indigo-950/40 focus-within:border-indigo-500 transition-colors">
            <div className="flex items-center gap-3 px-3 w-full">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none py-2"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-medium text-xs flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <span>{isLoading ? 'Analyzing...' : 'Analyze Repository'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Quick Load Sample Repositories */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-16 text-xs text-slate-400">
          <span className="text-slate-500">Quick explore verified repos:</span>
          {sampleRepos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onQuickLoadSample(repo.id)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 border border-slate-800 transition-all font-mono text-[11px]"
            >
              {repo.id}
            </button>
          ))}
        </div>

        {/* 3 Core Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left">
          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3.5">
              <Dna className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Repository DNA</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extract folders, files, AST functions, classes, and APIs. Connect them through typed Neo4j graph relationships.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3.5">
              <GitBranch className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Dependency Intelligence</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Traverse imports and dependents. Automatically isolate and visually highlight circular dependency loops across modules.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3.5">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Architecture Graph</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Synthesize 5-layer system architecture (Frontend, API, Services, DB, External) and trace endpoint execution paths directly to persistence.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Neo4j Graph Database & AST Traversal Engine</span>
          <span>Python · TypeScript · JavaScript Ingestion</span>
        </div>
      </footer>
    </div>
  );
};
