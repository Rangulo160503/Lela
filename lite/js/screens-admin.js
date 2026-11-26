/* ES5 admin screens — iOS 9 / Safari 9.3.5. No modules, no fetch/Promise. */
(function () {
  'use strict'

  Lela.screens = Lela.screens || {}

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100
  }

  function trim(s) {
    return String(s || '').replace(/^\s+|\s+$/g, '')
  }

  function val(id) {
    var el = Lela.$(id)
    return el ? el.value : ''
  }

  function num(id) {
    return Number(val(id)) || 0
  }

  function setHtml(main, html) {
    main.innerHTML = html
  }

  function toolbar(title, btnLabel, btnId, soft) {
    return (
      '<div class="toolbar' +
      (soft ? ' toolbar--soft' : '') +
      '">' +
      '<h2>' +
      esc(title) +
      '</h2>' +
      (btnLabel
        ? soft
          ? '<button type="button" class="soft-link" id="' +
            esc(btnId) +
            '">' +
            esc(btnLabel) +
            '</button>'
          : '<button type="button" class="btn btn-primary btn-sm" id="' +
            esc(btnId) +
            '">' +
            esc(btnLabel) +
            '</button>'
        : '') +
      '</div>'
    )
  }

  function emptyMsg(text) {
    return '<p class="empty">' + esc(text || 'Sin datos.') + '</p>'
  }

  function afterSave(main, reloadFn) {
    Lela.closeDrawer()
    if (Lela.state && Lela.state.refreshSnapshot) {
      Lela.state.refreshSnapshot(function () {
        reloadFn(main)
      })
    } else {
      reloadFn(main)
    }
  }

  /** Photo via #file-pick → JPEG dataUrl → POST /uploads. onDone(path|null). */
  function pickPhoto(kind, onDone) {
    var input = document.getElementById('file-pick')
    if (!input) {
      if (onDone) onDone(null)
      return
    }
    input.value = ''
    input.onchange = function () {
      var file = input.files && input.files[0]
      input.onchange = null
      input.value = ''
      if (!file) {
        if (onDone) onDone(null)
        return
      }
      Lela.fileToJpegDataUrl(file, 1280, 0.82, function (dataUrl) {
        if (!dataUrl) {
          Lela.toast('No se pudo leer la imagen', 'err')
          if (onDone) onDone(null)
          return
        }
        Lela.uploadDataUrl(dataUrl, kind || 'product', function (res) {
          if (!res || !res.ok || !res.path) {
            Lela.toast((res && res.error) || 'No se pudo subir la foto', 'err')
            if (onDone) onDone(null)
            return
          }
          if (onDone) onDone(res.path)
        })
      })
    }
    if (input.click) input.click()
  }

  function photoPreviewHtml(path, imgId) {
    var style = path
      ? ' style="background-image:url(' + esc(path) + ')"'
      : ''
    return (
      '<div class="photo-prev" id="' +
      esc(imgId || 'f-photo-prev') +
      '"' +
      style +
      '></div>' +
      '<input type="hidden" id="f-photo" value="' +
      esc(path || '') +
      '" />' +
      '<button type="button" class="btn btn-secondary btn-block" id="f-photo-btn">Cambiar foto</button>'
    )
  }

  function bindPhotoButton(kind) {
    var btn = Lela.$('f-photo-btn')
    if (!btn) return
    btn.onclick = function () {
      pickPhoto(kind, function (path) {
        if (!path) return
        var hid = Lela.$('f-photo')
        var prev = Lela.$('f-photo-prev')
        if (hid) hid.value = path
        if (prev) prev.style.backgroundImage = 'url(' + path + ')'
      })
    }
  }

  function footSave(saveId, removeId, hasId) {
    return (
      '<button type="button" class="btn btn-primary btn-block" id="' +
      esc(saveId) +
      '">Guardar</button>' +
      (hasId
        ? '<button type="button" class="btn btn-danger btn-block" id="' +
          esc(removeId) +
          '">Eliminar</button>'
        : '')
    )
  }

  function productOptions(selectedId) {
    var snap = (Lela.state && Lela.state.snapshot) || {}
    var products = snap.products || []
    var html = '<option value="">— producto —</option>'
    var i
    for (i = 0; i < products.length; i++) {
      if (!Lela.isActive(products[i])) continue
      html +=
        '<option value="' +
        esc(products[i].id) +
        '"' +
        (products[i].id === selectedId ? ' selected' : '') +
        '>' +
        esc(products[i].name) +
        '</option>'
    }
    return html
  }

  function findProduct(id) {
    var snap = (Lela.state && Lela.state.snapshot) || {}
    var products = snap.products || []
    var i
    for (i = 0; i < products.length; i++) {
      if (products[i].id === id) return products[i]
    }
    return null
  }

  /* ---------- 1. Dashboard ---------- */
  Lela.screens.dash = function (main) {
    setHtml(main, toolbar('Resumen') + '<p class="empty">Cargando…</p>')
    Lela.get('/shifts', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Resumen') + emptyMsg('No se pudieron cargar turnos.'))
        return
      }
      var items = data.items || []
      var html = toolbar('Resumen')
      if (!items.length) {
        setHtml(main, html + emptyMsg('Sin turnos.'))
        return
      }
      html +=
        '<label class="field"><span>Turno</span>' +
        '<select id="dash-shift">'
      var i
      for (i = 0; i < items.length; i++) {
        var s = items[i]
        var label =
          (s.businessDate || '') +
          ' · ' +
          (s.status || '') +
          (s.openedAt ? ' · ' + String(s.openedAt).slice(0, 16) : '')
        html +=
          '<option value="' +
          esc(s.id) +
          '">' +
          esc(label) +
          '</option>'
      }
      html += '</select></label><div id="dash-summary"></div>'
      setHtml(main, html)
      var sel = Lela.$('dash-shift')
      function loadSummary() {
        var id = sel && sel.value
        var host = Lela.$('dash-summary')
        if (!host || !id) return
        host.innerHTML = '<p class="empty">Cargando resumen…</p>'
        Lela.get('/shifts/' + encodeURIComponent(id) + '/summary', function (res) {
          if (!res || !res.ok || !res.data) {
            host.innerHTML = emptyMsg((res && res.error) || 'Sin resumen.')
            return
          }
          var d = res.data
          var sh = d.shift || {}
          var out =
            '<div class="kpi">' +
            '<div class="kpi__item"><span class="kpi__label">Ventas</span><span class="kpi__val">' +
            esc(d.salesCount || 0) +
            '</span></div>' +
            '<div class="kpi__item"><span class="kpi__label">Total</span><span class="kpi__val">' +
            esc(Lela.money(d.salesTotal)) +
            '</span></div>' +
            '<div class="kpi__item"><span class="kpi__label">Estado</span><span class="kpi__val">' +
            esc(sh.status || '—') +
            '</span></div></div>'

          var by = d.byMethod || {}
          var methods = []
          var m
          for (m in by) {
            if (by.hasOwnProperty(m)) {
              methods.push(
                '<span class="chip">' +
                  esc(m) +
                  ': ' +
                  esc(Lela.money(by[m])) +
                  '</span>'
              )
            }
          }
          if (methods.length) {
            out += '<p class="h2">Por método</p><div>' + methods.join('') + '</div>'
          }

          var accounts = d.accounts || []
          if (accounts.length) {
            out += '<p class="h2">Cuentas</p><div class="list">'
            var a
            for (a = 0; a < accounts.length; a++) {
              out +=
                '<div class="row"><div class="row__name">' +
                esc(accounts[a].name || accounts[a].id) +
                '</div><div class="row__right">' +
                esc(Lela.money(accounts[a].balance)) +
                '</div></div>'
            }
            out += '</div>'
          }

          if (sh.expectedCash != null || sh.countedCash != null) {
            out +=
              '<p class="h2">Efectivo</p><div class="list">' +
              '<div class="row"><div class="row__name">Esperado</div><div class="row__right">' +
              esc(sh.expectedCash != null ? Lela.money(sh.expectedCash) : '—') +
              '</div></div>' +
              '<div class="row"><div class="row__name">Contado</div><div class="row__right">' +
              esc(sh.countedCash != null ? Lela.money(sh.countedCash) : '—') +
              '</div></div></div>'
          }

          var expA = d.expectedAccounts || {}
          var cntA = d.countedAccounts || {}
          var hasAcc = false
          var k
          for (k in expA) {
            if (expA.hasOwnProperty(k)) hasAcc = true
          }
          for (k in cntA) {
            if (cntA.hasOwnProperty(k)) hasAcc = true
          }
          if (hasAcc) {
            out += '<p class="h2">Cuentas esperado vs contado</p><div class="list">'
            var seen = {}
            for (k in expA) {
              if (!expA.hasOwnProperty(k)) continue
              seen[k] = true
              out +=
                '<div class="row"><div class="row__name">' +
                esc(k) +
                '</div><div class="row__meta">esp ' +
                esc(Lela.money(expA[k])) +
                ' · cont ' +
                esc(cntA[k] != null ? Lela.money(cntA[k]) : '—') +
                '</div></div>'
            }
            for (k in cntA) {
              if (!cntA.hasOwnProperty(k) || seen[k]) continue
              out +=
                '<div class="row"><div class="row__name">' +
                esc(k) +
                '</div><div class="row__meta">esp — · cont ' +
                esc(Lela.money(cntA[k])) +
                '</div></div>'
            }
            out += '</div>'
          }

          host.innerHTML = out
        })
      }
      if (sel) {
        sel.onchange = loadSummary
        loadSummary()
      }
    })
  }

  /* ---------- 2. Products ---------- */
  function openProductDrawer(main, product) {
    var p = product || {}
    var editing = !!p.id
    var body =
      '<label class="field"><span>Nombre</span>' +
      '<input id="f-name" type="text" value="' +
      esc(p.name || '') +
      '" /></label>' +
      '<label class="field"><span>Presentación</span>' +
      '<input id="f-pres" type="text" value="' +
      esc(p.presentationName || 'Unidad') +
      '" /></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Precio</span>' +
      '<input id="f-price" type="number" value="' +
      esc(p.unitPrice != null ? p.unitPrice : 10) +
      '" /></label>' +
      '<label class="field"><span>Stock</span>' +
      '<input id="f-stock" type="number" value="' +
      esc(p.physicalStock != null ? p.physicalStock : 0) +
      '" /></label></div>' +
      '<label class="field"><span>Descripción</span>' +
      '<textarea id="f-desc">' +
      esc(p.description || '') +
      '</textarea></label>' +
      photoPreviewHtml(Lela.productImage(p), 'f-photo-prev')

    Lela.openDrawer(
      editing ? 'Editar producto' : 'Nuevo producto',
      body,
      footSave('f-save', 'f-del', editing)
    )
    bindPhotoButton('product')

    Lela.$('f-save').onclick = function () {
      var name = trim(val('f-name'))
      if (!name) {
        Lela.toast('Nombre requerido', 'err')
        return
      }
      var payload = {
        id: p.id,
        name: name,
        presentationName: trim(val('f-pres')) || 'Unidad',
        unitPrice: num('f-price'),
        physicalStock: num('f-stock'),
        description: trim(val('f-desc')),
        photoPath: val('f-photo') || null,
        active: true,
      }
      Lela.post('/admin/products', payload, function (res) {
        if (!res || res.ok === false) {
          Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
          return
        }
        Lela.toast(editing ? 'Producto actualizado' : 'Producto guardado', 'ok')
        afterSave(main, Lela.screens.products)
      })
    }

    if (editing && Lela.$('f-del')) {
      Lela.$('f-del').onclick = function () {
        Lela.confirmSoft(
          {
            title: 'Eliminar producto',
            body: 'Se ocultará del catálogo.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            Lela.post(
              '/admin/products',
              {
                id: p.id,
                name: p.name,
                presentationName: p.presentationName || 'Unidad',
                unitPrice: p.unitPrice,
                physicalStock: p.physicalStock,
                description: p.description || '',
                photoPath: p.photoPath || null,
                active: false,
              },
              function (res) {
                if (!res || res.ok === false) {
                  Lela.toast((res && res.error) || 'No se pudo eliminar', 'err')
                  return
                }
                Lela.toast('Producto eliminado', 'ok')
                afterSave(main, Lela.screens.products)
              }
            )
          }
        )
      }
    }
  }

  var productsFilter = ''

  Lela.screens.products = function (main) {
    var snap = (Lela.state && Lela.state.snapshot) || {}
    var products = snap.products || []
    var html = toolbar('Productos', 'Agregar', 'btn-new-product', true)
    html +=
      '<div class="field catalog-filter">' +
      '<input id="cat-search" class="field__input" type="search" placeholder="Buscar por nombre…" value="' +
      esc(productsFilter) +
      '" autocapitalize="off" autocomplete="off" />' +
      '</div>'
    var rows = []
    var i
    for (i = 0; i < products.length; i++) {
      if (!Lela.isActive(products[i])) continue
      rows.push(products[i])
    }
    html += '<div class="list" id="cat-list"></div>'
    setHtml(main, html)

    function paintCatalog() {
      var list = Lela.$('cat-list')
      if (!list) return
      var q = (productsFilter || '').toLowerCase()
      var out = ''
      var shown = 0
      var j
      for (j = 0; j < rows.length; j++) {
        ;(function (p) {
          var name = String(p.name || '')
          if (q && name.toLowerCase().indexOf(q) === -1) return
          shown++
          out +=
            '<div class="row row--tap" data-id="' +
            esc(p.id) +
            '">' +
            '<div class="row__thumb" style="background-image:url(' +
            esc(Lela.productImage(p)) +
            ')"' +
            '></div>' +
            '<div class="row__name">' +
            esc(name) +
            '</div>' +
            '<div class="row__meta">' +
            esc(Lela.money(p.unitPrice)) +
            ' · stock ' +
            esc(p.physicalStock != null ? p.physicalStock : 0) +
            '</div></div>'
        })(rows[j])
      }
      if (!shown) {
        out =
          '<div class="row empty">' +
          esc(
            rows.length
              ? 'Ningún producto coincide.'
              : 'Sin productos activos.'
          ) +
          '</div>'
      }
      list.innerHTML = out
      var taps = list.querySelectorAll('.row--tap')
      var t
      for (t = 0; t < taps.length; t++) {
        ;(function (el) {
          el.onclick = function () {
            var id = el.getAttribute('data-id')
            var found = null
            var k
            for (k = 0; k < products.length; k++) {
              if (products[k].id === id) {
                found = products[k]
                break
              }
            }
            if (found) openProductDrawer(main, found)
          }
        })(taps[t])
      }
    }

    var search = Lela.$('cat-search')
    if (search) {
      function onCatSearch() {
        productsFilter = search.value || ''
        paintCatalog()
      }
      search.oninput = onCatSearch
      search.onkeyup = onCatSearch
    }
    var btn = Lela.$('btn-new-product')
    if (btn) {
      btn.onclick = function () {
        openProductDrawer(main, null)
      }
    }
    paintCatalog()
  }

  /* ---------- 3. Promos / combos ---------- */
  function openPromoDrawer(main, promo, products) {
    var p = promo || {}
    var editing = !!p.id
    var first = (p.components && p.components[0]) || {}
    var body =
      '<label class="field"><span>Nombre</span>' +
      '<input id="f-name" type="text" value="' +
      esc(p.name || '') +
      '" /></label>' +
      '<label class="field"><span>Precio</span>' +
      '<input id="f-price" type="number" value="' +
      esc(p.price != null ? p.price : 0) +
      '" /></label>' +
      '<label class="field"><span>Producto</span>' +
      '<select id="f-prod">' +
      productOptions(first.productId || '') +
      '</select></label>' +
      '<label class="field"><span>Cantidad</span>' +
      '<input id="f-qty" type="number" value="' +
      esc(first.quantity != null ? first.quantity : 1) +
      '" /></label>' +
      photoPreviewHtml(p.photoPath || '', 'f-photo-prev')

    Lela.openDrawer(
      editing ? 'Editar combo' : 'Nuevo combo',
      body,
      footSave('f-save', 'f-del', editing)
    )
    bindPhotoButton('product')

    function savePromo(active) {
      var name = trim(val('f-name'))
      var productId = val('f-prod')
      if (!name) {
        Lela.toast('Nombre requerido', 'err')
        return
      }
      if (!productId) {
        Lela.toast('Elegí un producto', 'err')
        return
      }
      Lela.post(
        '/promos',
        {
          id: p.id,
          name: name,
          kind: 'combo',
          price: num('f-price'),
          photoPath: val('f-photo') || null,
          active: active !== false,
          components: [
            {
              productId: productId,
              quantity: num('f-qty') || 1,
              substitutable: true,
            },
          ],
        },
        function (res) {
          if (!res || res.ok === false) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          Lela.toast(
            active === false
              ? 'Combo eliminado'
              : editing
                ? 'Combo actualizado'
                : 'Combo guardado',
            'ok'
          )
          afterSave(main, Lela.screens.promos)
        }
      )
    }

    Lela.$('f-save').onclick = function () {
      savePromo(true)
    }
    if (editing && Lela.$('f-del')) {
      Lela.$('f-del').onclick = function () {
        Lela.confirmSoft(
          {
            title: 'Eliminar combo',
            body: 'Se ocultará el combo.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            savePromo(false)
          }
        )
      }
    }
  }

  function renderPromosList(main, items) {
    var html = toolbar('Combos', 'Nuevo', 'btn-new-promo')
    var rows = []
    var i
    for (i = 0; i < items.length; i++) {
      if (!Lela.isActive(items[i])) continue
      rows.push(items[i])
    }
    if (!rows.length) {
      html += emptyMsg('Sin combos.')
    } else {
      html += '<div class="list">'
      for (i = 0; i < rows.length; i++) {
        var p = rows[i]
        html +=
          '<div class="row row--tap" data-id="' +
          esc(p.id) +
          '">' +
          '<div class="row__thumb" style="background-image:url(' +
          esc(p.photoPath || '/images/pastry.jpg') +
          ')"></div>' +
          '<div class="row__name">' +
          esc(p.name) +
          '</div>' +
          '<div class="row__meta">' +
          esc(Lela.money(p.price)) +
          '</div></div>'
      }
      html += '</div>'
    }
    setHtml(main, html)
    var btn = Lela.$('btn-new-promo')
    if (btn) {
      btn.onclick = function () {
        openPromoDrawer(main, null)
      }
    }
    var taps = main.querySelectorAll('.row--tap')
    for (i = 0; i < taps.length; i++) {
      ;(function (el) {
        el.onclick = function () {
          var id = el.getAttribute('data-id')
          var found = null
          var j
          for (j = 0; j < items.length; j++) {
            if (items[j].id === id) {
              found = items[j]
              break
            }
          }
          if (found) openPromoDrawer(main, found)
        }
      })(taps[i])
    }
  }

  Lela.screens.promos = function (main) {
    var snap = (Lela.state && Lela.state.snapshot) || {}
    if (snap.promos && snap.promos.length) {
      renderPromosList(main, snap.promos)
      return
    }
    setHtml(main, toolbar('Combos') + '<p class="empty">Cargando…</p>')
    Lela.get('/promos', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Combos') + emptyMsg('No se pudieron cargar combos.'))
        return
      }
      renderPromosList(main, data.items || [])
    })
  }

  /* ---------- 4. Materials ---------- */
  function openMaterialDrawer(main, mat) {
    var m = mat || {}
    var editing = !!m.id
    var packSize =
      m.packSizeKg && m.packSizeKg > 0
        ? m.packSizeKg
        : 25
    var packPrice =
      m.packPrice != null
        ? m.packPrice
        : roundMoney((m.avgCost || 0) * packSize)
    var body =
      '<label class="field"><span>Nombre</span>' +
      '<input id="f-name" type="text" value="' +
      esc(m.name || '') +
      '" /></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Kg por saco</span>' +
      '<input id="f-pack-kg" type="number" value="' +
      esc(packSize) +
      '" /></label>' +
      '<label class="field"><span>Precio saco</span>' +
      '<input id="f-pack-price" type="number" value="' +
      esc(packPrice) +
      '" /></label></div>' +
      '<p class="kpi__label" id="f-cost-hint">₡/kg: —</p>' +
      '<div class="field-row">' +
      '<label class="field"><span>Stock</span>' +
      '<input id="f-stock" type="number" value="' +
      esc(m.stock != null ? m.stock : 0) +
      '" /></label>' +
      '<label class="field"><span>Unidad</span>' +
      '<input id="f-unit" type="text" value="' +
      esc(m.unit || 'kg') +
      '" /></label></div>' +
      photoPreviewHtml(m.photoPath || '', 'f-photo-prev')

    Lela.openDrawer(
      editing ? 'Editar materia' : 'Nueva materia',
      body,
      footSave('f-save', 'f-del', editing)
    )
    bindPhotoButton('material')

    function updateCostHint() {
      var kg = num('f-pack-kg')
      var price = num('f-pack-price')
      var hint = Lela.$('f-cost-hint')
      if (!hint) return
      if (kg > 0) {
        hint.textContent = '₡/kg: ' + Lela.money(price / kg)
      } else {
        hint.textContent = '₡/kg: —'
      }
    }
    var pkg = Lela.$('f-pack-kg')
    var pp = Lela.$('f-pack-price')
    if (pkg) pkg.oninput = updateCostHint
    if (pp) pp.oninput = updateCostHint
    updateCostHint()

    function saveMat(active) {
      var name = trim(val('f-name'))
      var packSizeKg = num('f-pack-kg')
      if (!name) {
        Lela.toast('Nombre requerido', 'err')
        return
      }
      if (!(packSizeKg > 0)) {
        Lela.toast('Kg por saco debe ser > 0', 'err')
        return
      }
      var packPriceVal = num('f-pack-price')
      Lela.post(
        '/raw-materials',
        {
          id: m.id,
          name: name,
          unit: trim(val('f-unit')) || 'kg',
          stock: num('f-stock'),
          packSizeKg: packSizeKg,
          packPrice: packPriceVal,
          avgCost: packPriceVal / packSizeKg,
          photoPath: val('f-photo') || null,
          active: active !== false,
        },
        function (res) {
          if (!res || res.ok === false) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          Lela.toast(
            active === false
              ? 'Materia eliminada'
              : editing
                ? 'Materia actualizada'
                : 'Materia guardada',
            'ok'
          )
          afterSave(main, Lela.screens.materials)
        }
      )
    }

    Lela.$('f-save').onclick = function () {
      saveMat(true)
    }
    if (editing && Lela.$('f-del')) {
      Lela.$('f-del').onclick = function () {
        Lela.confirmSoft(
          {
            title: 'Eliminar materia',
            body: 'Se ocultará la materia prima.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            saveMat(false)
          }
        )
      }
    }
  }

  Lela.screens.materials = function (main) {
    setHtml(main, toolbar('Materias') + '<p class="empty">Cargando…</p>')
    Lela.get('/raw-materials', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Materias') + emptyMsg('No se pudieron cargar.'))
        return
      }
      var items = data.items || []
      var html = toolbar('Materias', 'Nueva', 'btn-new-mat')
      var rows = []
      var i
      for (i = 0; i < items.length; i++) {
        if (!Lela.isActive(items[i])) continue
        rows.push(items[i])
      }
      if (!rows.length) {
        html += emptyMsg('Sin materias.')
      } else {
        html += '<div class="list">'
        for (i = 0; i < rows.length; i++) {
          var m = rows[i]
          var cpk =
            m.packSizeKg && m.packSizeKg > 0
              ? m.packPrice / m.packSizeKg
              : m.avgCost || 0
          html +=
            '<div class="row row--tap" data-id="' +
            esc(m.id) +
            '">' +
            '<div class="row__thumb"' +
            (m.photoPath
              ? ' style="background-image:url(' + esc(m.photoPath) + ')"'
              : '') +
            '></div>' +
            '<div class="row__name">' +
            esc(m.name) +
            '</div>' +
            '<div class="row__meta">' +
            esc(Lela.money(cpk)) +
            '/kg · stock ' +
            esc(m.stock != null ? m.stock : 0) +
            '</div></div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var btn = Lela.$('btn-new-mat')
      if (btn) {
        btn.onclick = function () {
          openMaterialDrawer(main, null)
        }
      }
      var taps = main.querySelectorAll('.row--tap')
      for (i = 0; i < taps.length; i++) {
        ;(function (el) {
          el.onclick = function () {
            var id = el.getAttribute('data-id')
            var found = null
            var j
            for (j = 0; j < items.length; j++) {
              if (items[j].id === id) {
                found = items[j]
                break
              }
            }
            if (found) openMaterialDrawer(main, found)
          }
        })(taps[i])
      }
    })
  }

  /* ---------- 5. Recipes ---------- */
  function percentToGrams(percent) {
    return (Number(percent) || 0) * 10
  }

  function gramsToPercent(grams) {
    return (Number(grams) || 0) / 10
  }

  function materialOptionsHtml(materials, selectedId) {
    var html = '<option value="">— materia —</option>'
    var i
    for (i = 0; i < materials.length; i++) {
      if (!Lela.isActive(materials[i])) continue
      html +=
        '<option value="' +
        esc(materials[i].id) +
        '"' +
        (materials[i].id === selectedId ? ' selected' : '') +
        '>' +
        esc(materials[i].name) +
        '</option>'
    }
    return html
  }

  function findMat(materials, id) {
    var i
    for (i = 0; i < materials.length; i++) {
      if (materials[i].id === id) return materials[i]
    }
    return null
  }

  function openRecipeDrawer(main, recipe, materials, products) {
    var r = recipe || {}
    var editing = !!r.id
    var baseKg = 1
    var lines = []
    var i

    if (r.ingredients && r.ingredients.length) {
      for (i = 0; i < r.ingredients.length; i++) {
        var ing = r.ingredients[i]
        var mat = findMat(materials, ing.rawMaterialId)
        var gpk = percentToGrams(ing.quantity)
        lines.push({
          rawMaterialId: ing.rawMaterialId || '',
          gramsBatch: gpk * baseKg,
          costPerKg: mat ? mat.avgCost || 0 : 0,
        })
      }
    } else {
      lines.push({ rawMaterialId: '', gramsBatch: 1000, costPerKg: 0 })
    }

    function summaryHtml() {
      return (
        '<div class="panel" id="rec-summary" style="position:sticky;top:0;z-index:2">' +
        '<div class="kpi">' +
        '<div class="kpi__item"><span class="kpi__label">Lote</span><span class="kpi__val" id="rec-batch-cost">—</span></div>' +
        '<div class="kpi__item"><span class="kpi__label">Unitario</span><span class="kpi__val" id="rec-unit-cost">—</span></div>' +
        '<div class="kpi__item"><span class="kpi__label">Margen</span><span class="kpi__val" id="rec-margin">—</span></div>' +
        '</div></div>'
      )
    }

    function linesHtml() {
      var h = '<div id="rec-lines">'
      var j
      for (j = 0; j < lines.length; j++) {
        h +=
          '<div class="panel rec-line" data-idx="' +
          j +
          '">' +
          '<label class="field"><span>Materia</span>' +
          '<select class="rec-mat">' +
          materialOptionsHtml(materials, lines[j].rawMaterialId) +
          '</select></label>' +
          '<div class="field-row">' +
          '<label class="field"><span>Gramos</span>' +
          '<input class="rec-g" type="number" value="' +
          esc(lines[j].gramsBatch) +
          '" /></label>' +
          '<label class="field"><span>₡/kg</span>' +
          '<input class="rec-c" type="number" value="' +
          esc(lines[j].costPerKg) +
          '" /></label></div>' +
          '<button type="button" class="btn btn-ghost btn-sm rec-rm">Quitar</button>' +
          '</div>'
      }
      h += '</div>'
      return h
    }

    var body =
      summaryHtml() +
      '<label class="field"><span>Producto</span>' +
      '<select id="f-prod">' +
      productOptions(r.productId || '') +
      '</select></label>' +
      '<label class="field"><span>Nombre</span>' +
      '<input id="f-name" type="text" value="' +
      esc(r.name || '') +
      '" /></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Base kg (UI)</span>' +
      '<input id="f-base" type="number" value="1" /></label>' +
      '<label class="field"><span>Unidades / 1kg</span>' +
      '<input id="f-yield" type="number" value="' +
      esc(r.batchYield && r.batchYield > 0 ? r.batchYield : 1) +
      '" /></label></div>' +
      linesHtml() +
      '<button type="button" class="btn btn-secondary btn-block" id="rec-add">+ Ingrediente</button>' +
      '<label class="field"><span>Notas</span>' +
      '<textarea id="f-notes">' +
      esc(r.notes || '') +
      '</textarea></label>' +
      photoPreviewHtml(r.photoPath || '', 'f-photo-prev')

    Lela.openDrawer(
      editing ? 'Editar receta' : 'Nueva receta',
      body,
      footSave('f-save', 'f-del', editing)
    )
    bindPhotoButton('recipe')

    function readLinesFromDom() {
      var boxes = document.querySelectorAll('#rec-lines .rec-line')
      var out = []
      var j
      for (j = 0; j < boxes.length; j++) {
        var box = boxes[j]
        var matSel = box.querySelector('.rec-mat')
        var gIn = box.querySelector('.rec-g')
        var cIn = box.querySelector('.rec-c')
        out.push({
          rawMaterialId: matSel ? matSel.value : '',
          gramsBatch: Number(gIn && gIn.value) || 0,
          costPerKg: Number(cIn && cIn.value) || 0,
        })
      }
      lines = out
      return out
    }

    function refreshSummary() {
      readLinesFromDom()
      baseKg = num('f-base')
      if (!(baseKg > 0)) baseKg = 1
      var batchYield = num('f-yield')
      if (!(batchYield > 0)) batchYield = 1
      var batchCost = 0
      var j
      for (j = 0; j < lines.length; j++) {
        batchCost += (lines[j].gramsBatch / 1000) * (lines[j].costPerKg || 0)
      }
      batchCost = roundMoney(batchCost)
      var yieldTotal = batchYield * baseKg
      var unitCost = yieldTotal > 0 ? roundMoney(batchCost / yieldTotal) : 0
      var prod = findProduct(val('f-prod'))
      var sell = prod ? Number(prod.unitPrice) || 0 : 0
      var margin = sell > 0 ? roundMoney(sell - unitCost) : null
      var bc = Lela.$('rec-batch-cost')
      var uc = Lela.$('rec-unit-cost')
      var mg = Lela.$('rec-margin')
      if (bc) bc.textContent = Lela.money(batchCost)
      if (uc) uc.textContent = Lela.money(unitCost)
      if (mg) {
        mg.textContent =
          margin == null ? '—' : Lela.money(margin) + (sell ? '' : '')
      }
    }

    function bindLineEvents() {
      var boxes = document.querySelectorAll('#rec-lines .rec-line')
      var j
      for (j = 0; j < boxes.length; j++) {
        ;(function (box) {
          var matSel = box.querySelector('.rec-mat')
          var gIn = box.querySelector('.rec-g')
          var cIn = box.querySelector('.rec-c')
          var rm = box.querySelector('.rec-rm')
          if (matSel) {
            matSel.onchange = function () {
              var mat = findMat(materials, matSel.value)
              if (mat && cIn) cIn.value = String(mat.avgCost || 0)
              refreshSummary()
            }
          }
          if (gIn) gIn.oninput = refreshSummary
          if (cIn) cIn.oninput = refreshSummary
          if (rm) {
            rm.onclick = function () {
              readLinesFromDom()
              if (lines.length <= 1) return
              var idx = Number(box.getAttribute('data-idx'))
              lines.splice(idx, 1)
              var host = Lela.$('rec-lines')
              if (host) {
                var wrap = document.createElement('div')
                wrap.innerHTML = linesHtml()
                host.parentNode.replaceChild(wrap.firstChild, host)
                bindLineEvents()
                refreshSummary()
              }
            }
          }
        })(boxes[j])
      }
    }

    bindLineEvents()
    var baseEl = Lela.$('f-base')
    var yieldEl = Lela.$('f-yield')
    var prodEl = Lela.$('f-prod')
    if (baseEl) {
      baseEl.oninput = function () {
        var prev = baseKg
        var next = num('f-base')
        if (!(next > 0)) next = 1
        readLinesFromDom()
        var j
        for (j = 0; j < lines.length; j++) {
          var gpk = prev > 0 ? lines[j].gramsBatch / prev : lines[j].gramsBatch
          lines[j].gramsBatch = gpk * next
        }
        baseKg = next
        var host = Lela.$('rec-lines')
        if (host) {
          var wrap = document.createElement('div')
          wrap.innerHTML = linesHtml()
          host.parentNode.replaceChild(wrap.firstChild, host)
          bindLineEvents()
        }
        refreshSummary()
      }
    }
    if (yieldEl) yieldEl.oninput = refreshSummary
    if (prodEl) prodEl.onchange = refreshSummary

    var addBtn = Lela.$('rec-add')
    if (addBtn) {
      addBtn.onclick = function () {
        readLinesFromDom()
        lines.push({ rawMaterialId: '', gramsBatch: 0, costPerKg: 0 })
        var host = Lela.$('rec-lines')
        if (host) {
          var wrap = document.createElement('div')
          wrap.innerHTML = linesHtml()
          host.parentNode.replaceChild(wrap.firstChild, host)
          bindLineEvents()
          refreshSummary()
        }
      }
    }

    refreshSummary()

    function saveRecipe(active) {
      readLinesFromDom()
      baseKg = num('f-base')
      if (!(baseKg > 0)) baseKg = 1
      var productId = val('f-prod')
      var name = trim(val('f-name'))
      if (!productId) {
        Lela.toast('Elegí el producto', 'err')
        return
      }
      if (!name) {
        Lela.toast('Nombre requerido', 'err')
        return
      }
      var ingredients = []
      var j
      for (j = 0; j < lines.length; j++) {
        if (!lines[j].rawMaterialId || !(lines[j].gramsBatch > 0)) continue
        var gramsPerKg = lines[j].gramsBatch / baseKg
        ingredients.push({
          rawMaterialId: lines[j].rawMaterialId,
          quantity: gramsToPercent(gramsPerKg),
        })
      }
      if (!ingredients.length) {
        Lela.toast('Agregá al menos un ingrediente', 'err')
        return
      }
      Lela.post(
        '/recipes',
        {
          id: r.id,
          productId: productId,
          name: name,
          notes: trim(val('f-notes')),
          photoPath: val('f-photo') || null,
          batchYield: num('f-yield') > 0 ? num('f-yield') : 1,
          official: true,
          active: active !== false,
          ingredients: ingredients,
        },
        function (res) {
          if (!res || res.ok === false) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          Lela.toast(
            active === false
              ? 'Receta eliminada'
              : editing
                ? 'Receta actualizada'
                : 'Receta guardada',
            'ok'
          )
          afterSave(main, Lela.screens.recipes)
        }
      )
    }

    Lela.$('f-save').onclick = function () {
      saveRecipe(true)
    }
    if (editing && Lela.$('f-del')) {
      Lela.$('f-del').onclick = function () {
        Lela.confirmSoft(
          {
            title: 'Eliminar receta',
            body: 'Se ocultará la receta.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            saveRecipe(false)
          }
        )
      }
    }
  }

  Lela.screens.recipes = function (main) {
    setHtml(main, toolbar('Recetas') + '<p class="empty">Cargando…</p>')
    Lela.get('/recipes', function (recData) {
      Lela.get('/raw-materials', function (matData) {
        var recipes = (recData && recData.items) || []
        var materials = (matData && matData.items) || []
        var html = toolbar('Recetas', 'Nueva', 'btn-new-rec')
        var rows = []
        var i
        for (i = 0; i < recipes.length; i++) {
          if (!Lela.isActive(recipes[i])) continue
          rows.push(recipes[i])
        }
        if (!rows.length) {
          html += emptyMsg('Sin recetas.')
        } else {
          html += '<div class="list">'
          for (i = 0; i < rows.length; i++) {
            var r = rows[i]
            var pname = ''
            var prod = findProduct(r.productId)
            if (prod) pname = prod.name
            html +=
              '<div class="row row--tap" data-id="' +
              esc(r.id) +
              '">' +
              '<div class="row__thumb"' +
              (r.photoPath
                ? ' style="background-image:url(' + esc(r.photoPath) + ')"'
                : '') +
              '></div>' +
              '<div class="row__name">' +
              esc(r.name) +
              '</div>' +
              '<div class="row__meta">' +
              esc(pname || r.productId || '') +
              (r.batchYield ? ' · ' + r.batchYield + ' unidades / kg harina' : '') +
              '</div></div>'
          }
          html += '</div>'
        }
        setHtml(main, html)
        var btn = Lela.$('btn-new-rec')
        if (btn) {
          btn.onclick = function () {
            openRecipeDrawer(main, null, materials)
          }
        }
        var taps = main.querySelectorAll('.row--tap')
        for (i = 0; i < taps.length; i++) {
          ;(function (el) {
            el.onclick = function () {
              var id = el.getAttribute('data-id')
              var found = null
              var j
              for (j = 0; j < recipes.length; j++) {
                if (recipes[j].id === id) {
                  found = recipes[j]
                  break
                }
              }
              if (found) openRecipeDrawer(main, found, materials)
            }
          })(taps[i])
        }
      })
    })
  }

  /* ---------- 6. Photos ---------- */
  Lela.screens.photos = function (main) {
    function render(items) {
      var html = toolbar('Fotos', 'Subir', 'btn-up-photo')
      if (!items.length) {
        html += emptyMsg('Todavía no hay fotos guardadas.')
      } else {
        html += '<div class="list">'
        var i
        for (i = 0; i < items.length; i++) {
          var it = items[i]
          html +=
            '<div class="row" data-path="' +
            esc(it.path) +
            '">' +
            '<div class="row__thumb" style="background-image:url(' +
            esc(it.path) +
            ')"></div>' +
            '<div class="row__name">' +
            esc(it.name || it.path) +
            '</div>' +
            '<div class="row__act">' +
            '<button type="button" class="btn btn-ghost btn-sm photo-del">Borrar</button>' +
            '</div></div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var up = Lela.$('btn-up-photo')
      if (up) {
        up.onclick = function () {
          pickPhoto('library', function (path) {
            if (!path) return
            Lela.toast('Foto guardada', 'ok')
            Lela.screens.photos(main)
          })
        }
      }
      var dels = main.querySelectorAll('.photo-del')
      var j
      for (j = 0; j < dels.length; j++) {
        ;(function (btn) {
          btn.onclick = function () {
            var row = btn.parentNode
            while (row && (!row.getAttribute || !row.getAttribute('data-path'))) {
              row = row.parentNode
            }
            var path = row && row.getAttribute('data-path')
            if (!path) return
            Lela.confirmSoft(
              {
                title: 'Borrar foto',
                body: 'Se elimina del banco de fotos.',
                confirmLabel: 'Borrar',
                danger: true,
              },
              function () {
                Lela.post('/uploads/delete', { path: path }, function (res) {
                  if (!res || !res.ok) {
                    Lela.toast((res && res.error) || 'No se pudo borrar', 'err')
                    return
                  }
                  Lela.toast('Foto eliminada', 'ok')
                  Lela.screens.photos(main)
                })
              }
            )
          }
        })(dels[j])
      }
    }

    setHtml(main, toolbar('Fotos') + '<p class="empty">Cargando…</p>')
    Lela.get('/uploads/library', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Fotos') + emptyMsg('No se pudieron cargar las fotos.'))
        return
      }
      render(data.items || [])
    })
  }

  /* ---------- 7. Suppliers ---------- */
  function openSupplierDrawer(main, supplier) {
    var s = supplier || {}
    var editing = !!s.id
    var body =
      '<label class="field"><span>Nombre</span>' +
      '<input id="f-name" type="text" value="' +
      esc(s.name || '') +
      '" /></label>' +
      '<label class="field"><span>Teléfono</span>' +
      '<input id="f-phone" type="text" value="' +
      esc(s.phone || '') +
      '" /></label>'

    Lela.openDrawer(
      editing ? 'Editar proveedor' : 'Nuevo proveedor',
      body,
      footSave('f-save', 'f-del', editing)
    )

    function saveSup(active) {
      var name = trim(val('f-name'))
      if (!name) {
        Lela.toast('Nombre requerido', 'err')
        return
      }
      Lela.post(
        '/suppliers',
        {
          id: s.id,
          name: name,
          phone: trim(val('f-phone')),
          active: active !== false,
        },
        function (res) {
          if (!res || res.ok === false) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          Lela.toast(
            active === false
              ? 'Proveedor eliminado'
              : editing
                ? 'Proveedor actualizado'
                : 'Proveedor guardado',
            'ok'
          )
          afterSave(main, Lela.screens.suppliers)
        }
      )
    }

    Lela.$('f-save').onclick = function () {
      saveSup(true)
    }
    if (editing && Lela.$('f-del')) {
      Lela.$('f-del').onclick = function () {
        Lela.confirmSoft(
          {
            title: 'Eliminar proveedor',
            body: 'Se ocultará el proveedor.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            saveSup(false)
          }
        )
      }
    }
  }

  Lela.screens.suppliers = function (main) {
    setHtml(main, toolbar('Proveedores') + '<p class="empty">Cargando…</p>')
    Lela.get('/suppliers', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Proveedores') + emptyMsg('No se pudieron cargar.'))
        return
      }
      var items = data.items || []
      var html = toolbar('Proveedores', 'Nuevo', 'btn-new-sup')
      var rows = []
      var i
      for (i = 0; i < items.length; i++) {
        if (!Lela.isActive(items[i])) continue
        rows.push(items[i])
      }
      if (!rows.length) {
        html += emptyMsg('Sin proveedores.')
      } else {
        html += '<div class="list">'
        for (i = 0; i < rows.length; i++) {
          var s = rows[i]
          html +=
            '<div class="row row--tap" data-id="' +
            esc(s.id) +
            '">' +
            '<div class="row__name">' +
            esc(s.name) +
            '</div>' +
            '<div class="row__meta">' +
            esc(s.phone || '') +
            '</div></div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var btn = Lela.$('btn-new-sup')
      if (btn) {
        btn.onclick = function () {
          openSupplierDrawer(main, null)
        }
      }
      var taps = main.querySelectorAll('.row--tap')
      for (i = 0; i < taps.length; i++) {
        ;(function (el) {
          el.onclick = function () {
            var id = el.getAttribute('data-id')
            var found = null
            var j
            for (j = 0; j < items.length; j++) {
              if (items[j].id === id) {
                found = items[j]
                break
              }
            }
            if (found) openSupplierDrawer(main, found)
          }
        })(taps[i])
      }
    })
  }

  /* ---------- 8. Proposals ---------- */
  Lela.screens.proposals = function (main) {
    setHtml(main, toolbar('Aprobaciones') + '<p class="empty">Cargando…</p>')
    Lela.get('/proposals', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Aprobaciones') + emptyMsg('No se pudieron cargar.'))
        return
      }
      var items = data.items || []
      var html = toolbar('Aprobaciones')
      if (!items.length) {
        html += emptyMsg('No hay propuestas.')
      } else {
        html += '<div class="list">'
        var i
        for (i = 0; i < items.length; i++) {
          var p = items[i]
          html +=
            '<div class="row" data-id="' +
            esc(p.id) +
            '">' +
            '<div class="row__name">' +
            esc(p.title || p.id) +
            '</div>' +
            '<div class="row__meta">Estado: ' +
            esc(p.status || '—') +
            '</div>'
          if (Lela.state && Lela.state.isAdmin() && p.status === 'pending') {
            html +=
              '<div class="row__act">' +
              '<button type="button" class="btn btn-primary btn-sm prop-ok">Aprobar</button>' +
              '</div>'
          }
          html += '</div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var btns = main.querySelectorAll('.prop-ok')
      var j
      for (j = 0; j < btns.length; j++) {
        ;(function (btn) {
          btn.onclick = function () {
            var row = btn.parentNode
            while (row && (!row.getAttribute || !row.getAttribute('data-id'))) {
              row = row.parentNode
            }
            var id = row && row.getAttribute('data-id')
            if (!id) return
            var found = null
            var k
            for (k = 0; k < items.length; k++) {
              if (items[k].id === id) {
                found = items[k]
                break
              }
            }
            var decisions = []
            if (found && found.items && found.items.length) {
              var n
              for (n = 0; n < found.items.length; n++) {
                decisions.push({
                  itemId: found.items[n].id,
                  status: 'approved',
                })
              }
            }
            Lela.post(
              '/proposals/' + encodeURIComponent(id) + '/review',
              { note: 'ok', decisions: decisions },
              function (res) {
                if (!res || res.ok === false) {
                  Lela.toast((res && res.error) || 'No se pudo revisar', 'err')
                  return
                }
                Lela.toast('Propuesta aprobada', 'ok')
                Lela.screens.proposals(main)
              }
            )
          }
        })(btns[j])
      }
    })
  }

  /* ---------- 9. Users ---------- */
  Lela.screens.users = function (main) {
    setHtml(main, toolbar('Usuarios') + '<p class="empty">Cargando…</p>')
    Lela.get('/users', function (data) {
      if (!data || data.ok === false) {
        setHtml(
          main,
          toolbar('Usuarios') +
            emptyMsg('Solo admin. ' + ((data && data.error) || ''))
        )
        return
      }
      var users = data.users || []
      var html = toolbar('Usuarios', 'Nuevo', 'btn-new-user')
      if (!users.length) {
        html += emptyMsg('Sin usuarios.')
      } else {
        html += '<div class="list">'
        var i
        for (i = 0; i < users.length; i++) {
          var u = users[i]
          html +=
            '<div class="row">' +
            '<div class="row__name">' +
            esc(u.displayName || u.username) +
            '</div>' +
            '<div class="row__meta">@' +
            esc(u.username) +
            ' · ' +
            esc(u.role) +
            (u.active === false || u.active === 0 ? ' · inactivo' : '') +
            '</div></div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var btn = Lela.$('btn-new-user')
      if (btn) {
        btn.onclick = function () {
          var body =
            '<label class="field"><span>Usuario</span>' +
            '<input id="f-user" type="text" autocomplete="off" /></label>' +
            '<label class="field"><span>Nombre</span>' +
            '<input id="f-disp" type="text" /></label>' +
            '<label class="field"><span>Rol</span>' +
            '<select id="f-role">' +
            '<option value="empleado">empleado</option>' +
            '<option value="admin">admin</option>' +
            '<option value="principal">principal</option>' +
            '</select></label>' +
            '<label class="field"><span>PIN</span>' +
            '<input id="f-pin" type="password" value="0000" /></label>'
          Lela.openDrawer(
            'Nuevo usuario',
            body,
            '<button type="button" class="btn btn-primary btn-block" id="f-save">Guardar</button>'
          )
          Lela.$('f-save').onclick = function () {
            var username = trim(val('f-user'))
            var displayName = trim(val('f-disp'))
            if (!username || !displayName) {
              Lela.toast('Usuario y nombre requeridos', 'err')
              return
            }
            Lela.post(
              '/users',
              {
                username: username,
                displayName: displayName,
                role: val('f-role') || 'empleado',
                pin: val('f-pin') || '0000',
              },
              function (res) {
                if (!res || res.ok === false) {
                  Lela.toast((res && res.error) || 'No se pudo crear', 'err')
                  return
                }
                Lela.toast('Usuario creado', 'ok')
                Lela.closeDrawer()
                Lela.screens.users(main)
              }
            )
          }
        }
      }
    })
  }

  /* ---------- 10. Menú público (datos panadería) ---------- */
  Lela.screens.bakery = function (main) {
    setHtml(
      main,
      toolbar('Menú público') + '<p class="empty">Cargando…</p>'
    )
    Lela.get('/bakery-public', function (data) {
      if (!data || data.ok === false) {
        setHtml(
          main,
          toolbar('Menú público') + emptyMsg('No se pudo cargar.')
        )
        return
      }
      var b = data.bakery || {}
      var html =
        toolbar('Menú público') +
        '<p class="hint">Estos datos se ven en la vitrina de clientes (/menu). Guardá y abrí la vitrina para verlos.</p>' +
        '<label class="field"><span>Nombre</span>' +
        '<input id="f-bakery-name" type="text" value="' +
        esc(b.name || '') +
        '" autocomplete="organization" /></label>' +
        '<label class="field"><span>Frase corta (arriba)</span>' +
        '<input id="f-bakery-eyebrow" type="text" value="' +
        esc(b.eyebrow || '') +
        '" /></label>' +
        '<label class="field"><span>Descripción / lema</span>' +
        '<textarea id="f-bakery-tagline" rows="2">' +
        esc(b.tagline || '') +
        '</textarea></label>' +
        '<label class="field"><span>Dirección</span>' +
        '<input id="f-bakery-address" type="text" value="' +
        esc(b.address || '') +
        '" autocomplete="street-address" /></label>' +
        '<label class="field"><span>Teléfono</span>' +
        '<input id="f-bakery-phone" type="tel" value="' +
        esc(b.phone || '') +
        '" autocomplete="tel" /></label>' +
        '<label class="field"><span>Horario</span>' +
        '<input id="f-bakery-hours" type="text" value="' +
        esc(b.hours || '') +
        '" placeholder="Ej. Lun–Sáb 6:00–18:00" /></label>' +
        '<label class="field"><span>Nota al pie</span>' +
        '<textarea id="f-bakery-note" rows="2" placeholder="Opcional">' +
        esc(b.note || '') +
        '</textarea></label>' +
        '<div class="admin-form__actions" style="display:grid;gap:0.6rem;margin-top:0.75rem">' +
        '<button type="button" class="btn btn-primary btn-block" id="f-save-bakery">Guardar</button>' +
        '<button type="button" class="btn btn-secondary btn-block" id="f-open-menu">Abrir vitrina</button>' +
        '</div>'
      setHtml(main, html)

      var save = Lela.$('f-save-bakery')
      if (save) {
        save.onclick = function () {
          Lela.post(
            '/bakery-public',
            {
              name: val('f-bakery-name'),
              eyebrow: val('f-bakery-eyebrow'),
              tagline: val('f-bakery-tagline'),
              address: val('f-bakery-address'),
              phone: val('f-bakery-phone'),
              hours: val('f-bakery-hours'),
              note: val('f-bakery-note'),
            },
            function (res) {
              if (!res || res.ok === false) {
                Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
                return
              }
              Lela.toast('Datos del menú guardados', 'ok')
            }
          )
        }
      }
      var openBtn = Lela.$('f-open-menu')
      if (openBtn) {
        openBtn.onclick = function () {
          window.open('/menu', '_blank')
        }
      }
    })
  }

  /* ---------- 11. Printer ---------- */
  Lela.screens.printer = function (main) {
    setHtml(main, toolbar('Impresora') + '<p class="empty">Cargando…</p>')
    Lela.get('/printer', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Impresora') + emptyMsg('No se pudo cargar.'))
        return
      }
      var settings = data.settings || {}
      var printers = data.printers || []
      var cur = settings.printerName || ''
      var chars = settings.paperChars != null ? settings.paperChars : 40
      var html =
        toolbar('Impresora') +
        '<label class="field"><span>Impresora</span><select id="f-printer">' +
        '<option value="">— seleccionar —</option>'
      var i
      for (i = 0; i < printers.length; i++) {
        html +=
          '<option value="' +
          esc(printers[i]) +
          '"' +
          (printers[i] === cur ? ' selected' : '') +
          '>' +
          esc(printers[i]) +
          '</option>'
      }
      if (cur) {
        var found = false
        for (i = 0; i < printers.length; i++) {
          if (printers[i] === cur) found = true
        }
        if (!found) {
          html +=
            '<option value="' +
            esc(cur) +
            '" selected>' +
            esc(cur) +
            '</option>'
        }
      }
      html +=
        '</select></label>' +
        '<label class="field"><span>Columnas (papel)</span>' +
        '<input id="f-chars" type="number" value="' +
        esc(chars) +
        '" /></label>' +
        '<button type="button" class="btn btn-primary btn-block" id="f-save-printer">Guardar</button>'
      setHtml(main, html)
      var save = Lela.$('f-save-printer')
      if (save) {
        save.onclick = function () {
          Lela.post(
            '/printer',
            {
              printerName: val('f-printer'),
              paperChars: num('f-chars') || 40,
            },
            function (res) {
              if (!res || res.ok === false) {
                Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
                return
              }
              Lela.toast('Impresora guardada', 'ok')
            }
          )
        }
      }
    })
  }

  /* ---------- 12. Backups ---------- */
  Lela.screens.backups = function (main) {
    setHtml(main, toolbar('Respaldos') + '<p class="empty">Cargando…</p>')
    Lela.get('/backups', function (data) {
      if (!data || data.ok === false) {
        setHtml(main, toolbar('Respaldos') + emptyMsg('No se pudieron cargar.'))
        return
      }
      var items = data.items || []
      var html = toolbar('Respaldos', 'Crear', 'btn-new-bak')
      if (!items.length) {
        html += emptyMsg('Sin respaldos aún.')
      } else {
        html += '<div class="list">'
        var i
        for (i = 0; i < items.length; i++) {
          var b = items[i]
          html +=
            '<div class="row" data-path="' +
            esc(b.path) +
            '">' +
            '<div class="row__name">' +
            esc(b.createdAt || b.id || '') +
            '</div>' +
            '<div class="row__meta">' +
            esc(b.kind || '') +
            '</div>' +
            '<div class="row__act">' +
            '<button type="button" class="btn btn-ghost btn-sm bak-restore">Restaurar</button>' +
            '</div></div>'
        }
        html += '</div>'
      }
      setHtml(main, html)
      var create = Lela.$('btn-new-bak')
      if (create) {
        create.onclick = function () {
          Lela.post('/backups', { note: 'manual' }, function (res) {
            if (!res || res.ok === false) {
              Lela.toast((res && res.error) || 'No se pudo crear', 'err')
              return
            }
            Lela.toast('Respaldo creado', 'ok')
            Lela.screens.backups(main)
          })
        }
      }
      var rests = main.querySelectorAll('.bak-restore')
      var j
      for (j = 0; j < rests.length; j++) {
        ;(function (btn) {
          btn.onclick = function () {
            var row = btn.parentNode
            while (row && (!row.getAttribute || !row.getAttribute('data-path'))) {
              row = row.parentNode
            }
            var path = row && row.getAttribute('data-path')
            if (!path) return
            Lela.confirmSoft(
              {
                title: 'Restaurar respaldo',
                body: 'Se restaurará la base. Se guarda un respaldo previo automáticamente.',
                confirmLabel: 'Restaurar',
                danger: true,
              },
              function () {
                Lela.post('/backups/restore', { path: path }, function (res) {
                  if (!res || res.ok === false) {
                    Lela.toast((res && res.error) || 'No se pudo restaurar', 'err')
                    return
                  }
                  Lela.toast('Base restaurada. Recargá la página.', 'ok')
                  setTimeout(function () {
                    window.location.reload()
                  }, 1200)
                })
              }
            )
          }
        })(rests[j])
      }
    })
  }
})()
