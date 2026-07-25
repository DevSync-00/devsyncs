import { isStalePullRequestJob, retryDelaySeconds } from '@/lib/job-queue';

describe('background job queue', () => {
  it('uses capped exponential retry delays', () => {
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(60);
    expect(retryDelaySeconds(20)).toBe(900);
  });

  it('identifies older commits for the same pull request', () => {
    const current = { repository: 'acme/api', pullNumber: 42, headSha: 'old' };
    expect(isStalePullRequestJob(current, { ...current, headSha: 'new' })).toBe(true);
    expect(isStalePullRequestJob(current, { ...current })).toBe(false);
    expect(isStalePullRequestJob(current, { ...current, pullNumber: 43, headSha: 'new' })).toBe(false);
  });
});
