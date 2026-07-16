import React from 'react';
import { ShieldCheck, Files, AlertCircle, Cpu, Calendar } from 'lucide-react';

export const Dashboard = ({ stats, technologies }) => {
  // Determine language distributions
  const primaryLang = technologies?.language || 'TypeScript';
  const otherLangs = technologies?.languages?.filter(l => l !== primaryLang) || [];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
      
      {/* 1. Header Metrics Cards Row */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        
        {/* Health Score Card */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem', height: '140px', borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.5px' }}>HEALTH SCORE</span>
            <ShieldCheck size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div style={{ margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif' }}>98.4%</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-info)' }}>+2.1% from last scan</span>
        </div>

        {/* Files Card */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem', height: '140px' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.5px' }}>FILES</span>
            <Files size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
              {stats.files_count.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Static modules indexed</span>
        </div>

        {/* Open Issues/Smells Card */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem', height: '140px' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.5px' }}>STATIC SMELLS</span>
            <AlertCircle size={16} style={{ color: 'var(--color-med)' }} />
          </div>
          <div style={{ margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-med)', fontFamily: 'Outfit, sans-serif' }}>12</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-high)' }}>4 critical severity</span>
        </div>

        {/* Complexity Card */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem', height: '140px' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.5px' }}>COMPLEXITY</span>
            <Cpu size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>Low</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-info)' }}>Highly modular design</span>
        </div>

      </div>

      {/* 2. Tech Distribution & Activity Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '2rem' }}>
        
        {/* Tech Distribution Doughnut Card */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>Tech Distribution</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '1rem 0' }}>
            <div style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'conic-gradient(var(--accent-primary) 0% 74%, rgba(255,255,255,0.06) 74% 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(250, 204, 21, 0.08)',
              position: 'relative'
            }}>
              <div style={{
                width: '108px',
                height: '108px',
                borderRadius: '50%',
                backgroundColor: '#0c0c10',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>{primaryLang}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>74%</span>
              </div>
            </div>

            {/* Language Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem', width: '100%', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{primaryLang}</span>
              </div>
              {otherLangs.slice(0, 2).map((lang, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{lang}</span>
                </div>
              ))}
              {otherLangs.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>CSS</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Repository Activity Bar Chart Card */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>Repository Activity</h4>
            <span className="repo-tag" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>LAST 30 DAYS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifySelf: 'stretch' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-glass)' }}>
              {[42, 64, 38, 78, 52, 70, 48, 62, 85].map((val, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '65%',
                    height: `${val}%`,
                    backgroundColor: idx === 8 ? 'var(--accent-primary)' : 'rgba(250, 204, 21, 0.12)',
                    border: idx === 8 ? '1px solid var(--accent-primary)' : '1px solid rgba(250, 204, 21, 0.2)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.3s ease',
                    boxShadow: idx === 8 ? '0 0 10px rgba(250, 204, 21, 0.25)' : 'none'
                  }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>MAIN BRANCH </span>
                <strong style={{ color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>v2.4.0-stable</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                <Calendar size={12} />
                <span>LAST PUSH 14 MINS AGO</span>
              </div>
            </div>

          </div>
        </div>

      </div>
      
    </div>
  );
};
