#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

function env(name, fallback) {
  return process.env[name] ?? fallback
}

function log(...a) { console.log('[send-alert]', ...a) }

async function readConfig(configPath) {
  if (!configPath) return null
  try {
    const raw = await fs.readFile(path.resolve(process.cwd(), configPath), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to read config ${configPath}: ${err.message}`)
  }
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env ${name}`)
  return v
}

async function sendEmail(apiKey, senderEmail, senderName, recipients, subject, html) {
  const url = 'https://api.brevo.com/v3/smtp/email'
  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: recipients.map(r => ({ email: r })),
    subject,
    htmlContent: html
  }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey }, body: JSON.stringify(payload) })
  const text = await res.text()
  if (!res.ok) throw new Error(`email send failed: ${res.status} ${text}`)
  return text
}

async function sendSms(apiKey, sender, recipients, text) {
  // Brevo SMS endpoint varies; attempt common transactional SMS endpoint
  const url = 'https://api.brevo.com/v3/transactionalSMS/sms'
  // Payload per Brevo: 'sender' and 'recipient' (phone number) and 'content'
  // We'll POST one SMS per recipient to keep it simple
  for (const to of recipients) {
    const payload = { sender, recipient: String(to), content: text }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey }, body: JSON.stringify(payload) })
    const txt = await res.text()
    if (!res.ok) throw new Error(`sms send failed to ${to}: ${res.status} ${txt}`)
  }
  return true
}

async function main() {
  try {
    const threshold = env('THRESHOLD') || env('INPUT_THRESHOLD') || env('INPUT_THRESHOLDTRIGGERED') || env('GITHUB_THRESHOLD')
    if (!threshold) throw new Error('Missing THRESHOLD (thresholdTriggered) environment variable')
    if (threshold === 'ok') {
      log('threshold is ok — skipping notifications')
      return
    }

    const configPath = env('NOTIFY_CONFIG') || env('INPUT_NOTIFY_CONFIG')
    const inline = env('NOTIFY_CONFIG_JSON')
    let config = null
    if (inline) config = JSON.parse(inline)
    else config = await readConfig(configPath)
    if (!config) throw new Error('No notification config provided')

    const mapping = config[threshold]
    if (!mapping) {
      log(`no mapping for threshold ${threshold} — nothing to do`)
      return
    }

    const apiKey = requireEnv('BREVO_API_KEY')
    const senderEmail = requireEnv('BREVO_SENDER_EMAIL')
    const senderName = env('BREVO_SENDER_NAME', 'Brevo Alerts')

    const usagePercent = env('USAGE_PERCENT') || env('INPUT_USAGEPERCENT') || env('STEPS_USAGEPERCENT') || ''
    const remainingEmails = env('REMAINING_EMAILS') || env('INPUT_REMAININGEMAILS') || ''
    const remainingSMS = env('REMAINING_SMS') || env('INPUT_REMAININGSMS') || ''

    const subject = `Brevo quota alert: ${threshold} (${usagePercent}%)`
    const html = `<p>Threshold: ${threshold}</p><ul><li>usagePercent: ${usagePercent}</li><li>remainingEmails: ${remainingEmails}</li><li>remainingSMS: ${remainingSMS}</li></ul>`
    const smsText = `Brevo alert ${threshold}: usage ${usagePercent}% remainingEmails=${remainingEmails} remainingSMS=${remainingSMS}`

    const channels = Array.isArray(mapping.channels) ? mapping.channels : []
    const recipients = Array.isArray(mapping.recipients) ? mapping.recipients : []

    for (const ch of channels) {
      if (ch === 'email') {
        const emails = recipients.filter(r => r.includes('@'))
        if (emails.length === 0) log('no email recipients configured; skipping email')
        else {
          log(`sending email to ${emails.length} recipients`)
          await sendEmail(apiKey, senderEmail, senderName, emails, subject, html)
          log('email sent')
        }
      } else if (ch === 'sms') {
        const phones = recipients.filter(r => !r.includes('@'))
        if (phones.length === 0) log('no sms recipients configured; skipping sms')
        else {
          log(`sending sms to ${phones.length} recipients`)
          await sendSms(apiKey, senderName, phones, smsText)
          log('sms sent')
        }
      } else {
        log(`unknown channel ${ch}; skipping`)
      }
    }
  } catch (err) {
    console.error('[send-alert] ERROR', err)
    process.exitCode = 1
    throw err
  }
}

if (import.meta.url === `file://${process.cwd()}/send-alert.js` || process.argv[1].endsWith('send-alert.js')) {
  main()
}
