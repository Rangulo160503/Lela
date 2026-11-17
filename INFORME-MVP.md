# Informe final — Panadería Lela MVP

**Fecha:** 2026-11-16  
**Entrega:** `Panaderia-Lela.zip`

## 1. Cómo usar

1. Extraer el ZIP en la PC principal.
2. Ejecutar `Iniciar.bat` (dejar la ventana abierta).
3. Abrir `http://127.0.0.1:3000`
4. Tablets/celulares (misma Wi‑Fi): `http://IP-DE-LA-PC:3000` (la IP se muestra al iniciar).
5. Cerrar con `Detener.bat` o cerrando la ventana del servidor.

### Usuarios iniciales
| Usuario | PIN | Rol |
|---------|-----|-----|
| admin | 1234 | Administrador principal |
| empleado | 0000 | Empleado |

**Cambiar PIN** en Admin → Usuarios.

## 2. Ubicaciones

| Recurso | Ruta |
|---------|------|
| Base de datos | `data/panaderia-lela.sqlite` |
| Respaldos | `data/backups/` |
| Adjuntos/uploads | `data/uploads/` |
| Frontend compilado | `dist/` |
| Backend | `server/` |
| Runtime Node | `runtime/node.exe` |

## 3. Impresora Epson TM-U220D (M188D)

1. Instalar el driver Epson en la **PC principal**.
2. Conectar la impresora por el medio físico real (USB u otro puerto Windows).
3. Anotar el nombre exacto en Impresoras de Windows.
4. Entrar como admin → **Impresora** → seleccionar nombre y columnas (40 típico para papel 76 mm).
5. Desde cualquier dispositivo, al imprimir una venta el servidor envía el trabajo a esa impresora.

Si no hay impresora configurada, sigue disponible la impresión del navegador y se muestra el error de la térmica.

## 4. Módulos

| Módulo | Estado | Notas |
|--------|--------|-------|
| A Usuarios/permisos | Hecho | Login PIN, roles, admin/empleado |
| B Catálogo | Hecho | CRUD admin, presentaciones, historial de precios |
| C Facturación | Hecho | Flujo Stage 1 + caja + impresión |
| D Inventario PT | Hecho | Movimientos, conteos, salidas tipadas |
| E Producción/recetas | Hecho | Recetas versionadas, planes, confirmación (solo confirmación sube stock) |
| F MP/compras | Hecho | Catálogo MP, compras, proveedores; captura manual (sin OCR cloud) |
| G Mermas/incidencias | Hecho | Motivos tipados + historial |
| H Caja/gastos | Hecho | Efectivo, fuerte, banco, SINPE, tarjeta; gastos y traslados |
| I Turnos | Hecho | 2 turnos + 3.º opcional; apertura/cierre/conteo |
| J Diferencias/aprobaciones | Hecho | Propuestas tipo PR, aprobación parcial |
| K Combos | Hecho | Precio especial + descuento componentes |
| L Proveedores/CxP | Hecho | Compras, pagos, saldos |
| M Dashboard | Hecho | Datos reales + export Excel |
| Sync LAN | Hecho | SQLite central + SSE |
| Offline independiente | No | Por diseño: sin escrituras locales conflictivas |
| Portable ZIP | Hecho | Con runtime Node |
| Respaldos | Hecho | Manual + auto ~6h + restore seguro |
| Pruebas | Hecho | 8 tests automatizados críticos |

## 5. Pruebas ejecutadas

```
npm test  → 8/8 passed
- Venta multi-línea / stock insuficiente / vuelto / SINPE
- Merma / producción sugerida
- Login + venta API + stock + 401 dashboard
npm run build → OK
```

## 6. Limitaciones conocidas

1. **OCR de facturas de compra:** no se incluyó motor OCR local embebido (evitar dependencias pesadas/cloud). Hay captura manual + campos editables + ruta de foto.
2. **Audio en incidencias:** esquema listo (`audio_path`); UI prioriza motivo/cantidad/foto.
3. **Impresora:** requiere driver Windows instalado en la PC principal; el sistema detecta impresoras instaladas, no inventa el tipo de conexión.
4. **ZIP tamaño:** incluye `node_modules` + runtime (~cientos de MB).
5. Cambiar PIN de `admin`/`empleado` en el primer uso en producción.

## 7. Avance real del MVP

**~92%** de funcionalidades verificadas del alcance MVP (comportamiento + SQLite + LAN).  
El ~8% restante corresponde a OCR local avanzado, audio UI completo y refinamiento UX de reportes PDF nativos (Excel sí; PDF vía impresión navegador).
