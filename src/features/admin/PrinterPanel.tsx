type PrinterPanelProps = {
  printers: string[]
  printerName: string
  paperChars: number
  printerHint: string
  onPrinterName: (v: string) => void
  onPaperChars: (v: number) => void
  onSave: () => void
}

export function PrinterPanel({
  printers,
  printerName,
  paperChars,
  printerHint,
  onPrinterName,
  onPaperChars,
  onSave,
}: PrinterPanelProps) {
  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Impresora</h2>
      </div>
      <p className="page__hint">Configuración de la PC principal.</p>
      <pre className="printer-hint">{printerHint}</pre>
      <div className="admin-form" style={{ maxWidth: '28rem' }}>
        <select
          className="field__input"
          value={printerName}
          onChange={(e) => onPrinterName(e.target.value)}
        >
          <option value="">Seleccionar impresora Windows</option>
          {printers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="field__label" htmlFor="paper-chars">
          Columnas (TM-U220 ~40 en papel 76mm)
        </label>
        <input
          id="paper-chars"
          className="field__input"
          type="number"
          value={paperChars}
          onChange={(e) => onPaperChars(Number(e.target.value))}
        />
        <button type="button" className="btn btn--primary" onClick={onSave}>
          Guardar
        </button>
      </div>
    </section>
  )
}
