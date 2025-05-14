import { DefaultNamingStrategy } from 'typeorm'
import { values, snakeCase } from 'lodash'
import * as entities from './entities'
import * as dotenv from 'dotenv'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { getEnv } from '../validation'
dotenv.config()

class CamelToSnakeNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName: string, userSpecifiedName: string) {
    return userSpecifiedName ? userSpecifiedName : snakeCase(targetName)
  }
  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[]
  ) {
    return snakeCase(
      embeddedPrefixes.concat(customName ? customName : propertyName).join('_')
    )
  }
  columnNameCustomized(customName: string) {
    return customName
  }
  relationName(propertyName: string) {
    return snakeCase(propertyName)
  }
}

const connectionOptions = {
  host: getEnv('DBHOST'),
  port: Number(getEnv('DBPORT')),
  username: getEnv('DBUSERNAME'),
  password: getEnv('DBPASS'),
  database: getEnv('DATABASE'),
}

const connectionOptionsRo = {
  host: getEnv('DBHOSTRO'),
  port: Number(getEnv('DBPORT')),
  username: getEnv('DBUSERNAME'),
  password: getEnv('DBPASS'),
  database: getEnv('DATABASE'),
}

export const options: PostgresConnectionOptions[] = [
  {
    name: 'default',
    type: 'postgres',
    synchronize: true,
    logging: false,
    logger: 'file',
    entities: values(entities),
    migrations: ['src/orm/migrations/*.ts'],
    namingStrategy: new CamelToSnakeNamingStrategy(),
    ...connectionOptions,
  },
  {
    name: 'readOnly',
    type: 'postgres',
    synchronize: false,
    logging: false,
    logger: 'file',
    entities: values(entities),
    migrations: ['src/orm/migrations/*.ts'],
    namingStrategy: new CamelToSnakeNamingStrategy(),
    ...connectionOptionsRo,
  },
]
