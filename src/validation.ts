export function getEnv(key: string, defaultVal?: string): string {
  const val = process.env[key]
  if (!val) {
    if (defaultVal) {
      return defaultVal
    }
    throw Error(`${key} is not given`)
  } else {
    return val
  }
}
