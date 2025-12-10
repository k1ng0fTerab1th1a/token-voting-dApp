from app.config import get_contract

class BlockchainService:
    def get_current_status(self, contract_address: str) -> int:
        try:
            contract = get_contract(contract_address)
            return contract.functions.getCurrentStatus().call()
        except Exception as e:
            print(f'Error fetching status: {e}')
            return 0

    def fetch_candidates(self, contract_address: str):
        try:
            contract = get_contract(contract_address)
            candidates_structs = contract.functions.getCandidates().call()
            
            result = []
            for c in candidates_structs:
                result.append({
                    'name': c[0],
                    'voteCount': c[1]
                })
            return result
            
        except Exception as e:
            print(f'Error fetching candidates: {e}')
            return []

    def fetch_all_votes(self, contract_address: str):
        contract = get_contract(contract_address)
        events = contract.events.VoteRevealed.get_logs(from_block=0)
        
        raw_data = []
        
        start_reveal_time = contract.functions.startRevealTimestamp().call()

        for event in events:
            args = event['args']

            reaction_time = args['timestamp'] - start_reveal_time
            vote_record = {
                'voter': args['voter'],
                'vector': args['distribution'],
                'timestamp': args['timestamp'],
                'reaction_time': reaction_time
            }
            raw_data.append(vote_record)
            
        return raw_data

blockchain_service = BlockchainService()