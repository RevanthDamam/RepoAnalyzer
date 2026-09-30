import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, User, Bot, Layers, Database, Code, Sparkles, RefreshCw, FileText } from 'lucide-react';
import { apiFetch } from '../utils/api';


const renderInline = (text) => {
  if (!text) return null;
  // Match bold (**text** or __text__) and inline code (`code`)
  const parts = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex matches `code` or **bold** or *italic*
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let match;
  let lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={keyIndex++} style={{
          background: 'rgba(255,255,255,0.08)',
          padding: '0.15rem 0.35rem',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.88em',
          color: '#38bdf8'
        }}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={keyIndex++} style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={keyIndex++} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const renderFormattedText = (content) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    // Check code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            margin: '0.5rem 0'
          }}>
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      return;
    }

    // Markdown Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} style={{ marginTop: '0.75rem', marginBottom: '0.25rem', color: '#f8fafc', fontWeight: 600 }}>
          {renderInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={idx} style={{ marginTop: '0.9rem', marginBottom: '0.35rem', color: '#38bdf8', fontWeight: 600 }}>
          {renderInline(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={idx} style={{ marginTop: '1rem', marginBottom: '0.4rem', color: '#60a5fa', fontWeight: 700 }}>
          {renderInline(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      return;
    }

    // Bullet points (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      elements.push(
        <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'disc', margin: '0.2rem 0' }}>
          {renderInline(trimmed.replace(/^[-*]\s+/, ''))}
        </li>
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      elements.push(
        <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'decimal', margin: '0.2rem 0' }}>
          {renderInline(trimmed.replace(/^\d+\.\s+/, ''))}
        </li>
      );
      return;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={idx} style={{ height: '0.4rem' }} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} style={{ margin: '0.25rem 0', lineHeight: 1.6 }}>
        {renderInline(rawLine)}
      </p>
    );
  });

  // Flush unclosed code block if any
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre key="code-unclosed" style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '0.75rem 1rem',
        borderRadius: '6px',
        overflowX: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.85rem'
      }}>
        <code>{codeBuffer.join('\n')}</code>
      </pre>
    );
  }

  return elements;
};

export const ChatInterface = ({ repoId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [multiAgent, setMultiAgent] = useState(false);
  const [activeSubAgentTab, setActiveSubAgentTab] = useState({});
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch(`/api/repositories/${repoId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg.content,
          mode: multiAgent ? 'multi' : 'single'
        })
      });

      if (!res.ok) {
        throw new Error('API server returned an error.');
      }

      const data = await res.json();
      
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'No answer received.',
        subAgents: data.sub_agents,
        sources: data.sources,
        contextLength: data.context_length_chars,
        mode: multiAgent ? 'multi' : 'single'
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Set default tab for the sub-agents view
      if (data.sub_agents) {
        setActiveSubAgentTab(prev => ({
          ...prev,
          [assistantMsg.id]: 'Architecture Agent'
        }));
      }

    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to query codebase.'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSubAgentIcon = (name) => {
    if (name.includes('Architecture')) return <Layers size={14} />;
    if (name.includes('Code')) return <Code size={14} />;
    return <Database size={14} />;
  };

  return (
    <div className="glass main-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div className="tab-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '1rem', height: '48px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.25rem', color: '#ffffff', fontSize: '0.88rem', fontWeight: 600 }}>
          <Sparkles size={15} style={{ color: '#facc15' }} />
          AI Codebase Assistant
        </div>

        {/* Multi-Agent toggle button */}
        <button 
          className={`agent-toggle ${multiAgent ? 'active' : ''}`}
          onClick={() => setMultiAgent(prev => !prev)}
          title="Toggle Multi-Agent mode to run queries through specialized sub-agents first"
        >
          <Users size={16} />
          Collaborative Multi-Agent
        </button>
      </div>

      {/* Messages */}
      <div className="tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '0', overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">
              <Bot size={32} />
            </div>
            <h3>Ask anything about this Repository</h3>
            <p>
              Queries use a RAG pipeline to search indexed files, folder layouts, and technologies.
              Answers are generated instantly using Groq LLMs.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              <span className="repo-tag" style={{ background: 'rgba(99,102,241,0.08)', cursor: 'pointer' }} onClick={() => setInput('Does this project use Docker?')}>"Does this project use Docker?"</span>
              <span className="repo-tag" style={{ background: 'rgba(99,102,241,0.08)', cursor: 'pointer' }} onClick={() => setInput('Explain the file structure of this codebase.')}>"Explain the file structure of this codebase."</span>
              <span className="repo-tag" style={{ background: 'rgba(99,102,241,0.08)', cursor: 'pointer' }} onClick={() => setInput('What dependencies are installed?')}>"What dependencies are installed?"</span>
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`message-bubble ${msg.role}`}
              >
                <div className="message-meta">
                  {msg.role === 'user' ? (
                    <>
                      <User size={14} />
                      <span>Developer</span>
                    </>
                  ) : (
                    <>
                      <Bot size={14} />
                      <span>RepoAnalyzer Assistant {msg.mode === 'multi' ? '(Multi-Agent)' : ''}</span>
                    </>
                  )}
                </div>

                <div className="message-content">
                  {renderFormattedText(msg.content)}
                </div>

                {/* Render Collaborative Agent reports if Multi-Agent was used */}
                {msg.role === 'assistant' && msg.subAgents && (
                  <div className="agents-collaboration-box">
                    <div className="agents-header">
                      <Users size={14} />
                      Sub-Agent Collaborative Board
                    </div>
                    
                    {/* Agent Tabs */}
                    <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                      {Object.keys(msg.subAgents).map(agentName => (
                        <button
                          key={agentName}
                          className={`agent-toggle ${activeSubAgentTab[msg.id] === agentName ? 'active' : ''}`}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px' }}
                          onClick={() => setActiveSubAgentTab(prev => ({ ...prev, [msg.id]: agentName }))}
                        >
                          {getSubAgentIcon(agentName)}
                          {agentName.replace(' Agent', '')}
                        </button>
                      ))}
                    </div>

                    {/* Active Agent Report */}
                    {activeSubAgentTab[msg.id] && msg.subAgents[activeSubAgentTab[msg.id]] && (
                      <div className="agent-card">
                        <div className="agent-name-tag">{activeSubAgentTab[msg.id]} Report</div>
                        <div className="agent-analysis">
                          {renderFormattedText(msg.subAgents[activeSubAgentTab[msg.id]])}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Render retrieved sources list */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="sources-box">
                    <div className="sources-title">Retrieved Context Sources ({msg.contextLength ? `${Math.round(msg.contextLength / 1000)}k chars` : ''})</div>
                    <div className="sources-list">
                      {msg.sources.map((src, sIdx) => (
                        <span key={sIdx} className="source-tag" title={`${src.type}: ${src.path}`}>
                          <FileText size={10} />
                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {src.path.split('/').pop()}
                          </span>
                          <span style={{ color: 'var(--color-info)', fontWeight: '600' }}>
                            {Math.round(src.similarity * 100)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="message-bubble assistant">
                <div className="message-meta">
                  <Bot size={14} />
                  <span>Thinking...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                  <RefreshCw className="animate-spin" size={18} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {multiAgent ? 'Running multi-agent diagnostics...' : 'Retrieving semantical context...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <form onSubmit={handleSend} className="chat-input-row">
          <div className="chat-input-wrapper">
            <input 
              type="text" 
              placeholder={loading ? "Synthesizing answer..." : "Ask code details (e.g. 'How does authentication work?')..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn-send" disabled={loading || !input.trim()}>
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
