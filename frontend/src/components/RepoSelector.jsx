import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, FolderGit2, Gauge, GitBranch, Loader2, Plus, Radar, Trash2, Zap } from 'lucide-react';
import { apiFetch } from '../utils/api';

const REPO_LIMIT = 2;
const EXAMPLES = [
  { label: 'Next.js', path: 'https://github.com/vercel/next.js' },
  { label: 'React', path: 'https://github.com/facebook/react' },
  { label: 'VS Code', path: 'https://github.com/microsoft/vscode' },
];

const statusMeta = (status) => {
  if (status === 'completed') return { label: 'Ready', icon: CheckCircle2, tone: 'success' };
  if (status === 'failed' || status?.startsWith('failed')) return { label: 'Failed', icon: AlertCircle, tone: 'danger' };
  return { label: status || 'Queued', icon: Loader2, tone: 'working' };
};

export const RepoSelector = ({ onSelectRepo }) => {
  const [repos, setRepos] = useState([]);
  const [scanPath, setScanPath] = useState('');
  const [repoName, setRepoName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePolls, setActivePolls] = useState({});

  const startPolling = (repoId) => {
    setActivePolls((prev) => ({ ...prev, [repoId]: true }));
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/repositories/${repoId}/progress`);
        if (!res.ok) throw new Error('Progress unavailable');
        const progress = await res.json();
        setRepos((prev) => prev.map((repo) => repo.id === repoId ? { ...repo, status: progress.message, progress } : repo));
        if (progress.message === 'completed' || progress.message.startsWith('failed')) {
          clearInterval(interval);
          setActivePolls((prev) => ({ ...prev, [repoId]: false }));
          fetchRepos();
        }
      } catch {
        clearInterval(interval);
        setActivePolls((prev) => ({ ...prev, [repoId]: false }));
      }
    }, 1000);
  };

  const fetchRepos = async () => {
    try {
      const res = await apiFetch('/api/repositories');
      if (!res.ok) return;
      const data = await res.json();
      setRepos(data);
      data.forEach((repo) => {
        if (repo.status !== 'completed' && repo.status !== 'failed' && !activePolls[repo.id]) startPolling(repo.id);
      });
    } catch (err) {
      console.error('Failed to fetch repositories', err);
    }
  };

  useEffect(() => { fetchRepos(); }, []);

  const handleScan = async (event) => {
    event.preventDefault();
    setError(null);
    if (!scanPath.trim()) {
      setError('Enter a local repository path or public Git URL.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: scanPath.trim(),
          name: repoName.trim() || undefined,
          github_url: githubUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Unable to queue repository scan.');
      setScanPath('');
      setRepoName('');
      setGithubUrl('');
      await fetchRepos();
      if (data.repo_id) startPolling(data.repo_id);
    } catch (err) {
      setError(err.message || 'Unable to start scan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (event, repoId) => {
    event.stopPropagation();
    if (!confirm('Delete this index and its analysis data?')) return;
    try {
      const res = await apiFetch(`/api/repositories/${repoId}`, { method: 'DELETE' });
      if (res.ok) setRepos((prev) => prev.filter((repo) => repo.id !== repoId));
    } catch (err) {
      console.error('Delete repository failed', err);
    }
  };

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> AI-powered code intelligence</div>
          <h1>See the system<br /><em>behind the source.</em></h1>
          <p className="hero-subtitle">RepoAnalyzer turns an unfamiliar codebase into a navigable map of architecture, dependencies, files, and answers.</p>
          <div className="hero-proof-row">
            <span><Radar size={14} /> Static analysis</span>
            <span><Zap size={14} /> RAG answers</span>
            <span><ShieldCheckIcon /> Private by session</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Repository analysis preview">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="signal-node node-a" /><div className="signal-node node-b" /><div className="signal-node node-c" />
          <div className="analysis-card">
            <div className="analysis-card-top"><span className="window-dots"><i /><i /><i /></span><span className="mono-label">ANALYSIS CORE / 01</span><span className="live-badge"><i />LIVE</span></div>
            <div className="analysis-core"><div className="core-ring ring-a" /><div className="core-ring ring-b" /><div className="core-center"><Gauge size={18} /><strong>RA</strong></div></div>
            <div className="analysis-metrics"><span><b>8,412</b><small>files indexed</small></span><span><b>97.4%</b><small>graph coverage</small></span><span><b>04</b><small>risk clusters</small></span></div>
          </div>
          <div className="float-chip chip-top"><ActivityIcon /><span>Dependency graph</span><strong>synced</strong></div>
          <div className="float-chip chip-bottom"><span className="chip-signal" /><span>Semantic index</span><strong>ready</strong></div>
        </div>
      </section>

      <section className="scan-section">
        <div className="section-heading"><div><span className="section-kicker">Start an analysis</span><h2>Bring a repository into focus.</h2></div><span className="limit-pill"><span>{repos.length}</span> / {REPO_LIMIT} slots used</span></div>
        <form className="scan-form" onSubmit={handleScan}>
          <div className="scan-input-row"><FolderGit2 size={18} /><input value={scanPath} onChange={(event) => setScanPath(event.target.value)} placeholder="Paste a public Git URL or local path..." aria-label="Repository path or Git URL" required /><button type="submit" disabled={loading}><span>{loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}</span>{loading ? 'Queueing' : 'Analyze repository'}<ArrowUpRight size={15} /></button></div>
          <div className="scan-advanced"><input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="Optional project name" aria-label="Optional project name" /><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="Optional public project URL" aria-label="Optional public project URL" /><span><Clock3 size={13} /> Usually ready in about 30 seconds</span></div>
        </form>
        {error && <div className="scan-error"><AlertCircle size={15} />{error}</div>}
        <div className="example-row"><span className="section-kicker">Try a public codebase</span>{EXAMPLES.map((example) => <button key={example.path} type="button" onClick={() => setScanPath(example.path)}><GitBranch size={13} />{example.label}<ArrowUpRight size={12} /></button>)}</div>
      </section>

      <section className="repository-section">
        <div className="section-heading compact"><div><span className="section-kicker">Your workspace</span><h2>Indexed repositories</h2></div><span className="repository-count">{repos.length === 0 ? 'No indexes yet' : `${repos.length} active ${repos.length === 1 ? 'index' : 'indexes'}`}</span></div>
        {repos.length === 0 ? <div className="empty-repositories"><div className="empty-icon"><Radar size={20} /></div><div><strong>Your analysis shelf is empty.</strong><p>Scan a repository above to unlock its architecture map, source explorer, and AI assistant.</p></div></div> : <div className="repository-grid">{repos.map((repo) => {
          const meta = statusMeta(repo.status);
          const StatusIcon = meta.icon;
          const isScanning = repo.status !== 'completed' && repo.status !== 'failed';
          const progress = repo.progress?.percent || (repo.status === 'completed' ? 100 : 0);
          return <article key={repo.id} className={`repository-card ${meta.tone}`} onClick={() => !isScanning && onSelectRepo(repo.id)} role={!isScanning ? 'button' : undefined} tabIndex={!isScanning ? 0 : undefined}>
            <div className="repository-card-top"><span className="repo-icon"><FolderGit2 size={17} /></span><span className={`status-pill ${meta.tone}`}><StatusIcon size={12} className={isScanning ? 'animate-spin' : ''} />{meta.label}</span><button className="icon-button danger" type="button" onClick={(event) => handleDelete(event, repo.id)} aria-label={`Delete ${repo.name}`}><Trash2 size={14} /></button></div>
            <h3>{repo.name}</h3><p className="repo-path">{repo.path}</p>
            {isScanning ? <div className="repo-progress"><div><span>{repo.progress?.message || 'Preparing analysis...'}</span><b>{Math.round(progress)}%</b></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div> : <div className="repo-card-footer"><span><Gauge size={13} /> Ready to inspect</span><ArrowUpRight size={14} /></div>}
          </article>;
        })}</div>}
      </section>
    </main>
  );
};

const ShieldCheckIcon = () => <span className="mini-shield">✓</span>;
const ActivityIcon = () => <span className="mini-wave">⌁</span>;
