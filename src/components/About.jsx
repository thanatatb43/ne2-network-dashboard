import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Info, User, BarChart3, Globe, ShieldCheck, Cpu, Code2, Users, Eye, BarChart, History, Loader2, Calendar, Clock } from 'lucide-react';
import peaLogo from '../assets/logo/pea_logo.png';

const About = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stats/summary`);
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error('Failed to fetch stats summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const stats = [
    { label: 'Online Users', value: summary?.data?.online_users ?? '0', icon: Users, color: '#10b981' },
    { label: 'Visits Today', value: (summary?.data?.views_today ?? 0).toLocaleString(), icon: Calendar, color: '#3b82f6' },
    { label: 'Visits This Month', value: (summary?.data?.views_month ?? 0).toLocaleString(), icon: Clock, color: '#eab308' },
    { label: 'Total Site Visits', value: (summary?.data?.total_views ?? 0).toLocaleString(), icon: Eye, color: '#a855f7' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ paddingBottom: '3rem' }}
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 className="krub-bold" style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>About This Project</h1>
        <p className="krub-regular" style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
          ระบบตรวจสอบ LAN Devices
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Creator Information Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: 'var(--accent-primary)' }}>
              <User size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>ผู้จัดทำ</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                TB
              </div>
              <div>
                <div className="krub-bold" style={{ fontSize: '1.1rem' }}>นายธนทัต บูระพันธ์</div>
                <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Thanatat Boorapan</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'var(--accent-primary)' }}><ShieldCheck size={18} /></div>
                <div>
                  <div className="krub-semibold" style={{ fontSize: '0.9rem' }}>ตำแหน่ง</div>
                  <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>นักระบบงานคอมพิวเตอร์</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'var(--accent-primary)' }}><Globe size={18} /></div>
                <div>
                  <div className="krub-semibold" style={{ fontSize: '0.9rem' }}>สังกัด</div>
                  <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผคข.กดส.ฉ.2 (การไฟฟ้าส่วนภูมิภาคเขต 2 ภาคตะวันออกเฉียงเหนือ)</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Site Statistics Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: '#3b82f6' }}>
              <BarChart size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>Site Viewer Statistics</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', position: 'relative', minHeight: '180px' }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '1rem', backdropFilter: 'blur(2px)' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : null}

            {stats.map((stat, idx) => (
              <div key={idx} className="glass" style={{ padding: '1.25rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: stat.color, marginBottom: '0.75rem' }}>
                  <stat.icon size={20} />
                </div>
                <div className="krub-bold" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{stat.value}</div>
                <div className="krub-regular" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <History size={16} color="#3b82f6" />
            <span>Operational metrics synchronized with real-time backend analytics.</span>
          </div>
        </motion.div>

        {/* Project Technical Details Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem', gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: '#10b981' }}>
              <Code2 size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>Technical Stack</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
              <span className="krub-medium">React (Vite)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)' }} />
              <span className="krub-medium">Framer Motion</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              <span className="krub-medium">Recharts API</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span className="krub-medium">Lucide Icons</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', opacity: 0.5 }}>
            <img src={peaLogo} alt="PEA Logo" style={{ width: '80px', filter: 'grayscale(1)' }} />
            <div className="krub-medium" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Version 1.2.0 • 2026</div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default About;
