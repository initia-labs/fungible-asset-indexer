import requests
import json
from eth_abi import encode
from eth_utils import to_hex


# JSON-RPC endpoint
url = "https://jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz"

# Address to query
address = "0x5da4e32E2fF3136b0dBdc9DbCc4734B16918992A"

# Token contract address
token_address = "0x4badfb501ab304ff11217c44702bb9e9732e7cf4"

# Encode the function call to balanceOf
function_signature = "balanceOf(address)"
encoded_function = encode(['address'], [address])
data = "0x70a08231" + to_hex(encoded_function)[2:]  # 0x70a08231 is the function signature for balanceOf

# JSON-RPC request payload
payload = {
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
        "to": token_address,
        "data": data
    }, "latest"],
    "id": 1
}

# Make the request
response = requests.post(url, json=payload)

# Parse the response
if response.status_code == 200:
    result = response.json()
    balance_wei = int(result['result'], 16)  # Convert hex to decimal
    balance_token = balance_wei / 1e18  # Convert wei to token units (assuming 18 decimals)
    print(f"Balance of {address}: {balance_token} tokens")
else:
    print("Failed to retrieve balance data")