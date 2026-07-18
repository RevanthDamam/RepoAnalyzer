import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, Circle, Play } from 'lucide-react';
import { apiFetch } from '../utils/api';

export const Learning = ({ repoId, onSelectFileByPath }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState({});

  useEffect(() => {
    const fetchLearning = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/repositories/${repoId}/learning`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLearning();
  }, [repoId]);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Creating learning onboarding guide...</div>;
  }

  if (!data || data.steps.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem 1.5rem', borderRadius: 'var(--border-radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No files found to map an onboarding path. Scan the repository first.
      </div>
    );
  }

  const toggleStep = (idx) => {
    setCompletedSteps(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Onboarding Checklist Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {data.steps.map((step, idx) => {
          const isCompleted = completedSteps[idx];
          return (
            <div 
              key={idx} 
              className="glass glow-hover"
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--border-radius-md)',
                display: 'flex',
                gap: '1rem',
                alignItems: 'start',
                borderLeft: isCompleted ? '4px solid var(--color-info)' : '1px solid var(--border-glass)',
                opacity: isCompleted ? 0.75 : 1,
                transition: 'var(--transition-normal)'
              }}
            >
              {/* Checkbox button */}
              <button 
                onClick={() => toggleStep(idx)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.2rem', color: isCompleted ? 'var(--color-info)' : 'var(--text-muted)' }}
              >
                {isCompleted ? <CheckCircle size={20} /> : <Circle size={20} />}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <h4 style={{
                  fontFamily: 'Outfit, sans-serif',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                  color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)'
                }}>
                  {step.title}
                </h4>
                
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{step.description}</p>
                
                {/* Target files links */}
                {step.files && step.files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Recommended Files:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {step.files.map((file, fIdx) => (
                        <button
                          key={fIdx}
                          onClick={() => onSelectFileByPath(file)}
                          className="repo-tag"
                          style={{
                            cursor: 'pointer',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            background: 'rgba(99, 102, 241, 0.08)',
                            borderColor: 'rgba(99, 102, 241, 0.15)'
                          }}
                        >
                          <Play size={10} style={{ color: 'var(--accent-primary)' }} />
                          {file.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Guide details / summary card */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
          <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
          Codebase Learning Path
        </h4>
        
        <p>
          This onboarding guide was generated dynamically by parsing codebase layout importance scores, bootstrapping entrypoints, ORM definitions, route registries, and module references.
        </p>
        <p>
          Trace each step sequentially. Click on any **Recommended File** badge to open its source code, and read its AI file summary to understand the architecture page-by-page.
        </p>
      </div>

    </div>
  );
};
