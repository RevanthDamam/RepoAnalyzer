import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  Server, Layout, Settings, 
  Layers, Cpu, FolderKanban, 
  Boxes, Code2, Paintbrush, FileJson, 
  Terminal, Info, ZoomIn, ZoomOut, Maximize2,
  X, Folder, FolderOpen, FileCode, FileText, File, RefreshCw, Code
} from 'lucide-react';
import { getBriefExplanation } from '../utils/fileExplanation';

// ----- Semantic Folder Icons Helper -----
const getFolderIcon = (path) => {
  const p = path.toLowerCase();
  if (p.includes('backend') || p.includes('app') || p.includes('server') || p.includes('api')) {
    return <Server size={18} style={{ color: '#facc15' }} />;
  }
  if (p.includes('frontend') || p.includes('src') || p.includes('web') || p.includes('client') || p.includes('components')) {
    return <Layout size={18} style={{ color: '#facc15' }} />;
  }
  if (p.includes('service') || p.includes('util') || p.includes('helper') || p.includes('lib') || p.includes('comput')) {
    return <Cpu size={18} style={{ color: '#facc15' }} />;
  }
  if (p.includes('config') || p.includes('set') || p.includes('deploy') || p.includes('build') || p.includes('docker')) {
    return <Settings size={18} style={{ color: '#facc15' }} />;
  }
  return <Folder size={18} style={{ color: '#facc15' }} />;
};

// ----- File Extension Icons Helper -----
const getFileIcon = (ext) => {
  const e = ext ? ext.toLowerCase() : '';
  if (['.json', '.lock', '.toml'].includes(e)) return <FileJson size={14} style={{ color: 'rgba(250, 204, 21, 0.7)' }} />;
  if (['.md', '.txt', '.rst', '.yml', '.yaml'].includes(e)) return <FileText size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />;
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.html', '.css', '.sh', '.ps1'].includes(e)) {
    return <FileCode size={14} style={{ color: '#facc15' }} />;
  }
  return <File size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />;
};

const getFolderExplanation = (folderPath, filesCount, totalLoc) => {
  const p = folderPath.toLowerCase();
  let baseDesc = '';
  if (p === 'configs' || p === 'configs') {
    baseDesc = 'Contains project configurations, environment rules, and dependency manifests.';
  } else if (p.includes('components')) {
    baseDesc = 'Houses reusable UI components, action dialogs, and layout elements.';
  } else if (p.includes('routes') || p.includes('api')) {
    baseDesc = 'Defines API endpoints, controllers, and routing registries.';
  } else if (p.includes('services') || p.includes('utils')) {
    baseDesc = 'Houses helper services, heavy compute algorithms, and backend workers.';
  } else if (p.includes('src')) {
    baseDesc = 'Primary frontend folder containing all asset styles and source components.';
  } else if (p.includes('public')) {
    baseDesc = 'Hosts static assets, public templates, and favicon packages.';
  } else {
    baseDesc = `Workspace subdirectory grouping ${filesCount} code modules.`;
  }
  return `${baseDesc} Total lines of code in this folder: ${totalLoc}.`;
};


