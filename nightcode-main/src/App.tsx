import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { sendCopilotMessage, type CopilotMessage } from './api/copilot'
import { collaborationUrl, type CollaborationMessage } from './api/collaboration'
import { getCodingStats, type CodingStats } from './api/stats'
import { getSnippets, toggleSnippetReaction, type Snippet } from './api/snippets'
import { getThemes, toggleTheme, type Theme } from './api/themes'
import {
  Braces, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDot, Code2,
  Command, Copy, FileCode2, FileJson, FileText, FolderOpen,
  GitBranch, GitCommitHorizontal, LayoutGrid, Maximize2,
  CloudLightning, MoreHorizontal, PanelBottom, Play, Plus, Radio, Search, Settings2,
  Sparkles, Timer, Wind, X, Zap
} from 'lucide-react'

type Accent = 'violet' | 'lime' | 'pink' | 'cyan'
type AmbientTheme = 'classic' | 'sakura' | 'storm'
type AmbientSound = 'theme' | 'lofi' | 'off'
type GitStatus = { branch: string; clean: boolean; changes: Array<{ index: string; worktree: string; path: string }> }
type FileItem = { name: string; path: string; language: string; icon: 'code' | 'json' | 'text'; content: string }
const supportedLanguages = [{ label: 'TypeScript React', extension: 'tsx', language: 'typescript' }, { label: 'JavaScript', extension: 'js', language: 'javascript' }, { label: 'Python', extension: 'py', language: 'python' }, { label: 'C', extension: 'c', language: 'c' }, { label: 'C++', extension: 'cpp', language: 'cpp' }, { label: 'Java', extension: 'java', language: 'java' }, { label: 'C#', extension: 'cs', language: 'csharp' }, { label: 'Go', extension: 'go', language: 'go' }, { label: 'Rust', extension: 'rs', language: 'rust' }, { label: 'PHP', extension: 'php', language: 'php' }, { label: 'Ruby', extension: 'rb', language: 'ruby' }, { label: 'HTML', extension: 'html', language: 'html' }, { label: 'CSS', extension: 'css', language: 'css' }, { label: 'JSON', extension: 'json', language: 'json' }] as const

type Store = {
  activeFile: string
  openFiles: string[]
  files: FileItem[]
  accent: Accent
  sidebarOpen: boolean
  setActiveFile: (name: string) => void
  setFiles: (files: FileItem[]) => void
  updateFile: (name: string, content: string) => void
  closeFile: (name: string) => void
  openFile: (name: string) => void
  setAccent: (accent: Accent) => void
  toggleSidebar: () => void
}

const fallbackFiles: FileItem[] = [
  { name: 'App.tsx', path: 'src/App.tsx', language: 'typescript', icon: 'code', content: 'Unable to reach the local workspace API.' },
  { name: 'package.json', path: 'package.json', language: 'json', icon: 'json', content: '{}' },
]

