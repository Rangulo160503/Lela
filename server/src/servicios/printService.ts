import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { AppDatabase } from '../da/db.js'
import type { RegisteredSale } from '../reglas/types.js'
import { DATA_DIR } from '../config.js'

const execFileAsync = promisify(execFile)

export type PrinterSettings = {
  printerName: string
  paperChars: number
}

const SETTINGS_KEY = 'printer_settings'

export function getPrinterSettings(db: AppDatabase): PrinterSettings {
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .get(SETTINGS_KEY) as { value: string } | undefined
  if (!row) {
    return { printerName: '', paperChars: 40 }
  }
  try {
    return JSON.parse(row.value) as PrinterSettings
  } catch {
    return { printerName: '', paperChars: 40 }
  }
}

export function savePrinterSettings(
  db: AppDatabase,
  settings: PrinterSettings,
): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(SETTINGS_KEY, JSON.stringify(settings))
}

export async function listWindowsPrinters(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-Printer | Select-Object -ExpandProperty Name',
      ],
      { windowsHide: true },
    )
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Formato ticket ~40 columnas (TM-U220 papel 76mm Font B). */
export function formatSaleTicket(
  sale: RegisteredSale,
  paperChars = 40,
  businessName = 'Panaderia Lela',
): string {
  const w = Math.max(24, Math.min(48, paperChars))
  const line = (ch = '-') => ch.repeat(w)
  const row = (left: string, right: string) => {
    const space = Math.max(1, w - left.length - right.length)
    return `${left}${' '.repeat(space)}${right}`
  }
  const lines: string[] = []
  lines.push(center(businessName, w))
  lines.push(center('Comprobante de venta', w))
  lines.push(line())
  lines.push(`ID: ${sale.id.slice(0, 18)}`)
  lines.push(new Date(sale.createdAt).toLocaleString('es-CR'))
  lines.push(line())
  for (const item of sale.lines) {
    lines.push(`${item.quantity} x ${item.name}`.slice(0, w))
    lines.push(row(`  @ ${money(item.unitPrice)}`, money(item.subtotal)))
  }
  lines.push(line())
  lines.push(row('TOTAL', money(sale.total)))
  lines.push(row('Pago', sale.paymentMethod.toUpperCase()))
  lines.push(row('Recibido', money(sale.amountPaid)))
  if (sale.paymentMethod === 'efectivo') {
    lines.push(row('Vuelto', money(sale.change)))
  }
  lines.push(line())
  lines.push(center('Gracias', w))
  lines.push('')
  lines.push('')
  lines.push('')
  return lines.join('\r\n')
}

function center(text: string, w: number): string {
  if (text.length >= w) return text.slice(0, w)
  const pad = Math.floor((w - text.length) / 2)
  return `${' '.repeat(pad)}${text}`
}

function money(n: number): string {
  return `CRC ${n.toFixed(2)}`
}

export async function printText(
  db: AppDatabase,
  text: string,
  saleId?: string,
): Promise<{ ok: true; jobId: string } | { ok: false; error: string; jobId: string }> {
  const settings = getPrinterSettings(db)
  const jobId = `print-${Date.now()}`
  const insert = db.prepare(
    `INSERT INTO print_jobs (id, created_at, sale_id, status, printer_name, error_message, payload_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  if (!settings.printerName) {
    insert.run(
      jobId,
      new Date().toISOString(),
      saleId ?? null,
      'error',
      '',
      'No hay impresora configurada. Configure el nombre en Admin > Impresora.',
      text,
    )
    return {
      ok: false,
      error:
        'No hay impresora configurada. En Admin > Impresora elija la Epson instalada en Windows.',
      jobId,
    }
  }

  if (process.platform !== 'win32') {
    insert.run(
      jobId,
      new Date().toISOString(),
      saleId ?? null,
      'error',
      settings.printerName,
      'Impresión solo disponible en Windows.',
      text,
    )
    return { ok: false, error: 'Impresión solo disponible en Windows.', jobId }
  }

  const tmpDir = path.join(DATA_DIR, 'print-spool')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `${jobId}.txt`)
  fs.writeFileSync(tmpFile, text, 'utf8')

  try {
    // Imprime el archivo de texto a la impresora Windows instalada (USB o red).
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-Content -LiteralPath '${tmpFile.replace(/'/g, "''")}' | Out-Printer -Name '${settings.printerName.replace(/'/g, "''")}'`,
      ],
      { windowsHide: true, timeout: 30000 },
    )
    insert.run(
      jobId,
      new Date().toISOString(),
      saleId ?? null,
      'printed',
      settings.printerName,
      null,
      text,
    )
    return { ok: true, jobId }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'No se pudo enviar el trabajo a la impresora.'
    insert.run(
      jobId,
      new Date().toISOString(),
      saleId ?? null,
      'error',
      settings.printerName,
      message,
      text,
    )
    return { ok: false, error: message, jobId }
  } finally {
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      // ignore
    }
  }
}

export function detectConnectionHint(): string {
  return [
    '1) Instale el driver Epson TM-U220 en la PC principal.',
    '2) Conecte la impresora (USB o el puerto que use físicamente).',
    '3) En Windows, abra Impresoras y anote el nombre exacto.',
    '4) En Admin > Impresora, seleccione ese nombre y el ancho (40 columnas típico para 76mm).',
    `Host: ${os.hostname()}`,
  ].join('\n')
}
