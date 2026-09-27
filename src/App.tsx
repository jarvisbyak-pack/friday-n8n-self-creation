import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Volume2, VolumeX, Activity, Radio, Sparkles, ShieldCheck } from 'lucide-react'

const WEBHOOK = 'https://akpackfitness.app.n8n.cloud/webhook/friday-core'

type Message = { role:'user'|'friday'; text:string; time:string }

export default function App() {
  const [messages,setMessages] = useState<Message[]>([
    {role:'friday',text:"I'm online. Tap the mic or say something — hands-free mode is ready.",time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
  ])
  const [input,setInput] = useState('')
  const [listening,setListening] = useState(false)
  const [handsFree,setHandsFree] = useState(false)
  const [speaking,setSpeaking] = useState(true)
  const [status,setStatus] = useState<'ready'|'thinking'|'error'>('ready')
  const [latency,setLatency] = useState<number|null>(null)
  const recognitionRef = useRef<any>(null)
  const handsFreeRef = useRef(false)

  useEffect(()=>{ handsFreeRef.current = handsFree },[handsFree])

  const say = (text:string) => {
    if (!speaking || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    window.speechSynthesis.speak(u)
  }

  const send = async (forced?:string) => {
    const message = (forced ?? input).trim()
    if (!message || status === 'thinking') return
    setInput('')
    setMessages(m=>[...m,{role:'user',text:message,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}])
    setStatus('thinking')
    const started = performance.now()
    try {
      const res = await fetch(WEBHOOK,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({source:'friday-web-ui',message,sessionId:'friday-web',inputMode:'voice'})
      })
      const data = await res.json()
      const reply = data?.reply?.text ?? data?.output ?? data?.reply ?? 'I received that, but no response text was returned.'
      setLatency(Math.round(performance.now()-started))
      setMessages(m=>[...m,{role:'friday',text:String(reply),time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}])
      say(String(reply))
      setStatus('ready')
    } catch {
      const text='I could not reach the Friday webhook. Check the n8n endpoint and browser connection.'
      setMessages(m=>[...m,{role:'friday',text,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}])
      setStatus('error')
      say(text)
    }
  }

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setStatus('error')
      setMessages(m=>[...m,{role:'friday',text:'Speech recognition is not supported in this browser. Use Chrome or Edge.',time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}])
      return
    }
    const r = new SR()
    recognitionRef.current = r
    r.lang = 'en-IN'
    r.continuous = handsFreeRef.current
    r.interimResults = true
    r.onstart=()=>setListening(true)
    r.onend=()=>{
      setListening(false)
      if (handsFreeRef.current) setTimeout(startListening,350)
    }
    r.onerror=()=>setListening(false)
    r.onresult=(e:any)=>{
      let finalText=''
      for(let i=e.resultIndex;i<e.results.length;i++) if(e.results[i].isFinal) finalText += e.results[i][0].transcript
      if(finalText) send(finalText)
    }
    r.start()
  }

  const stopListening = () => {
    handsFreeRef.current=false
    recognitionRef.current?.stop()
    setListening(false)
  }

  const toggleHandsFree = () => {
    const next=!handsFree
    setHandsFree(next)
    handsFreeRef.current=next
    if(next) startListening()
    else stopListening()
  }

  useEffect(()=>()=>{ recognitionRef.current?.stop(); window.speechSynthesis?.cancel() },[])

  return <div className="app">
    <div className="orb orb-a"/><div className="orb orb-b"/>
    <header className="topbar glass">
      <div className="brand"><div className="brand-mark"><Sparkles size={18}/></div><div><b>FRIDAY</b><span>AI COMMAND CENTER</span></div></div>
      <div className="live"><i/> {status==='thinking'?'THINKING':status==='error'?'CONNECTION ISSUE':'ONLINE'} <span>{latency ? latency+' ms':''}</span></div>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Radio size={14}/> PRIVATE VOICE INTERFACE</div>
        <h1>Talk to <span>Friday.</span></h1>
        <p>Hands-free control for your automation brain. Speak naturally, and Friday routes the work through your n8n command layer.</p>
        <div className={'core '+(listening?'listening':'')+(status==='thinking'?' thinking':'')}>
          <div className="core-ring ring1"/><div className="core-ring ring2"/><div className="core-dot"><Activity size={34}/></div>
        </div>
        <div className="controls">
          <button className={'mic '+(listening?'active':'')} onClick={listening?stopListening:startListening} aria-label="Voice input">{listening?<MicOff/>:<Mic/>}</button>
          <button className={'glass-btn '+(handsFree?'selected':'')} onClick={toggleHandsFree}><Radio size={17}/> {handsFree?'Hands-free ON':'Hands-free mode'}</button>
          <button className="glass-btn" onClick={()=>setSpeaking(!speaking)}>{speaking?<Volume2 size={17}/>:<VolumeX size={17}/>} Voice {speaking?'ON':'OFF'}</button>
        </div>
      </section>

      <section className="console glass">
        <div className="console-head"><div><span className="section-kicker">LIVE SESSION</span><h2>Command stream</h2></div><div className="secure"><ShieldCheck size={15}/> webhook connected</div></div>
        <div className="messages">
          {messages.map((m,i)=><div key={i} className={'msg '+m.role}><div className="avatar">{m.role==='friday'?'F':'YOU'}</div><div><div className="msg-meta">{m.role==='friday'?'FRIDAY':'YOU'} · {m.time}</div><div className="bubble">{m.text}</div></div></div>)}
        </div>
        <form onSubmit={e=>{e.preventDefault();send()}} className="composer">
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Type a command or use the microphone…" />
          <button type="submit"><Send size={18}/></button>
        </form>
      </section>
    </main>
    <footer>FRIDAY CORE · n8n orchestration · Voice interface</footer>
  </div>
}