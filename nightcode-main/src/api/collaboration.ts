export type CollaborationMessage =
  | { type: 'join'; name: string }
  | { type: 'presence'; participants: number }
  | { type: 'file-change'; path: string; content: string; clientId: string }
  | { type: 'error'; message: string }

export function collaborationUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/collaboration`
}