const useNightcode = create<Store>((set) => ({
  activeFile: 'App.tsx',
  openFiles: ['App.tsx', 'package.json'],
  files: fallbackFiles,
  accent: 'violet',
  sidebarOpen: true,
  setActiveFile: (activeFile) => set({ activeFile }),
  setFiles: (files) => set({ files }),
  updateFile: (name, content) => set((state) => ({ files: state.files.map((file) => file.name === name ? { ...file, content } : file) })),
  closeFile: (name) => set((state) => {
    const next = state.openFiles.filter((file) => file !== name)
    return { openFiles: next, activeFile: state.activeFile === name ? (next[0] ?? '') : state.activeFile }
  }),
  openFile: (name) => set((state) => ({ openFiles: state.openFiles.includes(name) ? state.openFiles : [...state.openFiles, name], activeFile: name })),
  setAccent: (accent) => set({ accent }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))

const iconForFile = (file: FileItem) => file.icon === 'json' ? <FileJson size={14} /> : file.icon === 'text' ? <FileText size={14} /> : <FileCode2 size={14} />

function CodingStats() {
  const [stats, setStats] = useState<CodingStats | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getCodingStats().then(setStats).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load stats.')) }, [])
  if (error) return <div className="feature-view"><div className="feature-kicker"><Timer size={15} /> CODING STATS</div><div className="copilot-error">{error}</div></div>
  if (!stats) return <div className="feature-view"><div className="feature-kicker"><Timer size={15} /> CODING STATS</div><span>Loading activity...</span></div>
  const languages = Object.entries(stats.byLanguage).sort(([, left], [, right]) => right - left).slice(0, 4)
  const peak = Math.max(...stats.recentActivity.map((item) => item.edits), 1)
  return <div className="feature-view stats-view"><div className="feature-kicker"><Timer size={15} /> CODING STATS</div><strong>{stats.totalEdits.toLocaleString()} edits</strong><span>{stats.activeDays} active days · {stats.charactersChanged.toLocaleString()} characters changed</span><div className="stats-bars">{languages.length ? languages.map(([language, characters]) => <div key={language}><span>{language}</span><b style={{ width: `${Math.max(8, (characters / languages[0][1]) * 100)}%` }}></b><small>{characters.toLocaleString()}</small></div>) : <span>No edits recorded yet.</span>}</div><div className="activity-sparkline">{stats.recentActivity.map((item) => <i key={item.date} title={`${item.date}: ${item.edits} edits`} style={{ height: `${Math.max(8, (item.edits / peak) * 100)}%` }}></i>)}</div></div>
}

function ThemeShop({ viewerId, setAccent }: { viewerId: string; setAccent: (accent: Accent) => void }) {
  const [themes, setThemes] = useState<Theme[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  useEffect(() => { getThemes(viewerId).then(setThemes).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load themes.')) }, [viewerId])
  const applyTheme = async (theme: Theme) => {
    if (pending) return
    setPending(theme.id)
    try {
      const installed = await toggleTheme(theme.id, viewerId)
      setThemes((items) => items.map((item) => item.id === installed.id ? installed : item))
      setAccent(installed.accent)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to install theme.') } finally { setPending('') }
  }
  return <div className="feature-view theme-view"><div className="feature-kicker"><Sparkles size={15} /> THEME SHOP</div>{error && <div className="copilot-error">{error}</div>}{themes.length ? themes.map((theme) => <div className="theme-card" key={theme.id}><div className={`theme-preview ${theme.accent}-preview`}><span></span><span></span><span></span></div><div><b>{theme.name}</b><small>by @{theme.author} · {theme.likes.toLocaleString()} likes</small><small>{theme.description}</small></div><button disabled={pending === theme.id} aria-label={`${theme.installed ? 'Uninstall' : 'Install'} ${theme.name}`} onClick={() => void applyTheme(theme)}>{pending === theme.id ? <Timer size={14} /> : theme.installed ? <CircleCheck size={14} /> : <Plus size={14} />}</button></div>) : !error && <span>Loading themes...</span>}</div>
}

function ActivityBar({ activeView, setActiveView, onSettings }: { activeView: string; setActiveView: (view: string) => void; onSettings: () => void }) {
  const items = [
    { id: 'explorer', label: 'Explorer', icon: <LayoutGrid size={20} /> },
    { id: 'search', label: 'Snippets', icon: <Search size={20} /> },
    { id: 'source', label: 'Source control', icon: <GitBranch size={20} /> },
    { id: 'run', label: 'Coding stats', icon: <Play size={20} /> },
    { id: 'extensions', label: 'Extensions', icon: <Braces size={20} /> },
  ]
  return <aside className="activity-bar">
    <div className="brand-mark"><Code2 size={22} /><span>NC</span></div>
    <nav>{items.map((item) => <button key={item.id} className={activeView === item.id ? 'activity-button active' : 'activity-button'} onClick={() => setActiveView(item.id)} title={item.label}>{item.icon}</button>)}</nav>
    <div className="activity-bottom"><button className="activity-button" title="Settings" onClick={onSettings}><Settings2 size={19} /></button><div className="avatar small">M</div></div>
  </aside>
}

function FileTree({ activeView, collaboration, onCloseMobile }: { activeView: string; collaboration: { connected: boolean; participants: number; names: string[] }; onCloseMobile: () => void }) {
  const { activeFile, openFile, setAccent, files } = useNightcode()
  const [expanded, setExpanded] = useState(true)
  const [query, setQuery] = useState('')
  const [snippetIndex, setSnippetIndex] = useState(0)
  const [liked, setLiked] = useState(false)
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [snippetError, setSnippetError] = useState('')
  const [reactionPending, setReactionPending] = useState(false)
  const [viewerId] = useState(() => {
    const key = 'nightcode-viewer-id'
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  })
  const [installed, setInstalled] = useState(false)
  const filtered = files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => { getSnippets(viewerId).then(setSnippets).catch((requestError) => setSnippetError(requestError instanceof Error ? requestError.message : 'Unable to load snippets.')) }, [viewerId])
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target as Element
      const reaction = target.closest('.review-line button') as HTMLButtonElement | null
      if (reaction) {
        reaction.parentElement?.querySelectorAll('button').forEach((button) => { if (button !== reaction) button.classList.remove('liked') })
        reaction.classList.toggle('liked')
      }
      const invite = target.closest('.invite-button') as HTMLButtonElement | null
      if (invite && !invite.dataset.sent) {
        invite.dataset.sent = 'true'
        invite.textContent = 'Invite sent'
      }
    }
    window.addEventListener('click', listener)
    return () => window.removeEventListener('click', listener)
  }, [])
  const snippet = snippets[snippetIndex] ?? { id: '', title: snippetError ? 'Snippet feed unavailable' : 'Loading snippets...', author: '', code: '', tag: '', reactionCount: 0, reacted: false }
  const reactToSnippet = async () => {
    if (!snippet || reactionPending) return
    setReactionPending(true)
    try {
      const updated = await toggleSnippetReaction(snippet.id, viewerId)
      setSnippets((items) => items.map((item) => item.id === updated.id ? updated : item))
      setLiked(updated.reacted)
    } catch (requestError) { setSnippetError(requestError instanceof Error ? requestError.message : 'Unable to update reaction.') } finally { setReactionPending(false) }
  }
  if (activeView === 'extensions') return <aside className="sidebar"><div className="sidebar-title"><span>EXTENSIONS</span><MoreHorizontal size={17} /></div><ThemeShop viewerId={viewerId} setAccent={setAccent} /></aside>
  if (activeView === 'search') return <aside className="sidebar"><div className="sidebar-title"><span>SEARCH</span><MoreHorizontal size={17} /></div><div className="feature-view snippet-view"><div className="feature-kicker"><Sparkles size={15} /> SNIPPET FEED</div>{snippetError && <div className="copilot-error">{snippetError}</div>}{snippet ? <><strong>{snippet.title}</strong><span className="feature-author">by {snippet.author} · {snippet.tag}</span><code>{snippet.code}</code><div className="feature-actions"><button disabled={reactionPending} className={snippet.reacted ? 'liked' : ''} onClick={() => void reactToSnippet()}>🔥 {snippet.reacted ? 'liked' : 'vibe it'} · {snippet.reactionCount}</button><button disabled={!snippets.length} onClick={() => setSnippetIndex((snippetIndex + 1) % snippets.length)}>next tip <ChevronRight size={13} /></button></div><span className="feed-count">{snippetIndex + 1} / {snippets.length} · persisted reactions</span></> : !snippetError && <span>Loading snippets...</span>}</div></aside>
  if (activeView === 'run') return <aside className="sidebar"><div className="sidebar-title"><span>CODING STATS</span><MoreHorizontal size={17} /></div><CodingStats /></aside>
  return <aside className="sidebar">
    <div className="sidebar-title"><span>{activeView === 'explorer' ? 'EXPLORER' : activeView.toUpperCase()}</span>{activeView === 'source' && <small className={collaboration.connected ? 'collaboration-online' : 'collaboration-offline'}>{collaboration.connected ? `${collaboration.participants} CONNECTED` : 'OFFLINE'}</small>}<button className="mobile-sidebar-close" aria-label="Close project panel" onClick={onCloseMobile}><X size={16} /></button><MoreHorizontal size={17} /></div>
    {activeView === 'explorer' ? <>
      <div className="file-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files" /></div>
      <button className="root-folder" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<FolderOpen size={15} className="folder-icon" /> nightcode-project</button>
      {expanded && <div className="file-list">{filtered.map((file) => <button key={file.name} className={activeFile === file.name ? 'file-row active' : 'file-row'} onClick={() => openFile(file.name)}>{iconForFile(file)}<span>{file.name}</span>{file.name === 'App.tsx' && <CircleDot size={10} className="dirty" />}</button>)}</div>}
      <div className="sidebar-section"><span>OUTLINE</span><ChevronRight size={14} /></div>
      <div className="outline-empty">Open a file to see its shape.</div>
    </> : activeView === 'search' ? <div className="feature-view snippet-view"><div className="feature-kicker"><Sparkles size={15} /> SNIPPET FEED</div><strong>{snippet.title}</strong><span className="feature-author">by {snippet.author} · {snippet.tag}</span><code>{snippet.code}</code><div className="feature-actions"><button className={liked ? 'liked' : ''} onClick={() => setLiked(!liked)}>🔥 {liked ? 'liked' : 'vibe it'}</button><button onClick={() => setSnippetIndex((snippetIndex + 1) % snippets.length)}>next tip <ChevronRight size={13} /></button></div><span className="feed-count">{snippetIndex + 1} / {snippets.length} · swipe the feed</span></div> : activeView === 'source' ? <div className="feature-view squad-view"><div className="feature-kicker"><Radio size={15} /> SQUAD LIVE SHARE <span className="live-pill">LIVE</span></div><strong>shipping the weird thing</strong><div className="squad-avatars"><div className="avatar">M</div><div className="avatar avatar-green">J</div><div className="avatar avatar-pink">A</div><span>+ 2 in the room</span></div><div className="review-line"><span>“this API is kind of gorgeous”</span><div><button onClick={() => setLiked(!liked)}>🔥</button><button>💀</button><button>✅</button></div></div><button className="invite-button" onClick={() => setLiked(true)}><Plus size={13} /> Invite your squad</button></div> : activeView === 'extensions' ? <div className="feature-view theme-view"><div className="feature-kicker"><Sparkles size={15} /> THEME SHOP</div><strong>Community heat</strong><span>Install a new mood for your next commit.</span><div className="theme-card"><div className="theme-preview"><span></span><span></span><span></span></div><div><b>after hours</b><small>by @luna.exe · 4.8k likes</small></div><button onClick={() => { setAccent('pink'); setInstalled(true) }}>{installed ? <CircleCheck size={14} /> : <Plus size={14} />}</button></div><div className="theme-card"><div className="theme-preview lime-preview"><span></span><span></span><span></span></div><div><b>matcha terminal</b><small>by @sora · 2.1k likes</small></div><button onClick={() => { setAccent('lime'); setInstalled(true) }}>{installed ? <CircleCheck size={14} /> : <Plus size={14} />}</button></div><span className="feed-count">{installed ? 'theme installed. extremely your color.' : '2,481 themes made by people with taste'}</span></div> : <div className="view-placeholder"><Sparkles size={19} /><strong>{activeView === 'run' ? 'Ready when you are' : 'Make it yours'}</strong><span>This view is wired for your next move.</span><button>{activeView === 'run' ? 'Run project' : 'Explore'}</button></div>}
  </aside>
}

function CommandPalette({ onClose, onCommand }: { onClose: () => void; onCommand: (command: string) => void }) {
  const { openFiles, setActiveFile, files } = useNightcode()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const commands = ['Open file', 'Save file', 'Run file', 'Toggle focus mode', 'Switch accent color', 'Build project', 'Open Coding Wrapped', ...openFiles]
  const results = commands.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => { setSelectedIndex(0) }, [query])
  const selectResult = () => { const result = results[selectedIndex]; if (result) onCommand(result); onClose() }
  return <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.div className="command-palette" initial={{ y: -15, scale: .98 }} animate={{ y: 0, scale: 1 }} onMouseDown={(event) => event.stopPropagation()}>
    <div className="palette-input"><Command size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex((index) => results.length ? (index + 1) % results.length : 0) } if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex((index) => results.length ? (index - 1 + results.length) % results.length : 0) } if (event.key === 'Enter') { event.preventDefault(); selectResult() } }} placeholder="Search files, commands, settings..." /><kbd>ESC</kbd></div>
    <div className="palette-label">QUICK PICKS</div>
    {results.map((result, index) => <button className={`palette-row ${selectedIndex === index ? 'selected' : ''}`} aria-selected={selectedIndex === index} key={result} onMouseEnter={() => setSelectedIndex(index)} onClick={() => { onCommand(result); onClose() }}><span className="result-icon">{index < 5 ? <Zap size={15} /> : iconForFile(files.find((file) => file.name === result) ?? files[0])}</span><span>{result}</span>{index < 5 && <kbd>{index + 1}</kbd>}</button>)}
    {!results.length && <div className="no-results">No matches. The void remains undefeated.</div>}
    <div className="palette-footer"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>esc</kbd> close</span></div>
  </motion.div></motion.div>
}

