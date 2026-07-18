import React, { useEffect, useState } from 'react';
import { Files, Cpu, Layers, RefreshCw, Zap, ArrowRight, Star, GitMerge, BookOpen } from 'lucide-react';

// ── Language badge colors ──────────────────────────────────────────────────
const LANG_COLORS = {
  'Python':      { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)',  text: '#93c5fd' },
  'JavaScript':  { bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.35)', text: '#fde68a' },
  'TypeScript':  { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)',  text: '#c4b5fd' },
  'CSS':         { bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.35)', text: '#5eead4' },
};

const LANGUAGE_PALETTE = {
  'Python': '#3b82f6', 'JavaScript': '#facc15', 'TypeScript': '#6366f1',
  'CSS': '#14b8a6', 'HTML': '#f97316', 'Rust': '#ea580c', 'Go': '#06b6d4', 'Shell': '#22c55e',
};

const TYPE_ICON = {
  'Framework':'⬡','Server':'⚙','ORM':'🗄','Database driver':'🔌','SDK / Library':'☁',
  'ML Library':'🧠','Library':'📦','HTTP library':'🌐','Data validation':'✔',
  'DB migrations':'🔀','Task queue':'⏱','Cache client':'⚡','Build tool':'🔨',
  'Build plugin':'🔧','Linter':'🔍','Formatter':'✨','Testing':'🧪',
  'Type checker':'📐','Type definitions':'📝','UI Library':'🎨','Component library':'🧩',
  'State management':'🔄','Animation library':'🎞','CSS framework':'🎭','Language compiler':'🏗',
};

function LangBadge({ lang }) {
  const c = LANG_COLORS[lang] || { bg:'rgba(255,255,255,0.06)', border:'rgba(255,255,255,0.15)', text:'#aaa' };
  return (
    <span style={{ fontSize:'0.68rem', fontWeight:'600', padding:'0.2rem 0.5rem',
      borderRadius:'4px', background:c.bg, border:`1px solid ${c.border}`, color:c.text, whiteSpace:'nowrap' }}>
      {lang}
    </span>
  );
}

