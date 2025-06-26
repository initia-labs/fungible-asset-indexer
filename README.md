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
| COOLING_DURATION | Operation cooling period in ms | `10` |
| SNAPSHOT_INTERVAL | Snapshot interval in blocks | `100` |

#### Asset Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| FUNGIBLE_ASSETS | JSON array of assets to monitor | [{"denom":"move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1","type":"weight", "start_height": 1847430}]
 |

### Asset Configuration Example

```json
[{
  "denom": "move/543b35a39cfadad3da3c23249c474455d15efd2f94f849473226dee8a3c7a9e1",
  "type": "weight",
  "start_height": 1847430
},
{
  "denom": "move/443b35a39cfadad3da3c232....",
  "type": "stable",
  "start_height": 2047430
}]
```

#### Configuration Fields

| Field | Description |
|-------|-------------|
| `denom` | Asset denomination identifier |
| `start_height` | Block height to start indexing from |
| `type` | Asset type (see types below) |

> **Note**: Setting `start_height` to a block height before the asset's creation to avoid heavy balance queries

#### Asset Types

- `normal`: Standard fungible asset (`0x1::fungible_asset`)
- `stable`: Stable pool LP token (`0x1::stableswap`)
- `weight`: Weighted pool LP token (`0x1::dex`)

### 3. Start Indexer
```bash
npm run start
```

## Data Models

### Balance Entity
Tracks current account balances at the indexing height.
If indexer is indexing latest block, this table will have recent balances of each accounts.

```typescript
@Entity('balance')
export class BalanceEntity {
  @PrimaryColumn('text')
  storeAddress: string

  @PrimaryColumn('text')
  @Index('balance_denom')
  denom: string

  @Column('text', { default: '' })
  @Index('balance_owner')
  owner: string

  @Column('numeric', { precision: 20, scale: 0 })
  amount: string

  @Column('boolean', { default: true })
  @Index('balance_primary')
  primary: boolean
}
```

### Balance History Entity
Records account balances at each snapshot interval.

```typescript

@Entity('balance_history')
export class BalanceHistoryEntity {
  @PrimaryColumn('bigint')
  @Index('balance_history_height')
  height: number

  @PrimaryColumn('text')
  storeAddress: string

  @PrimaryColumn('text')
  @Index('balance_history_denom')
  denom: string

  @Column('text')
  @Index('balance_history_owner')
  owner: string // owner of primary fungible store

  @Column('numeric', { precision: 20, scale: 0 })
  amount: string
}
```

### Pool Entity
Stores metadata for liquidity pools (stablepool or weighted pool LP tokens).

```typescript
@Entity('pool')
export class PoolEntity {
  @PrimaryColumn('text')
  @Index('pool_denom')
  denom: string

  @PrimaryColumn('bigint')
  @Index('pool_height')
  height: number

  @Column('text')
  type: FungibleAssetType

  @Column('jsonb')
  underlying: Record<string, number>
}
```


docker build -t funassindexer .
#ecr login

docker tag funassindexer:latest 590183983824.dkr.ecr.ap-southeast-1.amazonaws.com/test/api:funassindexer-latest
docker push 590183983824.dkr.ecr.ap-southeast-1.amazonaws.com/test/api:funassindexer-latest

docker tag funassindexer:latest 590183983824.dkr.ecr.ap-southeast-1.amazonaws.com/prod/api:funassindexer-latest
docker push 590183983824.dkr.ecr.ap-southeast-1.amazonaws.com/prod/api:funassindexer-latest
