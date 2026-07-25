import { validateWebhook } from '@/lib/team-integrations';

describe('team integration webhook validation', () => {
  it('accepts official Slack incoming webhooks', () => {
    expect(validateWebhook('slack', 'https://hooks.slack.com/services/T/B/secret')).toContain('hooks.slack.com');
  });

  it('rejects Slack lookalike and private network targets', () => {
    expect(() => validateWebhook('slack', 'https://hooks.slack.com.attacker.test/services/x')).toThrow();
    expect(() => validateWebhook('generic', 'https://127.0.0.1/hook')).toThrow(/Private/);
  });

  it('accepts Microsoft workflow webhook hosts', () => {
    expect(validateWebhook('teams', 'https://region.logic.azure.com/workflows/test')).toContain('logic.azure.com');
  });

  it('requires HTTPS for every provider', () => {
    expect(() => validateWebhook('generic', 'http://example.com/hook')).toThrow(/HTTPS/);
  });
});
