import { useState } from 'react';
import { RepoSelector } from './components/RepoSelector';
import { Dashboard } from './components/Dashboard';
import { FileTree } from './components/FileTree';
import { ChatInterface } from './components/ChatInterface';
import { Architecture } from './components/Architecture';
import { Dependencies } from './components/Dependencies';
import { FilesView } from './components/FilesView';
import { apiFetch } from './utils/api';


import {
  Bot, Code, RefreshCw,
  LayoutGrid, Network, GitFork, BookOpen, Settings, ChevronLeft, ChevronRight, Folder
} from 'lucide-react';

export default function App() {
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [repoDetails, setRepoDetails] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);

  // Navigation tabs for the MAIN central area via vertical sidebar
  const [activeNavTab, setActiveNavTab] = useState('overview');

  // Workspace tabs for the RIGHT code/chat panel
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('chat');
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  const fetchRepoDetails = async (repoId) => {
    setLoadingRepo(true);
    try {
      const res = await apiFetch(`/api/repositories/${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setRepoDetails(data);

        // Default select file with highest importance
        if (data.files && data.files.length > 0) {
          setSelectedFileId(data.files[0].id);
          fetchFileDetails(repoId, data.files[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load repo data', e);
    } finally {
      setLoadingRepo(false);
    }
  };

  const fetchFileDetails = async (repoId, fileId) => {
    setLoadingFile(true);
    try {
      const res = await apiFetch(`/api/repositories/${repoId}/file/${fileId}`);
      if (res.ok) {
        const data = await res.json();
        setFileDetails(data);
      }
    } catch (e) {
      console.error('Failed to load file details', e);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSelectRepo = (repoId) => {
    setSelectedRepoId(repoId);
    fetchRepoDetails(repoId);
    setActiveNavTab('overview');
    setActiveWorkspaceTab('chat');
  };

  const handleSelectFile = (fileId) => {
    setSelectedFileId(fileId);
    if (selectedRepoId) {
      fetchFileDetails(selectedRepoId, fileId);
    }
    setActiveWorkspaceTab('file');
  };

  const handleSelectFileByPath = (path) => {
    if (repoDetails) {
      const matched = repoDetails.files.find(f => f.path === path);
      if (matched) {
        handleSelectFile(matched.id);
      }
    }
  };

  const handleBackToSelector = () => {
    setSelectedRepoId(null);
    setRepoDetails(null);
    setSelectedFileId(null);
    setFileDetails(null);
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Global Cinematic Header */}
      {selectedRepoId === null && (
        <header style={{ height: '72px', flexShrink: 0, padding: '0 2.5rem', background: '#08080c', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={handleBackToSelector}>
            <span style={{ fontWeight: 800, fontSize: '1.4rem', fontFamily: 'Outfit, sans-serif', color: '#ffffff', letterSpacing: '-0.5px' }}>
              Repo<span style={{ color: 'var(--accent-primary)' }}>Analyzer</span>
            </span>
          </div>

          {/* Mockup Middle Nav Links */}
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-primary)', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.25rem' }}>SYSTEM</span>
            <span style={{ cursor: 'pointer' }} onClick={() => window.open('https://github', '_blank')}>GITHUB</span>
            <span style={{ cursor: 'pointer' }}>DOCS</span>
            <span style={{ cursor: 'pointer' }}>ABOUT</span>
          </div>

          {/* Right Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>SIGN IN</span>
            <button style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#000',
              padding: '0.5rem 1.25rem',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow)',
              fontFamily: 'Outfit, sans-serif'
            }}>
              GET STARTED
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace Frame */}
      {selectedRepoId === null ? (
        // Project selector dashboard (Centered view)
        <div style={{ flex: 1, overflowY: 'auto', padding: '4rem 2rem', background: '#060608' }}>
          <RepoSelector onSelectRepo={handleSelectRepo} />
        </div>
      ) : loadingRepo || !repoDetails ? (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060608', gap: '1rem' }}>
          <RefreshCw className="animate-spin" size={36} style={{ color: 'var(--accent-primary)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Compiling static AST dependency indexes...</p>
        </div>
      ) : (
        // Upgraded workspace layout with horizontal top navigation header
        <div className="workspace-container">

          {/* Top Horizontal workspace header */}
          <header className="workspace-header">
            <div className="workspace-logo-area" onClick={handleBackToSelector} style={{ border: 'none', background: 'none' }}>
              <div className="workspace-back-btn" title="Back to project list">
                <ChevronLeft size={16} />
              </div>
            </div>

            {/* Horizontal navigation tabs with active line indicator animation */}
            <div className="workspace-tabs">
              <div
                className={`workspace-tab ${activeNavTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveNavTab('overview')}
              >
                <LayoutGrid size={16} />
                <span>Overview</span>
              </div>

              <div
                className={`workspace-tab ${activeNavTab === 'architecture' ? 'active' : ''}`}
                onClick={() => setActiveNavTab('architecture')}
              >
                <Network size={16} />
                <span>Architecture</span>
              </div>

              <div
                className={`workspace-tab ${activeNavTab === 'dependencies' ? 'active' : ''}`}
                onClick={() => setActiveNavTab('dependencies')}
              >
                <GitFork size={16} />
                <span>Dependencies</span>
              </div>

              <div
                className={`workspace-tab ${activeNavTab === 'files' ? 'active' : ''}`}
                onClick={() => setActiveNavTab('files')}
              >
                <Folder size={16} />
                <span>Files</span>
              </div>

              <div
                className={`workspace-tab ${activeNavTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveNavTab('chat')}
              >
                <Bot size={16} />
                <span>AI Chat</span>
              </div>
            </div>

            <div className="workspace-header-right" />
          </header>

          {/* Main workspace layout: Tab Content (Full Width) */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>

            {/* 2. Middle Content Pane (Tab Content) */}
            <div className="workspace-content" style={activeNavTab === 'architecture' ? { padding: '2rem', overflow: 'hidden', gap: 0 } : {}}>

              {/* Headline Banner based on active Nav Tab */}
              {activeNavTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span className="repo-tag" style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.05)', fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>Excellent structural integrity confirmed</span>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#ffffff', lineHeight: 1.1 }}>Deconstruct the <span className="text-gradient">codebase pulse.</span></h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: 0 }}>Static fact extraction, cyclomatic branch analysis, and intent-based RAG search engines mapped instantly.</p>
                </div>
              )}
              {activeNavTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span className="repo-tag" style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.05)', fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>AI RAG Assistant</span>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#ffffff', lineHeight: 1.1 }}>Ask the <span className="text-gradient">repository agent.</span></h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: 0 }}>Query semantic code details, index hierarchies, and get instant explanations.</p>
                </div>
              )}
              {activeNavTab === 'architecture' && null}
              {activeNavTab === 'dependencies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span className="repo-tag" style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.05)', fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>Interactive Dependency Graph</span>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#ffffff', lineHeight: 1.1 }}>Visualize the <span className="text-gradient" style={{ fontStyle: 'italic' }}>inner pulse.</span></h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: 0 }}>Trace directed file imports. Understand which components depend on each other and perform risk assessments.</p>
                </div>
              )}
              {activeNavTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span className="repo-tag" style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.05)', fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>EXPLORER & FILE FACT SHEET</span>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#ffffff', lineHeight: 1.1 }}>Browse project <span className="text-gradient">files.</span></h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: 0 }}>Navigate the directory tree and analyze static file details, complexity, and source code side-by-side.</p>
                </div>
              )}

              {/* Mount active navigation subcomponent */}
              <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
                {activeNavTab === 'overview' && (
                  <Dashboard
                    stats={repoDetails.statistics}
                    technologies={repoDetails.technologies}
                    repoId={repoDetails.id}
                    repoName={repoDetails.name}
                  />
                )}
                {activeNavTab === 'chat' && (
                  <ChatInterface repoId={repoDetails.id} />
                )}
                {activeNavTab === 'architecture' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Architecture
                      repoId={repoDetails.id}
                      selectedFileId={selectedFileId}
                      fileDetails={fileDetails}
                      loadingFile={loadingFile}
                      onSelectFile={handleSelectFile}
                      files={repoDetails.files}
                      setActiveNavTab={setActiveNavTab}
                    />
                  </div>
                )}
                {activeNavTab === 'dependencies' && (
                  <Dependencies repoId={repoDetails.id} />
                )}
                {activeNavTab === 'files' && (
                  <FilesView
                    files={repoDetails.files}
                    selectedFileId={selectedFileId}
                    fileDetails={fileDetails}
                    loadingFile={loadingFile}
                    onSelectFile={handleSelectFile}
                  />
                )}
              </div>

            </div>

            {/* Right Pane removed from global workspace to only render inside Architecture Tab */}


          </div>

        </div>
      )}
    </div>
  );
}

// Simple spin animation style injector helper
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);
