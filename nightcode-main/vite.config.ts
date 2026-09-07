import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { WebSocketServer, WebSocket } from 'ws'
import { requestAiCompletion } from './server/services/ai'

const editableFiles = ['src/App.tsx', 'src/styles.css', 'package.json', 'vite.config.ts', 'index.html']
const fileWriteQueues = new Map<string, Promise<void>>()
const statsPath = path.resolve('server/data/stats.json')
const snippetsPath = path.resolve('server/data/snippets.json')
const themesPath = path.resolve('server/data/themes.json')

const languageFor = (filePath: string) => {
  if (filePath.endsWith('.tsx')) return 'typescript'
  if (filePath.endsWith('.ts')) return 'typescript'
  if (filePath.endsWith('.css')) return 'css'
  if (filePath.endsWith('.json')) return 'json'
  if (filePath.endsWith('.html')) return 'html'
  if (filePath.endsWith('.js')) return 'javascript'
  if (filePath.endsWith('.py')) return 'python'
  if (filePath.endsWith('.c')) return 'c'
  if (filePath.endsWith('.cpp')) return 'cpp'
  if (filePath.endsWith('.java')) return 'java'
  if (filePath.endsWith('.cs')) return 'csharp'
  if (filePath.endsWith('.go')) return 'go'
  if (filePath.endsWith('.rs')) return 'rust'
  if (filePath.endsWith('.php')) return 'php'
  if (filePath.endsWith('.rb')) return 'ruby'
  return 'plaintext'
}

const readRequestBody = (request: { on: Function }) => new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = []
  request.on('data', (chunk: Buffer) => chunks.push(chunk))
  request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  request.on('error', reject)
})

const runProcess = (command: string, args: string[], cwd: string) => new Promise<{ code: number; output: string }>((resolve) => {
  execFile(command, args, { cwd, timeout: 5000, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, output: `${stdout}${stderr}`.trim() }))
})

type CollaborationClient = { socket: WebSocket; id: string; name: string }
type StatsEvent = { timestamp: string; path: string; language: string; charactersChanged: number }

let statsWriteQueue = Promise.resolve()
const recordStatsEvent = (event: StatsEvent) => {
  const write = statsWriteQueue.then(async () => {
    const stored = JSON.parse(await fs.readFile(statsPath, 'utf8')) as { events: StatsEvent[] }
    stored.events.push(event)
    await fs.writeFile(statsPath, JSON.stringify(stored, null, 2), 'utf8')
  })
  statsWriteQueue = write.catch(() => undefined)
  return write
}

const changedCharacterCount = (previous: string, next: string) => {
  const sharedLength = Math.min(previous.length, next.length)
  let changed = Math.abs(previous.length - next.length)
  for (let index = 0; index < sharedLength; index += 1) {
    if (previous[index] !== next[index]) changed += 1
  }
  return changed
}

