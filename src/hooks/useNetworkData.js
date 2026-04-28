import { useState, useEffect } from 'react';

export const useNetworkData = () => {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    ram: 0,
    latency: 0,
    packetLoss: 0,
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch historical summary for chart
        const summaryRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/summary`);
        const summaryJson = await summaryRes.json();
        const summaryData = summaryJson.data || [];
        
        const newHistory = summaryData.map(d => ({
          time: new Date(d.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: parseFloat((d.avg_latency || 0).toFixed(2))
        }));
        setHistory(newHistory);

        // Fetch metrics for stats cards
        const metricsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/metrics`);
        const metricsJson = await metricsRes.json();
        const devices = metricsJson.data || [];
        
        const totalDevices = metricsJson.count || devices.length;
        const onlineDevices = devices.filter(d => d.status === 'up').length;
        const totalLatency = devices.reduce((sum, d) => sum + (d.latency_ms || 0), 0);
        const avgLatency = devices.length > 0 ? (totalLatency / devices.length).toFixed(2) : 0;
        
        const totalPacketLoss = devices.reduce((sum, d) => sum + (d.packet_loss || 0), 0);
        const avgPacketLoss = devices.length > 0 ? (totalPacketLoss / devices.length).toFixed(2) : 0;

        setMetrics({
          totalDevices,
          onlineDevices,
          latency: avgLatency,
          packetLoss: avgPacketLoss,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return { metrics, history };
};
