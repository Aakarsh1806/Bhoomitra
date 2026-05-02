type Listener = (payload: any) => void

const listeners: Listener[] = []

export function subscribe(listener: Listener) {
  listeners.push(listener)
}

export function publish(event: any) {
  listeners.forEach(listener => listener(event))
}