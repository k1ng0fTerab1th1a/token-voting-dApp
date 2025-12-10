import numpy as np
import pandas as pd
from scipy.stats import entropy
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, silhouette_samples

from app.schemas import AnalyticsData, AnomalyDetail, ClusterCentroid, ScatterPoint

class AnalyticsService:
    def run_pipeline(self, raw_data_list: list, candidates_data: list) -> AnalyticsData:
        if not raw_data_list:
            return None 

        c_names = [c['name'] for c in candidates_data]
        c_scores = [float(c['voteCount']) for c in candidates_data]

        vectors = [d['vector'] for d in raw_data_list]
        df_votes = pd.DataFrame(vectors)
        
        meta_df = pd.DataFrame([{
            'reaction_time': d['reaction_time'],
            'voter': d['voter']
        } for d in raw_data_list])

        meta_df['entropy'] = [entropy(v) for v in vectors]

        scaler = StandardScaler()
        if len(df_votes) > 0:
            X_scaled = scaler.fit_transform(df_votes)
        else:
            X_scaled = np.array([])

        anomalies_list = []
        
        if len(df_votes) >= 2:
            meta_features = meta_df[['reaction_time', 'entropy']].values
            meta_scaled = StandardScaler().fit_transform(meta_features)
            
            X_full = np.hstack([X_scaled, meta_scaled])

            iso_forest = IsolationForest(contamination=0.05, random_state=42)
            anomaly_scores = iso_forest.fit_predict(X_full)
            raw_scores = iso_forest.decision_function(X_full)

            for i, is_anomaly in enumerate(anomaly_scores):
                if is_anomaly == -1:
                    reasons = []
                    r_time = meta_df.iloc[i]['reaction_time']
                    ent = meta_df.iloc[i]['entropy']
                    score = raw_scores[i]

                    if r_time < 10: 
                        reasons.append(f'Instant reaction ({int(r_time)}s)')
                    
                    if ent < 0.1:
                        reasons.append('Zero Entropy (All-in vote)')
                    elif ent > 2.0:
                        reasons.append('High Entropy Noise')
                    
                    if score < -0.15:
                        reasons.append('Statistical Outlier (Unusual pattern)')

                    if not reasons:
                        reasons.append('Complex anomaly pattern')

                    anomalies_list.append(AnomalyDetail(
                        voter_id=meta_df.iloc[i]['voter'],
                        anomaly_score=float(score),
                        detected_reasons=reasons,
                        raw_stats={'reaction_time': float(r_time), 'entropy': float(ent)}
                    ))

        n_clusters = min(3, len(df_votes)) 
        
        cluster_labels = np.zeros(len(df_votes))
        global_sil_score = 0.0
        sample_silhouette_values = [1.0] * len(df_votes)

        if n_clusters > 1:
            kmeans = KMeans(n_clusters=n_clusters)
            cluster_labels = kmeans.fit_predict(X_scaled)
            
            global_sil_score = silhouette_score(X_scaled, cluster_labels)
            
            sample_silhouette_values = silhouette_samples(X_scaled, cluster_labels)

        explained_variance = [0.0, 0.0]
        scatter_points = []

        if len(df_votes) >= 2:
            pca_model = PCA(n_components=2)
            coords = pca_model.fit_transform(X_scaled)
            explained_variance = pca_model.explained_variance_ratio_.tolist()

            for i in range(len(coords)):
                p_conf = sample_silhouette_values[i] if n_clusters > 1 else 1.0
                
                scatter_points.append(ScatterPoint(
                    x=float(coords[i][0]),
                    y=float(coords[i][1]),
                    cluster_id=int(cluster_labels[i]),
                    voter_id=meta_df.iloc[i]['voter'],
                    raw_votes=vectors[i],
                    point_confidence=float(p_conf)
                ))

        centroids_list = []
        
        df_analysis = df_votes.copy()
        df_analysis['cluster'] = cluster_labels
        df_analysis['confidence'] = sample_silhouette_values

        for c_id in range(n_clusters):
            cluster_subset = df_analysis[df_analysis['cluster'] == c_id]
            
            if len(cluster_subset) == 0: continue

            avg_vector = cluster_subset.drop(columns=['cluster', 'confidence']).mean().tolist()
            avg_conf = cluster_subset['confidence'].mean()

            centroids_list.append(ClusterCentroid(
                cluster_id=c_id,
                size=len(cluster_subset),
                distribution=avg_vector,
                confidence_score=float(avg_conf) if not np.isnan(avg_conf) else 0.0
            ))

        return AnalyticsData(
            total_votes=len(df_votes),
            
            candidate_names=c_names,
            candidate_total_scores=c_scores,
            
            anomalies_count=len(anomalies_list),
            anomalies_list=anomalies_list,
            
            n_clusters=n_clusters,
            global_silhouette_score=float(global_sil_score),
            centroids=centroids_list,
            
            pca_explained_variance=explained_variance,
            pca_visualization=scatter_points
        )

analytics_service = AnalyticsService()