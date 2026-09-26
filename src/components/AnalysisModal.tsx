import React from 'react';
import { Loader2, CheckCircle2, Circle, GitFork, FileCode, Cpu, Network, BookOpen } from 'lucide-react';

interface AnalysisModalProps {
  isOpen: boolean;
  progressPercent: number;
  currentMessage: string;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  progressPercent,
  currentMessage,
}) => {
  if (!isOpen) return null;

  const steps = [
    { label: 'Repository metadata fetched', threshold: 15, icon: <GitFork className="w-4 h-4" /> },
    { label: 'File tree discovered & filtered', threshold: 35, icon: <FileCode className="w-4 h-4" /> },
    { label: 'Code parsed & AST extracted', threshold: 55, icon: <Cpu className="w-4 h-4" /> },
    { label: 'APIs & routes detected', threshold: 70, icon: <Network className="w-4 h-4" /> },
    { label: 'README analyzed & concepts extracted', threshold: 85, icon: <BookOpen className="w-4 h-4" /> },
    { label: 'Neo4j knowledge graph constructed', threshold: 98, icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-indigo-950/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <span className="text-sm font-semibold text-white">Analyzing Repository</span>
          </div>
          <span className="font-mono text-xs font-semibold text-indigo-400 tabular-nums">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 mb-5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Dynamic status message */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 mb-5">
          <p className="text-xs text-slate-300 font-mono truncate">{currentMessage}</p>
        </div>

        {/* Steps List */}
        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isDone = progressPercent >= step.threshold;
            const isCurrent = progressPercent < step.threshold && (idx === 0 || progressPercent >= steps[idx - 1].threshold);

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 text-xs transition-colors ${
                  isDone
                    ? 'text-slate-300'
                    : isCurrent
                    ? 'text-indigo-400 font-medium'
                    : 'text-slate-600'
                }`}
              >
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-700" />
                  )}
                </div>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
