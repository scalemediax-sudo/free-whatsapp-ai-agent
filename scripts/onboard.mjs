import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\nWhatsApp AI Agent Onboarding\n')
  console.log('This setup will create your local config, push variables to Railway, deploy the app, and return your Meta webhook callback URL.\n')

  const businessName = await ask('Business name', 'My Business')
  const agentName = await ask('Agent name', 'WhatsApp AI Agent')
  const knowledgeBasePath = await ask('Full path to your knowledge-base PDF', '')
  const copiedKnowledgeBase = copyKnowledgeBase(knowledgeBasePath)
  const questions = await collectQuestions()
  const completionMessage = await ask(
    'Final message after all answers are collected',
    "Perfect, thank you. We'll get back to you soon with the next steps.",
  )
  const metaVerifyToken = await ask('Meta webhook verify token', 'my-verify-token')
  const metaWhatsAppToken = await askSecret('Meta WhatsApp access token')
  const metaPhoneNumberId = await askSecret('Meta phone number ID')
  const railwayToken = await askSecret('Railway API token')
  const railwayProjectName = slug(await ask('Railway project name', `${businessName} WhatsApp Agent`))
  const serviceName = await ask('Railway service name', 'web')

  mkdirSync(join(root, 'data'), { recursive: true })
  writeFileSync(join(root, 'data', 'agent-config.json'), `${JSON.stringify({
    businessName,
    agentName,
    knowledgeBasePath: copiedKnowledgeBase,
    completionMessage,
    followUpMessages: [
      `Quick follow-up from ${businessName}.`,
      `Just checking in so ${businessName} can help you with the right next step.`,
      `Final reminder from ${businessName}.`,
    ],
    questions,
  }, null, 2)}\n`)

  writeFileSync(join(root, '.env'), [
    'PORT=8787',
    `META_VERIFY_TOKEN=${metaVerifyToken}`,
    `META_WHATSAPP_TOKEN=${metaWhatsAppToken}`,
    `META_PHONE_NUMBER_ID=${metaPhoneNumberId}`,
    'FOLLOW_UP_DELAY_DAYS=2',
    'ESTIMATED_TUTOR_MATCH_VALUE=150',
    '',
  ].join('\n'))

  console.log('\nLocal config created. Deploying to Railway...\n')
  const env = { ...process.env, RAILWAY_API_TOKEN: railwayToken }

  run('npx', ['railway', 'init', '--name', railwayProjectName, '--json'], env, true)
  run('npx', ['railway', 'add', '--service', serviceName, '--json'], env, true)
  setRailwayVariables(serviceName, env, {
    META_VERIFY_TOKEN: metaVerifyToken,
    META_WHATSAPP_TOKEN: metaWhatsAppToken,
    META_PHONE_NUMBER_ID: metaPhoneNumberId,
    FOLLOW_UP_DELAY_DAYS: '2',
    ESTIMATED_TUTOR_MATCH_VALUE: '150',
  })
  run('npx', ['railway', 'up', '--service', serviceName, '--detach', '--message', 'Initial WhatsApp AI agent deploy'], env)
  const domainResult = run('npx', ['railway', 'domain', '--service', serviceName, '--port', '8080', '--json'], env)
  const domain = parseDomain(domainResult.stdout)

  console.log('\nSetup complete.\n')
  console.log(`Dashboard URL: ${domain}`)
  console.log(`Meta callback URL: ${domain}/webhook/whatsapp`)
  console.log(`Meta verify token: ${metaVerifyToken}`)
  console.log('\nIf you are not getting replies, send the Railway logs and Meta webhook screenshot so we can fix it quickly.\n')
  rl.close()
}

async function collectQuestions() {
  console.log('Add the qualifying questions your WhatsApp agent should ask.')
  console.log('Press Enter on an empty question when you are done.\n')
  const defaults = [
    ['name', 'Name', 'What is your full name?'],
    ['phone', 'Phone Number', 'What phone number should our team use to contact you?'],
  ]
  const questions = defaults.map(([key, label, prompt]) => ({ key, label, prompt, required: true }))
  let index = 1
  while (true) {
    const prompt = await ask(`Question ${index}`, '')
    if (!prompt) break
    const label = await ask(`Short label for question ${index}`, prompt)
    questions.push({ key: normalizeKey(label), label, prompt, required: true })
    index += 1
  }
  if (questions.length === defaults.length) {
    questions.push(
      { key: 'need', label: 'Need', prompt: 'What do you need help with?', required: true },
      { key: 'timeline', label: 'Timeline', prompt: 'When would you like to get started?', required: true },
    )
  }
  return questions
}

function setRailwayVariables(serviceName, env, variables) {
  for (const [key, value] of Object.entries(variables)) {
    run('npx', ['railway', 'variable', 'set', `${key}=${value}`, '--service', serviceName, '--skip-deploys', '--json'], env, true)
  }
}

function copyKnowledgeBase(filePath) {
  if (!filePath) return undefined
  const source = resolve(filePath.replace(/^"|"$/g, ''))
  if (!existsSync(source)) {
    console.log('Knowledge-base file not found. Continuing without copying it.')
    return undefined
  }
  if (extname(source).toLowerCase() !== '.pdf') {
    console.log('Knowledge-base file is not a PDF. Continuing, but PDF is recommended.')
  }
  mkdirSync(join(root, 'knowledge-base'), { recursive: true })
  const target = join(root, 'knowledge-base', basename(source))
  copyFileSync(source, target)
  return `knowledge-base/${basename(source)}`
}

async function ask(label, fallback) {
  const answer = (await rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `)).trim()
  return answer || fallback
}

async function askSecret(label) {
  const answer = (await rl.question(`${label}: `)).trim()
  if (!answer) {
    console.log(`${label} is required.`)
    return askSecret(label)
  }
  return answer
}

function run(command, args, env, quiet = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (!quiet && result.stdout) process.stdout.write(result.stdout)
  if (!quiet && result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
  return result
}

function parseDomain(stdout) {
  try {
    const parsed = JSON.parse(stdout)
    if (parsed.domain) return parsed.domain
    if (parsed.domains?.[0]) return parsed.domains[0]
  } catch {
    // Fall through.
  }
  return 'https://YOUR-RAILWAY-DOMAIN.up.railway.app'
}

function normalizeKey(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `question_${Date.now()}`
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'whatsapp-ai-agent'
}

main().catch((error) => {
  rl.close()
  console.error(`\nSetup failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