// ----- Dynamic Hierarchy Layout Calculator -----
// Follows all 10 rules:
// - Roots is top node. Folders are rounded rectangles.
// - Folders with only files get one combined list box.
// - Folders with both get child folder nodes and a separate grouped Files box.
const computeTreeLayout = (files, repoName) => {
  if (!files || files.length === 0) {
    return { nodes: [], links: [], svgW: 1000, svgH: 500 };
  }

  // 1. Build directory tree structure
  const root = { name: repoName, path: '', isFolder: true, files: [], subfolders: {} };
  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      if (isFile) {
        current.files.push(file);
      } else {
        if (!current.subfolders[part]) {
          current.subfolders[part] = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            isFolder: true,
            files: [],
            subfolders: {}
          };
        }
        current = current.subfolders[part];
      }
    });
  });

  const nodes = [];
  const links = [];

  // 2. Generate tree nodes (folders and grouped files)
  const generateNodes = (treeNode, parentNode = null) => {
    const nodeId = treeNode.path ? `folder_${treeNode.path.replace(/\//g, '_')}` : 'root';
    
    const totalLoc = treeNode.files.reduce((sum, f) => sum + (f.lines_of_code || 0), 0);
    const folderNode = {
      id: nodeId,
      label: treeNode.name,
      path: treeNode.path,
      type: 'folder',
      children: [],
      files: treeNode.files,
      desc: treeNode.path 
        ? getFolderExplanation(treeNode.path, treeNode.files.length, totalLoc) 
        : `Root directory of ${repoName} workspace.`
    };
    nodes.push(folderNode);

    if (parentNode) {
      links.push({ from: parentNode.id, to: folderNode.id });
      parentNode.children.push(folderNode);
    }

    const subfolders = Object.values(treeNode.subfolders);
    subfolders.sort((a, b) => a.name.localeCompare(b.name));
    
    // Traverse subfolders
    subfolders.forEach(sub => {
      generateNodes(sub, folderNode);
    });

    // If there are files inside this folder, create ONE grouped files box node under it
    if (treeNode.files && treeNode.files.length > 0) {
      const filesNodeId = `files_${nodeId}`;
      const filesNode = {
        id: filesNodeId,
        label: 'Files',
        parentId: nodeId,
        type: 'files_box',
        files: treeNode.files,
        desc: `Files in folder "${treeNode.path || 'root'}"`
      };
      nodes.push(filesNode);
      links.push({ from: folderNode.id, to: filesNodeId });
      folderNode.children.push(filesNode);
    }
  };

  generateNodes(root);

  // 3. Post-order traversal to compute subtree widths
  const computeSubtreeWidth = (node) => {
    if (!node.children || node.children.length === 0) {
      node.width = 200;
      return node.width;
    }
    let totalWidth = 0;
    node.children.forEach(child => {
      totalWidth += computeSubtreeWidth(child);
    });
    node.width = Math.max(220, totalWidth);
    return node.width;
  };

  const rootFolderNode = nodes.find(n => n.id === 'root');
  if (rootFolderNode) {
    computeSubtreeWidth(rootFolderNode);
  }

  // 4. Pre-order traversal to assign coordinate positions (x, y)
  const svgW = rootFolderNode ? Math.max(1100, rootFolderNode.width + 120) : 1100;
  const svgH = 650;

  const positionNodes = (node, startX, depth) => {
    node.y = 80 + depth * 145;
    
    if (!node.children || node.children.length === 0) {
      node.x = startX + 100;
    } else {
      let currentX = startX;
      node.children.forEach(child => {
        positionNodes(child, currentX, depth + 1);
        currentX += child.width;
      });
      // Center parent over its children
      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      node.x = (firstChild.x + lastChild.x) / 2;
    }
  };

  if (rootFolderNode) {
    positionNodes(rootFolderNode, (svgW - rootFolderNode.width) / 2, 0);
  }

  return { nodes, links, svgW, svgH };
};

