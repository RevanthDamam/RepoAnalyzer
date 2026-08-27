import { useMemo, useState } from 'react';
import { FileTree } from './FileTree';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const TOKEN_PATTERN = /(\/\/.*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|import|from|return|export|default|function|class|public|private|static|void|int|for|new|if|else|while|do|break|continue|try|catch|finally|async|await|package)\b|\b\d+(?:\.\d+)?\b)/g;

const tokenClass = (token) => {
  if (/^(\/\/|\/\*)/.test(token)) return 'code-token-comment';
  if (/^["'`]/.test(token)) return 'code-token-string';
  if (/^\d/.test(token)) return 'code-token-number';
  return 'code-token-keyword';
};

const CodeHighlight = ({ code, extension }) => {
  const langLabel = useMemo(() => {
    const ext = extension ? extension.toLowerCase() : '';
    if (['.js', '.jsx'].includes(ext)) return 'JavaScript';
    if (['.ts', '.tsx'].includes(ext)) return 'TypeScript';
    if (ext === '.py') return 'Python';
    if (ext === '.json') return 'JSON';
    if (ext === '.html') return 'HTML';
    if (ext === '.css') return 'CSS';
    if (ext === '.java') return 'Java';
    return 'Code';
  }, [extension]);

  const lines = useMemo(() => {
    const source = code || '// Empty file';
    return source.split('\n').map((line) => {
      const parts = [];
      let cursor = 0;
      for (const match of line.matchAll(TOKEN_PATTERN)) {
        const token = match[0];
        const start = match.index ?? 0;
        if (start > cursor) parts.push(line.slice(cursor, start));
        parts.push(<span key={`${start}-${token}`} className={tokenClass(token)}>{token}</span>);
        cursor = start + token.length;
      }
      if (cursor < line.length) parts.push(line.slice(cursor));
      return parts.length ? parts : [' '];
    });
  }, [code]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', background: '#18181c',
      border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
      overflow: 'hidden', height: '100%', minHeight: 0,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem',
        background: '#141416', borderBottom: '1px solid rgba(255,255,255,0.03)',
        color: '#ffffff', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif',
        fontWeight: 600, flexShrink: 0
      }}>
        <span style={{ color: '#f472b6', fontWeight: 'bold' }}>&lt;/&gt;</span>
        <span>{langLabel}</span>
      </div>
      <pre style={{
        margin: 0, padding: '1.25rem', overflow: 'auto', flex: 1,
        fontSize: '0.82rem', lineHeight: '1.5', fontFamily: 'JetBrains Mono, monospace',
        color: '#f8f8f2', background: '#18181c', textAlign: 'left'
      }}>
        <code>{lines.map((line, index) => (
          <span key={index} style={{ display: 'block' }}>
            <span style={{ display: 'inline-block', width: '3rem', marginRight: '1rem', color: 'rgba(148,163,184,0.34)', userSelect: 'none', textAlign: 'right' }}>{index + 1}</span>
            {line}
          </span>
        ))}</code>
      </pre>
    </div>
  );
};

export const FilesView = ({ files, selectedFileId, fileDetails, loadingFile, onSelectFile, onRetryFile }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const sourceText = fileDetails?.raw_content || fileDetails?.raw_content_compressed || '';
  const sourceUnavailable = sourceText === 'Unable to read this file.';

  return (
    <div className="files-workspace" style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: 0, width: '100%' }}>
      <div style={{
        width: isSidebarCollapsed ? '0px' : '280px', height: '100%', flexShrink: 0,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
        display: 'flex', flexDirection: 'column', background: 'rgba(10, 10, 15, 0.55)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'none',
        borderRadius: '12px', boxShadow: isSidebarCollapsed ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(250, 204, 21, 0.05)',
        padding: isSidebarCollapsed ? '0' : '1rem 0.5rem', boxSizing: 'border-box'
      }}>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isSidebarCollapsed ? 'Expand file explorer' : 'Collapse file explorer'}
          style={{ left: isSidebarCollapsed ? '10px' : 'auto', right: isSidebarCollapsed ? 'auto' : '-12px' }}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div style={{ flex: 1, minHeight: 0, opacity: isSidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s', overflow: 'hidden' }}>
          <FileTree files={files} selectedFileId={selectedFileId} onSelectFile={onSelectFile} />
        </div>
      </div>

      <div className="source-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, paddingRight: '1rem' }}>
        {loadingFile || !fileDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', minHeight: '200px' }}>
            <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Select a file from the explorer on the left to view its source code...</p>
          </div>
        ) : sourceUnavailable ? (
          <div className="source-empty-state"><div className="source-empty-icon">!</div><strong>Source temporarily unavailable</strong><p>The indexed metadata is still available, but the repository source directory is not reachable. Restore the approved source and try again.</p>{onRetryFile && <button type="button" className="source-retry-button" onClick={onRetryFile}>Try loading source again</button>}</div>
        ) : (
          <div style={{ flex: 1, height: '100%', minHeight: 0, paddingBottom: '1rem' }}>
            <CodeHighlight code={sourceText || '// Empty file'} extension={fileDetails.extension || `.${fileDetails.filename.split('.').pop()}`} />
          </div>
        )}
      </div>
    </div>
  );
};