function PackageTable({ packages }) {
  if (!packages?.length) return <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', fontStyle:'italic', padding:'0.5rem 0' }}>No packages detected.</div>;
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
      <thead>
        <tr style={{ borderBottom:'1px solid var(--border-glass)' }}>
          {['Package','Type','Language'].map(h => (
            <th key={h} style={{ textAlign:'left', padding:'0.45rem 0.6rem', color:'var(--text-muted)', fontWeight:'600', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.4px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {packages.map((pkg, idx) => (
          <tr key={idx} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <td style={{ padding:'0.45rem 0.6rem', color:'#ffffff', fontWeight:'500', fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem' }}>
              {TYPE_ICON[pkg.type] || '📦'} {pkg.name}
            </td>
            <td style={{ padding:'0.45rem 0.6rem', color:'var(--text-secondary)' }}>{pkg.type}</td>
            <td style={{ padding:'0.45rem 0.6rem' }}><LangBadge lang={pkg.lang} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Left panel: AI Summary ─────────────────────────────────────────────────
function SummaryPanel({ repoId, repoName }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchSummary = () => {
    setLoading(true); setError(null);
    fetch(`/api/repositories/${repoId}/codebase-summary`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setSummary(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  const regenerate = () => {
    setRegenerating(true); setSummary(null); setError(null);
    fetch(`/api/repositories/${repoId}/codebase-summary/regenerate`, { method: 'POST' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setSummary(data); setRegenerating(false); })
      .catch(() => { setError('Regeneration failed.'); setRegenerating(false); });
  };

  useEffect(() => { if (repoId) fetchSummary(); }, [repoId]);

  const sectionCard = (icon, label, content, accentColor = 'var(--accent-primary)') => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <span style={{ color: accentColor }}>{icon}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      {content}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header: project name + regenerate */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Repository</p>
          <h2 style={{ margin: '0.1rem 0 0', fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>{repoName || 'Unknown Project'}</h2>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating || loading}
          title="Regenerate AI summary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', borderRadius: '4px', border: '1px solid rgba(250,204,21,0.25)', background: 'rgba(250,204,21,0.06)', color: 'var(--text-muted)', opacity: (regenerating || loading) ? 0.5 : 1, transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#facc15'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <RefreshCw size={11} style={{ animation: (regenerating || loading) ? 'spin 1s linear infinite' : 'none' }} />
          {regenerating ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: i === 1 ? '60px' : '80px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', animation: 'pulse 1.8s ease-in-out infinite' }} />
          ))}
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Generating summary with Groq…</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.82rem', color: '#f87171' }}>⚠ {error}</p>
          <button onClick={fetchSummary} style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-glass)', borderRadius: '4px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {summary && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1 }}>

          {/* Overview paragraph */}
          {summary.project_overview && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {summary.project_overview}
            </p>
          )}

          {/* Primary Purpose */}
          {summary.primary_purpose && sectionCard(
            <BookOpen size={13} />, 'Primary Purpose',
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {summary.primary_purpose.goal && (
                <div style={{ fontSize: '0.82rem', color: '#ffffff' }}><span style={{ color: 'var(--text-muted)' }}>Goal: </span>{summary.primary_purpose.goal}</div>
              )}
              {summary.primary_purpose.target_users && (
                <div style={{ fontSize: '0.82rem', color: '#ffffff' }}><span style={{ color: 'var(--text-muted)' }}>For: </span>{summary.primary_purpose.target_users}</div>
              )}
              {summary.primary_purpose.main_functionality && (
                <div style={{ fontSize: '0.82rem', color: '#ffffff' }}><span style={{ color: 'var(--text-muted)' }}>Core: </span>{summary.primary_purpose.main_functionality}</div>
              )}
            </div>
          )}

          {/* Core Features */}
          {summary.core_features?.length > 0 && sectionCard(
            <Star size={13} />, 'Core Features',
            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {summary.core_features.map((f, i) => (
                <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{f}</li>
              ))}
            </ul>,
            '#facc15'
          )}

          {/* Request Flow */}
          {summary.request_flow?.length > 0 && sectionCard(
            <ArrowRight size={13} />, 'Request Flow',
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
              {summary.request_flow.map((step, i) => (
                <React.Fragment key={i}>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '4px', color: '#c4b5fd' }}>{step}</span>
                  {i < summary.request_flow.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>}
                </React.Fragment>
              ))}
            </div>,
            '#6366f1'
          )}

          {/* Engineering Highlights */}
          {summary.engineering_highlights?.length > 0 && sectionCard(
            <Zap size={13} />, 'Engineering Highlights',
            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {summary.engineering_highlights.map((h, i) => (
                <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{h}</li>
              ))}
            </ul>,
            '#22c55e'
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export const Dashboard = ({ stats, technologies, repoId, repoName }) => {
  const primaryLang = technologies?.language || 'JavaScript';
  const otherLangs = technologies?.languages || [];

  const [manifest, setManifest] = useState(null);
  const [activeTab, setActiveTab] = useState('backend');

  useEffect(() => {
    if (!repoId) return;
    fetch(`/api/repositories/${repoId}/manifest`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setManifest(data); })
      .catch(() => {});
  }, [repoId]);

  const getLangColor = (lang, index) => {
    if (LANGUAGE_PALETTE[lang]) return LANGUAGE_PALETTE[lang];
    return ['#a855f7','#ec4899','#f43f5e','#10b981','#84cc16'][index % 5];
  };

  const filesCount = stats?.files_count || 0;
  const allLangs = [primaryLang, ...otherLangs.filter(l => l !== primaryLang)];
  const segmentSize = 100 / Math.max(allLangs.length, 1);
  let acc = 0;
  const conicSegments = allLangs.map((lang, idx) => {
    const color = getLangColor(lang, idx);
    const seg = `${color} ${acc}% ${acc + segmentSize}%`;
    acc += segmentSize;
    return seg;
  }).join(', ');

  const tabStyle = (tab) => ({
    padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
    borderRadius: '4px',
    background: activeTab === tab ? 'rgba(250,204,21,0.12)' : 'transparent',
    color: activeTab === tab ? '#facc15' : 'var(--text-secondary)',
    border: activeTab === tab ? '1px solid rgba(250,204,21,0.3)' : '1px solid transparent',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '100%', minHeight: '580px' }}>

      {/* ── LEFT: AI Codebase Summary ── */}
      <div className="glass" style={{ padding: '1.75rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryPanel repoId={repoId} repoName={repoName} />
      </div>

      {/* ── RIGHT: Files + Languages + Manifest ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Total Files */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderRadius: 'var(--border-radius-md)', borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Total Files Indexed</span>
            <span style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{filesCount.toLocaleString()}</span>
          </div>
          <div style={{ padding: '0.65rem', borderRadius: '8px', background: 'rgba(250,204,21,0.08)' }}>
            <Files size={22} style={{ color: 'var(--accent-primary)' }} />
          </div>
        </div>

        {/* Languages */}
        <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Cpu size={15} style={{ color: 'var(--accent-primary)' }} />
            Languages & Tech Stack
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${conicSegments})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: '#0c0c10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
                {allLangs.length} Langs
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
              {allLangs.map((lang, idx) => {
                const color = getLangColor(lang, idx);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ color: idx === 0 ? '#fff' : 'var(--text-secondary)', fontWeight: idx === 0 ? '600' : '400' }}>
                        {lang}{idx === 0 ? ' (Primary)' : ''}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{Math.round(segmentSize)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Libraries & Frameworks */}
        <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Layers size={15} style={{ color: 'var(--accent-primary)' }} />
              Libraries & Frameworks
              {manifest && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '400' }}>({manifest.total} total)</span>}
            </h4>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button style={tabStyle('backend')} onClick={() => setActiveTab('backend')}>Backend</button>
              <button style={tabStyle('frontend')} onClick={() => setActiveTab('frontend')}>Frontend</button>
            </div>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {!manifest ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading package manifest…</div>
            ) : (
              <PackageTable packages={manifest[activeTab]} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};


