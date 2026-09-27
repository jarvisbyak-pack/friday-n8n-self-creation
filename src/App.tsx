import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Volume2, VolumeX, Activity, Radio, Sparkles, ShieldCheck } from 'lucide-react'

const WEBHOOK =
  (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined)?.trim() ||
  'https://akpackfitness.app.n8n.cloud/webhook/friday-core'

type Message = { role: 'user' | 'friday'; text: string; time: string }
type InputMode = 'text' | 'voice'

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const getSessionId = () => {
  const key = 'friday-session-id'
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `friday-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, created)
    return created
  } catch {
    return `friday-${Date.now()}`
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'friday',
      text: "I'm online. Tap the mic or say something — hands-free mode is ready.",
      time: now(),
    },
  ])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [speaking, setSpeaking] = useState(true)
  const [status, setStatus] = useState<'ready' | 'thinking' | 'error'>('ready')
  const [latency, setLatency] = useState<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const handsFreeRef = useRef(false)
  const sessionIdRef = useRef('')

  useEffect(() => {
    sessionIdRef.current = getSessionId()
  }, [])

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  const say = (text: string) => {
    if (!speaking || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  const addFridayMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      { role: 'friday', text, time: now() },
    ])
  }

  const send = async (forced?: string, inputMode: InputMode = 'text') => {
    const message = (forced ?? input).trim()
    if (!message || status === 'thinking') return

    setInput('')
    setMessages((current) => [
      ...current,
      { role: 'user', text: message, time: now() },
    ])
    setStatus('thinking')

    const started = performance.now()

    try {
      const response = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(
          detail || `Friday webhook returned HTTP ${response.status}.`,
        )
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

      if (!reply) {
        throw new Error('Friday returned no response text.')
      }

      const text = String(reply)
      setLatency(Math.round(performance.now() - started))
      addFridayMessage(text)
      say(text)
      setStatus('ready')
    } catch (error) {
      const text =
        error instanceof Error && error.message
          ? error.message
          : 'I could not reach the Friday webhook. Check the n8n endpoint and browser connection.'
      addFridayMessage(text)
      setStatus('error')
      say(text)
    }
  }

  const startListening = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SR) {
      setStatus('error')
      addFridayMessage(
        'Speech recognition is not supported in this browser. Use Chrome or Edge.',
      )
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang = 'en-IN'
    recognition.continuous = handsFreeRef.current
    recognition.interimResults = true

    recognition.onstart = () => setListening(true)
    recognition.onend = () => {
      setListening(false)
      if (handsFreeRef.current) {
        window.setTimeout(startListening, 350)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: any) => {
      let finalText = ''
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        if (event.results[index].isFinal) {
          finalText += event.results[index][0].transcript
        }
      }
      if (finalText.trim()) {
        void send(finalText, 'voice')
      }
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
  }

  const toggleHandsFree = () => {
    const next = !handsFree
    setHandsFree(next)
    handsFreeRef.current = next
    if (next) {
      startListening()
    } else {
      stopListening()
    }
  }

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    },
    [],
  )

  return (
    <div className="app">
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <header className="topbar glass">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <b>FRIDAY</b>
            <span>AI COMMAND CENTER</span>
          </div>
        </div>
        <div className="live">
          <i />
          {status === 'thinking'
            ? 'THINKING'
            : status === 'error'
              ? 'CONNECTION ISSUE'
              : 'ONLINE'}
          <span>{latency ? `${latency} ms` : ''}</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">
            <Radio size={14} /> PRIVATE VOICE INTERFACE
          </div>
          <h1>
            Talk to <span>Friday.</span>
          </h1>
          <p>
            Hands-free control for your automation brain. Speak naturally, and
            Friday routes the work through your n8n command layer.
          </p>

          <div
            className={`core ${listening ? 'listening' : ''}${status === 'thinking' ? ' thinking' : ''}`}
          >
            <div className="core-ring ring1" />
            <div className="core-ring ring2" />
            <div className="core-dot">
              <Activity size={34} />
            </div>
          </div>

          <div className="controls">
            <button
              className={`mic ${listening ? 'active' : ''}`}
              onClick={listening ? stopListening : startListening}
              aria-label="Voice input"
              type="button"
            >
              {listening ? <MicOff /> : <Mic />}
            </button>

            <button
              className={`glass-btn ${handsFree ? 'selected' : ''}`}
              onClick={toggleHandsFree}
              type="button"
            >
              <Radio size={17} /> {handsFree ? 'Hands-free ON' : 'Hands-free mode'}
            </button>

            <button
              className="glass-btn"
              onClick={() => setSpeaking((value) => !value)}
              type="button"
            >
              {speaking ? <Volume2 size={17} /> : <VolumeX size={17} />} Voice{' '}
              {speaking ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <section className="console glass">
          <div className="console-head">
            <div>
              <span className="section-kicker">LIVE SESSION</span>
              <h2>Command stream</h2>
            </div>
            <div className="secure">
              <ShieldCheck size={15} /> webhook connected
            </div>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div
                key={`${message.time}-${index}`}
                className={`msg ${message.role}`}
              >
                <div className="avatar">
                  {message.role === 'friday' ? 'F' : 'YOU'}
                </div>
                <div>
                  <div className="msg-meta">
                    {message.role === 'friday' ? 'FRIDAY' : 'YOU'} ·{' '}
                    {message.time}
                  </div>
                  <div className="bubble">{message.text}</div>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send(undefined, 'text')
            }}
            className="composer"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a command or use the microphone…"
              aria-label="Message Friday"
            />
            <button type="submit" aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </section>
      </main>

      <footer>FRIDAY CORE · n8n orchestration · Voice interface</footer>
    </div>
  )
}