function CopilotPanel({ onClose, file }: { onClose: () => void; file: FileItem }) {
  const [tone, setTone] = useState(45)
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const vibe = tone < 35 ? 'professional' : tone > 70 ? 'unhinged' : 'friendly'
  const send = async () => {
    const content = prompt.trim()
    if (!content || loading) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setPrompt('')
    setError('')
    setLoading(true)
    try {
      const answer = await sendCopilotMessage({ messages: nextMessages, tone: vibe, file })
      setMessages([...nextMessages, { role: 'assistant', content: answer }])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Copilot request failed.')
    } finally {
      setLoading(false)
    }
  }
  return <motion.aside className="copilot-panel" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}><div className="panel-heading"><div><Sparkles size={17} /><strong>copilot / <span>sidekick</span></strong></div><button onClick={onClose}><X size={16} /></button></div><div className="copilot-chat"><div className="copilot-message"><div className="ai-orb"><Sparkles size={14} /></div><p>Hey. I’m looking at <span>{file.name}</span>. What are we making less painful today?</p></div>{messages.map((message, index) => message.role === 'user' ? <div className="user-message" key={`${message.role}-${index}`}>{message.content}</div> : <div className="copilot-message" key={`${message.role}-${index}`}><div className="ai-orb"><Sparkles size={14} /></div><p>{message.content}</p></div>)}{loading && <div className="copilot-message"><div className="ai-orb"><Sparkles size={14} /></div><p>Thinking...</p></div>}{error && <div className="copilot-error">{error}</div>}</div><div className="tone-wrap"><div><span>RESPONSE VIBE</span><b>{vibe}</b></div><input type="range" min="0" max="100" value={tone} onChange={(event) => setTone(Number(event.target.value))} /></div><div className="copilot-input"><input value={prompt} disabled={loading} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send() }} placeholder="Ask anything..." /><button disabled={loading || !prompt.trim()} onClick={() => void send()}><Sparkles size={16} /></button></div><div className="copilot-hint">Copilot can make mistakes. You make the final call.</div></motion.aside>
}

