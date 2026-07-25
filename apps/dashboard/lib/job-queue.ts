export function retryDelaySeconds(attempt: number, maximum = 900): number {
  return Math.min(maximum, Math.pow(2, Math.max(1, attempt)) * 15);
}

export function isStalePullRequestJob(
  current: { repository: string; pullNumber: number; headSha: string },
  incoming: { repository: string; pullNumber: number; headSha: string },
): boolean {
  return current.repository === incoming.repository
    && current.pullNumber === incoming.pullNumber
    && current.headSha !== incoming.headSha;
}
