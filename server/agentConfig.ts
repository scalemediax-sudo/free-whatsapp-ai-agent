import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const configFile = join(root, 'data', 'agent-config.json')

export type AgentQuestion = {
  key: string
  label: string
  prompt: string
  required: boolean
}

export type AgentConfig = {
  businessName: string
  agentName: string
  knowledgeBasePath?: string
  completionMessage: string
  followUpMessages: string[]
  questions: AgentQuestion[]
}

export const defaultAgentConfig: AgentConfig = {
  businessName: 'Tutoring Business',
  agentName: 'WhatsApp AI Agent',
  completionMessage: "Perfect, thank you. We'll get back to you soon with the teacher's credentials and next steps.",
  followUpMessages: [
    'Quick follow-up from the team.',
    'Just checking in so we can help you with the right next step.',
    'Final reminder from the team.',
  ],
  questions: [
    { key: 'name', label: 'Name', prompt: 'What is your full name?', required: true },
    { key: 'phone', label: 'Phone Number', prompt: 'What phone number should our team use to contact you?', required: true },
    { key: 'postalCode', label: 'Postal Code', prompt: 'What is your postal code?', required: true },
    { key: 'gender', label: 'Gender', prompt: 'What is the student gender?', required: true },
    { key: 'subject', label: 'Subject', prompt: 'Which subject do you need tutoring for?', required: true },
  ],
}

export function readAgentConfig(): AgentConfig {
  if (!existsSync(configFile)) return defaultAgentConfig
  try {
    const parsed = JSON.parse(readFileSync(configFile, 'utf8')) as Partial<AgentConfig>
    return {
      ...defaultAgentConfig,
      ...parsed,
      questions: parsed.questions?.length ? parsed.questions : defaultAgentConfig.questions,
      followUpMessages: parsed.followUpMessages?.length ? parsed.followUpMessages : defaultAgentConfig.followUpMessages,
    }
  } catch {
    return defaultAgentConfig
  }
}

export function normalizeKey(label: string) {
  const fallback = `question_${Date.now()}`
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return key || fallback
}