function FocusPanel({ onClose }: { onClose: () => void }) {
  const [seconds, setSeconds] = useState(24 * 60 + 38)
  const [paused, setPaused] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (paused) return undefined; const timer = window.setInterval(() => setSeconds((value) => value > 0 ? value - 1 : 25 * 60), 1000); return () => window.clearInterval(timer) }, [paused])
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0'); const remaining = String(seconds % 60).padStart(2, '0')
  return <motion.div className="focus-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="focus-card"><button className="close-focus" onClick={onClose}><X size={18} /></button><div className="focus-eyebrow"><Timer size={16} /> DEEP WORK // 01</div><div className="focus-time">{minutes}:{remaining}</div><p>one thing at a time.</p><div className="sound-row"><div className="album-art"><Radio size={19} /></div><div><b>late night loops</b><span>ambient for shipping</span></div><button aria-label="Copy focus soundtrack" onClick={() => { void navigator.clipboard?.writeText('late night loops'); setCopied(true) }}><Copy size={15} /></button></div><div className="focus-controls"><button aria-label="Subtract five minutes" onClick={() => setSeconds((value) => Math.max(0, value - 300))}>−</button><button aria-label={paused ? 'Resume focus timer' : 'Pause focus timer'} className="pause" onClick={() => setPaused(!paused)}><span></span></button><button aria-label="Add five minutes" onClick={() => setSeconds((value) => value + 300)}>+</button></div>{copied && <span className="focus-copied">copied</span>}<div className="focus-progress"><span></span></div></div></motion.div>
}

function Wrapped({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<CodingStats | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getCodingStats().then(setStats).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load your coding story.')) }, [])
  const languageEntries = stats ? Object.entries(stats.byLanguage).sort(([, left], [, right]) => right - left).slice(0, 4) : []
  const topLanguage = languageEntries[0]?.[0] ?? 'your editor'
  const topCharacters = languageEntries[0]?.[1] ?? 0
  const streak = stats?.recentActivity.reduce((count, item, index, activity) => index === 0 || new Date(`${item.date}T00:00:00`).getTime() - new Date(`${activity[index - 1].date}T00:00:00`).getTime() === 86400000 ? count + 1 : 1, 0) ?? 0
  return <motion.div className="wrapped-modal" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><button onClick={onClose} className="wrapped-close"><X size={18} /></button><div className="wrapped-kicker">NIGHTCODE / YOUR DATA</div>{error ? <><h2>Your story is <em>waiting.</em></h2><div className="copilot-error">{error}</div></> : !stats ? <><h2>Reading your <em>lore...</em></h2><p className="wrapped-footer">collecting recorded editor activity.</p></> : <><h2>Your code has <em>lore.</em></h2><div className="wrapped-stat"><strong>{streak}</strong><span>day activity run<br /><small>{stats.activeDays} active days recorded</small></span></div><div className="wrapped-summary"><b>{stats.totalEdits.toLocaleString()}</b><span>saved edits</span><b>{stats.charactersChanged.toLocaleString()}</b><span>characters changed</span></div><div className="language-bars">{languageEntries.length ? languageEntries.map(([language, characters]) => <div key={language}><span>{language}</span><b style={{ width: `${Math.max(8, (characters / topCharacters) * 100)}%` }}></b><small>{Math.round((characters / stats.charactersChanged) * 100) || 0}%</small></div>) : <span>No saved edits yet.</span>}</div><p className="wrapped-footer">your signature language is {topLanguage}.</p></>}</motion.div>
}

function createAmbientSound(theme: AmbientTheme, sound: AmbientSound) {
  if (sound === 'off') return () => undefined
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return () => undefined
  const context = new AudioContextClass()
  const output = context.createGain()
  output.gain.value = sound === 'lofi' ? 0.12 : 0.16
  output.connect(context.destination)
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1
  const noise = context.createBufferSource()
  noise.buffer = noiseBuffer
  noise.loop = true
  const noiseFilter = context.createBiquadFilter()
  noiseFilter.type = theme === 'storm' ? 'bandpass' : 'lowpass'
  noiseFilter.frequency.value = theme === 'storm' ? 2300 : 700
  noiseFilter.Q.value = theme === 'storm' ? 0.45 : 0.7
  const noiseGain = context.createGain()
  noiseGain.gain.value = theme === 'storm' ? 0.32 : 0.08
  noise.connect(noiseFilter).connect(noiseGain).connect(output)
  noise.start()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = theme === 'storm' ? 900 : 520
  filter.connect(output)
  const oscillator = context.createOscillator()
  oscillator.type = theme === 'storm' ? 'sine' : 'triangle'
  oscillator.frequency.value = theme === 'storm' ? 48 : 112
  const oscillatorGain = context.createGain()
  oscillatorGain.gain.value = theme === 'storm' ? 0.12 : 0.045
  oscillator.connect(filter).connect(oscillatorGain).connect(output)
  oscillator.start()
  const timer = window.setInterval(() => {
    const pulse = context.createOscillator()
    const gain = context.createGain()
    pulse.type = theme === 'storm' ? 'sawtooth' : 'sine'
    pulse.frequency.value = theme === 'storm' ? 35 + Math.random() * 20 : 520 + Math.random() * 220
    gain.gain.setValueAtTime(0.001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(theme === 'storm' ? 0.16 : 0.09, context.currentTime + 0.2)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (theme === 'storm' ? 1.8 : 0.8))
    pulse.connect(gain).connect(output)
    pulse.start()
    pulse.stop(context.currentTime + (theme === 'storm' ? 1.8 : 0.8))
  }, theme === 'storm' ? 4200 : 2600)
  const musicTimer = window.setInterval(() => {
    const notes = theme === 'storm' ? [55, 73.42] : sound === 'lofi' ? [196, 246.94, 293.66] : [261.63, 329.63, 392]
    const note = context.createOscillator()
    const noteGain = context.createGain()
    note.type = theme === 'storm' ? 'sine' : 'triangle'
    note.frequency.value = notes[Math.floor(Math.random() * notes.length)]
    noteGain.gain.setValueAtTime(0.001, context.currentTime)
    noteGain.gain.exponentialRampToValueAtTime(theme === 'storm' ? 0.06 : 0.045, context.currentTime + 0.35)
    noteGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (theme === 'storm' ? 3.5 : 2.2))
    note.connect(noteGain).connect(output)
    note.start()
    note.stop(context.currentTime + (theme === 'storm' ? 3.5 : 2.2))
  }, theme === 'storm' ? 9000 : sound === 'lofi' ? 3500 : 5000)
  void context.resume()
  return () => { window.clearInterval(timer); window.clearInterval(musicTimer); noise.stop(); oscillator.stop(); void context.close() }
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }

