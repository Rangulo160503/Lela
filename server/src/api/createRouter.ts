import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Router, type Response } from 'express'
import type { IAppFlujo } from '../abstracciones/ports.js'
import { DATA_DIR } from '../config.js'
import type { MvpFlujo } from '../flujo/mvpFlujo.js'
import { subscribe } from '../servicios/eventBus.js'
import {
  createAuthMiddleware,
  requireAdmin,
  requireAuth,
  type AuthedRequest,
} from './auth.js'
import { localDateKey } from '../reglas/buildProductionDraft.js'
import { parseRecipeFromPhoto } from '../servicios/recipeFromPhoto.js'
import { parseExpenseFromPhoto } from '../servicios/expenseFromPhoto.js'

export function createRouter(flujo: IAppFlujo, mvp: MvpFlujo): Router {
  const router = Router()
  router.use(createAuthMiddleware(mvp))

  router.get('/health', (_req, res) => {
    res.json(flujo.getSystemInfo())
  })

  router.post('/auth/login', (req, res) => {
    const { username, pin } = req.body as { username?: string; pin?: string }
    if (!username || !pin) {
      res.status(400).json({ ok: false, error: 'missing_credentials' })
      return
    }
    const result = mvp.login(username, pin)
    res.status(result.ok ? 200 : 401).json(result)
  })

  router.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    const header = req.headers.authorization
    const queryToken =
      typeof req.query.token === 'string' ? req.query.token : undefined
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : ((req.headers['x-session-token'] as string | undefined) ?? queryToken ?? '')
    res.json(mvp.logout(token))
  })

  router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ ok: true, user: req.user })
  })

  router.get('/snapshot', requireAuth, (_req, res) => {
    res.json({
      ...flujo.getSnapshot(),
      accounts: mvp.listAccounts(),
      openShift: mvp.getOpenShift(),
      promos: mvp.listPromos().filter((p) => (p as { active?: number }).active !== 0),
    })
  })

  router.get('/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`)
    const unsubscribe = subscribe((event) => {
      res.write(`event: ${event}\ndata: {}\n\n`)
    })
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15000)
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  router.post('/sales', requireAuth, (req: AuthedRequest, res: Response) => {
    const body = req.body as {
      lines?: { productId?: string; quantity?: number }[]
      paymentMethod?: string
      amountPaid?: number
      promoId?: string
      substitutions?: Record<string, string>
    }

    if (body.promoId) {
      const combo = mvp.sellCombo({
        promoId: body.promoId,
        substitutions: body.substitutions,
        paymentMethod: body.paymentMethod as 'efectivo',
        amountPaid: Number(body.amountPaid),
      })
      if (!combo.ok) {
        res.status(400).json(combo)
        return
      }
      if (
        body.paymentMethod !== 'efectivo' &&
        body.paymentMethod !== 'sinpe' &&
        body.paymentMethod !== 'tarjeta'
      ) {
        res.status(400).json({ ok: false, error: 'missing_method' })
        return
      }
      const result = flujo.sellLines({
        lines: combo.lines,
        paymentMethod: body.paymentMethod,
        amountPaid: Number(body.amountPaid),
        totalOverride: combo.price,
        saleLabel: combo.promo.name,
      })
      if (result.ok) mvp.applySalePaymentToCash(result.sale)
      res.status(result.ok ? 201 : 400).json(result)
      return
    }

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      res.status(400).json({ ok: false, error: 'empty_sale' })
      return
    }
    if (
      body.paymentMethod !== 'efectivo' &&
      body.paymentMethod !== 'sinpe' &&
      body.paymentMethod !== 'tarjeta'
    ) {
      res.status(400).json({ ok: false, error: 'missing_method' })
      return
    }
    if (typeof body.amountPaid !== 'number') {
      res.status(400).json({ ok: false, error: 'invalid_amount' })
      return
    }
    const result = flujo.sellLines({
      lines: body.lines.map((line) => ({
        productId: String(line.productId ?? ''),
        quantity: Number(line.quantity),
      })),
      paymentMethod: body.paymentMethod,
      amountPaid: body.amountPaid,
    })
    if (result.ok) mvp.applySalePaymentToCash(result.sale)
    res.status(result.ok ? 201 : 400).json(result)
  })

  router.post('/sales/:id/print', requireAuth, async (req, res) => {
    const result = await mvp.printSale(req.params.id)
    res.status(result.ok ? 200 : 400).json(result)
  })

  router.get('/production/draft', requireAuth, (_req, res) => {
    res.json({ ok: true, lines: flujo.buildProductionDraft() })
  })

  router.post('/production', requireAuth, (req, res) => {
    const lines = (req.body as { lines?: unknown }).lines
    if (!Array.isArray(lines)) {
      res.status(400).json({ ok: false, error: 'invalid_quantity' })
      return
    }
    const result = flujo.saveProductionSheet(lines as never)
    res.status(result.ok ? 201 : 400).json(result)
  })

  router.post('/merma', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as {
      productId?: string
      quantity?: number
      reason?: string
      motive?: string
      description?: string
      photoPath?: string
    }
    if (!body.productId || typeof body.quantity !== 'number') {
      res.status(400).json({ ok: false, error: 'invalid_quantity' })
      return
    }
    if (body.motive) {
      const result = mvp.registerExit({
        productId: body.productId,
        quantity: body.quantity,
        motive: body.motive,
        description: body.description,
        photoPath: body.photoPath,
        createdBy: req.user?.id,
      })
      res.status(result.ok ? 201 : 400).json(result)
      return
    }
    const result = flujo.applyMerma(
      body.productId,
      body.quantity,
      body.reason ?? '',
    )
    res.status(result.ok ? 201 : 400).json(result)
  })

  router.get('/exits', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listExits() })
  })

  router.post('/system/import-legacy', requireAuth, (req, res) => {
    res.json(flujo.importLegacy(req.body ?? {}))
  })

  // Users
  router.get('/users', requireAdmin, (_req, res) => {
    res.json({ ok: true, users: mvp.listUsers() })
  })
  router.post('/users', requireAdmin, (req: AuthedRequest, res) => {
    const body = req.body as {
      id?: string
      username: string
      displayName: string
      role: 'principal' | 'admin' | 'empleado'
      pin?: string
      active?: boolean
      permissions?: Record<string, boolean>
    }
    res.json(
      mvp.upsertUser({
        ...body,
        actorRole: req.user!.role,
      }),
    )
  })

  /** Foto (JPEG/PNG/WebP base64). Guarda en data/uploads/{kind}. */
  router.post('/uploads', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as { dataUrl?: string; kind?: string }
    const dataUrl = body.dataUrl ?? ''
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      dataUrl,
    )
    if (!match) {
      res.status(400).json({ ok: false, error: 'invalid_image' })
      return
    }
    const ext = match[1].toLowerCase() === 'png' ? 'png' : match[1].toLowerCase() === 'webp' ? 'webp' : 'jpg'
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length < 32 || buffer.length > 9_000_000) {
      res.status(400).json({ ok: false, error: 'invalid_image_size' })
      return
    }
    const kind = (body.kind ?? 'photo').replace(/[^a-z0-9_-]/gi, '') || 'photo'
    const dir = path.join(DATA_DIR, 'uploads', kind)
    fs.mkdirSync(dir, { recursive: true })
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
    fs.writeFileSync(path.join(dir, filename), buffer)
    res.json({ ok: true, path: `/uploads/${kind}/${filename}` })
  })

  /** Fotos reutilizables (Configuración → Fotos). */
  router.get('/uploads/library', requireAuth, (_req, res) => {
    const dir = path.join(DATA_DIR, 'uploads', 'library')
    fs.mkdirSync(dir, { recursive: true })
    const items = fs
      .readdirSync(dir)
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .map((name) => {
        const full = path.join(dir, name)
        const stat = fs.statSync(full)
        return {
          path: `/uploads/library/${name}`,
          name,
          createdAt: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    res.json({ ok: true, items })
  })

  router.post('/uploads/delete', requireAdmin, (req, res) => {
    const raw = String((req.body as { path?: string }).path ?? '')
    const match = /^\/uploads\/library\/([a-zA-Z0-9._-]+)$/.exec(raw)
    if (!match) {
      res.status(400).json({ ok: false, error: 'invalid_path' })
      return
    }
    const full = path.join(DATA_DIR, 'uploads', 'library', match[1])
    if (!fs.existsSync(full)) {
      res.status(404).json({ ok: false, error: 'not_found' })
      return
    }
    fs.unlinkSync(full)
    res.json({ ok: true })
  })

  // Catálogo: lectura admin; alta/edición/baja suave disponible a cualquier sesión
  // (Inventario edita stock/foto desde el piso; Config usa el mismo endpoint).
  router.get('/admin/products', requireAdmin, (_req, res) => {
    res.json({ ok: true, products: mvp.listProductsAdmin() })
  })
  router.post('/admin/products', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.upsertProduct({ ...req.body, actorId: req.user?.id }))
  })

  router.get('/raw-materials', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listRawMaterials() })
  })
  router.post('/raw-materials', requireAdmin, (req, res) => {
    res.json(mvp.upsertRawMaterial(req.body))
  })

  router.get('/recipes', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listRecipes() })
  })
  router.post('/recipes', requireAdmin, (req, res) => {
    res.json(mvp.saveRecipe(req.body))
  })
  /** Foto de ficha → rellena nombre/notas/ingredientes (visión opcional). */
  router.post('/recipes/parse-photo', requireAdmin, async (req, res) => {
    const body = req.body as { dataUrl?: string; photoPath?: string }
    const dataUrl = body.dataUrl ?? ''
    if (!dataUrl.startsWith('data:image/')) {
      res.status(400).json({ ok: false, error: 'invalid_image' })
      return
    }
    const materials = mvp
      .listRawMaterials()
      .filter((m) => (m as { active?: number }).active !== 0)
      .map((m) => ({
        id: String((m as { id: string }).id),
        name: String((m as { name: string }).name),
        unit: String((m as { unit?: string }).unit ?? ''),
      }))
    const products = mvp
      .listProductsAdmin()
      .filter((p) => (p as { active?: number }).active !== 0)
      .map((p) => ({
        id: String((p as { id: string }).id),
        name: String((p as { name: string }).name),
      }))
    const result = await parseRecipeFromPhoto({ dataUrl, materials, products })
    if (!result.ok) {
      // 200 + ok:false para que el cliente lea el error sin tratarlo como caída del server
      res.json(result)
      return
    }
    res.json({
      ok: true,
      photoPath: body.photoPath ?? null,
      recipe: result.recipe,
    })
  })

  router.get('/production-plans', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listProductionPlans() })
  })
  router.post('/production-plans', requireAuth, (req: AuthedRequest, res) => {
    res.json(
      mvp.createProductionPlan({
        ...req.body,
        businessDate: req.body.businessDate ?? localDateKey(),
        createdBy: req.user?.id,
      }),
    )
  })
  router.post('/production-plans/:id/confirm', requireAuth, (req, res) => {
    res.json(mvp.confirmProductionPlan(req.params.id, req.body.confirmed ?? []))
  })

  router.get('/suppliers', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listSuppliers() })
  })
  router.post('/suppliers', requireAdmin, (req, res) => {
    res.json(mvp.upsertSupplier(req.body))
  })
  router.get('/purchases', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listPurchases() })
  })
  router.post('/purchases', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.registerPurchase({ ...req.body, createdBy: req.user?.id }))
  })
  router.post('/supplier-payments', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.paySupplier({ ...req.body, createdBy: req.user?.id }))
  })

  router.get('/accounts', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listAccounts() })
  })
  router.get('/expenses', requireAuth, (req, res) => {
    const since =
      typeof req.query.since === 'string' ? req.query.since : undefined
    const until =
      typeof req.query.until === 'string' ? req.query.until : undefined
    const limit =
      typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
    res.json({
      ok: true,
      items: mvp.listExpenses({ sinceIso: since, untilIso: until, limit }),
    })
  })
  router.post('/expenses', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.registerExpense({ ...req.body, createdBy: req.user?.id }))
  })
  /** Lee monto/descripción de una foto de factura (visión opcional). */
  router.post('/expenses/parse-photo', requireAuth, async (req, res) => {
    const dataUrl =
      typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
    if (!dataUrl) {
      res.status(400).json({ ok: false, error: 'invalid_image' })
      return
    }
    const result = await parseExpenseFromPhoto({ dataUrl })
    res.status(result.ok ? 200 : 400).json(result)
  })
  router.post('/cash/transfer', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.transferCash({ ...req.body, createdBy: req.user?.id }))
  })

  router.get('/shifts/templates', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listShiftTemplates() })
  })
  router.post('/shifts/templates', requireAdmin, (req, res) => {
    res.json(mvp.createShiftTemplate(String(req.body.name ?? 'Turno')))
  })
  router.get('/shifts', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listShifts(), open: mvp.getOpenShift() })
  })
  router.get('/shifts/:id/summary', requireAdmin, (req, res) => {
    res.json(mvp.getShiftSummary(req.params.id))
  })
  router.post('/shifts/open', requireAuth, (req: AuthedRequest, res) => {
    res.json(
      mvp.openShift({
        ...req.body,
        businessDate: req.body.businessDate ?? localDateKey(),
        openedBy: req.user?.id,
      }),
    )
  })
  router.post('/shifts/:id/close', requireAuth, (req: AuthedRequest, res) => {
    res.json(
      mvp.closeShift({
        shiftId: req.params.id,
        closedBy: req.user?.id,
        countedCash: Number(req.body.countedCash),
        countedAccounts:
          req.body.countedAccounts &&
          typeof req.body.countedAccounts === 'object'
            ? (req.body.countedAccounts as Record<string, number>)
            : undefined,
        countedInventory: req.body.countedInventory ?? {},
        notes: req.body.notes,
        physicalSheetPhoto: req.body.physicalSheetPhoto,
      }),
    )
  })

  router.get('/proposals', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listProposals() })
  })
  router.post('/proposals', requireAuth, (req: AuthedRequest, res) => {
    res.json(
      mvp.createProposal({
        ...req.body,
        createdBy: req.user?.id ?? 'unknown',
      }),
    )
  })
  router.post('/proposals/:id/review', requireAdmin, (req: AuthedRequest, res) => {
    res.json(
      mvp.reviewProposal({
        proposalId: req.params.id,
        reviewerId: req.user!.id,
        note: req.body.note,
        decisions: req.body.decisions ?? [],
      }),
    )
  })
  router.post(
    '/proposals/:id/request-changes',
    requireAdmin,
    (req: AuthedRequest, res) => {
      res.json(
        mvp.requestProposalChanges(
          req.params.id,
          req.user!.id,
          String(req.body.note ?? ''),
        ),
      )
    },
  )

  router.get('/promos', requireAuth, (_req, res) => {
    res.json({ ok: true, items: mvp.listPromos() })
  })
  router.post('/promos', requireAdmin, (req, res) => {
    res.json(mvp.savePromo(req.body))
  })

  router.post('/inventory/counts', requireAuth, (req: AuthedRequest, res) => {
    res.json(mvp.saveInventoryCount({ ...req.body, createdBy: req.user?.id }))
  })

  router.get('/stock-movements', requireAuth, (req, res) => {
    res.json({
      ok: true,
      items: mvp.stockMovements(
        typeof req.query.productId === 'string' ? req.query.productId : undefined,
      ),
    })
  })

  router.get('/dashboard', requireAdmin, (req, res) => {
    res.json({
      ok: true,
      data: mvp.dashboard(
        typeof req.query.from === 'string' ? req.query.from : undefined,
        typeof req.query.to === 'string' ? req.query.to : undefined,
      ),
    })
  })

  router.get('/backups', requireAdmin, (_req, res) => {
    res.json({ ok: true, items: mvp.listBackups() })
  })
  router.post('/backups', requireAdmin, (req, res) => {
    res.json(mvp.backupManual(req.body?.note))
  })
  router.post('/backups/restore', requireAdmin, (req, res) => {
    const path = String(req.body?.path ?? '')
    res.json(mvp.restoreBackup(path))
  })

  router.get('/printer', requireAdmin, async (_req, res) => {
    res.json({ ok: true, ...(await mvp.getPrinterInfo()) })
  })
  router.post('/printer', requireAdmin, (req, res) => {
    res.json(
      mvp.savePrinter({
        printerName: String(req.body.printerName ?? ''),
        paperChars: Number(req.body.paperChars ?? 40),
      }),
    )
  })

  return router
}
