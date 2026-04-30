import fs from 'fs/promises'
import path from 'path'
import core from '@actions/core'
import runCheck from './checker.js'

async function loadConfig(workspace, configPath) {
  const full = path.join(workspace || process.cwd(), configPath)
  try {
    const raw = await fs.readFile(full, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

async function main() {
  try {
    const configPath = core.getInput('config_path') || '.github/brevo-checker.json'
    const brevoApiKey = core.getInput('brevo_api_key') || process.env.BREVO_NOTIFY_API_KEY || core.getInput('brevo_notify_api_key')
    const alertEmail = core.getInput('alert_email') || process.env.ALERT_EMAIL
    const localMetricFile = core.getInput('local_metric_file') || ''
    const warningPercent = core.getInput('warning_percent') ? Number(core.getInput('warning_percent')) : undefined
    const criticalPercent = core.getInput('critical_percent') ? Number(core.getInput('critical_percent')) : undefined
    const emergencyPercent = core.getInput('emergency_percent') ? Number(core.getInput('emergency_percent')) : undefined
    const stateFile = core.getInput('state_file') || '.alert-state.json'

    const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
    const fileConfig = await loadConfig(workspace, configPath)

    const opts = {
      brevoApiKey: brevoApiKey || fileConfig.brevoApiKey || fileConfig.brevoApiKeySecretName,
      metricJsonPath: core.getInput('metric_json_path') || fileConfig.metricJsonPath || fileConfig.metric_json_path || '',
      localMetricFile: localMetricFile || fileConfig.localMetricFile || fileConfig.local_metric_file || '',
      workspace: process.env.GITHUB_WORKSPACE || process.cwd(),
      warningPercent: warningPercent ?? fileConfig.warningPercent ?? fileConfig.warning_percent ?? 70,
      criticalPercent: criticalPercent ?? fileConfig.criticalPercent ?? fileConfig.critical_percent ?? 85,
      emergencyPercent: emergencyPercent ?? fileConfig.emergencyPercent ?? fileConfig.emergency_percent ?? 95,
      stateFile: stateFile || fileConfig.stateFile || fileConfig.state_file || '.alert-state.json',
      stateKey: alertEmail || fileConfig.alertEmail || fileConfig.alert_email || '_default'
    }

    if (!opts.brevoApiKey && !process.env.BREVO_NOTIFY_API_KEY) {
      core.warning('No Brevo API key provided; action will run using local metric file if provided; otherwise fetch will fail.')
    }

    const res = await runCheck(opts)
    core.setOutput('usagePercent', String(res.usagePercent))
    core.setOutput('remainingEmails', res.remainingEmails == null ? '' : String(res.remainingEmails))
    core.setOutput('remainingSMS', res.remainingSMS == null ? '' : String(res.remainingSMS))
    core.setOutput('thresholdTriggered', res.thresholdTriggered)
    core.setOutput('previousThreshold', res.previousThreshold)
    core.setOutput('stateChanged', String(res.stateChanged))
    core.info(`brevo-checker: usagePercent=${res.usagePercent} threshold=${res.thresholdTriggered} previous=${res.previousThreshold}`)
  } catch (err) {
    core.setFailed(err.message || String(err))
  }
}

main()
