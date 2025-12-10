import time
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import STATUS_PLANNED, STATUS_COMMIT, STATUS_REVEAL, STATUS_CLOSED
from app.schemas import AnalyticsResponse, AnalyticsMeta
from app.services.blockchain import blockchain_service
from app.services.analytics import analytics_service

app = FastAPI(title='Token Voting Analytics API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

CACHE_DIR = Path('data_cache')
CACHE_DIR.mkdir(exist_ok=True)

STATUS_NAMES = {
    STATUS_PLANNED: 'PLANNED',
    STATUS_COMMIT: 'COMMIT',
    STATUS_REVEAL: 'REVEAL',
    STATUS_CLOSED: 'CLOSED'
}

@app.get('/analytics/{contract_address}', response_model=AnalyticsResponse)
def get_analytics(contract_address: str):
    file_path = CACHE_DIR / f'{contract_address}.json'
    
    current_status = blockchain_service.get_current_status(contract_address)
    status_name = STATUS_NAMES.get(current_status, 'UNKNOWN')
    current_timestamp = int(time.time())

    if current_status < STATUS_REVEAL:
        return AnalyticsResponse(
            meta=AnalyticsMeta(
                contract_status=current_status,
                status_name=status_name,
                timestamp=current_timestamp
            ),
            data=None,
            message='Analytics will be available after Reveal phase starts.'
        )

    cached_data = None
    cache_is_valid = False

    if file_path.exists():
        try:
            with open(file_path, 'r') as f:
                cached_data = json.load(f)
            
            cached_object = AnalyticsResponse.model_validate(cached_data)
            cached_status = cached_object.meta.contract_status
            cached_time = cached_object.meta.timestamp

            if current_status == STATUS_CLOSED and cached_status == STATUS_CLOSED:
                cache_is_valid = True
                print(f'[CACHE HIT] Serving finalized report for {contract_address}')
            elif current_status == STATUS_REVEAL and current_timestamp - cached_time < 10:
                cache_is_valid = True
                print(f'[CACHE HIT] Serving fresh live data for {contract_address}')
            
        except Exception as e:
            print(f'[CACHE ERROR] Corrupted file: {e}')
            cache_is_valid = False

    if cache_is_valid:
        return cached_data

    print(f'[GENERATING] Running ML pipeline for {contract_address}...')
    raw_votes = blockchain_service.fetch_all_votes(contract_address)
    candidates_data = blockchain_service.fetch_candidates(contract_address)
    ml_data_object = analytics_service.run_pipeline(raw_votes, candidates_data)
    
    meta_object = AnalyticsMeta(
        contract_status=current_status,
        status_name=status_name,
        timestamp=current_timestamp
    )
    response_object = AnalyticsResponse(
        meta=meta_object,
        data=ml_data_object,
        message='Data successfully analyzed and updated.'
    )
    
    response_dict = response_object.model_dump(mode='json')
    with open(file_path, 'w') as f:
        json.dump(response_dict, f, indent=2)
    
    return response_object