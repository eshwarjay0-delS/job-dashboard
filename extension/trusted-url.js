// Keep account tokens on the configured dashboard origin and resume endpoints.
export function trustedResumeUrl(input, appUrl) {
  const base = new URL(appUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || !(base.protocol === 'https:' || (base.protocol === 'http:' && loopback))) {
    throw new Error('Use an HTTPS dashboard URL (HTTP is allowed only for local development).');
  }
  const target = new URL(input, base.origin);
  if (target.origin !== base.origin || target.username || target.password ||
      !['/api/resumes/download', '/api/tailor/file'].includes(target.pathname)) {
    throw new Error('Resume downloads must come from your configured MarketFit dashboard.');
  }
  return target.href;
}
