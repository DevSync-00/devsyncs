import { AnalyzerApiClient, DevicePollError, deriveExpiryFromToken } from '../api-client.js';

const mockFetch = () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const buildResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createToken = (exp: number) => {
  const encode = (data: Record<string, unknown>) => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`;
};

describe('AnalyzerApiClient', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('startDeviceFlow returns payload on success', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValue(
      buildResponse({
        device_code: 'abc',
        user_code: 'AAAA-BBBB',
        verification_uri: 'https://example.com/device',
        expires_in: 600,
        interval: 5,
      })
    );

    const client = new AnalyzerApiClient('https://example.com');
    const result = await client.startDeviceFlow('cli');
    expect(result.user_code).toBe('AAAA-BBBB');
  });

  test('pollDeviceToken throws typed error', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValue(buildResponse({ error: 'authorization_pending' }, 400));
    const client = new AnalyzerApiClient('https://example.com');
    await expect(client.pollDeviceToken('device')).rejects.toBeInstanceOf(DevicePollError);
  });

  test('deriveExpiryFromToken decodes exp claim', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = createToken(exp);
    expect(deriveExpiryFromToken(token)).toBe(exp);
  });
});

