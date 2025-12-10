from pydantic import BaseModel
from typing import List, Optional

class AnalyticsMeta(BaseModel):
    contract_status: int
    status_name: str
    timestamp: int

class ClusterCentroid(BaseModel):
    cluster_id: int
    size: int
    distribution: List[float]
    confidence_score: float

class ScatterPoint(BaseModel):
    x: float
    y: float
    cluster_id: int
    voter_id: str
    raw_votes: List[int]
    point_confidence: float

class AnomalyDetail(BaseModel):
    voter_id: str
    anomaly_score: float
    detected_reasons: List[str]
    raw_stats: dict

class AnalyticsData(BaseModel):
    total_votes: int
    candidate_names: List[str]
    candidate_total_scores: List[int]

    anomalies_count: int
    anomalies_list: List[AnomalyDetail]

    n_clusters: int
    global_silhouette_score: float

    centroids: List[ClusterCentroid]
    pca_explained_variance: List[float]
    pca_visualization: List[ScatterPoint]

class AnalyticsResponse(BaseModel):
    meta: AnalyticsMeta
    data: Optional[AnalyticsData] = None
    message: str