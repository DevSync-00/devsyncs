import { NeonBranchPreviewProvider } from '@/lib/preview-providers/neon-branch';

describe('Neon managed preview provider', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('provisions a branch with an endpoint and returns its connection', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({
        branch: { id: 'br-preview', name: 'devsync-preview' },
        endpoints: [{ id: 'ep-preview' }],
        connection_uris: [{ connection_uri: 'postgres://user:pass@host/db' }],
      }),
    } as any);
    const result = await new NeonBranchPreviewProvider().provision({
      apiKey: 'napi_test_key', projectId: 'project-test', name: 'devsync-preview',
    });
    expect(result).toMatchObject({ resourceId: 'br-preview', status: 'ready', connectionString: 'postgres://user:pass@host/db' });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/projects/project-test/branches'), expect.objectContaining({ method: 'POST' }));
  });

  it('treats a missing branch as deleted', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: 'not found' }) } as any);
    await expect(new NeonBranchPreviewProvider().status({ apiKey: 'key', projectId: 'project-test' }, 'br-gone'))
      .resolves.toMatchObject({ status: 'deleted' });
  });
});
