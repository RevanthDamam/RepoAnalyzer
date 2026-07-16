import React, { useEffect, useState } from 'react';
import { Award, Code, CheckCircle, Flame, Layers } from 'lucide-react';

export const Quality = ({ repoId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchQuality = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/repositories/${repoId}/quality`);
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
    fetchQuality();
  }, [repoId]);

  if (loading || !data) {
    return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Loading quality metrics...</div>;
  }

  const { score_grade, smells, metrics } = data;

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return 'var(--color-info)';
      case 'B': return 'var(--color-low)';
      case 'C': return 'var(--color-med)';
      case 'D': return 'var(--color-med-high)';
      default: return 'var(--color-high)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Metrics Row */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        
        {/* Grade Card */}
        <div className="glass stat-card glow-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)' }}>
              <Award size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Quality Rating</h4>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>SonarQube Standard</span>
            </div>
          </div>
          <div style={{
            fontSize: '3.2rem',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: '800',
            color: getGradeColor(score_grade),
            textShadow: `0 0 15px ${getGradeColor(score_grade)}44`,
            lineHeight: 1
          }}>
            {score_grade}
          </div>
        </div>

        {/* LOC Card */}
        <div className="glass stat-card glow-hover">
          <div className="stat-icon-wrapper" style={{ color: 'var(--accent-secondary)', background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
            <Code size={24} />
          </div>
          <div className="stat-details">
            <h4>Total LOC</h4>
            <p>{metrics.total_loc}</p>
          </div>
        </div>

        {/* Complexity Card */}
        <div className="glass stat-card glow-hover">
          <div className="stat-icon-wrapper" style={{ color: 'var(--color-med)', background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.2)' }}>
            <Flame size={24} />
          </div>
          <div className="stat-details">
            <h4>Avg Complexity</h4>
            <p>{metrics.avg_complexity}</p>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Code Smells List */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
            <Layers size={18} style={{ color: 'var(--color-med-high)' }} />
            Code Smells & Debt List ({smells.length})
          </h4>
          
          {smells.length === 0 ? (
            <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-info)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <CheckCircle size={24} style={{ marginBottom: '0.5rem' }} />
              <div>0 Code smells detected! The repository maintains perfect static syntax design.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
              {smells.map((smell, idx) => (
                <div key={idx} className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '3px solid var(--color-med-high)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                    <span>{smell.path.split('/').pop()}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-med-high)', textTransform: 'uppercase' }}>{smell.type}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{smell.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complexity Explanation Card */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          <h4 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>SonarQube Metric Definitions</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Lines of Code (LOC)</strong>:
              <p style={{ marginTop: '0.15rem' }}>Measures the count of executable logical code lines, excluding blank lines and standard comments.</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Cyclomatic Complexity</strong>:
              <p style={{ marginTop: '0.15rem' }}>Counts the number of independent execution paths inside a module. High complexity index values indicate dense conditional nesting which makes code harder to debug and test.</p>
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Coupling & Cohesion</strong>:
              <p style={{ marginTop: '0.15rem' }}>Measures module linkages. High coupling requires files to import too many modules. High cohesion targets are imported widely across files.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
