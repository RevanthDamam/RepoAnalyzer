import React, { useState } from 'react';
import { AlertTriangle, Lock, Database, Clock, RefreshCw, ChevronRight } from 'lucide-react';

export const Security = ({ repoId }) => {
  const [analyzing, setAnalyzing] = useState(false);
  console.log("Auditing security context for Repo ID:", repoId);

  const triggerAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%' }}>
      
      {/* 1. Risks Card Indicator Banner */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div className="glass" style={{
          width: '260px',
          height: '240px',
          borderRadius: '12px',
          border: '1px solid rgba(250, 204, 21, 0.15)',
          boxShadow: '0 0 30px rgba(250, 204, 21, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          position: 'relative'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '2px', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
            Critical Risks
          </span>
          <span style={{ fontSize: '5rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
            12
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className="status-indicator" style={{
              backgroundColor: 'var(--accent-primary)',
              width: '6px',
              height: '6px',
              boxShadow: '0 0 8px var(--accent-primary)',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: '700', textTransform: 'uppercase' }}>
              SYSTEM ANALYZING...
            </span>
          </div>
        </div>
      </div>

      {/* 2. Split Workspace Layout: Event Log & Vulnerabilities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '2rem' }}>
        
        {/* Left Side: Event Log Timeline */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>Event Log</h4>
            <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid var(--border-glass)', paddingLeft: '1.25rem', marginLeft: '0.5rem', position: 'relative' }}>
            
            {/* Event 1 */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{
                position: 'absolute',
                left: '-24px',
                top: '4px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                boxShadow: '0 0 6px var(--accent-primary)'
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: '700' }}>08:42 AM - TODAY</span>
              <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>SHA-256 Collision Check</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Verified Integrity for 'auth-module-v2'</span>
            </div>

            {/* Event 2 */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{
                position: 'absolute',
                left: '-24px',
                top: '4px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                boxShadow: '0 0 6px var(--accent-primary)'
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: '700' }}>06:35 AM - TODAY</span>
              <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>SQL Injection Detected</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Exploit path identified in `/api/search`</span>
            </div>

            {/* Event 3 */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{
                position: 'absolute',
                left: '-24px',
                top: '4px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-muted)'
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>11:55 PM - YESTERDAY</span>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Automated Dependency Audit</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>45 packages verified, 0 outdated.</span>
            </div>

          </div>
        </div>

        {/* Right Side: Vulnerabilities Resolution Panel */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>Vulnerabilities</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>ACTIVE SCAN:</span>
              <strong style={{ color: 'var(--accent-primary)' }}>Main Branch</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Vuln 1 */}
            <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ color: 'var(--color-high)' }}><AlertTriangle size={18} /></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: 'var(--color-high)', color: '#000', fontSize: '0.62rem', fontWeight: '800', padding: '0.05rem 0.35rem', borderRadius: '2px' }}>CRITICAL</span>
                    <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>Broken Access Control</strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.15rem' }}>CVE-2024-1298 • Auth Middleware</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '700' }}>IMPACT</span>
                  <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>UNAUTHORIZED DB ACCESS</span>
                </div>
                <button className="btn-back" style={{ background: '#ffffff', color: '#000000', border: 'none', padding: '0.35rem 1rem', fontSize: '0.78rem', fontWeight: '700', borderRadius: '4px', cursor: 'pointer' }} onClick={triggerAnalyze}>
                  {analyzing ? <RefreshCw size={12} className="animate-spin" /> : 'RESOLVE'}
                </button>
              </div>
            </div>

            {/* Vuln 2 */}
            <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ color: 'var(--color-med)' }}><Lock size={18} /></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: 'var(--color-med)', color: '#000', fontSize: '0.62rem', fontWeight: '800', padding: '0.05rem 0.35rem', borderRadius: '2px' }}>MEDIUM</span>
                    <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>Weak Encryption Key</strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.15rem' }}>Internal-Policy-B4 • Config Loader</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '700' }}>IMPACT</span>
                  <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>TOKEN PREDICTABILITY</span>
                </div>
                <button className="btn-back" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', padding: '0.35rem 1rem', fontSize: '0.78rem', fontWeight: '600', borderRadius: '4px', cursor: 'pointer' }} onClick={triggerAnalyze}>
                  RESOLVE
                </button>
              </div>
            </div>

            {/* Vuln 3 */}
            <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ color: 'var(--color-low)' }}><Database size={18} /></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.62rem', fontWeight: '800', padding: '0.05rem 0.35rem', borderRadius: '2px' }}>LOW</span>
                    <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>Exposed Metadata</strong>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.15rem' }}>DevOps-821 • Webhook Headers</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: '700' }}>IMPACT</span>
                  <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>INFO DISCLOSURE</span>
                </div>
                <button className="btn-back" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', padding: '0.35rem 1rem', fontSize: '0.78rem', fontWeight: '600', borderRadius: '4px', cursor: 'pointer' }} onClick={triggerAnalyze}>
                  RESOLVE
                </button>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              VIEW ALL 84 FINDINGS <ChevronRight size={14} />
            </span>
          </div>

        </div>

      </div>

      {/* 3. Footer Statistics Checklist Bar */}
      <div className="glass" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '1.25rem', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>SAFE COMMITS</span>
          <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', marginTop: '0.25rem' }}>12.4k</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>AVG FIX TIME</span>
          <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif', marginTop: '0.25rem' }}>14m</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>THREATS BLOCKED</span>
          <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', marginTop: '0.25rem' }}>281</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>UPTIME</span>
          <span style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', fontFamily: 'Outfit, sans-serif', marginTop: '0.25rem' }}>99.9%</span>
        </div>
      </div>

    </div>
  );
};
