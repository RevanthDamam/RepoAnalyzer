import React, { useEffect, useState, useCallback } from 'react';
import { Search, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { getBriefExplanation } from '../utils/fileExplanation';

export const Dependencies = ({ repoId }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodePath, setSelectedNodePath] = useState(null);

  const fetchDeps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/dependencies`);
      if (res.ok) {
        const json = await res.json();
        const fetchedNodes = json.nodes || [];
        const fetchedEdges = json.edges || [];
        setNodes(fetchedNodes);
        setEdges(fetchedEdges);
        if (fetchedNodes.length > 0) {
          setSelectedNodePath(fetchedNodes[0].path);
        }
        // Auto-rebuild if no edges found (dependency analysis hasn't run yet)
        if (fetchedEdges.length === 0 && fetchedNodes.length > 0) {
          rebuildDeps();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  const rebuildDeps = useCallback(async () => {
    setRebuilding(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/dependencies/rebuild`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setNodes(json.nodes || []);
        setEdges(json.edges || []);
        if (json.nodes && json.nodes.length > 0) {
          setSelectedNodePath(json.nodes[0].path);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRebuilding(false);
    }
  }, [repoId]);

  useEffect(() => {
    fetchDeps();
  }, [fetchDeps]);

  if (loading) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <RefreshCw size={20} className="animate-spin" style={{ color: '#facc15' }} />
        Loading dependency graph...
      </div>
    );
  }

  if (rebuilding) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <RefreshCw size={20} className="animate-spin" style={{ color: '#facc15' }} />
        <span>Running static AST import analysis...</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Parsing import statements across all files</span>
      </div>
    );
  }

  const selectedNode = nodes.find(n => n.path === selectedNodePath);
  
  // Find imports inside selected file (fan-out edges)
  const importsList = edges.filter(e => e.source === selectedNodePath).map(e => e.target);
  
  // Find files importing this selected file (fan-in edges)
  const importedByList = edges.filter(e => e.target === selectedNodePath).map(e => e.source);

  // Filter nodes for search list
  const searchedNodes = nodes.filter(n => 
    n.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="workspace-layout" style={{ gridTemplateColumns: '300px 1fr' }}>
      {/* Sidebar selection lists */}
      <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', height: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '-0.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Import Graph</span>
          <button
            onClick={rebuildDeps}
            title="Re-run static AST dependency analysis"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: '4px', color: '#facc15', fontSize: '0.72rem', padding: '0.25rem 0.55rem', cursor: 'pointer' }}
          >
            <RefreshCw size={11} />
            Rebuild
          </button>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search import graph..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.75rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {searchedNodes.map((n, idx) => (
            <div 
              key={idx}
              className={`tree-item ${selectedNodePath === n.path ? 'selected' : ''}`}
              onClick={() => setSelectedNodePath(n.path)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
            >
              <span className="tree-item-name">{n.filename}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({n.fan_in} in / {n.fan_out} out)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dependency details panel */}
      {selectedNode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Node details banner */}
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--border-radius-md)', background: 'rgba(99, 102, 241, 0.05)', borderLeft: '4px solid var(--accent-primary)' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif' }}>{selectedNode.filename}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
              {getBriefExplanation(selectedNode.filename, selectedNode.path, selectedNode.summary)}
            </p>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              <span>Imports: <strong>{importsList.length}</strong> files</span>
              <span>Imported By: <strong>{importedByList.length}</strong> files</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Fan Out: Imports List */}
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--border-radius-md)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', marginBottom: '1rem' }}>
                <ArrowRight size={16} style={{ color: 'var(--color-low)' }} />
                Imports inside this file (Fan Out)
              </h4>
              
              {importsList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No imports detected in this module.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {importsList.map((target, idx) => (
                    <div 
                      key={idx} 
                      className="tree-item"
                      onClick={() => setSelectedNodePath(target)}
                      style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)' }}
                    >
                      {target.split('/').pop()}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{target}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fan In: Imported By List */}
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--border-radius-md)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', marginBottom: '1rem' }}>
                <ArrowLeft size={16} style={{ color: 'var(--color-med-high)' }} />
                Imported by these files (Fan In / Impact Area)
              </h4>
              
              {importedByList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No other files import this module.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {importedByList.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="tree-item"
                      onClick={() => setSelectedNodePath(source)}
                      style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)' }}
                    >
                      {source.split('/').pop()}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Select a file in the left panel to inspect its import relationships.</div>
      )}
    </div>
  );
};
