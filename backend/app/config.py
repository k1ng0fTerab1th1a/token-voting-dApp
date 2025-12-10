import json
from web3 import Web3
from pathlib import Path

STATUS_PLANNED = 0
STATUS_COMMIT = 1
STATUS_REVEAL = 2
STATUS_CLOSED = 3

GANACHE_URL = 'http://127.0.0.1:7545'
w3 = Web3(Web3.HTTPProvider(GANACHE_URL))

BASE_DIR = Path(__file__).resolve().parent.parent
ABI_PATH = BASE_DIR / 'token_voting.json'

contract_abi = []

if ABI_PATH.exists():
    with open(ABI_PATH, 'r') as f:
        artifact = json.load(f)
        contract_abi = artifact['abi']
else:
    print(f'WARNING: ABI file not found at {ABI_PATH}')

def get_contract(address: str):
    checksum_address = Web3.to_checksum_address(address)
    return w3.eth.contract(address=checksum_address, abi=contract_abi)