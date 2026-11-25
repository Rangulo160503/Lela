# Panadería Lela

Sistema de gestión local para panadería: facturación, inventario, producción, caja, turnos, compras y administración.

## Demo en la nube (GitHub Pages)

UI estática con Actions → Pages:

**https://rangulo160503.github.io/Lela/**

> La demo en Pages es el frontend. Datos reales (API + SQLite) requieren el modo portable local en LAN.

## Arranque en la PC de la panadería

Solo **dos** archivos en la raíz:

| Archivo | Qué hace |
|---------|----------|
| **`Iniciar.bat`** | Instala Git/Node si faltan, **`git pull`** desde GitHub (preserva `data/`), `npm install` + build, reinicia, servidor `:3000` + túnel, abre el navegador |
| **`Detener.bat`** | Apaga servidor y túnel |

También sirve tras **Download ZIP** de [github.com/Rangulo160503/Lela](https://github.com/Rangulo160503/Lela) (primera vez necesita Internet).

Portable empaquetado: `npm run pack:portable` → `Panaderia-Lela.zip`.

Usuarios: `admin` / `1234` · `empleado` / `0000` · Ver `LEEME.txt`.

> El link `*.trycloudflare.com` **cambia** al reiniciar el túnel. Dominio fijo = Named Tunnel (después).

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

- SQLite durable (no se borra con git pull / ZIP): `%LOCALAPPDATA%\PanaderiaLela\data\panaderia-lela.sqlite`
- Catálogo en git: `data/bundled/panaderia-lela.sqlite` — `Iniciar.bat` lo restaura si la PC tiene menos productos
- Si existe `data/` junto al programa con una BD más completa, se migra sola a AppData
- Respaldos: `...\data\backups\` · seguridad ante update: `%LOCALAPPDATA%\PanaderiaLela\safety\`
- Override: variable `LELA_DATA_DIR`

## Arquitectura

API → Abstracciones → Flujo → Reglas / DA / Servicios · Frontend principal: **`lite/`** · React opcional: `/react`

## Identidad visual

Paleta artesanal (crema, café, terracota). Tipografías autoalojadas: **Fraunces** (titulares) + **Manrope** (UI). Marca: espiga en silueta plana (un color). Fotos en `public/images/` y `lite/images/`.

### UI 2026-11-17 (rediseño integral + ops)

- Tokens/primitivas en `src/index.css` + `src/styles/base.css` (`module-head`, `ds-toolbar`, `ds-table`, `ds-drawer`, botones, modales opacos)
- POS: overlay a pantalla completa; dual-pane catálogo \| carrito/cobro (desktop); pasos en móvil
- Empleado: Facturación · Inventario · **Cierre** (mismo flujo)
- Admin: + **Dashboard** · **Configuración**
- **Cierre** (`/admin`): dropdown **Caja · Conteo · Movimientos · Cerrar** (Cerrar = factura/resumen)
- **Dashboard** (`/admin/dashboard`): escoger turno → resumen (actividad, caja, movimientos, **conteo** del turno)
- **Configuración**: Catálogo, Combos, maestros, aprobaciones, usuarios, impresora, respaldos
- Sin área Trabajo; sin tab **Inicio**: post-login → `/facturacion` o `/admin`
- Catálogo / Inventario: crear, **editar** y **eliminar** (suave, `active=0`) productos; POST `/admin/products` (cualquier sesión autenticada)
- **Fotos** en productos, materia prima y combos: preview clickeable (vacío = subir; con foto = capa Cambiar/Quitar) → `POST /api/uploads`
- **Configuración → Fotos**: banco reutilizable; en el formulario, link «Elegir de fotos guardadas»
- Inventario: filas con miniatura; tocá para editar nombre, precio, stock y foto
- Combos, materia prima y proveedores: editar / eliminar desde el drawer de Configuración
- **Recetas**: lista en tarjetas (foto + producto, sin “v1”); ficha ancha con costo/u sticky, harina + rendimiento juntos, ingredientes y foto/notas plegables. Se guarda por 1 kg de harina.
- Avisos: toasts crema/terracota (`SoftToast`) y confirmaciones suaves (`SoftConfirm`) — sin `window.confirm` ni banner rojo de sistema.
- Materia prima: **saco (kg) + precio del saco** → ₡/kg automático (`pack_size_kg`, `pack_price`, `avg_cost`). En recetas se puede ajustar el ₡/kg y vuelve a la materia.
- Layout adaptable: safe-areas; controles unificados (`--control-h` 3rem); radios bajos tipo retail
- Móvil: tab bar inferior (Facturar·Inventario·Cierre·Resumen·Config); header compacto; drawers full-screen; foto a ancho completo
- Capturas: `docs/screenshots/lela-*-redesign.png`

- **UI principal = React** (`npm run build:web` → `dist/`). Abrí `http://IP:3000/` — Facturación (Nueva venta), Inventario, Cierre, Dashboard, Config. Es la versión del criterio del cliente.
- **UI por defecto (`/`):** `lite/` — Facturar · Saldos de inventario · **Gastos** (foto de factura o manual) · Cierre. Abrir turno exige **monto de apertura**; admin puede editarlo con el turno abierto. iPad 4 / iOS 9. Auth por `?token=` en Safari viejo.
- **Vitrina clientes (`/menu`):** página pública (sin login) con productos activos — foto, nombre, precio — y datos de la panadería. API: `GET /api/public/menu`. Edición en vivo: Config → **Menú público** (`GET/POST /api/bakery-public`). Dominio propio: después.
- **React opcional:** `http://IP:3000/react`
- **iPad / iOS 9:** solo `http://IP-LAN:3000/` (archivo `ipad-url.txt`). El túnel `trycloudflare` **no abre** en iOS 9 (certificado). Celulares modernos sí pueden usar el túnel.

Fórmulas de venta/inventario intactas; sin dependencias nuevas.
