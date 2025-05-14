export interface DepositEvent {
  store_addr: string
  metadata_addr: string
  amount: string
}

export interface WithdrawEvent {
  store_addr: string
  metadata_addr: string
  amount: number
}

export interface PrimaryStoreCreatedEvent {
  owner_addr: string
  store_addr: string
  metadata_addr: string
}
