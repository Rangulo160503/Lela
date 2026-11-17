type Listener = (event: string) => void

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publish(event: string): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // No tumbar el servidor por un cliente SSE fallido.
    }
  }
}
