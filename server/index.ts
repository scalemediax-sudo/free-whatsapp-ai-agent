import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  addEvent,
  completionMessage,
  firstPrompt,
  followUpMessage,
  nextMissingField,
  promptFor,
  readData,
  writeData,
  type TutorLead,
} from './store.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8787)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    services: {
      metaConfigured: Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID),
      verifyTokenConfigured: Boolean(process.env.META_VERIFY_TOKEN),
      followUpDays: followUpDelayMs() / 86_400_000,
      maxFollowUps: 3,
      railwayRegionRecommendation: 'EU West Metal - Amsterdam (Warsaw is not currently listed by Railway)',
    },
  })
})

app.get('/api/dashboard', (_request, response) => {
  const data = readData()
  const completed = data.leads.filter((lead) => lead.stage === 'completed')
  const collecting = data.leads.filter((lead) => lead.stage === 'collecting' || lead.stage === 'new')
  const missed = data.leads.filter((lead) => lead.stage === 'missed')
  const declined = data.leads.filter((lead) => lead.stage === 'declined')
  const withSubject = data.leads.filter((lead) => lead.subject)
  const subjects = groupCount(withSubject.map((lead) => lead.subject || 'Unknown'))
  response.json({
    leads: data.leads,
    events: data.events,
    metrics: {
      totalLeads: data.leads.length,
      completedIntakes: completed.length,
      completionRate: data.leads.length ? Math.round((completed.length / data.leads.length) * 100) : 0,
      inProgress: collecting.length,
      newEnquiries: data.leads.filter((lead) => lead.stage === 'new').length,
      declined: declined.length,
      leadsMissed: missed.length,
      followUpsDue: data.leads.filter(isFollowUpDue).length,
      estimatedMonthlyValue: completed.length * Number(process.env.ESTIMATED_TUTOR_MATCH_VALUE || 150),
      topSubjects: subjects,
      recentConversations: data.leads.slice(0, 8),
      monthly: monthlySeries(data.leads),
    },
  })
})

app.get('/webhook/whatsapp', (request, response) => {
  const query = request.query as Record<string, unknown> & { hub?: Record<string, unknown> }
  const mode = String(query['hub.mode'] ?? query.hub?.mode ?? '')
  const token = String(query['hub.verify_token'] ?? query.hub?.verify_token ?? '')
  const challenge = String(query['hub.challenge'] ?? query.hub?.challenge ?? '')
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    response.status(200).send(challenge)
    return
  }
  response.sendStatus(403)
})

app.post('/webhook/whatsapp', async (request, response) => {
  const messages = extractWhatsAppMessages(request.body)
  for (const message of messages) {
    await handleInboundMessage(message.from, message.text)
  }
  response.sendStatus(200)
})

app.post('/api/simulate/whatsapp', async (request, response) => {
  const schema = z.object({ from: z.string().min(3), text: z.string().min(1) })
  const input = schema.parse(request.body)
  const lead = await handleInboundMessage(input.from, input.text, true)
  response.json({ lead })
})

app.post('/api/followups/process', async (_request, response) => {
  const result = await processFollowUps()
  response.json(result)
})

app.patch('/api/leads/:id', (request, response) => {
  const schema = z.object({ stage: z.enum(['new', 'collecting', 'completed', 'missed', 'declined']) })
  const { stage } = schema.parse(request.body)
  const data = readData()
  const lead = data.leads.find((item) => item.id === request.params.id)
  if (!lead) {
    response.status(404).json({ error: 'Lead not found' })
    return
  }
  lead.stage = stage
  if (stage === 'completed') lead.completedAt = new Date().toISOString()
  writeData(data)
  addEvent('lead.updated', `${lead.name || lead.whatsappId} marked ${stage}`)
  response.json({ lead })
})