function SettingsPanel({ onClose, autosave, minimap, setAutosave, setMinimap, accent, setAccent, ambientTheme, setAmbientTheme, ambientSound, setAmbientSound }: { onClose: () => void; autosave: boolean; minimap: boolean; setAutosave: (enabled: boolean) => void; setMinimap: (enabled: boolean) => void; accent: Accent; setAccent: (accent: Accent) => void; ambientTheme: AmbientTheme; setAmbientTheme: (theme: AmbientTheme) => void; ambientSound: AmbientSound; setAmbientSound: (sound: AmbientSound) => void }) {
  const themes = [{ id: 'sakura' as const, name: 'Sakura Bloom', detail: 'Petals + gentle wind', icon: <Wind size={20} /> }, { id: 'storm' as const, name: 'Midnight Storm', detail: 'Lightning + heavy rain', icon: <CloudLightning size={20} /> }]
  const selectTheme = (theme: AmbientTheme) => { setAmbientTheme(theme); if (theme === 'classic') setAmbientSound('off'); else if (ambientSound === 'off') setAmbientSound('theme') }
  const accents: { id: Accent; name: string }[] = [{ id: 'violet', name: 'Violet' }, { id: 'lime', name: 'Lime' }, { id: 'pink', name: 'Pink' }, { id: 'cyan', name: 'Cyan' }]
  return <motion.div className="settings-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><section className="settings-panel appearance-panel"><div className="panel-heading"><div><strong>Appearance</strong><span>Choose a theme, accent, and ambient sound</span></div><button aria-label="Close settings" onClick={onClose}><X size={16} /></button></div><div className="appearance-themes">{themes.map((theme) => <button key={theme.id} className={`appearance-theme ${ambientTheme === theme.id ? 'selected' : ''} ${theme.id}`} onClick={() => selectTheme(theme.id)}><span className="theme-icon">{theme.icon}</span><strong>{theme.name}</strong><small>{theme.detail}</small></button>)}<button className={`appearance-theme classic ${ambientTheme === 'classic' ? 'selected' : ''}`} onClick={() => selectTheme('classic')}><span className="theme-icon"><Sparkles size={20} /></span><strong>Nightcode classic</strong><small>Original dark workspace</small></button></div><div className="accent-section"><b>Accent colour</b><div className="accent-options">{accents.map((option) => <button key={option.id} className={`accent-option ${option.id} ${accent === option.id ? 'selected' : ''}`} onClick={() => setAccent(option.id)}><span></span>{option.name}</button>)}</div></div><div className="appearance-sound"><div><b>Ambient sound</b><span>{ambientSound === 'lofi' ? 'Lofi mode is playing underneath' : ambientSound === 'theme' ? 'Theme ambience enabled' : 'Sound is muted'}</span></div><div className="sound-options">{(['theme', 'lofi', 'off'] as AmbientSound[]).map((sound) => <button key={sound} className={ambientSound === sound ? 'active' : ''} onClick={() => setAmbientSound(sound)}>{sound === 'theme' ? 'Theme' : sound === 'lofi' ? 'Lofi' : 'Off'}</button>)}</div></div><label><span>Autosave changes</span><input type="checkbox" checked={autosave} onChange={(event) => setAutosave(event.target.checked)} /></label><label><span>Editor minimap</span><input type="checkbox" checked={minimap} onChange={(event) => setMinimap(event.target.checked)} /></label><button className="settings-done" onClick={onClose}>Done</button></section></motion.div>
}

