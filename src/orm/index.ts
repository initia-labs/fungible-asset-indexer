import { DataSource } from 'typeorm'
import { options } from './ormconfig'

export * from './entities'
export const dataSource = new DataSource(options[0])
export const readOnlyDataSource = new DataSource(options[1])
export async function initConnection(): Promise<void> {
  await dataSource.initialize()
}

export async function finalizeConnection(): Promise<void> {
  await dataSource.destroy()
}
