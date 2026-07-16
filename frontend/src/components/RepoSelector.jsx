import React, { useState, useEffect } from 'react';
import { Trash2, Globe, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export const RepoSelector = ({ onSelectRepo }) => {
  const [repos, setRepos] = useState([]);
  const [scanPath, setScanPath] = useState('');
  const [repoName, setRepoName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePolls, setActivePolls] = useState({});

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
        
        // Start polling for any repo that is scanning
        data.forEach((r) => {
          if (r.status !== 'completed' && r.status !== 'failed' && !activePolls[r.id]) {
            startPolling(r.id);
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch repositories', e);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const startPolling = (repoId) => {
    setActivePolls(prev => ({ ...prev, [repoId]: true }));
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/repositories/${repoId}/progress`);
        if (res.ok) {
          const progressData = await res.json();
          
          setRepos(prev => 
            prev.map(r => 
              r.id === repoId 
                ? { ...r, status: progressData.message, progress: progressData }
                : r
            )
          );

          if (progressData.message === 'completed' || progressData.message.startsWith('failed')) {
            clearInterval(interval);
            setActivePolls(prev => ({ ...prev, [repoId]: false }));
            fetchRepos(); // Refresh full data
          }
        }
      } catch (e) {
        clearInterval(interval);
        setActivePolls(prev => ({ ...prev, [repoId]: false }));
      }
    }, 1000);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    setError(null);
    if (!scanPath.trim()) {
      setError('Please provide a valid directory path or Git URL.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: scanPath.trim(),
          name: repoName.trim() || undefined,
          github_url: githubUrl.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to trigger repository scan.');
      }

      setScanPath('');
      setRepoName('');
      setGithubUrl('');
      
      // Refresh list and start polling
      await fetchRepos();
      if (data.repo_id) {
        startPolling(data.repo_id);
      }
    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, repoId) => {
    e.stopPropagation(); // Avoid triggering onSelectRepo
    if (!confirm('Are you sure you want to delete this index? all summaries and embeddings will be removed.')) {
      return;
    }

    try {
      const res = await fetch(`/api/repositories/${repoId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRepos(prev => prev.filter(r => r.id !== repoId));
      }
    } catch (err) {
      console.error('Delete repository failed', err);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3rem', width: '100%' }}>
      {/* Indexer Setup Mockup View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Pill Badge */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="repo-tag" style={{
            color: 'var(--accent-primary)',
            borderColor: 'rgba(250,204,21,0.2)',
            background: 'rgba(250,204,21,0.05)',
            fontSize: '0.72rem',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '0.35rem 1rem',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 0 15px rgba(250, 204, 21, 0.05)'
          }}>
            <Zap size={12} style={{ fill: 'var(--accent-primary)' }} />
            AI-POWERED REPO ANALYZER
          </span>
        </div>

        {/* Large Cinematic Title */}
        <h1 style={{
          fontSize: '3.6rem',
          fontWeight: 800,
          fontFamily: 'Outfit, sans-serif',
          color: '#ffffff',
          lineHeight: 1.15,
          letterSpacing: '-1.5px',
          textAlign: 'center',
          margin: 0
        }}>
          Understand the repo <br/> before you <span style={{
            color: 'var(--accent-primary)',
            textShadow: '0 0 35px rgba(250,204,21,0.3)',
            fontStyle: 'italic'
          }}>touch the code.</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.05rem',
          maxWidth: '620px',
          margin: '0 auto',
          lineHeight: 1.5,
          textAlign: 'center'
        }}>
          Stop reading code for hours. Paste a local path or public Git URL — get the architecture, tech stack and a chat with the codebase in about 30 seconds.
        </p>

        {/* Search Input Bar form */}
        <div style={{ marginTop: '1rem' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-high)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left', maxWidth: '720px', margin: '0 auto 1rem auto' }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleScan} style={{ width: '100%', maxWidth: '720px', margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0a0a0d',
              border: '1px solid rgba(250,204,21,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              gap: '0.75rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(250, 204, 21, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(250,204,21,0.15)';
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.6)';
            }}
            >
              <Globe size={18} style={{ color: 'var(--text-muted)', marginLeft: '0.25rem' }} />
              
              <input 
                type="text" 
                placeholder="https://github.com/rust-lang/rust or C:/Projects/my-app"
                value={scanPath}
                onChange={e => setScanPath(e.target.value)}
                required
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  outline: 'none',
                  padding: '0.4rem 0',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              />

              <button 
                type="submit" 
                disabled={loading}
                style={{
                  background: 'var(--accent-primary)',
                  color: '#000000',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: 'var(--shadow-glow)',
                  transition: 'all 0.15s'
                }}
              >
                {loading ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : (
                  <Zap size={14} style={{ fill: '#000' }} />
                )}
                Explain →
              </button>
            </div>
          </form>
        </div>

        {/* Suggestion Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            SEE A LIVE EXAMPLE – NO SIGN-IN NEEDED
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'vercel/next.js', path: 'https://github.com/vercel/next.js' },
              { label: 'facebook/react', path: 'https://github.com/facebook/react' },
              { label: 'tailwindlabs/tailwindcss', path: 'https://github.com/tailwindlabs/tailwindcss' },
              { label: 'microsoft/vscode', path: 'https://github.com/microsoft/vscode' }
            ].map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setScanPath(ex.path)}
                className="repo-tag glow-hover"
                style={{
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: 'var(--border-glass)',
                  padding: '0.35rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px'
                }}
              >
                {ex.label} <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>↗</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Scanned Repositories List */}
      <div className="tech-section">
        <h3 className="tech-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Scanned Repositories
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.5rem', borderRadius: '50px' }}>
            {repos.length}
          </span>
        </h3>
        
        {repos.length === 0 ? (
          <div className="glass" style={{ padding: '3rem 1.5rem', borderRadius: 'var(--border-radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No indexed codebases yet. Enter a path above to scan your first codebase.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {repos.map(repo => {
              const isScanning = repo.status !== 'completed' && repo.status !== 'failed';
              const progressPct = repo.progress?.percent || (repo.status === 'completed' ? 100 : 0);
              
              return (
                <div 
                  key={repo.id}
                  className="glass repo-card glow-hover"
                  onClick={() => !isScanning && onSelectRepo(repo.id)}
                  style={{ 
                    opacity: isScanning ? 0.85 : 1, 
                    cursor: isScanning ? 'default' : 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {repo.name}
                        {repo.github_url && <Globe size={16} style={{ color: 'var(--text-secondary)' }} />}
                      </h3>
                      <div className="repo-path">{repo.path}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className={`status-badge`} style={{ textTransform: 'capitalize' }}>
                        <span className={`status-indicator ${repo.status === 'completed' ? 'status-active' : (repo.status === 'failed' ? 'status-inactive' : '')}`} style={{
                          backgroundColor: isScanning ? 'var(--color-med)' : (repo.status === 'completed' ? 'var(--color-info)' : 'var(--color-high)'),
                          boxShadow: isScanning ? '0 0 8px var(--color-med)' : undefined
                        }} />
                        {repo.status}
                      </span>
                      
                      <button 
                        className="btn-back" 
                        style={{ padding: '0.35rem', borderRadius: '50px', background: 'transparent' }}
                        onClick={(e) => handleDelete(e, repo.id)}
                        title="Delete index"
                      >
                        <Trash2 size={16} style={{ color: 'var(--color-high)' }} />
                      </button>
                    </div>
                  </div>

                  {isScanning && (
                    <div className="progress-container" style={{ margin: '0.5rem 0 0 0', padding: '0.75rem', background: 'transparent', border: 'none' }}>
                      <div className="progress-header" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <span>{repo.progress?.message || 'Processing...'}</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="progress-bar-bg" style={{ height: '6px' }}>
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  )}

                  {!isScanning && repo.technologies && (
                    <div className="repo-tags">
                      {repo.technologies.language !== 'Unknown' && (
                        <span className="repo-tag" style={{ borderLeft: '3px solid var(--color-low)' }}>
                          {repo.technologies.language}
                        </span>
                      )}
                      {repo.technologies.framework !== 'Unknown' && (
                        <span className="repo-tag" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                          {repo.technologies.framework}
                        </span>
                      )}
                      {repo.technologies.database !== 'Unknown' && (
                        <span className="repo-tag" style={{ borderLeft: '3px solid var(--color-info)' }}>
                          {repo.technologies.database}
                        </span>
                      )}
                      {repo.technologies.orm !== 'Unknown' && (
                        <span className="repo-tag" style={{ borderLeft: '3px solid var(--color-med)' }}>
                          {repo.technologies.orm}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {repo.status === 'failed' && repo.error_message && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-high)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Error: {repo.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
