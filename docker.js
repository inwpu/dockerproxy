export default {
  async fetch(request, env, ctx) {
    return Response.redirect('https://inwpu.github.io', 302)
  }
}

const dockerHub = 'https://registry-1.docker.io'

function buildRoutes(host) {
  // 如未来扩展多个源，这里务必做白名单校验
  return { [host]: dockerHub }
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    },
  })
}

function allowMethods() {
  return new Response(null, {
    status: 405,
    headers: { 'Allow': 'GET, HEAD, OPTIONS' },
  })
}

function addCors(resp) {
  // 若仅供 Docker 客户端使用，可禁用本段
  const headers = new Headers(resp.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Range')
  return new Response(resp.body, { status: resp.status, headers })
}

function isSingleSegmentRepo(pathname) {
  // 期待 /v2/<name>/... 且 <name> 不含 '/'
  const m = pathname.match(/^\/v2\/([^/]+)\/(manifests|tags|blobs)\b/i)
  return m && !m[1].includes('/')
}

function needsLibraryPrefix(pathname) {
  // 已经是 /v2/library/... 则不需要
  if (/^\/v2\/library\//i.test(pathname)) return false
  return isSingleSegmentRepo(pathname)
}

function withLibraryPrefix(url) {
  // 将 /v2/<name>/X → /v2/library/<name>/X
  url.pathname = url.pathname.replace(/^\/v2\/([^/]+)\//i, '/v2/library/$1/')
  return url
}

function parseAuthenticate(authenticateStr) {
  // 尽量稳健解析形如: Bearer realm="...",service="...",scope="..."
  const realmMatch = authenticateStr.match(/realm="([^"]+)"/i)
  const serviceMatch = authenticateStr.match(/service="([^"]+)"/i)
  if (!realmMatch) throw new Error('Missing realm in WWW-Authenticate')
  return { realm: realmMatch[1], service: serviceMatch ? serviceMatch[1] : '' }
}

async function fetchToken(wwwAuthenticate, scope, authorization) {
  const url = new URL(wwwAuthenticate.realm)
  if (wwwAuthenticate.service) url.searchParams.set('service', wwwAuthenticate.service)
  if (scope) url.searchParams.set('scope', scope)

  const headers = new Headers()
  if (authorization) headers.set('Authorization', authorization)

  return fetch(url.toString(), { method: 'GET', headers, redirect: 'follow' })
}

function responseUnauthorized(url) {
  const headers = new Headers()
  headers.set(
    'WWW-Authenticate',
    `Bearer realm="https://${url.hostname}/v2/auth",service="cloudflare-docker-proxy"`
  )
  return json({ message: 'UNAUTHORIZED' }, 401, Object.fromEntries(headers))
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // 允许的方法
    if (request.method === 'OPTIONS') {
      return addCors(new Response(null, { status: 204 }))
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return addCors(allowMethods())
    }

    // 根路径跳转
    if (url.pathname === '/') {
      return addCors(Response.redirect(url.protocol + '//' + url.host + '/v2/', 301))
    }

    const routes = buildRoutes(url.host)
    const upstream = routes[url.hostname] || ''
    if (upstream === '') {
      return addCors(json({ routes }, 404))
    }

    const isDockerHub = upstream === dockerHub
    const authorization = request.headers.get('Authorization')

    // /v2/ ping
    if (url.pathname === '/v2/') {
      const newUrl = new URL(upstream + '/v2/')
      const headers = new Headers()
      if (authorization) headers.set('Authorization', authorization)

      const resp = await fetch(newUrl.toString(), { method: 'GET', headers, redirect: 'follow' })
      if (resp.status === 401) return addCors(responseUnauthorized(url))
      return addCors(resp)
    }

    // /v2/auth - 代理获取 token
    if (url.pathname === '/v2/auth') {
      const probe = await fetch(new URL(upstream + '/v2/').toString(), { method: 'GET', redirect: 'follow' })
      if (probe.status !== 401) return addCors(probe)

      const authenticateStr = probe.headers.get('WWW-Authenticate')
      if (!authenticateStr) return addCors(probe)

      let wwwAuthenticate
      try {
        wwwAuthenticate = parseAuthenticate(authenticateStr)
      } catch (e) {
        // 兜底：上游格式异常，返回 502 便于排查
        return addCors(json({ message: 'Bad WWW-Authenticate from upstream' }, 502))
      }

      let scope = url.searchParams.get('scope')
      if (scope && isDockerHub) {
        const parts = scope.split(':') // e.g., repository:ubuntu:pull
        if (parts.length === 3 && !parts[1].includes('/')) {
          parts[1] = 'library/' + parts[1]
          scope = parts.join(':')
        }
      }

      const tokenResp = await fetchToken(wwwAuthenticate, scope, authorization)
      return addCors(tokenResp)
    }

    // DockerHub library 镜像自动补全（更稳健）
    if (isDockerHub && needsLibraryPrefix(url.pathname)) {
      const redirectUrl = withLibraryPrefix(new URL(url))
      return addCors(Response.redirect(redirectUrl.toString(), 301))
    }

    // 转发请求
    const newUrl = new URL(upstream + url.pathname + (url.search || ''))
    const newReq = new Request(newUrl, {
      method: request.method,
      headers: request.headers,
      redirect: isDockerHub ? 'manual' : 'follow',
    })

    const resp = await fetch(newReq)

    if (resp.status === 401) {
      return addCors(responseUnauthorized(url))
    }

    // 处理 DockerHub blob 的 307
    if (isDockerHub && resp.status === 307) {
      const loc = resp.headers.get('Location')
      if (!loc) return addCors(resp) // 没有 Location 就原样返回

      let locationUrl
      try {
        // 优先按绝对 URL 解析；若是相对路径，则基于 upstream 作为 base
        locationUrl = new URL(loc, upstream)
        if (locationUrl.protocol !== 'https:') {
          // 非 https 的兜底：直接把 307 透传回客户端
          return addCors(resp)
        }
      } catch {
        // 解析失败：透传原 307
        return addCors(resp)
      }

      const redirectResp = await fetch(locationUrl.toString(), { method: 'GET', redirect: 'follow' })
      return addCors(redirectResp)
    }

    return addCors(resp)
  },
}
