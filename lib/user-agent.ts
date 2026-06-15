// Tiny dependency-free User-Agent prettifier — "Chrome on macOS" style.
// Good enough for an admin login list; not a full UA database.

export function prettyUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'

  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome' :
    /Chromium/.test(ua) ? 'Chromium' :
    /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari' :
    /curl\//.test(ua) ? 'curl' :
    /PostmanRuntime/.test(ua) ? 'Postman' :
    null

  const os =
    /Windows NT/.test(ua) ? 'Windows' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /Linux/.test(ua) ? 'Linux' :
    null

  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  if (os) return os
  return ua.length > 40 ? ua.slice(0, 40) + '…' : ua
}