async function handleInboundMessage(from: string, text: string, skipMetaSend = false) {
  const data = readData()
  const now = new Date().toISOString()
  let lead = data.leads.find((item) => item.whatsappId === from)
  const isNewLead = !lead
  if (!lead) {
    lead = {
      id: randomUUID(),
      whatsappId: from,
      phone: from,
      answers: { phone: from },
      stage: 'new',
      currentField: 'name',
      followUpCount: 0,
      lastOutboundAt: now,
      lastInboundAt: now,
      nextFollowUpAt: undefined,
      source: 'meta_test_number',
      transcript: [],
    }
    data.leads.unshift(lead)
  }

  lead.lastInboundAt = now
  lead.followUpCount = 0
  lead.transcript.push({ id: randomUUID(), direction: 'inbound', body: text, createdAt: now })

  if (/stop|not interested|no thanks|decline/i.test(text)) {
    lead.stage = 'declined'
    lead.nextFollowUpAt = undefined
    await reply(lead, 'No problem. We will not follow up further. Thank you for letting us know.', skipMetaSend)
  } else if (isNewLead) {
    const nextField = nextMissingField(lead) ?? lead.currentField
    lead.stage = 'collecting'
    lead.currentField = nextField
    await reply(lead, nextField === 'name' ? firstPrompt() : promptFor(nextField), skipMetaSend)
  } else {
    captureField(lead, text)
    const nextField = nextMissingField(lead)
    if (nextField) {
      lead.stage = 'collecting'
      lead.currentField = nextField
      await reply(lead, lead.transcript.length <= 2 ? firstPrompt() : promptFor(nextField), skipMetaSend)
    } else {
      lead.stage = 'completed'
      lead.completedAt = now
      lead.nextFollowUpAt = undefined
      await reply(lead, completionMessage(), skipMetaSend)
    }
  }

  writeData(data)
  addEvent('whatsapp.inbound', `${from}: ${text.slice(0, 80)}`)
  return lead
}

function captureField(lead: TutorLead, text: string) {
  const clean = text.trim()
  const field = lead.currentField
  lead.answers ??= {}
  lead.answers[field] = clean
  if (field === 'name') lead.name = clean
  if (field === 'phone') lead.phone = clean
  if (field === 'postalCode' || field === 'postal_code') lead.postalCode = clean
  if (field === 'gender') lead.gender = clean
  if (field === 'subject') lead.subject = clean
}

async function reply(lead: TutorLead, body: string, skipMetaSend: boolean) {
  const createdAt = new Date().toISOString()
  lead.lastOutboundAt = createdAt
  lead.nextFollowUpAt = lead.stage === 'completed' || lead.stage === 'declined' ? undefined : new Date(Date.now() + followUpDelayMs()).toISOString()
  lead.transcript.push({ id: randomUUID(), direction: 'outbound', body, createdAt })
  if (!skipMetaSend) await sendWhatsAppText(lead.whatsappId, body)
}

async function processFollowUps() {
  const data = readData()
  const due = data.leads.filter(isFollowUpDue)
  let sent = 0
  for (const lead of due) {
    if (lead.followUpCount >= 3) {
      lead.stage = 'missed'
      lead.nextFollowUpAt = undefined
      continue
    }
    const body = followUpMessage(lead.currentField, lead.followUpCount)
    lead.followUpCount += 1
    await reply(lead, body, false)
    sent += 1
  }
  writeData(data)
  if (sent) addEvent('followup.sent', `${sent} WhatsApp follow-ups sent`)
  return { sent, markedMissed: due.length - sent }
}

function isFollowUpDue(lead: TutorLead) {
  return Boolean(
    lead.nextFollowUpAt &&
    (lead.stage === 'new' || lead.stage === 'collecting') &&
    Date.parse(lead.nextFollowUpAt) <= Date.now(),
  )
}

async function sendWhatsAppText(to: string, body: string) {
  if (!process.env.META_WHATSAPP_TOKEN || !process.env.META_PHONE_NUMBER_ID) return
  const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    addEvent('whatsapp.error', errorText.slice(0, 180))
  }
}

function extractWhatsAppMessages(body: unknown): Array<{ from: string; text: string }> {
  const entries = (body as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string } }> } }> }> }).entry ?? []
  return entries.flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) =>
      (change.value?.messages ?? [])
        .filter((message) => message.from && message.text?.body)
        .map((message) => ({ from: message.from as string, text: message.text?.body as string })),
    ),
  )
}

function followUpDelayMs() {
  return Math.max(1, Number(process.env.FOLLOW_UP_DELAY_DAYS || 2)) * 86_400_000
}

function groupCount(values: string[]) {
  return Object.entries(values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
}

function monthlySeries(leads: TutorLead[]) {
  return ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((month, index) => {
    const base = Math.max(8, leads.length * 9 + index * 12)
    return { month, total: base, matched: Math.round(base * (0.45 + index * 0.035)) }
  })
}

setInterval(() => {
  void processFollowUps()
}, 60_000)

if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*splat', (_request, response) => response.sendFile(join(dist, 'index.html')))
}

app.listen(port, () => {
  console.log(`Tutor WhatsApp AI Agent listening on http://127.0.0.1:${port}`)
})
