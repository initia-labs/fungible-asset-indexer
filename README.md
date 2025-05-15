# Fungible Asset Indexer

A service that indexes token balances on the Initia L1.

## Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Access to Initia archival node

## Quick Start

### 1. Installation 

```bash
npm install
```

### 2. Environment Setup

Create a `.env` file in the project root with the following configuration:

#### Database Settings
| Variable | Description | Default Value |
|----------|-------------|---------------|
| DBHOST | Database host | `localhost` |
| DBHOSTRO | Database host (read-only) | `localhost` |
| DBUSERNAME | Database username | `postgres` |
| DBPASS | Database password | `password` |
| DATABASE | Database name | `fungible_assets` |
| DBPORT | Database port | `5432` |

#### Server Settings
| Variable | Description | Default Value |
|----------|-------------|---------------|
| PORT | Server port | `5000` |
| RPC_URL | Initia RPC endpoint | `https://rpc.testnet.initia.xyz` |
| REST_URL | Initia REST endpoint | `https://rest.testnet.initia.xyz` |

#### Indexer Settings
| Variable | Description | Default Value |
|----------|-------------|---------------|
| MONITOR_INTERVAL | Block monitoring interval in ms | `1000` |
| COOLING_DURATION | Operation cooling period in ms | `100` |
| SNAPSHOT_INTERVAL | Snapshot interval in blocks | `100` |

#### Asset Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| FUNGIBLE_ASSETS | JSON array of assets to monitor | [{"denom":"move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1","type":"weight", "start_height": 1847430}]
 |

### Asset Configuration Example

```json
{
  "denom": "move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1",
  "type": "weight",
  "start_height": 1847430 // RECOMMED TO SET HEIGHT THAT CREATION HEIGHT OF ASSET
}
```

#### Configuration Fields

| Field | Description |
|-------|-------------|
| `denom` | Asset denomination identifier |
| `start_height` | Block height to start indexing from |
| `type` | Asset type (see types below) |

#### Asset Types

- `normal`: Standard fungible asset (`0x1::fungible_asset`)
- `stable`: Stable pool LP token (`0x1::stableswap`)
- `weight`: Weighted pool LP token (`0x1::dex`)

### 3. Start Indexer
```bash
npm run start
