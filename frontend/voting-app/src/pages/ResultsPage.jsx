import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell 
} from 'recharts';

import '../App.css';
import '../styles/ResultsPage.css';

const CLUSTER_COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];
const CANDIDATE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE'];

const ResultsPage = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  
  const [inputAddress, setInputAddress] = useState("");
  
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const handleSearch = () => {
    if (inputAddress.trim()) {
      navigate(`/results/${inputAddress.trim()}`);
    }
  };

  const fetchData = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/analytics/${address}`);
      if (!res.ok) throw new Error("Backend connection failed");
      
      const json = await res.json();
      setAnalytics(json);
      setLastUpdated(new Date().toLocaleTimeString());

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  if (!address) {
    return (
      <div className="main-container" style={{maxWidth: "500px", marginTop: "50px", textAlign: "center"}}>
        <h2 className="page-title">Analytics Lookup</h2>
        <div className="form-group">
          <label className="label-text" style={{textAlign: "left"}}>Contract Address:</label>
          <input 
            className="input-field" 
            placeholder="0x..."
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={handleSearch}>
          View Results
        </button>
      </div>
    );
  }

  if (loading && !analytics) return <div className="main-container" style={{textAlign:'center'}}><h3>Loading Analytics...</h3></div>;
  if (error) return <div className="main-container" style={{textAlign:'center'}}><h3 style={{color:'red'}}>Error: {error}</h3></div>;
  if (!analytics) return <div className="main-container">Enter an address to view results.</div>;

  const { meta, data } = analytics;
  const isReady = data !== null;

  const winnersData = isReady ? data.candidate_names.map((name, index) => ({
    name,
    score: data.candidate_total_scores[index]
  })) : [];

  const clusterProfileData = isReady ? data.centroids.map((centroid) => {
    const row = { name: `Cluster ${centroid.cluster_id}` };
    
    centroid.distribution.forEach((score, index) => {
        const candidateName = data.candidate_names[index];
        row[candidateName] = score;
    });
    
    return row;
  }) : [];

  const CustomScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <div className="tooltip-title">Voter: {dataPoint.voter_id.slice(0, 6)}...</div>
          <div>Cluster: <strong>{dataPoint.cluster_id}</strong></div>
          <div>Confidence: <strong>{dataPoint.point_confidence.toFixed(2)}</strong></div>
          <hr style={{margin: "5px 0", borderColor: "#eee"}}/>
          <div style={{fontSize: "11px", color: "#666"}}>
            Raw Votes: [{dataPoint.raw_votes.join(", ")}]
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      <div className="results-header">
        <div>
            <h2 style={{margin: 0}}>Analytics Dashboard</h2>
            <span className="contract-badge">{address}</span>
        </div>
        <div style={{textAlign: "right"}}>
            <div style={{fontSize: "12px", color: "#666"}}>Last updated: {lastUpdated}</div>
            <button className="btn-primary" style={{width: "auto", padding: "8px 15px"}} onClick={fetchData}>
                Refresh
            </button>
        </div>
      </div>

      {!isReady ? (
        <div className="card" style={{textAlign: "center", padding: "50px"}}>
          <h2>Analytics Pending</h2>
          <p>The contract is currently in <strong>{meta.status_name}</strong> phase.</p>
          <p>Advanced analytics (ML, Clusters, Anomalies) will be generated once the <strong>Reveal</strong> phase begins.</p>
        </div>
      ) : (
        <>
            <div className="metrics-grid">
                <div className="metric-card blue">
                    <div className="metric-label">Total Votes</div>
                    <div className="metric-value">{data.total_votes}</div>
                </div>
                <div className="metric-card green">
                    <div className="metric-label">Clusters Found</div>
                    <div className="metric-value">{data.n_clusters}</div>
                </div>
                <div className="metric-card purple">
                    <div className="metric-label">Clustering Quality</div>
                    <div className="metric-value">{data.global_silhouette_score.toFixed(2)}</div>
                    <div style={{fontSize: "11px", color: "#888"}}>Silhouette Score (-1 to 1)</div>
                </div>
                <div className="metric-card red">
                    <div className="metric-label">Anomalies Detected</div>
                    <div className="metric-value">{data.anomalies_count}</div>
                </div>
            </div>

            <div className="charts-row">
                <div className="chart-card">
                    <h3 className="chart-title">Election Results</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={winnersData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="score" fill="#2196F3" radius={[4, 4, 0, 0]} name="Total Points" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3 className="chart-title">
                        Cluster Profiles
                        <span style={{fontSize: "12px", fontWeight: "normal", color: "#777"}}>Avg. vote per group</span>
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={clusterProfileData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            
                            {data.candidate_names.map((candName, idx) => (
                                <Bar 
                                    key={candName}
                                    dataKey={candName} 
                                    fill={CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length]} 
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="chart-card" style={{marginBottom: "30px"}}>
                <h3 className="chart-title">
                    Voter Map (PCA)
                    <span className="confidence-tag">
                        Explained Variance: {(data.pca_explained_variance[0]*100).toFixed(0)}% / {(data.pca_explained_variance[1]*100).toFixed(0)}%
                    </span>
                </h3>
                <p style={{fontSize: "14px", color: "#666", marginBottom: "20px"}}>
                    Each dot is a voter. Closer dots = similar voting patterns. Colors represent AI-detected clusters.
                </p>
                
                <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="x" name="PC1" unit="" />
                        <YAxis type="number" dataKey="y" name="PC2" unit="" />
                        <Tooltip content={<CustomScatterTooltip />} />
                        <ZAxis type="number" range={[50, 50]} />
                        
                        <Scatter name="Voters" data={data.pca_visualization} fill="#8884d8">
                            {data.pca_visualization.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CLUSTER_COLORS[entry.cluster_id % CLUSTER_COLORS.length]} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {data.anomalies_count > 0 && (
                <div className="anomalies-section">
                    <h3 style={{color: "#d32f2f", marginTop: 0}}>Suspicious Activity Detected</h3>
                    <table className="anomalies-table">
                        <thead>
                            <tr>
                                <th>Voter Address</th>
                                <th>Anomaly Score</th>
                                <th>Reason(s)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.anomalies_list.map((anomaly, idx) => (
                                <tr key={idx}>
                                    <td style={{fontFamily: "monospace"}}>{anomaly.voter_id}</td>
                                    <td>{anomaly.anomaly_score.toFixed(3)}</td>
                                    <td>
                                        {anomaly.detected_reasons.map((reason, rIdx) => (
                                            <span key={rIdx} className="reason-tag">{reason}</span>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;