import React, { useState } from 'react';
import { 
  ChevronRight, ChevronDown, Folder, FolderOpen, 
  FileCode, FileJson, FileText, File, Search
} from 'lucide-react';

// Helper to build tree structure from flat files list
const buildTree = (files) => {
  const root = { name: 'root', isFolder: true, children: {} };

  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isFolder: !isLast,
          children: {}
        };
      }
      if (isLast) {
        current.children[part].fileId = file.id;
        current.children[part].extension = file.extension || ('.' + part.split('.').pop());
      }
      current = current.children[part];
    });
  });

  return root;
};

// Recursive Node Component
const TreeNode = ({ node, depth, selectedFileId, onSelectFile, expandedFolders, onToggleFolder }) => {
  const isExpanded = expandedFolders[node.path];

  const getFileIcon = (ext) => {
    const e = ext ? ext.toLowerCase() : '';
    if (['.json', '.lock'].includes(e)) return <FileJson size={16} style={{ color: 'rgba(250, 204, 21, 0.7)' }} />;
    if (['.md', '.txt', '.rst', '.yml', '.yaml'].includes(e)) return <FileText size={16} style={{ color: 'var(--text-secondary)' }} />;
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.html', '.css', '.sh', '.ps1'].includes(e)) {
      return <FileCode size={16} style={{ color: 'var(--accent-primary)' }} />;
    }
    return <File size={16} style={{ color: 'var(--text-secondary)' }} />;
  };

  const handleRowClick = () => {
    if (node.isFolder) {
      onToggleFolder(node.path);
    } else {
      onSelectFile(node.fileId);
    }
  };

  // Sort children: folders first, then files alphabetically
  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Node row */}
      {node.name !== 'root' && (
        <div 
          className={`file-tree-row ${!node.isFolder && selectedFileId === node.fileId ? 'selected' : ''}`}
          onClick={handleRowClick}
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {node.isFolder ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span style={{ color: 'rgba(250,204,21,0.65)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
              </span>
            </>
          ) : (
            <>
              {/* Indent spacer for files if they have no expand chevron */}
              <span className="file-tree-indent" />
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {getFileIcon(node.extension)}
              </span>
            </>
          )}
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        </div>
      )}

      {/* Children rendering */}
      {node.isFolder && (node.name === 'root' || isExpanded) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sortedChildren.map((child, idx) => (
            <TreeNode 
              key={idx}
              node={child}
              depth={node.name === 'root' ? 0 : depth + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ files, selectedFileId, onSelectFile }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({
    // Expand root items by default
  });

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Filter files by search query
  const filteredFiles = files.filter(f => 
    f.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build tree model from filtered list
  const treeModel = buildTree(filteredFiles);

  // Proactively auto-expand folders if search query exists
  React.useEffect(() => {
    if (searchQuery.trim() !== '') {
      const newExpanded = {};
      filteredFiles.forEach(file => {
        const parts = file.path.split('/');
        // Expand all parent folders
        for (let i = 1; i < parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          newExpanded[parentPath] = true;
        }
      });
      setExpandedFolders(newExpanded);
    }
  }, [searchQuery, files]);

  return (
    <div className="glass explorer-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: 'none' }}>
      {/* Header Search */}
      <div className="explorer-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem 1rem 0.5rem 1rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.5rem 0.4rem 2rem',
              fontSize: '0.82rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(250, 204, 21, 0.28)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all var(--transition-fast)'
            }}
            onFocus={e => {
              e.target.style.borderColor = 'rgba(250,204,21,0.6)';
              e.target.style.boxShadow = '0 0 8px rgba(250,204,21,0.1)';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'rgba(250,204,21,0.28)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Hierarchical Files List */}
      <div className="file-list-container" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.8rem' }}>
            No matching files found.
          </div>
        ) : (
          <TreeNode 
            node={treeModel} 
            depth={0} 
            selectedFileId={selectedFileId} 
            onSelectFile={onSelectFile}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
          />
        )}
      </div>
    </div>
  );
};
