import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readAgentConfig } from './agentConfig.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dataFile = join(root, 'data', 'tutor-whatsapp.json')

export type LeadStage = 'new' | 'collecting' | 'completed' | 'missed' | 'declined'
export type IntakeField = string

export type TutorLead = {
  id: string
  whatsappId: string
  name?: string
  phone?: string
  postalCode?: string
  gender?: string
  subject?: string
  answers?: Record<string, string>
  stage: LeadStage
  currentField: IntakeField
  currentQuestionIndex?: number
  followUpCount: number
  lastInboundAt?: string
  lastOutboundAt: string
  nextFollowUpAt?: string
  completedAt?: string
  source: 'meta_test_number' | 'dashboard_demo' | 'manual'
  transcript: Array<{ id: string; direction: 'inbound' | 'outbound'; body: string; createdAt: string }>
}

export type AppEvent = {
  id: string
  type: string
  message: string
  createdAt: string
}

export type AppData = {
  schemaVersion: number
  leads: TutorLead[]
  events: AppEvent[]
}

const now = Date.now()
const seed: AppData = {
  schemaVersion: 1,
  leads: [
    demoLead('+15550101410', 'Aarav Mehta', 'M4B 1B3', 'Male', 'Grade 10 Math', 'completed', 0, now - 1000 * 60 * 60 * 2),
    demoLead('+15550101411', 'Sophia Reed', '10001', 'Female', 'Chemistry', 'completed', 0, now - 1000 * 60 * 60 * 5),
    demoLead('+15550101412', 'Noah Singh', '94105', undefined, 'Physics', 'collecting', 1, now - 1000 * 60 * 60 * 7),
    demoLead('+15550101413', 'Mia Patel', undefined, undefined, undefined, 'collecting', 2, now - 1000 * 60 * 60 * 24),
    demoLead('+15550101414', undefined, undefined, undefined, undefined, 'new', 0, now - 1000 * 60 * 12),
    demoLead('+15550101415', 'Daniel Kim', '60601', 'Male', 'English', 'declined', 0, now - 1000 * 60 * 60 * 28),
    demoLead('+15550101416', 'Emma Wilson', 'SW1A 1AA', 'Female', 'Biology', 'missed', 3, now - 1000 * 60 * 60 * 96),
  ],
  events: [],
}

function demoLead(
  whatsappId: string,
  name: string | undefined,
  postalCode: string | undefined,
  gender: string | undefined,
  subject: string | undefined,
  stage: LeadStage,
  followUpCount: number,
  timestamp: number,
): TutorLead {
  const field = nextMissingField({ name, phone: whatsappId, postalCode, gender, subject } as TutorLead) ?? 'subject'
  return {
    id: randomUUID(),
    whatsappId,
    name,
    phone: whatsappId,
    postalCode,
    gender,
    subject,
    stage,
    currentField: field,
    followUpCount,
    lastInboundAt: new Date(timestamp).toISOString(),
    lastOutboundAt: new Date(timestamp + 1000 * 60).toISOString(),
    nextFollowUpAt: stage === 'collecting' || stage === 'new' ? new Date(timestamp + 1000 * 60 * 60 * 48).toISOString() : undefined,
    completedAt: stage === 'completed' ? new Date(timestamp + 1000 * 60 * 8).toISOString() : undefined,
    source: 'dashboard_demo',
    transcript: [
      { id: randomUUID(), direction: 'inbound', body: 'Hi, I need a tutor.', createdAt: new Date(timestamp).toISOString() },
      { id: randomUUID(), direction: 'outbound', body: firstPrompt(), createdAt: new Date(timestamp + 1000 * 60).toISOString() },
    ],
  }
}

export function readData(): AppData {
  if (!existsSync(dataFile)) {
    mkdirSync(dirname(dataFile), { recursive: true })
    writeFileSync(dataFile, JSON.stringify(seed, null, 2))
  }
  const data = JSON.parse(readFileSync(dataFile, 'utf8')) as AppData
  if (data.schemaVersion !== seed.schemaVersion) {
    writeFileSync(dataFile, JSON.stringify(seed, null, 2))
    return seed
  }
  data.events ??= []
  data.leads ??= []
  return data
}

export function writeData(data: AppData) {
  mkdirSync(dirname(dataFile), { recursive: true })
  writeFileSync(dataFile, JSON.stringify(data, null, 2))
}

export function addEvent(type: string, message: string) {
  const data = readData()
  data.events.unshift({ id: randomUUID(), type, message, createdAt: new Date().toISOString() })
  data.events = data.events.slice(0, 100)
  writeData(data)
}

export function firstPrompt() {
  const config = readAgentConfig()
  return `Hi! Thanks for reaching out to ${config.businessName}. ${config.questions[0]?.prompt ?? 'How can we help?'}`
}

export function promptFor(field: IntakeField) {
  const config = readAgentConfig()
  return config.questions.find((question) => question.key === field)?.prompt ?? 'Can you share a little more detail?'
}

export function completionMessage() {
  return readAgentConfig().completionMessage
}

export function followUpMessage(field: IntakeField, count: number) {
  const intro = readAgentConfig().followUpMessages[Math.min(count, 2)] ?? 'Quick follow-up from the team.'
  return `${intro} ${promptFor(field)}`
}

export function nextMissingField(lead: Partial<TutorLead>): IntakeField | null {
  const config = readAgentConfig()
  const answers = lead.answers ?? {}
  for (const question of config.questions) {
    const value = answers[question.key] ?? lead[question.key as keyof TutorLead]
    if (question.required && !value) return question.key
  }
  return null
}
