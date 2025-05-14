import { ScrappedBlock } from './rpc'

export interface ParsedEvent {
  type: string
  attributes: Record<string, string>
}

export function parseEvents(block: ScrappedBlock): ParsedEvent[] {
  const events: ParsedEvent[] = []
  for (const info of block.infos) {
    for (const event of info.events) {
      events.push({
        type: event.type,
        attributes: event.attributes.reduce(
          (obj, attr) => {
            obj[attr.key] = attr.value
            return obj
          },
          {} as Record<string, string>
        ),
      })
    }
  }

  for (const event of block.finalizeEvents) {
    events.push({
      type: event.type,
      attributes: event.attributes.reduce(
        (obj, attr) => {
          obj[attr.key] = attr.value
          return obj
        },
        {} as Record<string, string>
      ),
    })
  }

  return events
}