const apiPlugin = () => ({
  name: 'nightcode-local-api',
  configureServer(server: { middlewares: { use: Function }; httpServer?: { on: Function } }) {
    const clients = new Set<CollaborationClient>()
    const collaborationServer = new WebSocketServer({ noServer: true })
    collaborationServer.on('connection', (socket: WebSocket) => {
      const client = { socket, id: randomUUID(), name: 'Guest' }
      clients.add(client)
      const broadcastPresence = () => {
        const message = JSON.stringify({ type: 'presence', participants: clients.size, names: Array.from(clients, (item) => item.name) })
        clients.forEach(({ socket: peer }) => { if (peer.readyState === WebSocket.OPEN) peer.send(message) })
      }
      broadcastPresence()
      socket.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString()) as { type?: string; path?: string; content?: string; name?: string }
          if (message.type === 'join' && message.name?.trim()) { client.name = message.name.trim().slice(0, 24); broadcastPresence(); return }
          if (message.type !== 'file-change' || !message.path || typeof message.content !== 'string') return
          if (!editableFiles.includes(message.path)) return
          const outgoing = JSON.stringify({ type: 'file-change', path: message.path, content: message.content, clientId: client.id })
          clients.forEach(({ socket: peer }) => { if (peer !== socket && peer.readyState === WebSocket.OPEN) peer.send(outgoing) })
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid collaboration message.' }))
        }
      })
      socket.on('close', () => { clients.delete(client); broadcastPresence() })
    })
    server.httpServer?.on('upgrade', (request: { url?: string }, socket: { destroy: Function }, head: Buffer) => {
      if (!request.url?.startsWith('/api/collaboration')) return
      collaborationServer.handleUpgrade(request as never, socket as never, head, (client) => collaborationServer.emit('connection', client, request))
    })
    server.middlewares.use('/api/files', async (request: { method?: string; on?: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'GET') {
        if (request.method !== 'POST') return next()
        try {
          const body = JSON.parse(await readRequestBody(request as { on: Function })) as { name?: string; content?: string }
          const name = body.name?.trim() ?? ''
          if (!/^([A-Za-z0-9_-]+)\.(tsx|ts|js|py|c|cpp|css|json|html|java|cs|go|rs|php|rb)$/.test(name)) {
            response.statusCode = 400
            response.end(JSON.stringify({ error: 'Choose a valid project file name.' }))
            return
          }
          const filePath = `src/${name}`
          if (editableFiles.includes(filePath)) {
            response.statusCode = 409
            response.end(JSON.stringify({ error: 'That file already exists.' }))
            return
          }
          await fs.writeFile(path.resolve(filePath), body.content ?? '', 'utf8')
          editableFiles.push(filePath)
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ name, path: filePath, language: languageFor(filePath), icon: 'code', content: body.content ?? '' }))
        } catch {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'Unable to create file.' }))
        }
        return
      }
      const files = await Promise.all(editableFiles.map(async (filePath) => {
        try {
          return { name: path.basename(filePath), path: filePath, language: languageFor(filePath), icon: filePath.endsWith('.json') ? 'json' : filePath.endsWith('.md') ? 'text' : 'code', content: await fs.readFile(path.resolve(filePath), 'utf8') }
        } catch {
          return null
        }
      }))
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(files.filter(Boolean)))
    })
    server.middlewares.use('/api/stats', async (request: { method?: string }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'GET') return next()
      try {
        const stored = JSON.parse(await fs.readFile(statsPath, 'utf8')) as { events: StatsEvent[] }
        const byLanguage: Record<string, number> = {}
        const byDate = new Map<string, number>()
        stored.events.forEach((event) => {
          byLanguage[event.language] = (byLanguage[event.language] || 0) + event.charactersChanged
          const date = event.timestamp.slice(0, 10)
          byDate.set(date, (byDate.get(date) || 0) + 1)
        })
        const recentActivity = Array.from(byDate.entries()).sort(([left], [right]) => left.localeCompare(right)).slice(-14).map(([date, edits]) => ({ date, edits }))
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ totalEdits: stored.events.length, charactersChanged: stored.events.reduce((sum, event) => sum + event.charactersChanged, 0), activeDays: byDate.size, byLanguage, recentActivity }))
      } catch {
        response.statusCode = 500
        response.end(JSON.stringify({ error: 'Unable to read coding statistics.' }))
      }
    })
    server.middlewares.use('/api/snippets', async (request: { method?: string; url?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'GET') return next()
      try {
        const snippets = JSON.parse(await fs.readFile(snippetsPath, 'utf8')) as Array<{ id: string; title: string; author: string; code: string; tag: string; reactors: string[] }>
        const viewer = new URL(request.url ?? '', 'http://nightcode.local').searchParams.get('viewer') || ''
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(snippets.map(({ reactors, ...snippet }) => ({ ...snippet, reactionCount: reactors.length, reacted: reactors.includes(viewer) }))))
      } catch {
        response.statusCode = 500
        response.end(JSON.stringify({ error: 'Unable to load snippets.' }))
      }
    })
    server.middlewares.use('/api/snippets/', async (request: { method?: string; url?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'POST') return next()
      try {
        const match = request.url?.match(/^\/([^/]+)\/reaction(?:\?.*)?$/)
        if (!match) return next()
        const body = JSON.parse(await readRequestBody(request)) as { viewerId?: string }
        if (!body.viewerId?.trim()) { response.statusCode = 400; response.end(JSON.stringify({ error: 'A viewer id is required.' })); return }
        const snippets = JSON.parse(await fs.readFile(snippetsPath, 'utf8')) as Array<{ id: string; title: string; author: string; code: string; tag: string; reactors: string[] }>
        const snippet = snippets.find((item) => item.id === decodeURIComponent(match[1]))
        if (!snippet) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Snippet not found.' })); return }
        const reactorIndex = snippet.reactors.indexOf(body.viewerId)
        if (reactorIndex >= 0) snippet.reactors.splice(reactorIndex, 1)
        else snippet.reactors.push(body.viewerId)
        await fs.writeFile(snippetsPath, JSON.stringify(snippets, null, 2), 'utf8')
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ ...snippet, reactionCount: snippet.reactors.length, reacted: reactorIndex < 0 }))
      } catch {
        response.statusCode = 400
        response.end(JSON.stringify({ error: 'Unable to update reaction.' }))
      }
    })
    server.middlewares.use('/api/themes', async (request: { method?: string; url?: string }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'GET') return next()
      try {
        const themes = JSON.parse(await fs.readFile(themesPath, 'utf8')) as Array<{ id: string; name: string; author: string; description: string; accent: string; likes: number; installers: string[] }>
        const viewer = new URL(request.url ?? '', 'http://nightcode.local').searchParams.get('viewer') || ''
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(themes.map(({ installers, ...theme }) => ({ ...theme, installed: installers.includes(viewer) }))))
      } catch {
        response.statusCode = 500
        response.end(JSON.stringify({ error: 'Unable to load themes.' }))
      }
    })
    server.middlewares.use('/api/themes/', async (request: { method?: string; url?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'POST') return next()
      try {
        const match = request.url?.match(/^\/([^/]+)\/install(?:\?.*)?$/)
        if (!match) return next()
        const body = JSON.parse(await readRequestBody(request)) as { viewerId?: string }
        if (!body.viewerId?.trim()) { response.statusCode = 400; response.end(JSON.stringify({ error: 'A viewer id is required.' })); return }
        const themes = JSON.parse(await fs.readFile(themesPath, 'utf8')) as Array<{ id: string; name: string; author: string; description: string; accent: string; likes: number; installers: string[] }>
        const theme = themes.find((item) => item.id === decodeURIComponent(match[1]))
        if (!theme) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Theme not found.' })); return }
        const installerIndex = theme.installers.indexOf(body.viewerId)
        if (installerIndex >= 0) theme.installers.splice(installerIndex, 1)
        else theme.installers.push(body.viewerId)
        await fs.writeFile(themesPath, JSON.stringify(themes, null, 2), 'utf8')
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ ...theme, installed: installerIndex < 0 }))
      } catch {
        response.statusCode = 400
        response.end(JSON.stringify({ error: 'Unable to install theme.' }))
      }
    })
    server.middlewares.use('/api/file', async (request: { method?: string; url?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'PUT') return next()
      const requestedPath = new URL(request.url ?? '', 'http://nightcode.local').searchParams.get('path')
      if (!requestedPath || !editableFiles.includes(requestedPath)) {
        response.statusCode = 400
        response.end('File is not editable')
        return
      }
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', async () => {
        const content = Buffer.concat(chunks).toString('utf8')
        const previousWrite = fileWriteQueues.get(requestedPath) ?? Promise.resolve()
        const write = previousWrite.then(async () => {
          const previousContent = await fs.readFile(path.resolve(requestedPath), 'utf8').catch(() => '')
          await fs.writeFile(path.resolve(requestedPath), content, 'utf8')
          await recordStatsEvent({ timestamp: new Date().toISOString(), path: requestedPath, language: languageFor(requestedPath), charactersChanged: changedCharacterCount(previousContent, content) })
        })
        fileWriteQueues.set(requestedPath, write.then(() => undefined, () => undefined))
        try {
          await write
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ ok: true, path: requestedPath }))
        } catch {
          response.statusCode = 500
          response.end(JSON.stringify({ error: 'Save failed.' }))
        }
      })
    })
    server.middlewares.use('/api/git/status', async (request: { method?: string }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'GET') return next()
      try {
        const [branch, porcelain] = await Promise.all([
          runProcess('git', ['branch', '--show-current'], process.cwd()),
          runProcess('git', ['status', '--short'], process.cwd()),
        ])
        const changes = porcelain.output ? porcelain.output.split('\n').filter(Boolean).map((line) => ({ index: line.slice(0, 1), worktree: line.slice(1, 2), path: line.slice(3) })) : []
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ branch: branch.output || 'detached', clean: changes.length === 0, changes }))
      } catch (error) {
        response.statusCode = 500
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to read Git status.' }))
      }
    })
    server.middlewares.use('/api/build', (request: { method?: string }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'POST') return next()
      const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build']
      execFile(command, args, { cwd: process.cwd() }, (error, stdout, stderr) => {
        response.setHeader('Content-Type', 'application/json')
        if (error) {
          response.statusCode = 500
          response.end(JSON.stringify({ ok: false, output: `${stdout}${stderr}`.trim() || error.message }))
          return
        }
        response.end(JSON.stringify({ ok: true, output: stdout.trim() }))
      })
    })
    server.middlewares.use('/api/run', async (request: { method?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'POST') return next()
      let temporaryDirectory = ''
      try {
        const body = JSON.parse(await readRequestBody(request)) as { language?: string; content?: string }
        const language = body.language ?? ''
        const content = body.content ?? ''
        if (!content.trim() || content.length > 20000) { response.statusCode = 400; response.end(JSON.stringify({ error: 'Provide between 1 and 20,000 characters of code.' })); return }
        const configuration: Record<string, { file: string; command: string; args: (file: string) => string[] }> = {
          javascript: { file: 'main.js', command: process.execPath, args: (file) => [file] },
          python: { file: 'main.py', command: process.platform === 'win32' ? 'python.exe' : 'python3', args: (file) => [file] },
        }
        if (language === 'c' || language === 'cpp') {
          const compiler = language === 'cpp' ? (process.platform === 'win32' ? 'g++.exe' : 'g++') : (process.platform === 'win32' ? 'gcc.exe' : 'gcc')
          temporaryDirectory = await fs.mkdtemp(path.join(process.cwd(), '.nightcode-run-'))
          const sourceFile = path.join(temporaryDirectory, language === 'c' ? 'main.c' : 'main.cpp')
          const outputFile = path.join(temporaryDirectory, process.platform === 'win32' ? 'main.exe' : 'main')
          await fs.writeFile(sourceFile, content, 'utf8')
          const compilation = await runProcess(compiler, [sourceFile, '-o', outputFile], temporaryDirectory)
          if (compilation.code !== 0) { response.statusCode = 422; response.end(JSON.stringify({ error: compilation.output || 'C compiler is unavailable or compilation failed.' })); return }
          const execution = await runProcess(outputFile, [], temporaryDirectory)
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ ok: execution.code === 0, output: execution.output }))
          return
        }
        const selected = configuration[language]
        if (!selected) { response.statusCode = 422; response.end(JSON.stringify({ error: `Running ${language || 'this language'} is not configured on this machine.` })); return }
        temporaryDirectory = await fs.mkdtemp(path.join(process.cwd(), '.nightcode-run-'))
        const sourceFile = path.join(temporaryDirectory, selected.file)
        await fs.writeFile(sourceFile, content, 'utf8')
        const execution = await runProcess(selected.command, selected.args(sourceFile), temporaryDirectory)
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ ok: execution.code === 0, output: execution.output }))
      } catch (error) {
        response.statusCode = 500
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to run code.' }))
      } finally {
        if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true })
      }
    })
    server.middlewares.use('/api/copilot/chat', async (request: { method?: string; on: Function }, response: { setHeader: Function; end: Function; statusCode: number }, next: Function) => {
      if (request.method !== 'POST') return next()
      try {
        const body = JSON.parse(await readRequestBody(request)) as {
          messages?: Array<{ role: 'user' | 'assistant'; content: string }>
          file?: { name: string; language: string; content: string }
          tone?: 'professional' | 'friendly' | 'unhinged'
        }
        const messages = body.messages?.filter((message) => message.content.trim()).slice(-12) ?? []
        if (!messages.length) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'A prompt is required.' }))
          return
        }
        const fileContext = body.file ? `\n\nActive file: ${body.file.name} (${body.file.language})\n\`\`\`\n${body.file.content.slice(0, 12000)}\n\`\`\`` : ''
        const systemMessage = `You are the coding assistant inside Nightcode. Give precise, practical answers. Keep the response concise and use Markdown when useful. The user's requested response vibe is ${body.tone || 'friendly'}.${fileContext}`
        const message = await requestAiCompletion({ messages: [{ role: 'system', content: systemMessage }, ...messages] })
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ message }))
      } catch (error) {
        response.statusCode = error instanceof SyntaxError ? 400 : 502
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Copilot request failed.' }))
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
