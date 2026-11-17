# Panadería Lela

Sistema de gestión local para panadería: facturación, inventario, producción, caja, turnos, compras y administración.

## Demo en la nube (GitHub Pages)

UI estática con Actions → Pages:

**https://rangulo160503.github.io/Lela/**

> La demo en Pages es el frontend. Datos reales (API + SQLite) requieren el modo portable local en LAN.

## Entrega portable

Archivo: **`Panaderia-Lela.zip`**

1. Extraer en la PC principal  
2. Ejecutar `Iniciar.bat`  
3. Abrir `http://127.0.0.1:3000`  
4. Otros dispositivos: `http://IP-DE-LA-PC:3000`

No requiere instalar Node, Python ni bases de datos.

Usuarios iniciales: `admin` / `1234` · `empleado` / `0000`

Ver `LEEME.txt` e `INFORME-MVP.md`.

## Desarrollo

```powershell
npm.cmd install
npm.cmd run dev
```

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run start
npm.cmd run pack:portable
```

## Datos

- SQLite: `data/panaderia-lela.sqlite`
- Respaldos: `data/backups/`

## Arquitectura

API → Abstracciones → Flujo → Reglas / DA / Servicios · Frontend React + Vite

## Identidad visual

Paleta artesanal (crema, café, terracota). Tipografías autoalojadas: **Fraunces** (titulares) + **Manrope** (UI). Marca: espiga en silueta plana (un color). Fotos locales en `public/images/` (sin CDN).

### UI 2026-11-17 (rediseño integral + ops)

- Tokens/primitivas en `src/index.css` + `src/styles/base.css` (`module-head`, `ds-toolbar`, `ds-table`, `ds-drawer`, botones, modales opacos)
- POS: overlay a pantalla completa; dual-pane catálogo \| carrito/cobro (desktop); pasos en móvil
- Empleado: Facturación · Inventario · **Cierre** (mismo flujo)
- Admin: + **Dashboard** · **Configuración**
- **Cierre** (`/admin`): dropdown **Caja · Conteo · Movimientos · Cerrar** (Cerrar = factura/resumen)
- **Dashboard** (`/admin/dashboard`): escoger turno → resumen (actividad, caja, movimientos, **conteo** del turno)
- **Configuración**: Catálogo, Combos, maestros, aprobaciones, usuarios, impresora, respaldos
- Sin área Trabajo; sin tab **Inicio**: post-login → `/facturacion` o `/admin`
- Catálogo admin: crear y **editar** productos (POST `/admin/products` con `id` = upsert)
- Cada producto tiene **foto propia** (`photo_path`): cámara/galería del móvil (`POST /api/uploads` → `data/uploads/`) o biblioteca en `public/images/products/`
- Layout adaptable: safe-areas; controles unificados (`--control-h` 3rem); radios bajos tipo retail
- Móvil: tab bar inferior (Facturar·Inventario·Cierre·Resumen·Config); header compacto; drawers full-screen; foto a ancho completo
- Capturas: `docs/screenshots/lela-*-redesign.png`

Fórmulas de venta/inventario intactas; sin dependencias nuevas.