function NewFilePanel({ onClose, onCreate }: { onClose: () => void; onCreate: (extension: string) => void }) {
  return <motion.div className="settings-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><section className="settings-panel new-file-panel"><div className="panel-heading"><strong>new file</strong><button aria-label="Close new file" onClick={onClose}><X size={16} /></button></div><div className="language-options">{supportedLanguages.map((item) => <button key={item.extension} onClick={() => onCreate(item.extension)}>{item.label}<small>.{item.extension}</small></button>)}</div></section></motion.div>
}

function BottomPanel() { const [tab, setTab] = useState('Terminal'); const [collapsed, setCollapsed] = useState(false); const [expanded, setExpanded] = useState(false); return <section className={`bottom-panel ${collapsed ? 'collapsed' : ''} ${expanded ? 'expanded' : ''}`}><div className="bottom-tabs">{['Terminal', 'Problems', 'Output'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setCollapsed(false) }}>{item}{item === 'Problems' && <span className="problem-badge">2</span>}</button>)}<div className="bottom-actions"><button aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} title={collapsed ? 'Expand panel' : 'Collapse panel'} onClick={() => setCollapsed(!collapsed)}><PanelBottom size={15} /></button><button aria-label={expanded ? 'Restore panel' : 'Maximize panel'} title={expanded ? 'Restore panel' : 'Maximize panel'} onClick={() => { setExpanded(!expanded); setCollapsed(false) }}><Maximize2 size={14} /></button></div></div>{!collapsed && (tab === 'Terminal' ? <div className="terminal"><div><span className="prompt">➜</span> <span className="path">~/nightcode-project</span> <span className="branch">git:(main)</span></div><div className="terminal-line">npm run dev</div><div className="terminal-success"><CircleCheck size={14} /> ready in 412ms · <span>http://localhost:5173</span></div><div><span className="prompt">➜</span><span className="cursor-block"></span></div></div> : <div className="panel-message">{tab === 'Problems' ? <><CircleAlert size={17} /><span>2 warnings in this workspace. Nothing blocking your flow.</span></> : <><CircleCheck size={17} /><span>Build succeeded 14 seconds ago.</span></>}</div>)}</section> }

function WelcomeScreen({ onOpenFile, onNewFile }: { onOpenFile: () => void; onNewFile: () => void }) {
  return <motion.div className="welcome-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><section className="welcome-card"><div className="welcome-mark"><Code2 size={28} /></div><span className="welcome-kicker">NIGHTCODE WORKSPACE</span><h1>Make something weird.</h1><p>A focused coding desk for shipping ideas with a little atmosphere.</p><div className="welcome-actions"><button onClick={onOpenFile}><FolderOpen size={16} /> Open project</button><button onClick={onNewFile}><Plus size={16} /> New file</button></div><div className="welcome-shortcuts"><span><kbd>Ctrl</kbd><kbd>K</kbd> Command palette</span><span><kbd>Ctrl</kbd><kbd>S</kbd> Save current file</span></div></section></motion.div>
}

function App() {
  const { activeFile, openFiles, files, accent, sidebarOpen, setFiles, updateFile, setActiveFile, closeFile, setAccent, toggleSidebar } = useNightcode()
  const [activeView, setActiveView] = useState('explorer'); const [paletteOpen, setPaletteOpen] = useState(false); const [copilotOpen, setCopilotOpen] = useState(false); const [focusOpen, setFocusOpen] = useState(false); const [wrappedOpen, setWrappedOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [newFileOpen, setNewFileOpen] = useState(false); const [welcomeOpen, setWelcomeOpen] = useState(() => window.localStorage.getItem('nightcode-welcome-dismissed') !== 'true'); const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle'); const [runOutput, setRunOutput] = useState(''); const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle')
  const dismissWelcome = () => { window.localStorage.setItem('nightcode-welcome-dismissed', 'true'); setWelcomeOpen(false) }
    const [autosave, setAutosave] = useState(true); const [minimap, setMinimap] = useState(true)
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme>(() => (window.localStorage.getItem('nightcode-ambient-theme') as AmbientTheme) || 'classic')
  const [ambientSound, setAmbientSound] = useState<AmbientSound>(() => (window.localStorage.getItem('nightcode-ambient-sound') as AmbientSound) || 'off')
  const [diagnostics, setDiagnostics] = useState<Array<{ message: string; line: number }>>([])
    const [soundRevision, setSoundRevision] = useState(0)
  const activateSound = (sound: AmbientSound) => { setAmbientSound(sound); setSoundRevision((revision) => revision + 1) }
  const [collaboration, setCollaboration] = useState({ connected: false, participants: 0, names: [] as string[] })
  const [gitStatus, setGitStatus] = useState<GitStatus>({ branch: 'loading', clean: true, changes: [] })
  const collaborationSocket = useRef<WebSocket | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const currentFile = files.find((file) => file.name === activeFile) ?? files[0]
  const applyingRemoteChange = useRef(false)
  const ambientCleanup = useRef<(() => void) | null>(null)
    const accentOptions: Accent[] = ['violet', 'lime', 'pink', 'cyan']
    useEffect(() => { window.localStorage.setItem('nightcode-ambient-theme', ambientTheme); window.localStorage.setItem('nightcode-ambient-sound', ambientSound); ambientCleanup.current?.(); ambientCleanup.current = ambientTheme === 'classic' ? null : createAmbientSound(ambientTheme, ambientSound); return () => { ambientCleanup.current?.(); ambientCleanup.current = null } }, [ambientTheme, ambientSound, soundRevision])
  const buildProject = async () => {
    if (buildStatus === 'building') return
    setBuildStatus('building')
    try {
      const response = await fetch('/api/build', { method: 'POST' })
      if (!response.ok) throw new Error('Build failed.')
      setBuildStatus('success')
    } catch {
      setBuildStatus('error')
    }
  }
  const persistFile = (filePath: string, content: string) => {
    const save = saveQueue.current.then(async () => {
      const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content })
      if (!response.ok) throw new Error('Save failed.')
    })
    saveQueue.current = save.then(() => undefined, () => undefined)
    return save
  }
  const saveCurrentFile = async () => {
    if (!currentFile) return
    setSaveStatus('saving')
    try {
      await persistFile(currentFile.path, currentFile.content)
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 1800)
    } catch {
      setSaveStatus('error')
    }
  }
  const runCurrentFile = async () => {
    if (!currentFile || runStatus === 'running') return
    setRunStatus('running')
    setRunOutput('')
    try {
      const response = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: currentFile.language, content: currentFile.content }) })
      const result = await response.json() as { ok?: boolean; output?: string; error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to run file.')
      setRunOutput(result.output || '(no output)')
      setRunStatus(result.ok === false ? 'error' : 'done')
    } catch (error) {
      setRunOutput(error instanceof Error ? error.message : 'Unable to run file.')
      setRunStatus('error')
    }
  }
  const runCommand = (command: string) => {
    if (openFiles.includes(command)) { setActiveFile(command); return }
    if (command === 'Open file') { setActiveView('explorer'); if (!sidebarOpen) toggleSidebar() }
    if (command === 'Save file') void saveCurrentFile()
    if (command === 'Run file') void runCurrentFile()
    if (command === 'Toggle focus mode') setFocusOpen(true)
    if (command === 'Switch accent color') setAccent(accentOptions[(accentOptions.indexOf(accent) + 1) % accentOptions.length])
    if (command === 'Build project') void buildProject()
    if (command === 'Open Coding Wrapped') setWrappedOpen(true)
  }
  const openFileItems = useMemo(() => openFiles.map((name) => files.find((file) => file.name === name)!).filter(Boolean), [openFiles])
  useEffect(() => {
    fetch('/api/files').then((response) => response.json()).then((projectFiles: FileItem[]) => setFiles(projectFiles)).catch(() => undefined)
  }, [setFiles])
  useEffect(() => {
    if (!welcomeOpen) window.localStorage.setItem('nightcode-welcome-dismissed', 'true')
  }, [welcomeOpen])
  useEffect(() => { const refresh = () => { fetch('/api/git/status').then((response) => response.json()).then((status: GitStatus) => setGitStatus(status)).catch(() => undefined) }; refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let stopped = false
    const connect = () => {
      if (stopped) return
      socket = new WebSocket(collaborationUrl())
      collaborationSocket.current = socket
      socket.addEventListener('open', () => {
        setCollaboration((state) => ({ ...state, connected: true }))
        socket?.send(JSON.stringify({ type: 'join', name: 'M' }))
      })
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as CollaborationMessage
          if (message.type === 'presence') setCollaboration({ connected: true, participants: message.participants, names: message.names })
          if (message.type === 'file-change') {
            const file = useNightcode.getState().files.find((item) => item.path === message.path)
            if (file) {
              applyingRemoteChange.current = true
              updateFile(file.name, message.content)
            }
          }
        } catch {
          setCollaboration({ connected: false, participants: 0, names: [] })
        }
      })
      socket.addEventListener('close', () => {
        setCollaboration({ connected: false, participants: 0, names: [] })
        if (!stopped && reconnectTimer === undefined) reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; connect() }, 1500)
      })
      socket.addEventListener('error', () => setCollaboration({ connected: false, participants: 0, names: [] }))
    }
    connect()
    return () => { stopped = true; if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer); socket?.close(); collaborationSocket.current = null }
  }, [])
  useEffect(() => useNightcode.subscribe((state, previousState) => {
    if (applyingRemoteChange.current) {
      applyingRemoteChange.current = false
      return
    }
    const changedFile = state.files.find((file) => file.content !== previousState.files.find((previous) => previous.path === file.path)?.content)
    if (changedFile && collaborationSocket.current?.readyState === WebSocket.OPEN) collaborationSocket.current.send(JSON.stringify({ type: 'file-change', path: changedFile.path, content: changedFile.content }))
  }), [])
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true) } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveCurrentFile() } if (event.key === 'Escape') { setPaletteOpen(false); setFocusOpen(false); setCopilotOpen(false); setWrappedOpen(false); setSettingsOpen(false); setNewFileOpen(false); setWelcomeOpen(false) } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [currentFile])
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target as Element
      if (target.closest('.new-tab')) {
        setNewFileOpen(true)
      }
      if (target.closest('.editor-tools button[title="More actions"]')) setPaletteOpen(true)
      if (target.closest('.editor-tools button[title="Split editor"]')) {
        const otherFile = openFiles.find((name) => name !== activeFile)
        if (otherFile) setActiveFile(otherFile)
      }
    }
    window.addEventListener('click', listener)
    return () => window.removeEventListener('click', listener)
  }, [activeFile, files, openFiles, setActiveFile, setFiles])
  return <div className={`app accent-${accent} ambient-${ambientTheme} ${focusOpen ? 'focus-active' : ''}`}>
    <ActivityBar activeView={activeView} setActiveView={(view) => { setActiveView(view); if (view !== 'explorer' && !sidebarOpen) toggleSidebar() }} onSettings={() => setSettingsOpen(true)} />
    {sidebarOpen && <FileTree activeView={activeView} collaboration={collaboration} onCloseMobile={toggleSidebar} />}
    <main className="workspace">
      <header className="topbar"><div className="workspace-name"><span className="status-dot"></span><b>nightcode</b><span className="slash">/</span><span>nightcode-project</span></div><div className="top-actions"><button className="streak-button" onClick={() => setWrappedOpen(true)}><Timer size={15} /> Activity</button><button className="icon-text" onClick={() => setFocusOpen(true)}><Timer size={15} /> Focus</button><button className="icon-text copilot-trigger" onClick={() => setCopilotOpen(true)}><Sparkles size={15} /> Copilot</button><div className="avatar">M</div></div></header>
      <div className="editor-wrap"><div className="tabs-bar"><button className="sidebar-toggle" onClick={toggleSidebar}><PanelBottom size={16} /></button>{openFileItems.map((file) => <div className={activeFile === file.name ? 'editor-tab active' : 'editor-tab'} key={file.name} onClick={() => setActiveFile(file.name)}>{iconForFile(file)}<span>{file.name}</span>{activeFile === file.name && <CircleDot size={9} className="tab-dirty" />}<button className="tab-close" onClick={(event) => { event.stopPropagation(); closeFile(file.name) }}><X size={13} /></button></div>)}<button className="new-tab"><Plus size={16} /></button><div className="editor-tools"><button title="Split editor"><PanelBottom size={15} /></button><button title="More actions"><MoreHorizontal size={16} /></button></div></div><div className="breadcrumbs"><span>src</span><ChevronRight size={12} /><span className="breadcrumb-current">{currentFile.name}</span><ChevronRight size={12} /><span>{currentFile.name === 'App.tsx' ? 'App' : 'default'}</span><div className="language-label">{currentFile.language} <ChevronDown size={12} /></div></div><div className="editor-stage"><Editor height="100%" theme="nightcode" language={currentFile.language} value={currentFile.content} onChange={(value) => { if (value === undefined) return; updateFile(currentFile.name, value); if (autosave) void fetch(`/api/file?path=${encodeURIComponent(currentFile.path)}`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: value }) }} options={{ minimap: { enabled: minimap }, fontFamily: 'JetBrains Mono, monospace', fontSize: 14, lineHeight: 24, padding: { top: 14 }, smoothScrolling: true, roundedSelection: true, scrollBeyondLastLine: false, automaticLayout: true }} beforeMount={(monaco) => { monaco.editor.defineTheme('nightcode', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: 'C995FF' }, { token: 'string', foreground: 'B8E986' }, { token: 'comment', foreground: '686477', fontStyle: 'italic' }, { token: 'type', foreground: '64D7FF' }], colors: { 'editor.background': '#111116', 'editor.foreground': '#DCD9E5', 'editorLineNumber.foreground': '#45434E', 'editorLineNumber.activeForeground': '#A6A0B5', 'editorCursor.foreground': '#BF8CFF', 'editor.selectionBackground': '#42315d', 'editor.lineHighlightBackground': '#17161e', 'editorIndentGuide.background': '#24222d', 'minimap.background': '#111116' } }) }} /></div><BottomPanel /></div>
      <footer className="statusbar"><div><span><GitBranch size={13} /> {gitStatus.branch}</span><span><GitCommitHorizontal size={13} /> {gitStatus.changes.length} changes</span><span className="sync">{saveStatus === 'saving' ? <Timer size={13} /> : saveStatus === 'error' ? <CircleAlert size={13} /> : <CircleCheck size={13} />} {saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'save failed' : gitStatus.clean ? 'clean' : 'unsaved changes'}</span></div><div><span><CircleAlert size={13} /> {runStatus === 'error' ? '1' : '0'}</span><span><CircleCheck size={13} /> {buildStatus === 'success' ? '0' : ''}</span><span>UTF-8</span><span>{currentFile.language}</span></div></footer>
    </main>
    {saveStatus !== 'idle' && <div className={`save-status ${saveStatus}`}>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}</div>}{runOutput && <div className={`run-output ${runStatus}`}>{runOutput}</div>}<button className="run-button" disabled={runStatus === 'running'} onClick={() => void runCurrentFile()}><Play size={16} />{runStatus === 'running' ? 'Running...' : 'Run'}</button><button className={`build-button ${buildStatus === 'error' ? 'build-error' : ''}`} disabled={buildStatus === 'building'} onClick={() => void buildProject()}>{buildStatus === 'building' ? <Timer size={17} /> : buildStatus === 'success' ? <CircleCheck size={17} /> : <Play size={16} />}{buildStatus === 'building' ? 'Building...' : buildStatus === 'success' ? 'Built beautifully' : buildStatus === 'error' ? 'Build failed' : 'Build'}</button>
    <AnimatePresence>{welcomeOpen && <WelcomeScreen key="welcome" onOpenFile={() => setWelcomeOpen(false)} onNewFile={() => { setWelcomeOpen(false); setNewFileOpen(true) }} />}{paletteOpen && <CommandPalette key="palette" onClose={() => setPaletteOpen(false)} onCommand={runCommand} />}{copilotOpen && currentFile && <CopilotPanel key="copilot" file={currentFile} onClose={() => setCopilotOpen(false)} />}{focusOpen && <FocusPanel key="focus" onClose={() => setFocusOpen(false)} />}{wrappedOpen && <Wrapped key="wrapped" onClose={() => setWrappedOpen(false)} />}{settingsOpen && <SettingsPanel key="settings" autosave={autosave} minimap={minimap} setAutosave={setAutosave} setMinimap={setMinimap} accent={accent} setAccent={setAccent} ambientTheme={ambientTheme} setAmbientTheme={setAmbientTheme} ambientSound={ambientSound} setAmbientSound={setAmbientSound} onClose={() => setSettingsOpen(false)} />}{newFileOpen && <NewFilePanel key="new-file" onClose={() => setNewFileOpen(false)} onCreate={(extension) => { const number = files.filter((file) => file.name.startsWith('Untitled')).length + 1; const name = `Untitled-${number}.${extension}`; void fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, content: '' }) }).then(async (response) => { if (!response.ok) throw new Error('Unable to create file.'); const file = await response.json() as FileItem; setFiles([...useNightcode.getState().files, file]); useNightcode.getState().openFile(file.name); setNewFileOpen(false) }).catch(() => undefined) }} />}</AnimatePresence>
  </div>
}

export default App