export const Architecture = ({ 
  repoId, 
  selectedFileId, 
  fileDetails, 
  loadingFile, 
  onSelectFile, 
  files,
  setActiveNavTab 
}) => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [transform, setTransform] = useState({ x: 50, y: 40, scale: 0.85 });

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const didPan = useRef(false);
  const canvasRef = useRef(null);
  const prevSelectedRef = useRef(null);

  // ── Retrieve repository name dynamically ──
  const repoName = useMemo(() => {
    return files && files[0] ? files[0].path.split('/')[0] : 'PdfSplitter';
  }, [files]);

  // ── Compute Tree Layout dynamically based on exact directory tree rules ──
  const { nodes, links, svgW, svgH } = useMemo(() => {
    return computeTreeLayout(files, repoName);
  }, [files, repoName]);

  const bezier = (x1, y1, x2, y2) => {
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  };

  // ── Fit & Center View ──
  const resetView = useCallback(() => {
    if (canvasRef.current) {
      const containerWidth = canvasRef.current.offsetWidth;
      const scale = Math.min(0.85, (containerWidth - 60) / svgW);
      setTransform({
        x: (containerWidth - svgW * scale) / 2,
        y: 40,
        scale
      });
    } else {
      setTransform({ x: 50, y: 40, scale: 0.8 });
    }
  }, [svgW]);

  // Center view on load
  useEffect(() => {
    resetView();
  }, [files, resetView]);

  // Shift view when sidebar opens/closes
  useEffect(() => {
    if (selectedNode && !prevSelectedRef.current) {
      setTransform(p => ({ ...p, x: p.x - 120 }));
    } else if (!selectedNode && prevSelectedRef.current) {
      setTransform(p => ({ ...p, x: p.x + 120 }));
    }
    prevSelectedRef.current = selectedNode;
  }, [selectedNode]);

  // ── Drag to Pan Handlers ──
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const onNode = e.target.closest('[data-node]');
    if (onNode) return;
    isPanning.current = true;
    didPan.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) didPan.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // ── Wheel to Zoom ──
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.08 : -0.08;
    setTransform(p => ({ ...p, scale: Math.max(0.3, Math.min(2.2, p.scale + step)) }));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ── Node Click Handlers ──
  const handleNodeClick = (node, e) => {
    e.stopPropagation();
    if (didPan.current) return;
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  const activeNode = selectedNode || hoveredNode;

  if (!files || files.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', background: '#111118' }}>
        <RefreshCw className="animate-spin" size={24} style={{ color: '#facc15' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Loading workspace architecture...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* ── Left Map Canvas Container ── */}
      <div style={{ 
        flex: 1, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        minWidth: 0,
        gap: '1rem',
        boxSizing: 'border-box'
      }}>
        {/* Heading */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 800,
            fontFamily: 'Outfit, sans-serif',
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-0.5px'
          }}>
            Architecture <span style={{ color: '#facc15', textShadow: '0 0 12px rgba(250,204,21,0.45)' }}>Map</span>
          </h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
            Drag to pan · Scroll to zoom · Click folders/files to inspect
          </p>
        </div>

        {/* Dynamic Tooltip Chip inside Canvas */}
        {activeNode && !selectedNode && (
          <div style={{
            position: 'absolute', top: '4.5rem', left: '50%', transform: 'translateX(-50%)',
            zIndex: 30, pointerEvents: 'none',
            padding: '0.45rem 1rem', borderRadius: '20px',
            background: 'rgba(14,14,20,0.92)', backdropFilter: 'blur(10px)',
            border: '1.5px solid rgba(250,204,21,0.35)',
            fontSize: '0.78rem', color: '#fff', whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            <strong style={{ color: '#facc15' }}>{activeNode.label}:</strong> {activeNode.desc}
          </div>
        )}

        {/* Infinite Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            cursor: isPanning.current ? 'grabbing' : 'grab',
            backgroundColor: '#111118',
            backgroundImage: `radial-gradient(circle, rgba(250,204,21,0.18) 1px, transparent 1px)`,
            backgroundSize: `${28 * transform.scale}px ${28 * transform.scale}px`,
            backgroundPosition: `${transform.x % (28 * transform.scale)}px ${transform.y % (28 * transform.scale)}px`,
            border: '1.5px solid rgba(250, 204, 21, 0.45)',
            borderRadius: '12px',
            boxShadow: '0 0 14px rgba(250, 204, 21, 0.22), 0 0 32px rgba(250, 204, 21, 0.06), inset 0 0 16px rgba(250, 204, 21, 0.03)',
            margin: '0.5rem 0.5rem 1rem 0.5rem',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={() => { if (!didPan.current) setSelectedNode(null); }}
        >
          {/* Transformable world layer */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: `${svgW}px`, height: `${svgH}px`,
            willChange: 'transform',
          }}>

            {/* SVG connections */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: `${svgW}px`, height: `${svgH}px`, overflow: 'visible', pointerEvents: 'none' }}>
              {links.map((link, idx) => {
                const fromNode = nodes.find(n => n.id === link.from);
                const toNode = nodes.find(n => n.id === link.to);
                if (!fromNode || !toNode) return null;

                const fromX = fromNode.x;
                const fromY = fromNode.y + (fromNode.type === 'folder' ? 22 : 25);
                const toX = toNode.x;
                const toY = toNode.y - (toNode.type === 'folder' ? 22 : 0);

                const hi = hoveredNode?.id === fromNode.id || hoveredNode?.id === toNode.id;
                const sel = selectedNode?.id === fromNode.id || selectedNode?.id === toNode.id;

                return <path key={idx} d={bezier(fromX, fromY, toX, toY)}
                  stroke={sel || hi ? '#facc15' : 'rgba(250,204,21,0.22)'} strokeWidth={sel || hi ? 1.8 : 1}
                  fill="none" style={{ transition: 'stroke 0.2s' }} />;
              })}
            </svg>

            {/* ── Render Map Nodes ── */}
            {nodes.map(node => {
              const isFolder = node.type === 'folder';
              const sel = selectedNode?.id === node.id;
              const hi = hoveredNode?.id === node.id;

              if (isFolder) {
                return (
                  <div 
                    key={node.id} 
                    data-node={node.id} 
                    style={{
                      position: 'absolute', left: node.x, top: node.y,
                      transform: 'translate(-50%, -50%)',
                      minWidth: '158px', height: '44px',
                      borderRadius: '7px',
                      border: `1.5px solid ${sel || hi ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
                      background: '#0f0f1a',
                      boxShadow: sel || hi ? '0 0 16px rgba(250,204,21,0.18)' : '0 2px 8px rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem',
                      cursor: 'pointer', userSelect: 'none', zIndex: 10,
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={e => handleNodeClick(node, e)}
                  >
                    {getFolderIcon(node.label)}
                    <span style={{ 
                      fontSize: '0.74rem', 
                      fontWeight: 700, 
                      color: sel || hi ? '#fff' : 'rgba(255,255,255,0.6)', 
                      lineHeight: 1.2, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {node.label}
                    </span>
                  </div>
                );
              } else {
                // Grouped Files box
                return (
                  <div 
                    key={node.id}
                    data-node={node.id}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={e => handleNodeClick(node, e)}
                    style={{
                      position: 'absolute', left: node.x, top: node.y,
                      transform: 'translate(-50%, 0)',
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#0d0d14',
                      border: sel || hi ? '1.5px solid #facc15' : '1.25px dashed rgba(250, 204, 21, 0.65)',
                      borderRadius: '5px',
                      padding: '0.5rem 0.75rem',
                      width: '180px',
                      boxSizing: 'border-box',
                      color: '#a0a0b0',
                      fontSize: '0.72rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      textAlign: 'left',
                      zIndex: 5,
                      boxShadow: sel || hi ? '0 0 16px rgba(250, 204, 21, 0.22)' : '0 4px 10px rgba(0,0,0,0.5)',
                      cursor: 'pointer',
                      transition: 'border 0.2s, box-shadow 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '0.62rem', color: 'rgba(250,204,21,0.8)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem', borderBottom: '1px solid rgba(250,204,21,0.15)', paddingBottom: '0.15rem' }}>
                      Files ({node.files.length})
                    </div>
                    {node.files.map((file, idx) => {
                      const ext = file.extension || ('.' + file.filename.split('.').pop());
                      return (
                        <div 
                          key={idx} 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFile(file.id);
                            setSelectedNode({
                              id: `file_${file.id}`,
                              fileId: file.id,
                              label: file.filename,
                              path: file.path,
                              type: 'leaf',
                              desc: `File: ${file.path}. LOC: ${file.lines_of_code || 0}, Complexity: ${file.complexity_score || 0}.`,
                              lines_of_code: file.lines_of_code,
                              complexity_score: file.complexity_score,
                              extension: ext
                            });
                          }}
                          style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            padding: '0.2rem 0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                          onMouseLeave={e => e.currentTarget.style.color = '#a0a0b0'}
                        >
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            {getFileIcon(ext)}
                          </span>
                          <span>{file.filename}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }
            })}

          </div>

          {/* Canvas HUD indicators */}
          <div style={{
            position: 'absolute', bottom: '1rem', right: '1rem',
            fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)',
            fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none'
          }}>
            {Math.round(transform.scale * 100)}% · drag to pan · scroll to zoom
          </div>
          <button onClick={resetView} style={{
            position: 'absolute', bottom: '1rem', left: '1rem',
            padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem',
            border: '1px solid rgba(250,204,21,0.15)', background: 'rgba(25,25,30,0.85)',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <Maximize2 size={12} /> Fit Canvas
          </button>
        </div>
      </div>

      {/* ── Right Slidable Detail Panel ── */}
      <div style={{
        width: selectedNode ? '380px' : '0px',
        borderLeft: selectedNode ? '1px solid rgba(250,204,21,0.2)' : 'none',
        borderTop: selectedNode ? '1px solid rgba(250,204,21,0.2)' : 'none',
        borderBottom: selectedNode ? '1px solid rgba(250,204,21,0.2)' : 'none',
        borderRadius: selectedNode ? '12px 0 0 12px' : '0px',
        height: '100%',
        background: 'rgba(15, 15, 22, 0.95)',
        backdropFilter: 'blur(16px)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: selectedNode ? '-4px 0 24px rgba(0,0,0,0.6)' : 'none',
        flexShrink: 0,
        zIndex: 40
      }}>
        {selectedNode && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', boxSizing: 'border-box', overflowY: 'auto' }}>
            {/* Panel Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                {selectedNode.type === 'root' && <FolderOpen size={20} style={{ color: '#facc15' }} />}
                {selectedNode.type === 'folder' && getFolderIcon(selectedNode.label)}
                {selectedNode.type === 'leaf' && getFileIcon(selectedNode.extension)}
                <span style={{ 
                  fontSize: '1.05rem', 
                  fontWeight: 800, 
                  color: '#fff', 
                  wordBreak: 'break-all', 
                  fontFamily: 'Outfit, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {selectedNode.label}
                </span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s', flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: 0 }}>
              
              {/* Type Badge & Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Type
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#facc15' }}>
                  {selectedNode.type === 'root' && 'Project Root Directory'}
                  {selectedNode.type === 'folder' && 'Directory Folder'}
                  {selectedNode.type === 'leaf' && 'File Module'}
                </span>
                {selectedNode.path && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                    {selectedNode.path}
                  </span>
                )}
              </div>

              {/* Description/Explanation section */}
              <div>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Explanation
                </span>
                <div style={{
                  marginTop: '0.4rem', padding: '0.85rem 1rem', borderRadius: '8px',
                  background: 'rgba(250,204,21,0.02)', border: '1px solid rgba(250,204,21,0.08)',
                  color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: '1.45',
                }}>
                  {selectedNode.type === 'leaf' ? (
                    loadingFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.4)', padding: '0.25rem 0' }}>
                        <RefreshCw size={14} className="animate-spin" />
                        Loading explanation...
                      </div>
                    ) : (
                      getBriefExplanation(selectedNode.label, selectedNode.path, fileDetails?.summary || selectedNode.desc)
                    )
                  ) : (
                    selectedNode.desc
                  )}
                </div>
              </div>

              {/* Metrics Grid for Files */}
              {selectedNode.type === 'leaf' && (
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Code Metrics
                  </span>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.4rem'
                  }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Lines of Code</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>
                        {loadingFile ? '...' : (fileDetails?.lines_of_code || selectedNode.lines_of_code || '0')}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Complexity</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>
                        {loadingFile ? '...' : (fileDetails?.complexity_score || selectedNode.complexity_score || '0')}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Imports (Out)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>
                        {loadingFile ? '...' : (fileDetails?.fan_out || '0')}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Imported By (In)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>
                        {loadingFile ? '...' : (fileDetails?.fan_in || '0')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AST Symbols for Files */}
              {selectedNode.type === 'leaf' && !loadingFile && fileDetails?.symbols && fileDetails.symbols.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Symbols Defined ({fileDetails.symbols.length})
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {fileDetails.symbols.map((sym, sIdx) => (
                      <span 
                        key={sIdx} 
                        className="repo-tag" 
                        style={{ 
                          fontSize: '0.68rem', 
                          padding: '0.12rem 0.4rem', 
                          borderLeft: sym.type === 'class' ? '2px solid var(--accent-secondary)' : (sym.type === 'route' ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)')
                        }}
                      >
                        {sym.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Files in Folder list for Folder Node */}
              {selectedNode.type === 'folder' && selectedNode.files && selectedNode.files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                    Files inside directory ({selectedNode.files.length})
                  </span>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto', paddingRight: '0.25rem'
                  }}>
                    {selectedNode.files.map((file, idx) => {
                      const ext = file.extension || ('.' + file.filename.split('.').pop());
                      return (
                        <div 
                          key={idx}
                          onClick={() => {
                            // Select file & load details
                            onSelectFile(file.id);
                            setSelectedNode({
                              id: `file_${file.id}`,
                              fileId: file.id,
                              label: file.filename,
                              path: file.path,
                              type: 'leaf',
                              desc: `File: ${file.path}. LOC: ${file.lines_of_code || 0}, Complexity: ${file.complexity_score || 0}.`,
                              lines_of_code: file.lines_of_code,
                              complexity_score: file.complexity_score,
                              extension: ext
                            });
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                            padding: '0.45rem 0.6rem', borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)',
                            cursor: 'pointer', transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.border = '1px solid rgba(250,204,21,0.2)';
                            e.currentTarget.style.background = 'rgba(250,204,21,0.02)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.04)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                            {getFileIcon(ext)}
                            <span style={{ fontSize: '0.78rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.filename}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                            {file.lines_of_code || 0} LOC
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action button to switch to File Explorer */}
              {selectedNode.type === 'leaf' && setActiveNavTab && (
                <button 
                  onClick={() => {
                    setActiveNavTab('files');
                  }}
                  style={{
                    marginTop: 'auto', padding: '0.6rem 1rem', borderRadius: '8px',
                    border: '1px solid #facc15', background: 'rgba(250,204,21,0.08)',
                    color: '#facc15', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                    cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 10px rgba(250,204,21,0.1)',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#facc15';
                    e.currentTarget.style.color = '#000';
                    e.currentTarget.style.boxShadow = '0 0 15px rgba(250,204,21,0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(250,204,21,0.08)';
                    e.currentTarget.style.color = '#facc15';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(250,204,21,0.1)';
                  }}
                >
                  <Code size={14} />
                  Open in Files Explorer
                </button>
              )}

            </div>
          </div>
        )}
      </div>

    </div>
  );
};
