import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarCheck,
  Clock3,
  FileText,
  Grid2X2,
  IndianRupee,
  MessageCircle,
  RefreshCw,
  Settings,
  UserRoundX,
  Users,
  Zap,
} from 'lucide-react'
import './App.css'

type Lead = {
  id: string
  whatsappId: string
  name?: string
  phone?: string
  postalCode?: string
  gender?: string
  subject?: string
  stage: 'new' | 'collecting' | 'completed' | 'missed' | 'declined'
  currentField: string
  followUpCount: number
  nextFollowUpAt?: string
  transcript: Array<{ direction: 'inbound' | 'outbound'; body: string; createdAt: string }>
}

type Dashboard = {
  leads: Lead[]
  metrics: {
    totalLeads: number
    completedIntakes: number
    completionRate: number
    inProgress: number
    newEnquiries: number
    declined: number
    leadsMissed: number
    followUpsDue: number
    estimatedMonthlyValue: number
    topSubjects: Array<{ name: string; count: number }>
    recentConversations: Lead[]
    monthly: Array<{ month: string; total: number; matched: number }>
  }
}

const empty: Dashboard = {
  leads: [],
  metrics: {
    totalLeads: 0,
    completedIntakes: 0,
    completionRate: 0,
    inProgress: 0,
    newEnquiries: 0,
    declined: 0,
    leadsMissed: 0,
    followUpsDue: 0,
    estimatedMonthlyValue: 0,
    topSubjects: [],
    recentConversations: [],
    monthly: [],
  },
}

const nav = [
  ['Dashboard', Grid2X2],
  ['WhatsApp', MessageCircle],
  ['Leads', Users],
  ['Tutor Matches', CalendarCheck],
  ['Subjects', BookOpen],
  ['Analytics', BarChart3],
  ['Automations', Zap],
  ['Settings', Settings],
] as const

function App() {
  const [dashboard, setDashboard] = useState<Dashboard>(empty)
  const [view, setView] = useState('Dashboard')
  const [range, setRange] = useState('All')
  const [simPhone, setSimPhone] = useState('+15550101999')
  const [simText, setSimText] = useState('Hi, I need a tutor')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const response = await fetch('/api/dashboard')
    setDashboard(await response.json() as Dashboard)
  }

  async function simulate() {
    await fetch('/api/simulate/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: simPhone, text: simText }),
    })
    setSimText('')
    await load()
  }

  async function processFollowUps() {
    await fetch('/api/followups/process', { method: 'POST' })
    await load()
  }

  const leadStatus = useMemo(() => {
    const total = Math.max(1, dashboard.metrics.totalLeads)
    return [
      ['Completed', dashboard.metrics.completedIntakes, '#28d65f'],
      ['Collecting', dashboard.metrics.inProgress, '#ffa51f'],
      ['Declined', dashboard.metrics.declined, '#aeb4bd'],
      ['Missed', dashboard.metrics.leadsMissed, '#17c964'],
    ].map(([label, value, color]) => ({ label: String(label), value: Number(value), color: String(color), percent: Math.round((Number(value) / total) * 100) }))
  }, [dashboard])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><BookOpen size={18} /></span><div><strong>Vireon AI</strong><small>Tutoring Assistant</small></div></div>
        <nav className="nav">
          {nav.slice(0, 5).map(([label, Icon]) => <button key={label} className={view === label ? 'active' : ''} onClick={() => setView(label)}><Icon size={18} />{label}</button>)}
          <p>INSIGHTS</p>
          {nav.slice(5).map(([label, Icon]) => <button key={label} className={view === label ? 'active' : ''} onClick={() => setView(label)}><Icon size={18} />{label}</button>)}
        </nav>
        <div className="agent-card"><span /> <strong>AI Agent Active</strong><small>Handling WhatsApp 24/7</small></div>
        <button className="logout">Log out</button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><h1>{view === 'Dashboard' ? 'Overview' : view}</h1><p>AI lead qualification & tutor matching - {range === 'All' ? 'All Time' : range}</p></div>
          <div className="controls">
            <span className="live"><i />AI Live</span>
            {['Today', '7 Days', 'Month', 'All'].map((item) => <button key={item} className={range === item ? 'selected' : ''} onClick={() => setRange(item)}>{item}</button>)}
            <button onClick={load}><RefreshCw size={14} />Refresh</button>
          </div>
        </header>

        {view === 'Dashboard' && (
          <>
            <section className="metric-grid">
              <Metric icon={<Users />} tint="blue" value={dashboard.metrics.totalLeads} label="Total Leads" sub="All Time" />
              <Metric icon={<CalendarCheck />} tint="green" value={dashboard.metrics.completedIntakes} label="Tutor Matches Ready" sub="Completed student intakes" />
              <Metric icon={<Bot />} tint="purple" value={`${dashboard.metrics.completionRate}%`} label="Intake Completion Rate" sub={`${dashboard.metrics.completedIntakes} of ${dashboard.metrics.totalLeads} leads`} />
              <Metric icon={<IndianRupee />} tint="gold" value={`₹${dashboard.metrics.estimatedMonthlyValue.toLocaleString('en-IN')}`} label="Est. Monthly Value" sub="@ configured value per match" />
              <Metric icon={<Clock3 />} tint="gold" value={dashboard.metrics.inProgress} label="In Progress" sub="Collecting details now" />
              <Metric icon={<Users />} tint="blue" value={dashboard.metrics.newEnquiries} label="New Enquiries" sub="Just started" />
              <Metric icon={<UserRoundX />} tint="gray" value={dashboard.metrics.declined} label="Declined" sub="Not interested" />
              <Metric icon={<MessageCircle />} tint="green" value={dashboard.metrics.leadsMissed} label="Leads Missed" sub="After 3 follow-ups" />
            </section>

            <section className="automation-strip">
              <div><span><Zap size={24} /></span><div><strong>AI Automations Running</strong><p>instant WhatsApp response - 2-day follow-ups - tutor credential handoff - all handled automatically</p></div></div>
              <strong>{dashboard.metrics.totalLeads}<small>leads answered</small></strong>
              <strong>{dashboard.metrics.completedIntakes}<small>matches ready</small></strong>
              <strong>{dashboard.metrics.leadsMissed}<small>leads missed</small></strong>
            </section>

            <section className="lower-grid">
              <div className="panel chart-panel"><div className="panel-head"><div><h2>Monthly Overview</h2><p>Leads vs completed tutor matches</p></div><div className="legend"><span className="dot blue" />Total <span className="dot green" />Matched</div></div><LineChart rows={dashboard.metrics.monthly} /></div>
              <div className="panel status-panel"><h2>Lead Status</h2><p>Distribution by conversation stage</p><Donut segments={leadStatus} /><div className="status-list">{leadStatus.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}<b>{item.value}</b></span>)}</div></div>
            </section>

            <section className="lower-grid bottom">
              <div className="panel conversations"><h2>Recent WhatsApp Conversations</h2>{dashboard.metrics.recentConversations.map((lead) => <article key={lead.id}><MessageCircle size={18} /><div><strong>{lead.name || lead.whatsappId}</strong><p>{lead.subject || `Waiting for ${lead.currentField}`}</p></div><span>{lead.stage}</span></article>)}</div>
              <div className="panel simulator"><h2>Test WhatsApp Flow</h2><input value={simPhone} onChange={(event) => setSimPhone(event.target.value)} /><textarea value={simText} onChange={(event) => setSimText(event.target.value)} placeholder="Type an incoming WhatsApp message" /><div><button onClick={simulate}>Send Test Message</button><button onClick={processFollowUps}>Run Follow-ups</button></div></div>
            </section>
          </>
        )}

        {view !== 'Dashboard' && <Secondary view={view} leads={dashboard.leads} topSubjects={dashboard.metrics.topSubjects} />}
      </main>
    </div>
  )
}

