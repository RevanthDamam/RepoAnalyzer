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
    const labels = {
      '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
      '.py': 'Python', '.json': 'JSON', '.html': 'HTML', '.css': 'CSS', '.java': 'Java'
    };
    return labels[ext] || 'Code';
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
    <div className="code-viewer glass-depth">
      <div className="code-viewer-header">
        <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
        <span className="code-language">{langLabel}</span>
        <span className="code-live-indicator">LIVE SOURCE</span>
      </div>
      <pre className="code-scroll-area">
        <code>{lines.map((line, index) => (
          <span className="code-line" key={index}>
            <span className="line-number">{String(index + 1).padStart(3, '0')}</span>
            <span className="line-content">{line}</span>
          </span>
        ))}</code>
      </pre>
    </div>
  );
};

export const FilesView = ({ files, selectedFileId, fileDetails, loadingFile, onSelectFile }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="files-workspace">
      <div className={`file-sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isSidebarCollapsed ? 'Expand file explorer' : 'Collapse file explorer'}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className="file-tree-frame">
          <FileTree files={files} selectedFileId={selectedFileId} onSelectFile={onSelectFile} />
        </div>
      </div>

      <div className="file-code-pane">
        {loadingFile || !fileDetails ? (
          <div className="empty-code-state">
            <RefreshCw className="animate-spin" size={24} />
            <p>Select a file from the explorer to inspect its source code.</p>
          </div>
        ) : (
          <CodeHighlight
            code={fileDetails.raw_content || fileDetails.raw_content_compressed || '// Empty file'}
            extension={fileDetails.extension || `.${fileDetails.filename.split('.').pop()}`}
          />
        )}
      </div>
    </div>
  );
};
