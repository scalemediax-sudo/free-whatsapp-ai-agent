import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\nWhatsApp AI Agent Onboarding\n')
  console.log('I will ask one thing at a time, create your agent, deploy it to Railway, then give you the Meta callback URL.\n')

  const knowledgeBasePath = await askRequired('Knowledge-base PDF full path')
  const copiedKnowledgeBase = copyKnowledgeBase(knowledgeBasePath)
  const businessName = titleFromPdf(knowledgeBasePath)
  const questions = await collectQuestions()
  const meta = await askMetaCredentials()
  const railwayToken = await askRequired('Railway API token')
  const calendarEnabled = await askYesNo('Do you want to connect Google Calendar?')
  const followUp = await collectFollowUp()

  const completionMessage = "Perfect, thank you. We have your details. We'll get back to you soon with the next steps."
  const railwayProjectName = slug(`${businessName} WhatsApp Agent`)
  const serviceName = 'web'

  mkdirSync(join(root, 'data'), { recursive: true })
  writeFileSync(join(root, 'data', 'agent-config.json'), `${JSON.stringify({
    businessName,
    agentName: 'WhatsApp AI Agent',
    knowledgeBasePath: copiedKnowledgeBase,
    completionMessage,
    calendarEnabled,
    followUpMessages: followUp.messages,
    questions,
  }, null, 2)}\n`)

  writeFileSync(join(root, '.env'), [
    'PORT=8787',
    `META_VERIFY_TOKEN=${meta.verifyToken}`,
    `META_WHATSAPP_TOKEN=${meta.accessToken}`,
    `META_PHONE_NUMBER_ID=${meta.phoneNumberId}`,
    `FOLLOW_UP_DELAY_DAYS=${followUp.days}`,
    'ESTIMATED_TUTOR_MATCH_VALUE=150',
    '',
  ].join('\n'))

  if (calendarEnabled) printGoogleCalendarGuide()

  console.log('\nCreating your Railway deployment now...\n')
  const env = { ...process.env, RAILWAY_API_TOKEN: railwayToken }

  run('npx', ['railway', 'init', '--name', railwayProjectName, '--json'], env, true)
  run('npx', ['railway', 'add', '--service', serviceName, '--json'], env, true)
  setRailwayVariables(serviceName, env, {
    META_VERIFY_TOKEN: meta.verifyToken,
    META_WHATSAPP_TOKEN: meta.accessToken,
    META_PHONE_NUMBER_ID: meta.phoneNumberId,
    FOLLOW_UP_DELAY_DAYS: String(followUp.days),
    ESTIMATED_TUTOR_MATCH_VALUE: '150',
  })
  run('npx', ['railway', 'up', '--service', serviceName, '--detach', '--message', 'Initial WhatsApp AI agent deploy'], env)
  const domainResult = run('npx', ['railway', 'domain', '--service', serviceName, '--port', '8080', '--json'], env)
  const domain = parseDomain(domainResult.stdout)

  console.log('\nSetup complete.\n')
  console.log(`Dashboard URL: ${domain}`)
  console.log(`Meta callback URL: ${domain}/webhook/whatsapp`)
  console.log(`Meta verify token: ${meta.verifyToken}`)
  console.log('\nPaste the callback URL and verify token into Meta Developer Webhooks.')
  console.log('If you are not getting replies, let me know and I will help you fix it.\n')
  rl.close()
}

async function collectQuestions() {
  console.log('\nNow add the qualifying questions your WhatsApp agent should ask.')
  console.log('I will ask one by one. Press Enter on an empty question when you are done.\n')
  const questions = []
  let index = 1
  while (true) {
    const prompt = await ask(`Qualifying question ${index}`, '')
    if (!prompt) break
    questions.push({ key: normalizeKey(prompt), label: shortLabel(prompt), prompt, required: true })
    index += 1
  }
  if (!questions.length) {
    console.log('You need at least one qualifying question.')
    return collectQuestions()
  }
  return questions
}

async function askMetaCredentials() {
  console.log('\nPaste all Meta WhatsApp values in one go.')
  console.log('Format: verify token | access token | phone number ID')
  console.log('Example: myverifytoken | EAA... | 123456789012345\n')
  while (true) {
    const raw = await askRequired('Meta credentials')
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean)
    if (parts.length === 3) {
      return { verifyToken: parts[0], accessToken: parts[1], phoneNumberId: parts[2] }
    }
    console.log('Please paste exactly three values separated by |')
  }
}

async function collectFollowUp() {
  const days = Number(await ask('Follow up after how many days?', '2')) || 2
  console.log('\nWrite the three follow-up messages.')
  const messages = [
    await ask('Follow-up message 1', 'Quick follow-up. Can you answer the question above so we can help you?'),
    await ask('Follow-up message 2', 'Just checking in. Reply here when you are ready and we will continue.'),
    await ask('Follow-up message 3', 'Final reminder. If you still need help, reply here and we will pick this back up.'),
  ]
  return { days: Math.max(1, days), messages }
}

function printGoogleCalendarGuide() {
  console.log('\nGoogle Calendar connection guide\n')
  console.log('This repo does not auto-connect Google Calendar yet. Follow these steps after deployment:')
  console.log('1. Open https://console.cloud.google.com/')
  console.log('2. Create a new Google Cloud project.')
  console.log('3. Open APIs & Services -> Library.')
  console.log('4. Search for Google Calendar API and click Enable.')
  console.log('5. Open APIs & Services -> OAuth consent screen.')
  console.log('6. Choose External if you are testing with normal Gmail accounts.')
  console.log('7. Add your app name, support email, and developer email.')
  console.log('8. Add yourself as a test user.')
  console.log('9. Open APIs & Services -> Credentials.')
  console.log('10. Click Create Credentials -> OAuth client ID.')
  console.log('11. Choose Web application.')
  console.log('12. Add your Railway app URL as an authorized JavaScript origin.')
  console.log('13. Add your future calendar callback route as an authorized redirect URI.')
  console.log('14. Copy the Client ID and Client Secret.')
  console.log('15. Store them in Railway Variables when calendar booking is added.')
  console.log('16. Test with your own Google account first, then move the app to production in Google Cloud.\n')
}

function setRailwayVariables(serviceName, env, variables) {
  for (const [key, value] of Object.entries(variables)) {
    run('npx', ['railway', 'variable', 'set', `${key}=${value}`, '--service', serviceName, '--skip-deploys', '--json'], env, true)
  }
}

function copyKnowledgeBase(filePath) {
  const source = resolve(filePath.replace(/^"|"$/g, ''))
  if (!existsSync(source)) {
    throw new Error('Knowledge-base PDF was not found. Check the full path and run onboarding again.')
  }
  if (extname(source).toLowerCase() !== '.pdf') {
    throw new Error('Knowledge-base file must be a PDF.')
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

async function askRequired(label) {
  const answer = (await rl.question(`${label}: `)).trim()
  if (!answer) {
    console.log(`${label} is required.`)
    return askRequired(label)
  }
  return answer
}

async function askYesNo(label) {
  const answer = (await ask(`${label} (yes/no)`, 'no')).toLowerCase()
  return ['y', 'yes'].includes(answer)
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

function shortLabel(prompt) {
  return prompt.replace(/[?.!]+$/g, '').split(/\s+/).slice(0, 4).join(' ')
}

function titleFromPdf(filePath) {
  return parse(filePath.replace(/^"|"$/g, '')).name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'My Business'
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
