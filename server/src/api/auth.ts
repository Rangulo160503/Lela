import type { Request, Response, NextFunction } from 'express'
import type { MvpFlujo } from '../flujo/mvpFlujo.js'

export type AuthedRequest = Request & {
  user?: ReturnType<MvpFlujo['sessionUser']>
}

export function createAuthMiddleware(mvp: MvpFlujo) {
  return function authOptional(
    req: AuthedRequest,
    _res: Response,
    next: NextFunction,
  ) {
    const header = req.headers.authorization
    const queryToken =
      typeof req.query.token === 'string' ? req.query.token : undefined
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : ((req.headers['x-session-token'] as string | undefined) ?? queryToken)
    req.user = mvp.sessionUser(token)
    next()
  }
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  next()
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  if (req.user.role !== 'admin' && req.user.role !== 'principal') {
    res.status(403).json({ ok: false, error: 'forbidden' })
    return
  }
  next()
}
