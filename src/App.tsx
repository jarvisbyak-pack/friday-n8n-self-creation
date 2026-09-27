import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bot,
  ChevronLeft,
  Command,
  Gauge,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react'

const DEFAULT_WEBHOOK =
  (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined)?.trim() ||
  'https://akpackfitness.app.n8n.cloud/webhook/friday-core'
const WEBHOOK_STORAGE_KEY = 'friday-n8n-webhook-url'

type Message = { role: 'user' | 'friday'; text: string; time: string }
type View = 'friday' | 'chat' | 'handsfree' | 'dashboard'
type InputMode = 'text' | 'voice'

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const getSessionId = () => {
  const key = 'friday-session-id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `friday-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, created)
    return created
  } catch {
    return `friday-${Date.now()}`
  }
}

const getSavedWebhook = () => {
  try {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY)?.trim() || DEFAULT_WEBHOOK
  } catch {
    return DEFAULT_WEBHOOK
  }
}

const validUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export default function App() {
  const [view, setView] = useState<View>('friday')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'friday',
      text: "I'm online. I'm ready when you are.",
      time: now(),
    },
  ])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [speaking, setSpeaking] = useState(true)
  const [status, setStatus] = useState<'ready' | 'thinking' | 'error'>('ready')
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK)
  const [webhookDraft, setWebhookDraft] = useState(DEFAULT_WEBHOOK)
  const [webhookError, setWebhookError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const handsFreeRef = useRef(false)
  const sessionIdRef = useRef('')

  useEffect(() => {
    sessionIdRef.current = getSessionId()
    const saved = getSavedWebhook()
    setWebhookUrl(saved)
    setWebhookDraft(saved)
  }, [])

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  const addFriday = (text: string) =>
    setMessages((current) => [
      ...current,
      { role: 'friday', text, time: now() },
    ])

  const say = (text: string) => {
    if (!speaking || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.98
    utterance.pitch = 1
    utterance.onstart = () => setView('handsfree')
    utterance.onend = () => {
      if (handsFreeRef.current) setView('handsfree')
      else setView('friday')
    }
    window.speechSynthesis.speak(utterance)
  }

  const send = async (forced?: string, inputMode: InputMode = 'text') => {
    const message = (forced ?? input).trim()
    if (!message || status === 'thinking') return

    setInput('')
    setView(inputMode === 'voice' ? 'handsfree' : 'chat')
    setMessages((current) => [
      ...current,
      { role: 'user', text: message, time: now() },
    ])
    setStatus('thinking')

    try {
      const started = performance.now()
      const response = await fetch(webhookUrl, {
        method: 'POST',
        // text/plain is a CORS-safelisted request content type, so the browser does not
        // send an OPTIONS preflight to the POST-only n8n webhook. The Guard node
        // already accepts and JSON-parses a string request body.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          source: 'friday-web-ui',
          message,
          sessionId: sessionIdRef.current || getSessionId(),
          inputMode,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      if (!response.ok) {
        let detail = ''
        if (contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(raw)
            detail = String(errorData?.message ?? errorData?.error ?? '')
          } catch {
            detail = ''
          }
        }
        throw new Error(detail || `Friday webhook returned HTTP ${response.status}.`)
      }

      let data: any = raw
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error('Friday returned invalid JSON.')
        }
      }

      const reply =
        data?.reply?.text ??
        data?.reply ??
        data?.output ??
        data?.text ??
        (typeof data === 'string' ? data : '')

      if (!reply) throw new Error('Friday returned no response text.')

      const text = String(reply)
      setLatency(Math.round(performance.now() - started))
      addFriday(text)
      setStatus('ready')
      say(text)
    } catch (error) {
      const text =
        error instanceof Error && error.message
          ? error.message
          : 'I could not reach the Friday webhook.'
      addFriday(text)
      setStatus('error')
      say(text)
      if (inputMode === 'voice') setView('handsfree')
    }
  }

  const startListening = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SR) {
      setStatus('error')
      addFriday('Speech recognition is not supported here. Use Chrome or Edge.')
      return
    }

    recognitionRef.current?.stop()
    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang = 'en-IN'
    recognition.continuous = handsFreeRef.current
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      setView('handsfree')
      setStatus('ready')
    }
    recognition.onend = () => {
      setListening(false)
      if (handsFreeRef.current) window.setTimeout(startListening, 350)
    }
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: any) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript
      }
      if (finalText.trim()) void send(finalText, 'voice')
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  const stopListening = () => {
    handsFreeRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setHandsFree(false)
  }

  const toggleHandsFree = () => {
    const next = !handsFree
    setHandsFree(next)
    handsFreeRef.current = next
    if (next) startListening()
    else stopListening()
  }

  const saveWebhook = () => {
    const value = webhookDraft.trim()
    if (!validUrl(value)) {
      setWebhookError('Enter a valid http:// or https:// webhook URL.')
      return
    }
    setWebhookUrl(value)
    setWebhookDraft(value)
    setWebhookError('')
    try {
      localStorage.setItem(WEBHOOK_STORAGE_KEY, value)
    } catch {}
    addFriday('Webhook updated. I’m ready on the new endpoint.')
    setView('friday')
  }

  const resetWebhook = () => {
    setWebhookDraft(DEFAULT_WEBHOOK)
    setWebhookUrl(DEFAULT_WEBHOOK)
    setWebhookError('')
    try {
      localStorage.removeItem(WEBHOOK_STORAGE_KEY)
    } catch {}
    addFriday('Webhook reset to my default Friday Core endpoint.')
  }

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    },
    [],
  )

  const lastFriday = [...messages].reverse().find((m) => m.role === 'friday')
  const isActive = listening || status === 'thinking' || (speaking && 'speechSynthesis' in window && window.speechSynthesis.speaking)

  return (
    <div className={`app view-${view}`}>
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <button className="brand" onClick={() => setView('friday')} type="button">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span><b>FRIDAY</b><small>AI COMMAND CENTER</small></span>
        </button>

        <div className="status-pill">
          <i className={status === 'error' ? 'bad' : ''} />
          {status === 'thinking' ? 'THINKING' : status === 'error' ? 'CHECK CONNECTION' : 'ONLINE'}
          {latency ? <em>{latency}ms</em> : null}
        </div>

        <button className="icon-btn" onClick={() => setView('dashboard')} aria-label="Open dashboard" type="button">
          <Settings2 size={19} />
        </button>
      </header>

      {view === 'dashboard' ? (
        <main className="dashboard-page">
          <div className="page-title">
            <button className="back-btn" onClick={() => setView('friday')} type="button"><ChevronLeft size={17} /> Friday</button>
            <span className="section-kicker">COMMAND CENTER</span>
            <h1>Dashboard</h1>
            <p>Control Friday’s connection without interrupting the conversation.</p>
          </div>

          <section className="dashboard-grid">
            <div className="dash-card connection-card">
              <div className="card-icon"><Link2 size={20} /></div>
              <span className="section-kicker">N8N CONNECTION</span>
              <h2>Webhook URL</h2>
              <p>Paste any n8n webhook here. Friday will use it for the next command.</p>
              <div className="url-editor">
                <input
                  value={webhookDraft}
                  onChange={(e) => { setWebhookDraft(e.target.value); setWebhookError('') }}
                  placeholder="https://your-n8n-domain/webhook/..."
                  aria-label="n8n webhook URL"
                  spellCheck={false}
                  inputMode="url"
                />
                <button onClick={saveWebhook} type="button"><Link2 size={16} /> Connect</button>
              </div>
              {webhookError ? <div className="form-error">{webhookError}</div> : null}
              <div className="current-url"><i /> Active · {webhookUrl}</div>
              <button className="secondary-btn" onClick={resetWebhook} type="button"><RotateCcw size={15} /> Reset default</button>
            </div>

            <div className="dash-card">
              <div className="card-icon"><Gauge size={20} /></div>
              <span className="section-kicker">SESSION</span>
              <h2>Friday status</h2>
              <div className="metric"><strong>{messages.length}</strong><span>messages</span></div>
              <div className="metric"><strong>{latency ?? '—'}</strong><span>last response ms</span></div>
              <div className="metric"><strong>{handsFree ? 'ON' : 'OFF'}</strong><span>hands-free</span></div>
            </div>

            <div className="dash-card">
              <div className="card-icon"><Radio size={20} /></div>
              <span className="section-kicker">VOICE</span>
              <h2>Interaction mode</h2>
              <button className="mode-btn" onClick={() => { setView('handsfree'); setHandsFree(true); handsFreeRef.current = true; startListening() }} type="button"><Mic size={17} /> Open hands-free</button>
              <button className="mode-btn" onClick={() => setView('chat')} type="button"><MessageSquare size={17} /> Open chat</button>
            </div>
          </section>
        </main>
      ) : view === 'chat' ? (
        <main className="chat-page">
          <div className="chat-header">
            <button className="back-btn" onClick={() => setView('friday')} type="button"><ChevronLeft size={17} /> Friday</button>
            <div><span className="section-kicker">CONVERSATION</span><h2>Chat with Friday</h2></div>
            <button className="icon-btn" onClick={() => setView('handsfree')} type="button"><Mic size={18} /></button>
          </div>
          <div className="chat-list">
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.time}-${index}`}>
                <div className="chat-avatar">{message.role === 'friday' ? <Sparkles size={15} /> : 'YOU'}</div>
                <div><span className="chat-meta">{message.role === 'friday' ? 'FRIDAY' : 'YOU'} · {message.time}</span><p>{message.text}</p></div>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void send() }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message Friday…" aria-label="Message Friday" />
            <button type="submit" aria-label="Send"><Send size={18} /></button>
            <button type="button" className="voice-send" onClick={() => { setHandsFree(true); handsFreeRef.current = true; startListening() }} aria-label="Voice"><Mic size={18} /></button>
          </form>
        </main>
      ) : view === 'handsfree' ? (
        <main className="handsfree-page">
          <div className="mode-top">
            <button className="back-btn" onClick={() => { stopListening(); setView('friday') }} type="button"><ChevronLeft size={17} /> Friday</button>
            <span className="section-kicker">HANDS-FREE</span>
          </div>

          <div className={`talking-core ${listening ? 'listening' : ''} ${status === 'thinking' ? 'thinking' : ''} ${isActive ? 'active' : ''}`}>
            <div className="pulse pulse-one" /><div className="pulse pulse-two" /><div className="pulse pulse-three" />
            <div className="core-orbit orbit-one" /><div className="core-orbit orbit-two" />
            <div className="friday-core"><Sparkles size={42} /></div>
          </div>

          <div className="talk-state">
            <span>{status === 'thinking' ? 'FRIDAY IS THINKING' : listening ? 'LISTENING TO YOU' : 'FRIDAY IS READY'}</span>
            <h1>{status === 'thinking' ? 'One moment…' : listening ? 'I’m listening.' : 'Talk to me.'}</h1>
            <p>{status === 'thinking' ? 'Processing your command through the automation layer.' : lastFriday?.text ?? 'Say something and Friday will answer you.'}</p>
          </div>

          <div className="waveform" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * -55}ms` }} />)}
          </div>

          <div className="voice-actions">
            <button className={`round-action ${listening ? 'on' : ''}`} onClick={listening ? stopListening : startListening} type="button" aria-label={listening ? 'Stop listening' : 'Start listening'}>
              {listening ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button className={`round-action ${handsFree ? 'on' : ''}`} onClick={toggleHandsFree} type="button" aria-label="Toggle hands-free">
              <Radio size={21} />
            </button>
            <button className="round-action" onClick={() => setSpeaking((v) => !v)} type="button" aria-label="Toggle voice output">
              {speaking ? <Volume2 size={21} /> : <VolumeX size={21} />}
            </button>
          </div>
        </main>
      ) : (
        <main className="friday-page">
          <div className="hero-copy">
            <span className="eyebrow"><Bot size={14} /> YOUR AI COMMAND LAYER</span>
            <h1>I’m <span>Friday.</span></h1>
            <p>Speak naturally. I’ll handle the automation.</p>
          </div>

          <div className={`friday-orb ${status === 'thinking' ? 'thinking' : ''}`}>
            <div className="orb-ring ring-a" /><div className="orb-ring ring-b" /><div className="orb-ring ring-c" />
            <div className="orb-core"><Sparkles size={38} /></div>
          </div>

          <div className="friday-response">
            <span>{status === 'thinking' ? 'PROCESSING' : 'FRIDAY'}</span>
            <p>{status === 'thinking' ? 'Give me a second…' : lastFriday?.text}</p>
          </div>

          <div className="home-actions">
            <button className="primary-action" onClick={() => { setHandsFree(true); handsFreeRef.current = true; startListening() }} type="button">
              <Mic size={20} /> Talk to Friday
            </button>
            <button className="secondary-action" onClick={() => setView('chat')} type="button">
              <MessageSquare size={18} /> Chat
            </button>
          </div>

          <div className="home-footer">
            <button onClick={() => setView('dashboard')} type="button"><BarChart3 size={15} /> Dashboard</button>
            <span><i /> {webhookUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
          </div>
        </main>
      )}
    </div>
  )
}
