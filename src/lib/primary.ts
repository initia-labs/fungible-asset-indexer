import { bcs } from '@initia/initia.js'
import * as crypto from 'crypto'

export function getPrimaryStore(owner: string, metadata: string): string {
  const bytes = bcs.address().serialize(owner).toBytes()
  const metadataBytes = bcs.address().serialize(metadata).toBytes()
  const combinedBytes = Uint8Array.from([...bytes, ...metadataBytes, 0xfc])

  const hash = crypto.createHash('SHA3-256')
  hash.update(combinedBytes)
  const hashResult = hash.digest('hex')
  return bcs
    .address()
    .fromHex(hashResult)
    .replace(/^0x0+|^0x|^0+(?!x)/, '')
}
