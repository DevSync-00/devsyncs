import { decryptSecret } from './secret-vault';

export const integrationEvents = ['approval.requested', 'promotion.deployed', 'promotion.failed', 'rehearsal.failed', 'drift.detected'] as const;
export type IntegrationEvent = typeof integrationEvents[number];

export function validateWebhook(provider: string, value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Webhook URLs must use HTTPS.');
  const host = url.hostname.toLowerCase();
  if (provider === 'slack' && host !== 'hooks.slack.com') throw new Error('Slack webhooks must use hooks.slack.com.');
  if (provider === 'teams' && !/(^|\.)((webhook|outlook)\.office\.com|powerautomate\.com|logic\.azure\.com)$/.test(host)) {
    throw new Error('The URL is not a recognized Microsoft Teams workflow webhook.');
  }
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/.test(host)) throw new Error('Private network webhook targets are forbidden.');
  return url.toString();
}

export async function enqueueTeamEvent(admin: any, event: {
  projectId: string; type: IntegrationEvent; title: string; message: string; url?: string; facts?: Record<string, string | number>;
}) {
  const { data: project } = await admin.from('projects').select('team_id').eq('id', event.projectId).single();
  if (!project?.team_id) return [];
  const { data: integrations } = await admin.from('team_integrations').select('id, events').eq('team_id', project.team_id).eq('enabled', true);
  const matching = (integrations || []).filter((item: any) => (item.events || []).includes(event.type));
  const jobs = [];
  for (const integration of matching) {
    const { data: delivery } = await admin.from('integration_deliveries').insert({
      integration_id: integration.id, event_type: event.type, payload: event,
    }).select('id').single();
    if (!delivery) continue;
    const { data: job } = await admin.from('background_jobs').insert({
      job_type: 'integration_delivery', deduplication_key: `integration:${delivery.id}`,
      project_id: event.projectId, priority: 70, payload: { deliveryId: delivery.id }, max_attempts: 5,
    }).select('id').single();
    if (job) jobs.push(job.id);
  }
  return jobs;
}

export async function deliverIntegration(admin: any, deliveryId: string) {
  const { data: delivery } = await admin.from('integration_deliveries')
    .select('*, integration:team_integrations(*)').eq('id', deliveryId).single();
  if (!delivery) throw new Error('Integration delivery not found.');
  const webhook = decryptSecret(delivery.integration.encrypted_webhook_url);
  const event = delivery.payload;
  const body = delivery.integration.provider === 'slack'
    ? { text: `*${event.title}*\n${event.message}${event.url ? `\n<${event.url}|Open in DevSync>` : ''}`, blocks: slackBlocks(event) }
    : delivery.integration.provider === 'teams'
      ? teamsCard(event)
      : event;
  await admin.from('integration_deliveries').update({ status: 'delivering', attempts: delivery.attempts + 1 }).eq('id', delivery.id);
  const response = await fetch(webhook, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    await admin.from('integration_deliveries').update({ status: 'failed', response_status: response.status, error_message: detail }).eq('id', delivery.id);
    throw new Error(`Integration webhook returned ${response.status}: ${detail}`);
  }
  await admin.from('integration_deliveries').update({
    status: 'delivered', response_status: response.status, error_message: null, delivered_at: new Date().toISOString(),
  }).eq('id', delivery.id);
  return { deliveryId, provider: delivery.integration.provider, status: response.status };
}

function slackBlocks(event: any) {
  return [{ type: 'section', text: { type: 'mrkdwn', text: `*${event.title}*\n${event.message}` } }];
}

function teamsCard(event: any) {
  return {
    type: 'message',
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {
      type: 'AdaptiveCard', version: '1.4',
      body: [{ type: 'TextBlock', text: event.title, weight: 'Bolder', size: 'Medium' }, { type: 'TextBlock', text: event.message, wrap: true }],
      actions: event.url ? [{ type: 'Action.OpenUrl', title: 'Open in DevSync', url: event.url }] : [],
    } }],
  };
}
