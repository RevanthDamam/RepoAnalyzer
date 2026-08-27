import { useState } from 'react';
import { Activity, Bot, ChevronLeft, Folder, GitFork, LayoutGrid, Loader2, Network, ShieldCheck } from 'lucide-react';
import { RepoSelector } from './components/RepoSelector';
import { Dashboard } from './components/Dashboard';
import { ChatInterface } from './components/ChatInterface';
import { Architecture } from './components/Architecture';
import { Dependencies } from './components/Dependencies';
import { FilesView } from './components/FilesView';
import { apiFetch } from './utils/api';

const RepoLogo = ({ compact = false }) => (
  <span className={`repo-logo${compact ? ' compact' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M24 6 38 14v16L24 38 10 30V14L24 6Z" stroke="currentColor" strokeWidth="2" />
      <path d="m14 17 10 6 10-6M24 23v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="23" r="3.5" fill="currentColor" />
    </svg>
  </span>
);

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, eyebrow: 'Repository overview', title: 'Understand the system at a glance.', copy: 'Static facts, technology signals, and the AI-generated codebase brief in one view.' },
  { id: 'architecture', label: 'Architecture', icon: Network, eyebrow: 'Architecture map', title: 'See how the codebase is shaped.', copy: 'Pan the hierarchy, inspect nodes, and follow the structure from root to source.' },
  { id: 'dependencies', label: 'Dependencies', icon: GitFork, eyebrow: 'Dependency graph', title: 'Trace the inner connections.', copy: 'Explore fan-in, fan-out, and the impact area around every indexed module.' },
  { id: 'files', label: 'Files', icon: Folder, eyebrow: 'Source explorer', title: 'Browse the source with context.', copy: 'Navigate the repository tree and inspect file facts alongside readable source.' },
  { id: 'chat', label: 'AI assistant', icon: Bot, eyebrow: 'Repository assistant', title: 'Ask the codebase directly.', copy: 'Use grounded retrieval to get concise answers backed by indexed repository context.' },
];

export default function App() {
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [repoDetails, setRepoDetails] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [activeNavTab, setActiveNavTab] = useState('overview');
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [repoError, setRepoError] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const fetchFileDetails = async (repoId, fileId) => {
    setLoadingFile(true);
    try {
      const res = await apiFetch(`/api/repositories/${repoId}/file/${fileId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFileDetails({ id: fileId, filename: 'Source unavailable', extension: '', raw_content: 'Unable to read this file.', error: body.detail || `Source request failed (${res.status}).` });
        return;
      }
      setFileDetails(await res.json());
    } catch (error) {
      console.error('Failed to load file details', error);
    } finally {
      setLoadingFile(false);
    }
  };

  const fetchRepoDetails = async (repoId) => {
    setLoadingRepo(true);
    try {
      const res = await apiFetch(`/api/repositories/${repoId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Repository request failed (${res.status}).`);
      }
      const data = await res.json();
      setRepoError(null);
      setRepoDetails(data);
      if (data.files?.length) {
        setSelectedFileId(data.files[0].id);
        fetchFileDetails(repoId, data.files[0].id);
      }
    } catch (error) {
      console.error('Failed to load repository data', error);
      setRepoError(error.message || 'Unable to load this repository.');
    } finally {
      setLoadingRepo(false);
    }
  };

  const openRepository = (repoId) => {
    setSelectedRepoId(repoId);
    setActiveNavTab('overview');
    fetchRepoDetails(repoId);
  };

  const selectFile = (fileId) => {
    setSelectedFileId(fileId);
    if (selectedRepoId) fetchFileDetails(selectedRepoId, fileId);
  };

  const closeRepository = () => {
    setSelectedRepoId(null);
    setRepoDetails(null);
    setRepoError(null);
    setSelectedFileId(null);
    setFileDetails(null);
  };

  const activeTab = tabs.find((tab) => tab.id === activeNavTab) || tabs[0];
  const ActiveIcon = activeTab.icon;

  if (selectedRepoId === null) {
    return (
      <div className="app-shell public-shell">
        <header className="public-nav">
          <button className="brand-lockup" type="button" onClick={closeRepository} aria-label="Go to RepoAnalyzer home">
            <RepoLogo />
            <span><strong>RepoAnalyzer</strong><small>Code intelligence workspace</small></span>
          </button>
          <nav className="public-links" aria-label="Primary navigation"><span>How it works</span><span>Signals</span><span>Documentation</span></nav>
          <div className="public-nav-meta"><span className="status-dot" /> No sign-in required <span className="nav-divider" /><span>Local-first analysis</span></div>
        </header>
        <RepoSelector onSelectRepo={openRepository} />
      </div>
    );
  }

  if (loadingRepo) {
    return <div className="app-shell loading-shell"><Loader2 className="animate-spin" size={30} /><p>Preparing your analysis workspace…</p><span>Loading repository metadata and the first source file</span></div>;
  }

  if (repoError || !repoDetails) {
    return <div className="app-shell loading-shell error-shell"><div className="error-mark">!</div><h1>Workspace unavailable</h1><p>{repoError || 'The repository could not be loaded.'}</p><div><button type="button" className="primary-button" onClick={() => selectedRepoId && fetchRepoDetails(selectedRepoId)}>Try again</button><button type="button" className="secondary-button" onClick={closeRepository}>Back to repositories</button></div></div>;
  }

  return (
    <div className="app-shell workspace-shell">
      <aside className="workspace-rail">
        <div className="rail-top">
          <button className="rail-brand" type="button" onClick={closeRepository} aria-label="Return to repositories"><RepoLogo compact /></button>
          <div className="rail-rule" />
          <div className="rail-label">Workspace</div>
          <nav className="rail-nav" aria-label="Analysis views">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return <button key={tab.id} className={`rail-link ${activeNavTab === tab.id ? 'active' : ''}`} type="button" onClick={() => setActiveNavTab(tab.id)} title={tab.label}><Icon size={17} /><span>{tab.label}</span></button>;
            })}
          </nav>
        </div>
        <div className="rail-bottom"><div className="rail-signal"><span /><span /><span /></div><small>Session secured</small><button className="rail-home" type="button" onClick={closeRepository}><ChevronLeft size={15} /> Repositories</button></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumb"><span className="breadcrumb-muted">Repositories</span><ChevronLeft size={13} /><strong>{repoDetails.name}</strong></div>
          <div className="topbar-meta"><span><ShieldCheck size={14} /> Session protected</span><span><Activity size={14} /> Index {repoDetails.status === 'completed' ? 'ready' : repoDetails.status}</span></div>
        </header>

        <div className="workspace-body">
          <header className="view-heading">
            <div className="view-title-group"><div className="view-icon"><ActiveIcon size={18} /></div><div><span className="section-kicker">{activeTab.eyebrow}</span><h1>{activeTab.title}</h1><p>{activeTab.copy}</p></div></div>
            <div className="repo-context"><span className="context-label">Indexed target</span><strong>{repoDetails.name}</strong><small>{repoDetails.files?.length || 0} source files</small></div>
          </header>

          <section className={`workspace-view view-${activeNavTab}`}>
            {activeNavTab === 'overview' && <Dashboard stats={repoDetails.statistics} technologies={repoDetails.technologies} repoId={repoDetails.id} repoName={repoDetails.name} />}
            {activeNavTab === 'chat' && <ChatInterface repoId={repoDetails.id} />}
            {activeNavTab === 'architecture' && <Architecture fileDetails={fileDetails} loadingFile={loadingFile} onSelectFile={selectFile} files={repoDetails.files} setActiveNavTab={setActiveNavTab} />}
            {activeNavTab === 'dependencies' && <Dependencies repoId={repoDetails.id} />}
            {activeNavTab === 'files' && <FilesView files={repoDetails.files} selectedFileId={selectedFileId} fileDetails={fileDetails} loadingFile={loadingFile} onSelectFile={selectFile} onRetryFile={() => selectedRepoId && selectedFileId && fetchFileDetails(selectedRepoId, selectedFileId)} />}
          </section>
        </div>
      </main>
    </div>
  );
}
