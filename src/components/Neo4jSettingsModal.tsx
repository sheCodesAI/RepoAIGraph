import React, { useState } from 'react';
import { Database, X, CheckCircle2, AlertTriangle, RefreshCw, KeyRound, Server } from 'lucide-react';
import { Neo4jStatus } from '../types/client';

interface Neo4jSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: Neo4jStatus | null;
  onRefreshStatus: () => void;
}

export const Neo4jSettingsModal: React.FC<Neo4jSettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
}) => {
  const [uri, setUri] = useState(status?.uri || 'bolt://localhost:7687');
  const [username, setUsername] = useState('neo4j');
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/neo4j/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, username, password }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connected successfully!' : 'Connection failed.'),
      });
      onRefreshStatus();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network request failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-indigo-950/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Neo4j Database Engine</h3>
              <p className="text-[11px] text-slate-400">Core Knowledge Graph Source of Truth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Status Box */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 mb-5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Driver Status:</span>
            <span className={`inline-flex items-center gap-1.5 font-semibold ${status?.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {status?.connected ? 'Live Neo4j Connected' : 'In-Memory Graph Engine (Ready)'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 space-y-1">
            <p>URI: <span className="text-slate-300">{status?.uri || 'bolt://localhost:7687'}</span></p>
            <p>Database: <span className="text-slate-300">{status?.database || 'neo4j'}</span></p>
            <p>Nodes Indexed: <span className="text-indigo-400 font-semibold">{status?.nodeCount || 0}</span></p>
          </div>
        </div>

        {/* Connect Form */}
        <form onSubmit={handleTestConnection} className="space-y-3 mb-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Neo4j URI (Local or Neo4j Aura)
            </label>
            <div className="relative">
              <Server className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="neo4j+s://xxx.databases.neo4j.io"
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="neo4j"
                className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800 text-amber-300'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isTesting}
              className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {isTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isTesting ? 'Testing Connection...' : 'Connect to Neo4j Instance'}</span>
            </button>
          </div>
        </form>

        <p className="text-[10px] text-slate-500 leading-normal">
          RepoGraph AI executes native Cypher queries for all graph traversals, circular dependency cycles, and architecture mapping. When running without external Neo4j credentials, our built-in Cypher engine manages the graph seamlessly.
        </p>
      </div>
    </div>
  );
};
