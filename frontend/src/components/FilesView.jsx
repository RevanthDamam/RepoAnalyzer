import React, { useState, useMemo } from 'react';
import { FileTree } from './FileTree';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

// ----- Syntax Highlighting Code Viewer Component -----
// Theme and style matches the user's reference dark editor card
const CodeHighlight = ({ code, extension }) => {
  // Determine language label
  let langLabel = 'Code';
  const ext = extension ? extension.toLowerCase() : '';
  if (['.js', '.jsx'].includes(ext)) langLabel = 'JavaScript';
  else if (['.ts', '.tsx'].includes(ext)) langLabel = 'TypeScript';
  else if (ext === '.py') langLabel = 'Python';
  else if (ext === '.json') langLabel = 'JSON';
  else if (ext === '.html') langLabel = 'HTML';
  else if (ext === '.css') langLabel = 'CSS';
  else if (ext === '.java') langLabel = 'Java';

  // Basic regex highlighting to give exact colors from reference screenshot
  const highlightCode = (rawCode) => {
    if (!rawCode) return '// Empty file';
    
    // Escape HTML tags to prevent XSS
    let escaped = rawCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlighting rules (matching screenshot colors)
    // Keywords: const, let, var, import, from, return, export, default, function, class, public, private, static, void, int, for, new, if, else
    const keywords = /\b(const|let|var|import|from|return|export|default|function|class|public|private|static|void|int|for|new|if|else|while|do|break|continue|try|catch|finally|async|await|package)\b/g;
    
    // Numbers
    const numbers = /\b(\d+)\b/g;
    
    // Strings
    const strings = /(["'`])(.*?)\1/g;
    
    // Comments
    const comments = /(\/\/.*|\/\*[\s\S]*?\*\/)/g;

    let html = escaped;

    // Highlight comments (greenish/muted blue)
    html = html.replace(comments, '<span style="color: #6272a4; font-style: italic;">$1</span>');

    // Highlight strings (yellowish-green)
    html = html.replace(strings, '<span style="color: #facc15;">$1$2$1</span>');

    // Highlight keywords (pinkish/purple)
    html = html.replace(keywords, '<span style="color: #f472b6; font-weight: bold;">$1</span>');

    // Highlight numbers (orange/purple)
    html = html.replace(numbers, '<span style="color: #fb923c;">$1</span>');

    return html;
  };

  const highlightedHtml = useMemo(() => highlightCode(code), [code]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#18181c',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '12px',
      overflow: 'hidden',
      height: '100%',
      minHeight: 0,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
    }}>
      {/* Code Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.25rem',
        background: '#141416',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        color: '#ffffff',
        fontSize: '0.85rem',
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 600,
        flexShrink: 0
      }}>
        <span style={{ color: '#f472b6', fontWeight: 'bold' }}>&lt;/&gt;</span>
        <span>{langLabel}</span>
      </div>

      {/* Code Area */}
      <pre style={{
        margin: 0,
        padding: '1.25rem',
        overflow: 'auto',
        flex: 1,
        fontSize: '0.82rem',
        lineHeight: '1.5',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#f8f8f2',
        background: '#18181c',
        textAlign: 'left'
      }}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
};

export const FilesView = ({ 
  files, 
  selectedFileId, 
  fileDetails, 
  loadingFile, 
  onSelectFile 
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: 0, width: '100%' }}>
      {/* 1. Left code folders tree (explorer) with slide minimize/maximize transition */}
      <div 
        style={{ 
          width: isSidebarCollapsed ? '0px' : '280px', 
          height: '100%', 
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 10, 15, 0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: 'none',
          borderRadius: '12px',
          boxShadow: isSidebarCollapsed ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 10px rgba(250, 204, 21, 0.05)',
          padding: isSidebarCollapsed ? '0' : '1rem 0.5rem',
          boxSizing: 'border-box'
        }}
      >
        {/* Collapse/Expand Floating Button */}
        <div 
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            left: isSidebarCollapsed ? '10px' : 'auto',
            right: isSidebarCollapsed ? 'auto' : '-12px'
          }}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </div>

        {/* Render FileTree only if not collapsed (keep mounted but hidden for transitions) */}
        <div style={{ flex: 1, minHeight: 0, opacity: isSidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s', overflow: 'hidden' }}>
          <FileTree 
            files={files} 
            selectedFileId={selectedFileId} 
            onSelectFile={onSelectFile} 
          />
        </div>
      </div>

      {/* 2. Right Pane: File Code Viewer Card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, paddingRight: '1rem' }}>
        {loadingFile || !fileDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', minHeight: '200px' }}>
            <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Select a file from the explorer on the left to view its source code...</p>
          </div>
        ) : (
          <div style={{ flex: 1, height: '100%', minHeight: 0, paddingBottom: '1rem' }}>
            <CodeHighlight 
              code={fileDetails.raw_content || fileDetails.raw_content_compressed || '// Empty file'} 
              extension={fileDetails.extension || ('.' + fileDetails.filename.split('.').pop())} 
            />
          </div>
        )}
      </div>
    </div>
  );
};