function Metric({ icon, tint, value, label, sub }: { icon: React.ReactNode; tint: string; value: number | string; label: string; sub: string }) {
  return <article className="metric"><span className={`metric-icon ${tint}`}>{icon}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong><h3>{label}</h3><p>{sub}</p></article>
}

function LineChart({ rows }: { rows: Array<{ month: string; total: number; matched: number }> }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.total, row.matched]))
  const totalPoints = rows.map((row, index) => `${index * 19 + 2},${120 - (row.total / max) * 95}`).join(' ')
  const matchedPoints = rows.map((row, index) => `${index * 19 + 2},${120 - (row.matched / max) * 95}`).join(' ')
  return <svg className="line-chart" viewBox="0 0 100 132" preserveAspectRatio="none"><path d="M0 28 H100 M0 62 H100 M0 96 H100" /><polyline points={totalPoints} /><polyline className="matched-line" points={matchedPoints} />{rows.map((row, index) => <text key={row.month} x={index * 19 + 2} y="130">{row.month}</text>)}</svg>
}

function Donut({ segments }: { segments: Array<{ label: string; percent: number; color: string }> }) {
  let offset = 25
  return <svg className="donut" viewBox="0 0 42 42">{segments.map((segment) => { const circle = <circle key={segment.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={segment.color} strokeWidth="7" strokeDasharray={`${segment.percent} ${100 - segment.percent}`} strokeDashoffset={offset} />; offset -= segment.percent; return circle })}<circle cx="21" cy="21" r="10" fill="#fff" /></svg>
}

function Secondary({ view, leads, topSubjects }: { view: string; leads: Lead[]; topSubjects: Array<{ name: string; count: number }> }) {
  if (view === 'Leads') return <section className="panel full"><h2>Leads</h2>{leads.map((lead) => <article className="lead-row" key={lead.id}><FileText size={18} /><strong>{lead.name || lead.whatsappId}</strong><span>{lead.phone}</span><span>{lead.postalCode || '-'}</span><span>{lead.subject || '-'}</span><b>{lead.stage}</b></article>)}</section>
  if (view === 'Subjects') return <section className="panel full"><h2>Subjects</h2>{topSubjects.map((subject) => <article className="lead-row" key={subject.name}><BookOpen size={18} /><strong>{subject.name}</strong><span>{subject.count} enquiries</span></article>)}</section>
  return <section className="panel full"><h2>{view}</h2><p className="muted">This section is ready for the next production controls: templates, Meta credentials, tutor database, and reporting exports.</p></section>
}

export default App
