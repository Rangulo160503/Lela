/* ES5 ops screens — Facturación · Inventario · Cierre (iOS 9) */
(function (global) {
  var Lela = global.Lela || (global.Lela = {})
  Lela.screens = Lela.screens || {}

  var CAJA_IDS = ['acc-efectivo', 'acc-tarjeta', 'acc-sinpe']
  var CAJA_LABELS = {
    'acc-efectivo': 'Efectivo',
    'acc-tarjeta': 'Tarjetas',
    'acc-sinpe': 'SINPE',
  }

  var posCart = {}
  var posPromoId = null
  var posFilter = ''
  var posMethod = 'efectivo'
  var posAmount = ''
  var posStep = 'catalog'
  var posHostMain = null

  var cierreSection = 'caja'
  var cierreCounted = null
  var cierreInventory = null
  var cierreExpenses = null

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function snap() {
    return (Lela.state && Lela.state.snapshot) || {}
  }

  function activeProducts() {
    var list = snap().products || []
    var out = []
    var i
    for (i = 0; i < list.length; i++) {
      if (Lela.isActive(list[i])) out.push(list[i])
    }
    return out
  }

  function activePromos() {
    var list = snap().promos || []
    var out = []
    var i
    for (i = 0; i < list.length; i++) {
      if (Lela.isActive(list[i])) out.push(list[i])
    }
    return out
  }

  function findProduct(id) {
    var list = snap().products || []
    var i
    for (i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i]
    }
    return null
  }

  function findPromo(id) {
    var list = snap().promos || []
    var i
    for (i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i]
    }
    return null
  }

  function accountBalance(id) {
    var list = snap().accounts || []
    var i
    for (i = 0; i < list.length; i++) {
      if (list[i].id === id) return Number(list[i].balance) || 0
    }
    return 0
  }

  function stockOf(p) {
    if (!p) return 0
    if (p.physicalStock != null) return Number(p.physicalStock) || 0
    return Number(p.stock) || 0
  }

  function rerender(screenFn, main) {
    Lela.state.refreshSnapshot(function () {
      screenFn(main)
    })
  }

  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
  }

  function field(labelText, inputEl) {
    var lab = el('label', 'field')
    lab.appendChild(el('span', null, labelText))
    lab.appendChild(inputEl)
    return lab
  }

  function clearPosCart() {
    posCart = {}
    posPromoId = null
    posAmount = ''
  }

  function cartLines() {
    var lines = []
    var id
    for (id in posCart) {
      if (!posCart.hasOwnProperty(id)) continue
      if (!posCart[id]) continue
      lines.push({ productId: id, quantity: posCart[id] })
    }
    return lines
  }

  function cartTotal() {
    if (posPromoId) {
      var promo = findPromo(posPromoId)
      return promo ? Number(promo.price) || 0 : 0
    }
    var total = 0
    var id
    for (id in posCart) {
      if (!posCart.hasOwnProperty(id) || !posCart[id]) continue
      var p = findProduct(id)
      if (p) total += (Number(p.unitPrice) || 0) * posCart[id]
    }
    return total
  }

  function cartHasItems() {
    if (posPromoId) return true
    var id
    for (id in posCart) {
      if (posCart.hasOwnProperty(id) && posCart[id] > 0) return true
    }
    return false
  }

  function setCartQty(productId, qty) {
    var p = findProduct(productId)
    if (!p || !Lela.isActive(p)) return
    var max = stockOf(p)
    var n = Math.floor(Number(qty) || 0)
    if (n <= 0) {
      delete posCart[productId]
      return
    }
    if (n > max) {
      Lela.toast('Stock insuficiente (' + max + ')', 'err')
      n = max
    }
    if (n <= 0) {
      delete posCart[productId]
      return
    }
    posPromoId = null
    posCart[productId] = n
  }

  /* ——— Facturación (mismo flujo que la app original) ——— */
  function closePosOverlay() {
    var ov = document.getElementById('pos-overlay')
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov)
    try {
      document.body.style.overflow = ''
    } catch (e) {}
  }

  Lela.closePosOverlay = closePosOverlay

  function daySales() {
    var sales = snap().sales || []
    var out = []
    var i
    for (i = 0; i < sales.length; i++) out.push(sales[i])
    out.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
    return out.slice(0, 40)
  }

  function formatSaleWhen(iso) {
    if (!iso) return ''
    var s = String(iso)
    if (s.length >= 16) return s.slice(0, 16).replace('T', ' ')
    return s
  }

  function openPosOverlay() {
    clearPosCart()
    posStep = 'catalog'
    posFilter = ''
    renderPosOverlay()
  }

  function renderPosOverlay() {
    closePosOverlay()
    var products = activeProducts()
    var promos = activePromos()
    var total = cartTotal()
    if (posAmount === '' || posAmount == null) posAmount = String(total)

    var ov = el('div', 'pos-overlay')
    ov.id = 'pos-overlay'

    var head = el('div', 'pos-overlay__head')
    var titleWrap = el('div', null)
    titleWrap.appendChild(el('h2', 'pos-overlay__title', 'Nueva venta'))
    titleWrap.appendChild(
      el(
        'p',
        'pos-overlay__meta',
        cartHasItems()
          ? 'Total ' + Lela.money(total)
          : 'Catálogo y cobro'
      )
    )
    head.appendChild(titleWrap)

    var headActs = el('div', 'pos-overlay__acts')
    if (posStep === 'catalog') {
      var toCart = el('button', 'btn btn--primary btn--sm', 'Cobrar')
      toCart.type = 'button'
      toCart.disabled = !cartHasItems()
      toCart.onclick = function () {
        if (!cartHasItems()) {
          Lela.toast('Agregá productos al carrito', 'err')
          return
        }
        posStep = 'cart'
        posAmount = String(cartTotal())
        renderPosOverlay()
      }
      headActs.appendChild(toCart)
    } else {
      var back = el('button', 'btn btn--ghost btn--sm', 'Catálogo')
      back.type = 'button'
      back.onclick = function () {
        posStep = 'catalog'
        renderPosOverlay()
      }
      headActs.appendChild(back)
    }
    var closeBtn = el('button', 'btn btn--secondary btn--sm', 'Cerrar')
    closeBtn.type = 'button'
    closeBtn.onclick = function () {
      closePosOverlay()
      if (posHostMain) Lela.screens.pos(posHostMain)
    }
    headActs.appendChild(closeBtn)
    head.appendChild(headActs)
    ov.appendChild(head)

    var body = el('div', 'pos-overlay__body')

    if (posStep === 'catalog') {
      var searchRow = el('div', 'field')
      searchRow.appendChild(el('span', 'field__label', 'Buscar'))
      var search = document.createElement('input')
      search.type = 'text'
      search.className = 'field__input'
      search.placeholder = 'Nombre del producto…'
      search.value = posFilter
      search.id = 'pos-search'
      var filterBtn = el('button', 'btn btn--secondary btn--block', 'Filtrar')
      filterBtn.type = 'button'
      filterBtn.style.marginTop = '0.5rem'
      filterBtn.onclick = function () {
        posFilter = search.value || ''
        renderPosOverlay()
      }
      search.onkeydown = function (ev) {
        ev = ev || window.event
        if ((ev.keyCode || ev.which) === 13) {
          posFilter = search.value || ''
          renderPosOverlay()
        }
      }
      searchRow.appendChild(search)
      searchRow.appendChild(filterBtn)
      body.appendChild(searchRow)

      if (promos.length) {
        var comboPanel = el('div', 'panel')
        comboPanel.appendChild(el('h2', 'h2', 'Combos'))
        var comboList = el('div', 'list')
        var pi
        for (pi = 0; pi < promos.length; pi++) {
          ;(function (promo) {
            var row = el('div', 'row')
            var thumb = el('div', 'row__thumb')
            var promoImg =
              promo.photoPath ||
              Lela.productImage({ name: promo.name || 'combo' }) ||
              '/images/pastry.jpg'
            thumb.style.backgroundImage =
              'url("' + String(promoImg).replace(/"/g, '') + '")'
            var mid = document.createElement('div')
            mid.style.webkitFlex = '1'
            mid.style.flex = '1'
            mid.style.minWidth = '0'
            mid.appendChild(el('div', 'row__name', promo.name))
            mid.appendChild(el('div', 'row__meta', Lela.money(promo.price)))
            var act = el('div', 'row__act')
            var btn = el(
              'button',
              'btn btn-sm btn-secondary',
              posPromoId === promo.id ? 'Quitar' : 'Usar'
            )
            btn.type = 'button'
            btn.onclick = function () {
              if (posPromoId === promo.id) {
                posPromoId = null
                posAmount = ''
              } else {
                posCart = {}
                posPromoId = promo.id
                posAmount = String(Number(promo.price) || 0)
              }
              renderPosOverlay()
            }
            act.appendChild(btn)
            row.appendChild(thumb)
            row.appendChild(mid)
            row.appendChild(act)
            comboList.appendChild(row)
          })(promos[pi])
        }
        comboPanel.appendChild(comboList)
        body.appendChild(comboPanel)
      }

      var prodPanel = el('div', 'panel')
      prodPanel.appendChild(el('h2', 'h2', 'Productos'))
      var prodList = el('div', 'list')
      var q = (posFilter || '').toLowerCase()
      var shown = 0
      var i
      for (i = 0; i < products.length; i++) {
        ;(function (p) {
          var name = String(p.name || '')
          if (q && name.toLowerCase().indexOf(q) === -1) return
          shown++
          var stock = stockOf(p)
          var qty = posCart[p.id] || 0
          var row = el('div', 'row row--line')
          var thumb = el('div', 'row__thumb')
          thumb.style.backgroundImage =
            'url("' + Lela.productImage(p).replace(/"/g, '') + '")'
          var left = document.createElement('div')
          left.className = 'row__body'
          left.appendChild(el('div', 'row__name', name))
          left.appendChild(
            el(
              'div',
              'row__meta',
              Lela.money(p.unitPrice) +
                ' · stock ' +
                stock +
                (qty ? ' · en carrito ' + qty : '')
            )
          )
          var act = el('div', 'row__act')
          var minus = el('button', 'btn btn-sm btn-ghost', '−')
          minus.type = 'button'
          minus.onclick = function () {
            setCartQty(p.id, (posCart[p.id] || 0) - 1)
            posAmount = ''
            renderPosOverlay()
          }
          var plus = el('button', 'btn btn-sm btn-secondary', '+')
          plus.type = 'button'
          plus.disabled = stock <= 0 || qty >= stock
          plus.onclick = function () {
            setCartQty(p.id, (posCart[p.id] || 0) + 1)
            posAmount = ''
            renderPosOverlay()
          }
          act.appendChild(minus)
          act.appendChild(document.createTextNode(' '))
          act.appendChild(plus)
          row.appendChild(thumb)
          row.appendChild(left)
          row.appendChild(act)
          prodList.appendChild(row)
        })(products[i])
      }
      if (!shown) prodList.appendChild(el('div', 'row empty', 'Sin productos.'))
      prodPanel.appendChild(prodList)
      body.appendChild(prodPanel)
    } else {
      var cartPanel = el('div', 'panel')
      cartPanel.appendChild(el('h2', 'h2', 'Carrito'))
      var cartList = el('div', 'list')
      if (posPromoId) {
        var pr = findPromo(posPromoId)
        cartList.appendChild(
          el(
            'div',
            'row',
            (pr ? pr.name : 'Combo') + ' · ' + Lela.money(pr && pr.price)
          )
        )
      } else {
        var empty = true
        var cid
        for (cid in posCart) {
          if (!posCart.hasOwnProperty(cid) || !posCart[cid]) continue
          empty = false
          ;(function (pid, qty) {
            var p = findProduct(pid)
            if (!p) return
            var row = el('div', 'row row--line')
            var body = el('div', 'row__body')
            body.appendChild(el('div', 'row__name', p.name))
            body.appendChild(
              el('div', 'row__meta', qty + ' × ' + Lela.money(p.unitPrice))
            )
            row.appendChild(body)
            var act = el('div', 'row__act')
            var minus = el('button', 'btn btn-sm btn-ghost', '−')
            minus.type = 'button'
            minus.onclick = function () {
              setCartQty(pid, qty - 1)
              posAmount = ''
              renderPosOverlay()
            }
            var plus = el('button', 'btn btn-sm btn-secondary', '+')
            plus.type = 'button'
            plus.onclick = function () {
              setCartQty(pid, qty + 1)
              posAmount = ''
              renderPosOverlay()
            }
            act.appendChild(minus)
            act.appendChild(document.createTextNode(' '))
            act.appendChild(plus)
            row.appendChild(act)
            cartList.appendChild(row)
          })(cid, posCart[cid])
        }
        if (empty) cartList.appendChild(el('div', 'row empty', 'El carrito está vacío.'))
      }
      cartPanel.appendChild(cartList)
      cartPanel.appendChild(el('p', 'total', 'Total ' + Lela.money(total)))

      var payField = el('div', 'field')
      payField.appendChild(el('span', 'field__label', 'Método de pago'))
      var payRow = el('div', 'pay-methods')
      var methods = [
        { id: 'efectivo', label: 'Efectivo' },
        { id: 'sinpe', label: 'SINPE' },
        { id: 'tarjeta', label: 'Tarjeta' },
      ]
      var mi
      for (mi = 0; mi < methods.length; mi++) {
        ;(function (m) {
          var b = el(
            'button',
            'btn btn--sm ' +
              (posMethod === m.id ? 'btn--primary' : 'btn--secondary'),
            m.label
          )
          b.type = 'button'
          b.style.marginRight = '0.35rem'
          b.onclick = function () {
            posMethod = m.id
            renderPosOverlay()
          }
          payRow.appendChild(b)
        })(methods[mi])
      }
      payField.appendChild(payRow)
      cartPanel.appendChild(payField)

      var amountInp = document.createElement('input')
      amountInp.type = 'number'
      amountInp.className = 'field__input'
      amountInp.value = posAmount
      var changeEl = el('p', 'row__meta', '')
      function paintChange() {
        var paid = Number(amountInp.value)
        var due = cartTotal()
        if (posMethod === 'efectivo' && paid >= due) {
          changeEl.textContent = 'Vuelto ' + Lela.money(paid - due)
        } else if (paid < due) {
          changeEl.textContent = 'Falta ' + Lela.money(due - paid)
        } else {
          changeEl.textContent = ''
        }
      }
      amountInp.oninput = function () {
        posAmount = amountInp.value
        paintChange()
      }
      cartPanel.appendChild(field('Monto pagado', amountInp))
      paintChange()
      cartPanel.appendChild(changeEl)

      var sellBtn = el('button', 'btn btn--primary btn--block', 'Registrar venta')
      sellBtn.type = 'button'
      sellBtn.onclick = function () {
        if (!cartHasItems()) {
          Lela.toast('El carrito está vacío', 'err')
          return
        }
        var amount = Number(posAmount)
        if (!(amount >= 0) || isNaN(amount)) {
          Lela.toast('Monto inválido', 'err')
          return
        }
        var body
        if (posPromoId) {
          body = {
            promoId: posPromoId,
            paymentMethod: posMethod,
            amountPaid: amount,
          }
        } else {
          var lines = cartLines()
          var li
          for (li = 0; li < lines.length; li++) {
            var prod = findProduct(lines[li].productId)
            if (!prod || lines[li].quantity > stockOf(prod)) {
              Lela.toast('Stock insuficiente', 'err')
              return
            }
          }
          body = {
            lines: lines,
            paymentMethod: posMethod,
            amountPaid: amount,
          }
        }
        sellBtn.disabled = true
        Lela.post('/sales', body, function (data) {
          sellBtn.disabled = false
          if (!data || !data.ok) {
            Lela.toast((data && data.error) || 'No se pudo cobrar', 'err')
            return
          }
          var sale = data.sale || {}
          clearPosCart()
          Lela.toast('Venta registrada. ' + Lela.money(sale.total), 'ok')
          showCompletedSale(sale)
        })
      }
      cartPanel.appendChild(sellBtn)
      body.appendChild(cartPanel)
    }

    ov.appendChild(body)
    document.body.appendChild(ov)
    try {
      document.body.style.overflow = 'hidden'
    } catch (e3) {}
  }

  function showCompletedSale(sale) {
    closePosOverlay()
    var ov = el('div', 'pos-overlay')
    ov.id = 'pos-overlay'
    var head = el('div', 'pos-overlay__head')
    head.appendChild(el('h2', 'pos-overlay__title', 'Venta registrada'))
    ov.appendChild(head)
    var body = el('div', 'pos-overlay__body')
    var panel = el('div', 'panel')
    panel.appendChild(
      el('p', 'total', 'Total ' + Lela.money(sale && sale.total))
    )
    panel.appendChild(
      el(
        'p',
        'row__meta',
        (sale && sale.paymentMethod ? String(sale.paymentMethod) : '') +
          (sale && sale.id ? ' · ' + sale.id : '')
      )
    )
    var printBtn = el('button', 'btn btn--secondary btn--block', 'Imprimir')
    printBtn.type = 'button'
    printBtn.onclick = function () {
      if (!sale || !sale.id) return
      Lela.post('/sales/' + sale.id + '/print', {}, function (pr) {
        if (!pr || !pr.ok) {
          Lela.toast((pr && pr.error) || 'No se pudo imprimir', 'err')
        } else {
          Lela.toast('Enviado a imprimir', 'ok')
        }
      })
    }
    var again = el('button', 'btn btn--primary btn--block', 'Nueva factura')
    again.type = 'button'
    again.onclick = function () {
      openPosOverlay()
    }
    var done = el('button', 'btn btn--ghost btn--block', 'Volver al registro')
    done.type = 'button'
    done.onclick = function () {
      closePosOverlay()
      Lela.state.refreshSnapshot(function () {
        if (posHostMain) Lela.screens.pos(posHostMain)
      })
    }
    panel.appendChild(printBtn)
    panel.appendChild(again)
    panel.appendChild(done)
    body.appendChild(panel)
    ov.appendChild(body)
    document.body.appendChild(ov)
  }

  Lela.screens.pos = function (main) {
    posHostMain = main
    closePosOverlay()
    main.innerHTML = ''

    var head = el('header', 'module-head module-head--ops')
    var copy = el('div', 'module-head__copy')
    copy.appendChild(el('p', 'module-head__kicker', 'Punto de venta'))
    copy.appendChild(el('h1', 'module-head__title', 'Facturación'))
    copy.appendChild(
      el(
        'p',
        'module-head__lede',
        'Historial del día. Abrí el POS para cobrar una venta nueva.'
      )
    )
    head.appendChild(copy)
    var acts = el('div', 'module-head__actions')
    var nueva = el('button', 'btn btn--primary', 'Nueva venta')
    nueva.type = 'button'
    nueva.onclick = function () {
      openPosOverlay()
    }
    acts.appendChild(nueva)
    head.appendChild(acts)
    main.appendChild(head)

    var section = el('section', 'panel')
    section.appendChild(el('h2', 'h2', 'Registro de facturas'))
    var sales = daySales()
    section.appendChild(
      el('p', 'row__meta', sales.length ? sales.length + ' recientes' : 'Sin facturas aún')
    )
    var list = el('div', 'list')
    if (!sales.length) {
      list.appendChild(
        el('div', 'row empty', 'Todavía no hay facturas. Usá Nueva venta para cobrar.')
      )
    }
    var si
    for (si = 0; si < sales.length; si++) {
      ;(function (sale) {
        var row = el('div', 'row')
        var left = document.createElement('div')
        left.style.webkitFlex = '1'
        left.style.flex = '1'
        left.appendChild(
          el(
            'div',
            'row__name',
            Lela.money(sale.total) +
              ' · ' +
              (sale.paymentMethod || 'pago')
          )
        )
        left.appendChild(
          el('div', 'row__meta', formatSaleWhen(sale.createdAt))
        )
        row.appendChild(left)
        list.appendChild(row)
      })(sales[si])
    }
    section.appendChild(list)
    main.appendChild(section)
  }

  /* ——— Inventario ——— */
  function pickPhoto(kind, onDone) {
    var input = Lela.$('file-pick')
    if (!input) {
      onDone(null)
      return
    }
    input.onchange = function () {
      var file = input.files && input.files[0]
      input.value = ''
      input.onchange = null
      if (!file) {
        onDone(null)
        return
      }
      Lela.fileToJpegDataUrl(file, 1280, 0.82, function (dataUrl) {
        if (!dataUrl) {
          Lela.toast('No se pudo leer la foto', 'err')
          onDone(null)
          return
        }
        Lela.uploadDataUrl(dataUrl, kind || 'product', function (res) {
          if (!res || !res.ok || !res.path) {
            Lela.toast((res && res.error) || 'Error al subir foto', 'err')
            onDone(null)
            return
          }
          onDone(res.path)
        })
      })
    }
    input.click()
  }

  function openProductDrawer(main, product) {
    var draft = {
      id: product.id,
      name: product.name || '',
      unitPrice: Number(product.unitPrice) || 0,
      physicalStock: stockOf(product),
      photoPath: product.photoPath || Lela.productImage(product),
    }

    function paint() {
      var preview = draft.photoPath || Lela.productImage(draft)
      var body =
        '<label class="field"><span>Nombre</span>' +
        '<input id="inv-name" class="field__input" type="text" value="' +
        esc(draft.name) +
        '" /></label>' +
        '<div class="field-row">' +
        '<label class="field"><span>Precio</span>' +
        '<input id="inv-price" class="field__input" type="number" inputmode="decimal" value="' +
        esc(draft.unitPrice) +
        '" /></label>' +
        '<label class="field"><span>Stock</span>' +
        '<input id="inv-stock" class="field__input" type="number" inputmode="numeric" value="' +
        esc(draft.physicalStock) +
        '" /></label>' +
        '</div>' +
        '<div class="photo-prev" id="inv-photo-prev" style="background-image:url(\'' +
        esc(preview) +
        '\')"></div>' +
        '<button type="button" id="inv-photo-btn" class="btn btn-secondary btn-block">Cambiar foto</button>'

      var foot =
        '<button type="button" id="inv-save" class="btn btn-primary">Guardar</button>' +
        '<button type="button" id="inv-del" class="btn btn-danger">Eliminar</button>'

      Lela.openDrawer('Editar · ' + (draft.name || 'producto'), body, foot)

      var nameEl = Lela.$('inv-name')
      var priceEl = Lela.$('inv-price')
      var stockEl = Lela.$('inv-stock')
      var photoBtn = Lela.$('inv-photo-btn')
      var saveBtn = Lela.$('inv-save')
      var delBtn = Lela.$('inv-del')

      function readDraft() {
        draft.name = (nameEl.value || '').replace(/^\s+|\s+$/g, '')
        draft.unitPrice = Number(priceEl.value)
        draft.physicalStock = Number(stockEl.value)
      }

      photoBtn.onclick = function () {
        readDraft()
        pickPhoto('product', function (path) {
          if (!path) return
          draft.photoPath = path
          paint()
        })
      }

      saveBtn.onclick = function () {
        readDraft()
        if (!draft.name) {
          Lela.toast('Nombre requerido', 'err')
          return
        }
        saveBtn.disabled = true
        Lela.post(
          '/admin/products',
          {
            id: draft.id,
            name: draft.name,
            unitPrice: draft.unitPrice,
            physicalStock: draft.physicalStock,
            photoPath: draft.photoPath || undefined,
            active: true,
          },
          function (res) {
            saveBtn.disabled = false
            if (!res || !res.ok) {
              Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
              return
            }
            Lela.closeDrawer()
            Lela.toast('Producto actualizado', 'ok')
            rerender(Lela.screens.inv, main)
          }
        )
      }

      delBtn.onclick = function () {
        readDraft()
        Lela.confirmSoft(
          {
            title: '¿Eliminar producto?',
            body: 'Se ocultará del catálogo.',
            confirmLabel: 'Eliminar',
            danger: true,
          },
          function () {
            Lela.post(
              '/admin/products',
              {
                id: draft.id,
                name: draft.name || product.name,
                unitPrice: draft.unitPrice,
                physicalStock: draft.physicalStock,
                photoPath: draft.photoPath || undefined,
                active: false,
              },
              function (res) {
                if (!res || !res.ok) {
                  Lela.toast((res && res.error) || 'No se pudo eliminar', 'err')
                  return
                }
                Lela.closeDrawer()
                Lela.toast('Producto eliminado', 'ok')
                rerender(Lela.screens.inv, main)
              }
            )
          }
        )
      }
    }

    paint()
  }

  function openMermaDrawer(main) {
    var products = activeProducts()
    var opts = '<option value="">Elegí producto…</option>'
    var i
    for (i = 0; i < products.length; i++) {
      opts +=
        '<option value="' +
        esc(products[i].id) +
        '">' +
        esc(products[i].name) +
        ' (' +
        stockOf(products[i]) +
        ')</option>'
    }
    var body =
      '<label class="field"><span>Producto</span><select id="merma-prod" class="field__input">' +
      opts +
      '</select></label>' +
      '<label class="field"><span>Cantidad</span><input id="merma-qty" class="field__input" type="number" inputmode="numeric" min="1" value="1" /></label>' +
      '<label class="field"><span>Motivo</span><input id="merma-reason" class="field__input" type="text" value="Producto dañado" /></label>'
    var foot = '<button type="button" id="merma-save" class="btn btn-danger">Registrar merma</button>'
    Lela.openDrawer('Merma', body, foot)
    Lela.$('merma-save').onclick = function () {
      var productId = Lela.$('merma-prod').value
      var quantity = Number(Lela.$('merma-qty').value)
      var reason = (Lela.$('merma-reason').value || '').replace(/^\s+|\s+$/g, '')
      if (!productId) {
        Lela.toast('Elegí un producto', 'err')
        return
      }
      if (!(quantity > 0) || quantity !== Math.floor(quantity)) {
        Lela.toast('Cantidad inválida', 'err')
        return
      }
      var p = findProduct(productId)
      if (p && quantity > stockOf(p)) {
        Lela.toast('Stock insuficiente', 'err')
        return
      }
      Lela.post(
        '/merma',
        { productId: productId, quantity: quantity, reason: reason },
        function (res) {
          if (!res || !res.ok) {
            Lela.toast((res && res.error) || 'No se pudo registrar', 'err')
            return
          }
          Lela.closeDrawer()
          Lela.toast('Merma registrada', 'ok')
          rerender(Lela.screens.inv, main)
        }
      )
    }
  }

  function openProductionDrawer(main) {
    Lela.get('/production/draft', function (data) {
      if (!data || !data.ok || !data.lines) {
        Lela.toast((data && data.error) || 'No se pudo cargar la producción', 'err')
        return
      }
      var lines = data.lines
      var body = '<div class="list">'
      var i
      for (i = 0; i < lines.length; i++) {
        var line = lines[i]
        body +=
          '<div class="row">' +
          '<div class="row__name">' +
          esc(line.name) +
          '</div>' +
          '<div class="row__meta">vendido ' +
          esc(line.sold) +
          ' · stock ' +
          esc(line.stock) +
          '</div>' +
          '<label class="field"><span>Cantidad</span>' +
          '<input class="field__input prod-qty" data-pid="' +
          esc(line.productId) +
          '" type="number" inputmode="numeric" min="0" value="' +
          esc(line.quantity) +
          '" /></label>' +
          '</div>'
      }
      if (!lines.length) body += '<div class="row empty">Sin líneas.</div>'
      body += '</div>'
      var foot = '<button type="button" id="prod-save" class="btn btn-primary">Guardar producción</button>'
      Lela.openDrawer('Producción', body, foot)
      Lela.$('prod-save').onclick = function () {
        var inputs = document.getElementsByClassName('prod-qty')
        var payload = []
        var j
        for (j = 0; j < inputs.length; j++) {
          var inp = inputs[j]
          var qty = Number(inp.value)
          if (isNaN(qty) || qty < 0 || qty !== Math.floor(qty)) {
            Lela.toast('Cantidades inválidas', 'err')
            return
          }
          var src = null
          var k
          for (k = 0; k < lines.length; k++) {
            if (lines[k].productId === inp.getAttribute('data-pid')) {
              src = lines[k]
              break
            }
          }
          payload.push({
            productId: inp.getAttribute('data-pid'),
            name: src ? src.name : '',
            sold: src ? src.sold : 0,
            stock: src ? src.stock : 0,
            quantity: qty,
          })
        }
        Lela.post('/production', { lines: payload }, function (res) {
          if (!res || !res.ok) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          Lela.closeDrawer()
          Lela.toast('Producción guardada', 'ok')
          rerender(Lela.screens.inv, main)
        })
      }
    })
  }

  Lela.screens.inv = function (main) {
    main.innerHTML = ''
    var products = activeProducts()
    var mermaRecords = snap().mermaRecords || []
    var sheets = snap().productionSheets || []

    var head = el('header', 'module-head module-head--ops')
    var copy = el('div', 'module-head__copy')
    copy.appendChild(el('p', 'module-head__kicker', 'Bodega y horno'))
    copy.appendChild(el('h1', 'module-head__title', 'Saldos de inventario'))
    copy.appendChild(
      el(
        'p',
        'module-head__lede',
        'Stock, producción y merma. Tocá un producto para editar.'
      )
    )
    head.appendChild(copy)
    var actions = el('div', 'module-head__actions')
    var btnProd = el('button', 'btn btn--secondary btn--sm', 'Producción')
    btnProd.type = 'button'
    btnProd.onclick = function () {
      openProductionDrawer(main)
    }
    var btnMerma = el('button', 'btn btn--secondary btn--sm', 'Merma')
    btnMerma.type = 'button'
    btnMerma.style.marginLeft = '0.4rem'
    btnMerma.onclick = function () {
      openMermaDrawer(main)
    }
    actions.appendChild(btnProd)
    actions.appendChild(btnMerma)
    head.appendChild(actions)
    main.appendChild(head)

    var list = el('div', 'list')
    if (!products.length) {
      list.appendChild(el('div', 'row empty', 'Sin productos activos.'))
    }
    var i
    for (i = 0; i < products.length; i++) {
      ;(function (p) {
        var row = el('div', 'row row--line row--tap')
        var thumb = el('div', 'row__thumb')
        thumb.style.backgroundImage =
          'url("' + Lela.productImage(p).replace(/"/g, '') + '")'
        var left = el('div', 'row__body')
        left.appendChild(el('div', 'row__name', p.name))
        left.appendChild(
          el(
            'div',
            'row__meta',
            Lela.money(p.unitPrice) + ' · stock ' + stockOf(p)
          )
        )
        row.appendChild(thumb)
        row.appendChild(left)
        row.onclick = function () {
          openProductDrawer(main, p)
        }
        list.appendChild(row)
      })(products[i])
    }
    main.appendChild(list)

    var recent = el('div', 'panel')
    recent.appendChild(el('h2', 'h2', 'Reciente'))
    var mMax = Math.min(5, mermaRecords.length)
    if (mMax) {
      recent.appendChild(el('h2', 'h2', 'Mermas'))
      var ml = el('div', 'list')
      var mi
      for (mi = 0; mi < mMax; mi++) {
        var m = mermaRecords[mi]
        ml.appendChild(
          el(
            'div',
            'row',
            (m.productName || m.productId || '—') +
              ' · ' +
              (m.quantity || 0) +
              (m.reason ? ' · ' + m.reason : '')
          )
        )
      }
      recent.appendChild(ml)
    }
    var sMax = Math.min(3, sheets.length)
    if (sMax) {
      recent.appendChild(el('h2', 'h2', 'Producción'))
      var sl = el('div', 'list')
      var si
      for (si = 0; si < sMax; si++) {
        var s = sheets[si]
        sl.appendChild(
          el(
            'div',
            'row',
            (s.businessDate || '') +
              (s.createdAt ? ' · ' + String(s.createdAt).slice(0, 16).replace('T', ' ') : '')
          )
        )
      }
      recent.appendChild(sl)
    }
    if (!mMax && !sMax) {
      recent.appendChild(el('p', 'empty', 'Sin mermas ni hojas recientes.'))
    }
    main.appendChild(recent)
  }

  /* ——— Cierre ——— */
  function seedCierreCounted(key) {
    cierreCounted = { _key: key }
    var i
    for (i = 0; i < CAJA_IDS.length; i++) {
      cierreCounted[CAJA_IDS[i]] = accountBalance(CAJA_IDS[i])
    }
  }

  function seedCierreInventory(key) {
    cierreInventory = { _key: key }
    var products = activeProducts()
    var j
    for (j = 0; j < products.length; j++) {
      cierreInventory[products[j].id] = stockOf(products[j])
    }
  }

  function ensureCierreState() {
    var open = snap().openShift
    var key = open && open.id ? open.id : 'none'
    if (!cierreCounted || cierreCounted._key !== key) {
      seedCierreCounted(key)
    }
    if (!cierreInventory || cierreInventory._key !== key) {
      seedCierreInventory(key)
    }
  }

  /** Vuelve conteos de caja e inventario a los valores del sistema. */
  function resetCierreConteo(main) {
    Lela.confirmSoft(
      {
        title: '¿Reiniciar conteo?',
        body: 'Se borran los montos y cantidades que apuntaste. Caja e inventario vuelven a lo del sistema.',
        confirmLabel: 'Reiniciar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
      function () {
        var open = snap().openShift
        var key = open && open.id ? open.id : 'none'
        seedCierreCounted(key)
        seedCierreInventory(key)
        Lela.toast('Conteo reiniciado', 'ok')
        if (cierreSection !== 'caja' && cierreSection !== 'conteo') {
          cierreSection = 'caja'
        }
        Lela.screens.cierre(main)
      }
    )
  }

  function openingCashError(code) {
    return Lela.friendlyError(code, 'No se pudo abrir')
  }

  function readOpeningCashInput(inp) {
    var raw = String(inp.value || '').trim()
    if (raw === '') return null
    var n = Number(raw)
    if (!isFinite(n) || n < 0) return null
    return n
  }

  function renderNoShift(main) {
    main.appendChild(el('p', 'empty', 'No hay turno abierto.'))
    var panel = el('div', 'panel')
    panel.appendChild(el('h2', 'h2', 'Abrir turno'))
    panel.appendChild(
      el(
        'p',
        'hint',
        'Contá el efectivo en caja e indicá el monto. Es obligatorio para abrir.'
      )
    )
    var amountInp = document.createElement('input')
    amountInp.type = 'number'
    amountInp.className = 'field__input'
    amountInp.min = '0'
    amountInp.step = '1'
    amountInp.placeholder = '0'
    amountInp.setAttribute('inputmode', 'decimal')
    amountInp.setAttribute('aria-label', 'Monto de apertura')
    panel.appendChild(field('Monto de apertura (efectivo)', amountInp))
    var list = el('div', 'list')
    list.appendChild(el('div', 'row empty', 'Cargando…'))
    panel.appendChild(list)
    main.appendChild(panel)

    Lela.get('/shifts/templates', function (data) {
      list.innerHTML = ''
      var items = (data && data.items) || []
      if (!items.length) {
        list.appendChild(el('div', 'row empty', 'No hay turnos para abrir.'))
        return
      }
      var i
      for (i = 0; i < items.length; i++) {
        ;(function (t) {
          var row = el('div', 'row')
          row.appendChild(el('div', 'row__name', t.name || 'Turno'))
          var act = el('div', 'row__act')
          var btn = el('button', 'btn btn-sm btn-primary', 'Abrir')
          btn.type = 'button'
          btn.style.width = 'auto'
          btn.onclick = function () {
            var openingCash = readOpeningCashInput(amountInp)
            if (openingCash == null) {
              Lela.toast('Indicá el monto de apertura', 'err')
              try {
                amountInp.focus()
              } catch (e) {}
              return
            }
            btn.disabled = true
            Lela.post(
              '/shifts/open',
              { templateId: t.id, openingCash: openingCash },
              function (res) {
                btn.disabled = false
                if (!res || !res.ok) {
                  Lela.toast(openingCashError(res && res.error), 'err')
                  return
                }
                Lela.toast('Turno abierto', 'ok')
                cierreCounted = null
                cierreInventory = null
                cierreExpenses = null
                rerender(Lela.screens.cierre, main)
              }
            )
          }
          act.appendChild(btn)
          row.appendChild(act)
          list.appendChild(row)
        })(items[i])
      }
    })
  }

  function renderOpeningCashCard(main, host) {
    var open = snap().openShift
    if (!open || !open.id) return
    var card = el('div', 'count-card')
    card.appendChild(el('div', 'count-card__title', 'Fondo de apertura'))
    var current =
      open.expectedCash != null ? Number(open.expectedCash) : null
    card.appendChild(
      el(
        'div',
        'count-card__meta',
        current != null && isFinite(current)
          ? 'Registrado ' + Lela.money(current)
          : 'Sin monto registrado'
      )
    )
    if (Lela.state.isAdmin()) {
      var inp = document.createElement('input')
      inp.type = 'number'
      inp.className = 'field__input'
      inp.min = '0'
      inp.step = '1'
      inp.value = current != null && isFinite(current) ? String(current) : ''
      inp.setAttribute('aria-label', 'Editar fondo de apertura')
      card.appendChild(field('Monto de apertura', inp))
      var save = el('button', 'btn btn-sm btn-primary', 'Guardar monto')
      save.type = 'button'
      save.style.width = 'auto'
      save.style.marginTop = '0.5rem'
      save.onclick = function () {
        var openingCash = readOpeningCashInput(inp)
        if (openingCash == null) {
          Lela.toast('Indicá un monto válido', 'err')
          return
        }
        save.disabled = true
        Lela.post(
          '/shifts/' + open.id + '/opening-cash',
          { openingCash: openingCash },
          function (res) {
            save.disabled = false
            if (!res || !res.ok) {
              Lela.toast(
                openingCashError(res && res.error) || 'No se pudo guardar',
                'err'
              )
              return
            }
            Lela.toast('Monto de apertura actualizado', 'ok')
            cierreCounted = null
            rerender(Lela.screens.cierre, main)
          }
        )
      }
      card.appendChild(save)
    }
    host.appendChild(card)
  }

  function renderCaja(main, host) {
    ensureCierreState()
    renderOpeningCashCard(main, host)
    var i
    for (i = 0; i < CAJA_IDS.length; i++) {
      ;(function (id) {
        var sistema = accountBalance(id)
        if (cierreCounted[id] == null) cierreCounted[id] = sistema
        var card = el('div', 'count-card')
        card.appendChild(el('div', 'count-card__title', CAJA_LABELS[id] || id))
        var meta = el('div', 'count-card__meta', '')
        function paintMeta() {
          var contado = Number(cierreCounted[id]) || 0
          var diff = contado - sistema
          meta.textContent =
            'Sistema ' +
            Lela.money(sistema) +
            ' · Diff ' +
            (diff >= 0 ? '+' : '') +
            Lela.money(diff)
        }
        paintMeta()
        card.appendChild(meta)
        var inp = document.createElement('input')
        inp.type = 'number'
        inp.className = 'field__input'
        inp.value = String(cierreCounted[id])
        inp.oninput = function () {
          cierreCounted[id] = Number(inp.value) || 0
          paintMeta()
        }
        card.appendChild(field('Contado', inp))
        host.appendChild(card)
      })(CAJA_IDS[i])
    }
    host.appendChild(
      el('p', 'hint', 'Los gastos se registran en Gastos (foto o manual).')
    )
  }

  function afterExpenseSaved(main, accountId, amount) {
    ensureCierreState()
    if (cierreCounted[accountId] != null) {
      cierreCounted[accountId] = Math.max(
        0,
        (Number(cierreCounted[accountId]) || 0) - amount
      )
    }
    cierreExpenses = null
    Lela.closeDrawer()
    Lela.toast('Gasto registrado', 'ok')
    if (main && Lela.screens) {
      if (location.hash === '#/gastos' && Lela.screens.gastos) {
        Lela.screens.gastos(main)
      } else if (Lela.screens.cierre) {
        cierreSection = 'gastos'
        Lela.screens.cierre(main)
      }
    }
  }

  /**
   * Drawer de gasto: foto de factura (rellena campos si hay visión) o manual.
   * opts.preferPhoto = true abre el picker al instante.
   */
  function openExpenseDrawer(main, opts) {
    opts = opts || {}
    var photoPath = null
    var desc = document.createElement('input')
    desc.type = 'text'
    desc.className = 'field__input'
    desc.placeholder = 'Ej. Factura proveedor, gasolina…'
    var amt = document.createElement('input')
    amt.type = 'number'
    amt.className = 'field__input'
    amt.value = ''
    amt.placeholder = '0'
    var acc = document.createElement('select')
    acc.className = 'field__input'
    var ai
    for (ai = 0; ai < CAJA_IDS.length; ai++) {
      var o = document.createElement('option')
      o.value = CAJA_IDS[ai]
      o.textContent = CAJA_LABELS[CAJA_IDS[ai]]
      acc.appendChild(o)
    }
    var cat = document.createElement('select')
    cat.className = 'field__input'
    var cats = [
      { id: 'factura', label: 'Factura' },
      { id: 'gasto', label: 'Gasto' },
      { id: 'compra', label: 'Compra' },
      { id: 'otro', label: 'Otro' },
    ]
    var ci
    for (ci = 0; ci < cats.length; ci++) {
      var co = document.createElement('option')
      co.value = cats[ci].id
      co.textContent = cats[ci].label
      cat.appendChild(co)
    }

    Lela.openDrawer(
      'Registrar gasto',
      '',
      '<button type="button" id="exp-save" class="btn btn--primary btn--block">Guardar gasto</button>'
    )
    var db = Lela.$('drawer-body')
    db.innerHTML = ''

    var status = el('p', 'hint', 'Podés cargar la factura con foto o llenar a mano.')
    status.id = 'exp-status'

    var preview = el('div', 'photo-prev')
    preview.id = 'exp-photo-prev'
    preview.style.display = 'none'

    var btnFoto = el('button', 'btn btn--secondary btn--block', 'Foto de factura')
    btnFoto.type = 'button'
    btnFoto.id = 'exp-photo-btn'

    db.appendChild(status)
    db.appendChild(preview)
    db.appendChild(btnFoto)
    db.appendChild(field('Categoría', cat))
    db.appendChild(field('Descripción', desc))
    db.appendChild(field('Monto', amt))
    db.appendChild(field('Cuenta que paga', acc))

    function setPhotoPreview(path) {
      photoPath = path || null
      if (path) {
        preview.style.display = 'block'
        preview.style.backgroundImage = 'url("' + String(path).replace(/"/g, '') + '")'
      } else {
        preview.style.display = 'none'
        preview.style.backgroundImage = ''
      }
    }

    function applyParsed(expense) {
      if (!expense) return
      if (expense.description) desc.value = expense.description
      if (expense.amount > 0) amt.value = String(expense.amount)
      if (expense.category) {
        var optsEl = cat.options
        var oi
        for (oi = 0; oi < optsEl.length; oi++) {
          if (optsEl[oi].value === expense.category) {
            cat.value = expense.category
            break
          }
        }
      }
    }

    function captureFoto() {
      var input = Lela.$('file-pick')
      if (!input) {
        Lela.toast('Cámara no disponible', 'err')
        return
      }
      status.textContent = 'Elegí o tomá la foto…'
      input.onchange = function () {
        var file = input.files && input.files[0]
        input.value = ''
        input.onchange = null
        if (!file) {
          status.textContent = 'Podés cargar la factura con foto o llenar a mano.'
          return
        }
        status.textContent = 'Subiendo foto…'
        btnFoto.disabled = true
        Lela.fileToJpegDataUrl(file, 1280, 0.82, function (dataUrl) {
          if (!dataUrl) {
            btnFoto.disabled = false
            status.textContent = 'No se pudo leer la foto. Probá de nuevo o llená a mano.'
            Lela.toast('No se pudo leer la foto', 'err')
            return
          }
          Lela.uploadDataUrl(dataUrl, 'expense', function (res) {
            if (!res || !res.ok || !res.path) {
              btnFoto.disabled = false
              status.textContent = 'Error al subir. Podés llenar a mano.'
              Lela.toast((res && res.error) || 'Error al subir foto', 'err')
              return
            }
            setPhotoPreview(res.path)
            status.textContent = 'Leyendo factura…'
            Lela.post('/expenses/parse-photo', { dataUrl: dataUrl }, function (parsed) {
              btnFoto.disabled = false
              if (parsed && parsed.ok && parsed.expense) {
                applyParsed(parsed.expense)
                status.textContent =
                  'Foto lista. Revisá monto y descripción antes de guardar.'
                Lela.toast('Datos leídos de la foto', 'ok')
              } else {
                status.textContent =
                  'Foto guardada. Completá monto y descripción a mano.'
                if (parsed && parsed.error === 'vision_not_configured') {
                  /* sin API de visión: flujo manual con foto adjunta */
                } else if (parsed && parsed.error) {
                  Lela.toast('No se pudo leer la factura; llená a mano', 'err')
                }
              }
            })
          })
        })
      }
      input.click()
    }

    btnFoto.onclick = function () {
      captureFoto()
    }

    Lela.$('exp-save').onclick = function () {
      var description = (desc.value || '').replace(/^\s+|\s+$/g, '')
      var amount = Number(amt.value)
      if (!description) {
        Lela.toast('Escribí la descripción', 'err')
        return
      }
      if (!(amount > 0)) {
        Lela.toast('Monto inválido', 'err')
        return
      }
      var saveBtn = Lela.$('exp-save')
      if (saveBtn) saveBtn.disabled = true
      Lela.post(
        '/expenses',
        {
          description: description,
          amount: amount,
          accountId: acc.value,
          category: cat.value,
          photoPath: photoPath || undefined,
        },
        function (res) {
          if (saveBtn) saveBtn.disabled = false
          if (!res || !res.ok) {
            Lela.toast((res && res.error) || 'No se pudo guardar', 'err')
            return
          }
          afterExpenseSaved(main, acc.value, amount)
        }
      )
    }

    if (opts.preferPhoto) {
      setTimeout(function () {
        captureFoto()
      }, 200)
    }
  }

  Lela.openExpenseDrawer = openExpenseDrawer

  function paintExpenseList(list, totalEl, items) {
    list.innerHTML = ''
    if (totalEl) totalEl.textContent = ''
    if (!items || !items.length) {
      list.appendChild(
        el('div', 'row empty', 'Sin gastos aún. Usá Foto de factura o Manual.')
      )
      if (totalEl) totalEl.textContent = 'Total gastos ₡0'
      return
    }
    var total = 0
    var i
    for (i = 0; i < items.length; i++) {
      ;(function (e) {
        total += Number(e.amount) || 0
        var row = el('div', 'row row--line')
        if (e.photoPath) {
          var thumb = el('div', 'row__thumb')
          thumb.style.backgroundImage =
            'url("' + String(e.photoPath).replace(/"/g, '') + '")'
          row.appendChild(thumb)
        }
        var body = el('div', 'row__body')
        body.appendChild(el('div', 'row__name', e.description || '—'))
        body.appendChild(
          el(
            'div',
            'row__meta',
            (e.category ? e.category + ' · ' : '') +
              (CAJA_LABELS[e.accountId] || e.accountId || '') +
              (e.createdAt
                ? ' · ' + String(e.createdAt).slice(0, 16).replace('T', ' ')
                : '')
          )
        )
        row.appendChild(body)
        row.appendChild(el('div', 'row__right', Lela.money(e.amount)))
        list.appendChild(row)
      })(items[i])
    }
    if (totalEl) totalEl.textContent = 'Total gastos ' + Lela.money(total)
  }

  function loadShiftExpenses(cb) {
    var open = snap().openShift
    if (cierreExpenses) {
      cb(cierreExpenses)
      return
    }
    var path = '/expenses'
    if (open && open.openedAt) {
      path += '?since=' + encodeURIComponent(open.openedAt)
    }
    Lela.get(path, function (data) {
      cierreExpenses = (data && data.items) || []
      cb(cierreExpenses)
    })
  }

  function renderGastosHost(main, host) {
    var actions = el('div', 'gastos-actions')
    var btnFoto = el('button', 'btn btn--primary', 'Foto de factura')
    btnFoto.type = 'button'
    btnFoto.onclick = function () {
      openExpenseDrawer(main, { preferPhoto: true })
    }
    var btnManual = el('button', 'btn btn--secondary', 'Manual')
    btnManual.type = 'button'
    btnManual.onclick = function () {
      openExpenseDrawer(main, {})
    }
    actions.appendChild(btnFoto)
    actions.appendChild(btnManual)
    host.appendChild(actions)
    host.appendChild(
      el(
        'p',
        'hint',
        'La foto intenta llenar monto y descripción. Siempre podés corregir antes de guardar.'
      )
    )

    var list = el('div', 'list')
    list.appendChild(el('div', 'row empty', 'Cargando…'))
    host.appendChild(list)
    var totalEl = el('p', 'total', '')
    host.appendChild(totalEl)
    loadShiftExpenses(function (items) {
      paintExpenseList(list, totalEl, items)
    })
  }

  function renderMovimientos(main, host) {
    renderGastosHost(main, host)
  }

  Lela.screens.gastos = function (main) {
    main.innerHTML = ''
    var head = el('header', 'module-head module-head--ops')
    var copy = el('div', 'module-head__copy')
    copy.appendChild(el('p', 'module-head__kicker', 'Egresos del turno'))
    copy.appendChild(el('h1', 'module-head__title', 'Gastos'))
    copy.appendChild(
      el(
        'p',
        'module-head__lede',
        'Subí la foto de una factura o registrá el gasto a mano. Queda en el Cierre.'
      )
    )
    head.appendChild(copy)
    main.appendChild(head)

    var open = snap().openShift
    if (!open || !open.id) {
      main.appendChild(
        el(
          'p',
          'empty',
          'Abrí un turno en Cierre para registrar gastos del día.'
        )
      )
      var go = el('button', 'btn btn--primary btn--block', 'Ir a Cierre')
      go.type = 'button'
      go.onclick = function () {
        Lela.state.go('#/cierre')
      }
      main.appendChild(go)
      return
    }

    var host = el('div', 'cierre-host')
    main.appendChild(host)
    renderGastosHost(main, host)
  }

  function renderConteo(main, host) {
    ensureCierreState()
    var products = activeProducts()
    if (!products.length) {
      host.appendChild(el('p', 'empty', 'Sin productos.'))
      return
    }
    var i
    for (i = 0; i < products.length; i++) {
      ;(function (p) {
        var sistema = stockOf(p)
        if (cierreInventory[p.id] == null) cierreInventory[p.id] = sistema
        var card = el('div', 'count-card')
        card.appendChild(el('div', 'count-card__title', p.name))
        card.appendChild(el('div', 'count-card__meta', 'Sistema ' + sistema))
        var inp = document.createElement('input')
        inp.type = 'number'
        inp.className = 'field__input'
        inp.inputMode = 'numeric'
        inp.value = String(cierreInventory[p.id])
        inp.oninput = function () {
          cierreInventory[p.id] = Number(inp.value) || 0
        }
        card.appendChild(field('Contado', inp))
        host.appendChild(card)
      })(products[i])
    }
  }

  function renderCerrar(main, host) {
    ensureCierreState()
    var open = snap().openShift
    var products = activeProducts()

    var cajaDiffs = []
    var i
    for (i = 0; i < CAJA_IDS.length; i++) {
      var id = CAJA_IDS[i]
      var sistema = accountBalance(id)
      var contado = Number(cierreCounted[id]) || 0
      var diff = contado - sistema
      if (Math.abs(diff) >= 0.01) {
        cajaDiffs.push({
          name: CAJA_LABELS[id],
          sistema: sistema,
          contado: contado,
          diff: diff,
        })
      }
    }

    var invDiffs = []
    var j
    for (j = 0; j < products.length; j++) {
      var p = products[j]
      var sys = stockOf(p)
      var cnt = cierreInventory[p.id] != null ? Number(cierreInventory[p.id]) : sys
      var d = cnt - sys
      if (d !== 0) {
        invDiffs.push({ name: p.name, sistema: sys, contado: cnt, diff: d })
      }
    }

    var sum = el('div', 'panel')
    sum.appendChild(el('h2', 'h2', 'Diferencias de caja'))
    if (!cajaDiffs.length) {
      sum.appendChild(el('p', 'empty', 'Sin diferencias de caja.'))
    } else {
      var cl = el('div', 'list')
      var ci
      for (ci = 0; ci < cajaDiffs.length; ci++) {
        var c = cajaDiffs[ci]
        cl.appendChild(
          el(
            'div',
            'row',
            c.name +
              ': sistema ' +
              Lela.money(c.sistema) +
              ' · contado ' +
              Lela.money(c.contado) +
              ' · diff ' +
              Lela.money(c.diff)
          )
        )
      }
      sum.appendChild(cl)
    }
    host.appendChild(sum)

    var invSum = el('div', 'panel')
    invSum.appendChild(el('h2', 'h2', 'Diferencias de inventario'))
    if (!invDiffs.length) {
      invSum.appendChild(el('p', 'empty', 'Sin diferencias de inventario.'))
    } else {
      var il = el('div', 'list')
      var ii
      for (ii = 0; ii < invDiffs.length; ii++) {
        var r = invDiffs[ii]
        il.appendChild(
          el(
            'div',
            'row',
            r.name +
              ': sistema ' +
              r.sistema +
              ' · contado ' +
              r.contado +
              ' · diff ' +
              r.diff
          )
        )
      }
      invSum.appendChild(il)
    }
    host.appendChild(invSum)

    var movSum = el('div', 'panel')
    movSum.appendChild(el('h2', 'h2', 'Gastos del turno'))
    function paintMovClose(items) {
      movSum.innerHTML = ''
      movSum.appendChild(el('h2', 'h2', 'Gastos del turno'))
      if (!items || !items.length) {
        movSum.appendChild(el('p', 'empty', 'Sin gastos.'))
        return
      }
      var totalMov = 0
      var ml = el('div', 'list')
      var mi
      for (mi = 0; mi < items.length; mi++) {
        var e = items[mi]
        totalMov += Number(e.amount) || 0
        var row = el('div', 'row row--line')
        if (e.photoPath) {
          var thumb = el('div', 'row__thumb')
          thumb.style.backgroundImage =
            'url("' + String(e.photoPath).replace(/"/g, '') + '")'
          row.appendChild(thumb)
        }
        var body = el('div', 'row__body')
        body.appendChild(el('div', 'row__name', e.description || '—'))
        body.appendChild(
          el(
            'div',
            'row__meta',
            (e.category ? e.category + ' · ' : '') +
              (CAJA_LABELS[e.accountId] || '')
          )
        )
        row.appendChild(body)
        row.appendChild(el('div', 'row__right', Lela.money(e.amount)))
        ml.appendChild(row)
      }
      movSum.appendChild(ml)
      movSum.appendChild(el('p', 'total', 'Total gastos ' + Lela.money(totalMov)))
    }
    host.appendChild(movSum)
    if (cierreExpenses) {
      paintMovClose(cierreExpenses)
    } else {
      var path = '/expenses'
      if (open && open.openedAt) {
        path += '?since=' + encodeURIComponent(open.openedAt)
      }
      Lela.get(path, function (data) {
        cierreExpenses = (data && data.items) || []
        paintMovClose(cierreExpenses)
      })
    }

    var closeBtn = el('button', 'btn btn--primary btn--block', 'Confirmar cierre')
    closeBtn.type = 'button'
    closeBtn.onclick = function () {
      Lela.confirmSoft(
        {
          title: '¿Cerrar turno?',
          body: 'Se guardarán conteos de caja e inventario.',
          confirmLabel: 'Cerrar',
          danger: true,
        },
        function () {
          var countedAccounts = {}
          var ai
          for (ai = 0; ai < CAJA_IDS.length; ai++) {
            countedAccounts[CAJA_IDS[ai]] = Number(cierreCounted[CAJA_IDS[ai]]) || 0
          }
          var countedInventory = {}
          var pi
          for (pi = 0; pi < products.length; pi++) {
            var pid = products[pi].id
            countedInventory[pid] =
              cierreInventory[pid] != null
                ? Number(cierreInventory[pid]) || 0
                : stockOf(products[pi])
          }
          closeBtn.disabled = true
          Lela.post(
            '/shifts/' + open.id + '/close',
            {
              countedCash: countedAccounts['acc-efectivo'],
              countedAccounts: countedAccounts,
              countedInventory: countedInventory,
              notes: '',
            },
            function (res) {
              closeBtn.disabled = false
              if (!res || !res.ok) {
                Lela.toast((res && res.error) || 'No se pudo cerrar', 'err')
                return
              }
              Lela.toast(
                'Cierre guardado. Diferencias: ' + (res.differences != null ? res.differences : 0),
                'ok'
              )
              cierreCounted = null
              cierreInventory = null
              cierreExpenses = null
              rerender(Lela.screens.cierre, main)
            }
          )
        }
      )
    }
    host.appendChild(closeBtn)
  }

  Lela.screens.cierre = function (main) {
    main.innerHTML = ''
    var open = snap().openShift

    var head = el('header', 'module-head module-head--ops')
    var copy = el('div', 'module-head__copy')
    copy.appendChild(el('p', 'module-head__kicker', 'Turno'))
    copy.appendChild(el('h1', 'module-head__title', 'Cierre'))
    copy.appendChild(
      el(
        'p',
        'module-head__lede',
        'Caja, saldos de inventario, gastos y cierre del turno.'
      )
    )
    head.appendChild(copy)
    main.appendChild(head)

    if (!open || !open.id) {
      renderNoShift(main)
      return
    }

    ensureCierreState()

    if (cierreSection === 'movimientos') cierreSection = 'gastos'
    var sections = [
      { id: 'caja', label: 'Caja' },
      { id: 'conteo', label: 'Saldos de inventario' },
      { id: 'gastos', label: 'Gastos' },
      { id: 'cerrar', label: 'Cerrar' },
    ]
    var tabs = el('nav', 'cierre-tabs')
    tabs.setAttribute('aria-label', 'Apartado de cierre')
    var si
    for (si = 0; si < sections.length; si++) {
      ;(function (sec) {
        var b = document.createElement('button')
        b.type = 'button'
        b.textContent = sec.label
        b.className = cierreSection === sec.id ? 'is-on' : ''
        b.onclick = function () {
          cierreSection = sec.id
          if (cierreSection === 'gastos') cierreExpenses = null
          Lela.screens.cierre(main)
        }
        tabs.appendChild(b)
      })(sections[si])
    }
    main.appendChild(tabs)

    if (cierreSection === 'caja' || cierreSection === 'conteo') {
      var resetBar = el('div', 'cierre-reset')
      var resetBtn = el(
        'button',
        'btn btn--ghost btn--block',
        'Reiniciar conteo'
      )
      resetBtn.type = 'button'
      resetBtn.onclick = function () {
        resetCierreConteo(main)
      }
      resetBar.appendChild(resetBtn)
      resetBar.appendChild(
        el(
          'p',
          'hint',
          'Borra lo apuntado en caja e inventario y vuelve a los valores del sistema.'
        )
      )
      main.appendChild(resetBar)
    }

    var host = el('div', 'cierre-host')
    main.appendChild(host)

    if (cierreSection === 'caja') renderCaja(main, host)
    else if (cierreSection === 'conteo') renderConteo(main, host)
    else if (cierreSection === 'gastos') renderGastosHost(main, host)
    else renderCerrar(main, host)
  }
})(window)
