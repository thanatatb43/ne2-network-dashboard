import React from 'react';
import { MoreVertical, CheckCircle, AlertCircle } from 'lucide-react';

const DeviceTable = () => {
  const devices = [
    { id: 1, name: 'Main Server', ip: '192.168.1.10', status: 'Online', lastSeen: 'Just now' },
    { id: 2, name: 'Office Router', ip: '192.168.1.1', status: 'Online', lastSeen: '2 min ago' },
    { id: 3, name: 'Backup Storage', ip: '192.168.1.105', status: 'Warning', lastSeen: '5 min ago' },
    { id: 4, name: 'CCTV Gateway', ip: '192.168.1.20', status: 'Online', lastSeen: 'Just now' },
    { id: 5, name: 'External Client', ip: '10.0.5.42', status: 'Offline', lastSeen: '1 hour ago' },
  ];

  return (
    <div className="card glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Connected Devices</h3>
        <button style={{ 
          background: 'rgba(255,255,255,0.05)', 
          border: '1px solid var(--border-color)', 
          color: 'var(--text-primary)',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem'
        }}>View All</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <th style={{ padding: '1rem 0' }}>Device Name</th>
            <th style={{ padding: '1rem 0' }}>IP Address</th>
            <th style={{ padding: '1rem 0' }}>Status</th>
            <th style={{ padding: '1rem 0' }}>Last Seen</th>
            <th style={{ padding: '1rem 0', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '1rem 0', fontWeight: 500 }}>{device.name}</td>
              <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontFamily: 'ui-monospace' }}>{device.ip}</td>
              <td style={{ padding: '1rem 0' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: device.status === 'Online' ? 'var(--accent-success)' : 
                         device.status === 'Warning' ? 'var(--accent-warning)' : 'var(--accent-danger)'
                }}>
                  {device.status === 'Online' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span style={{ fontSize: '0.875rem' }}>{device.status}</span>
                </div>
              </td>
              <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{device.lastSeen}</td>
              <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                <MoreVertical size={18} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DeviceTable;
