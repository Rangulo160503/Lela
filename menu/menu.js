;(function () {
  'use strict'

  var SEED_PHOTOS = {
    'prod-bolillo': '/images/products/bolillo.jpg',
    'prod-concha': '/images/products/concha.jpg',
    'prod-cuernito': '/images/products/cuernito.jpg',
    'prod-empanada': '/images/products/empanada.jpg',
    'prod-galleta': '/images/products/galleta.jpg',
    'prod-oreja': '/images/products/oreja.jpg',
    'prod-pan': '/images/products/pan.jpg',
    'prod-pastelito': '/images/products/pastelito.jpg',
    'prod-reposteria': '/images/products/reposteria.jpg',
    'prod-cafe': '/images/products/cafe.jpg',
  }

  var NAME_PHOTOS = [
    { key: 'bolillo', path: '/images/products/bolillo.jpg' },
    { key: 'concha', path: '/images/products/concha.jpg' },
    { key: 'cuernito', path: '/images/products/cuernito.jpg' },
    { key: 'empanada', path: '/images/products/empanada.jpg' },
    { key: 'galleta', path: '/images/products/galleta.jpg' },
    { key: 'oreja', path: '/images/products/oreja.jpg' },
    { key: 'pastel', path: '/images/products/pastelito.jpg' },
    { key: 'cafe', path: '/images/products/cafe.jpg' },
    { key: 'pan', path: '/images/products/pan.jpg' },
  ]

  var allProducts = []
  var debounceTimer = null

  function foldName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ñ/g, 'n')
  }

  function productImage(product) {
    if (!product) return '/images/bread-loaf.jpg'
    if (product.photoPath) return product.photoPath
    if (product.id && SEED_PHOTOS[product.id]) return SEED_PHOTOS[product.id]
    var n = foldName(product.name)
    for (var i = 0; i < NAME_PHOTOS.length; i++) {
      if (n.indexOf(NAME_PHOTOS[i].key) !== -1) return NAME_PHOTOS[i].path
    }
    return '/images/bread-loaf.jpg'
  }

  function money(n) {
    var v = Math.round(Number(n) || 0)
    return '₡' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function productHaystack(p) {
    var extra = Array.isArray(p.ingredients) ? p.ingredients.join(' ') : ''
    return foldName(
      [p.name, p.presentationName, p.description, extra]
        .filter(Boolean)
        .join(' ')
    )
  }

  function renderIngredients(list) {
    if (!list || !list.length) {
      return '<p class="card__empty">Sin ingredientes publicados aún.</p>'
    }
    var html = '<p class="card__section">Ingredientes</p><ul class="card__ingredients">'
    for (var i = 0; i < list.length; i++) {
      html += '<li>' + escapeHtml(list[i]) + '</li>'
    }
    html += '</ul>'
    return html
  }

  function renderNutrition(n) {
    if (!n) {
      return '<p class="card__empty">Sin tabla nutricional aún.</p>'
    }
    return (
      '<p class="card__section">Tabla nutricional</p>' +
      '<p class="card__portion">' +
      escapeHtml(n.portion || 'Por porción') +
      '</p>' +
      '<table class="card__nutrition"><tbody>' +
      '<tr><th>Energía</th><td>' +
      escapeHtml(n.kcal) +
      ' kcal</td></tr>' +
      '<tr><th>Proteínas</th><td>' +
      escapeHtml(n.protein) +
      ' g</td></tr>' +
      '<tr><th>Carbohidratos</th><td>' +
      escapeHtml(n.carbs) +
      ' g</td></tr>' +
      '<tr><th>Grasas</th><td>' +
      escapeHtml(n.fat) +
      ' g</td></tr>' +
      '<tr><th>Fibra</th><td>' +
      escapeHtml(n.fiber) +
      ' g</td></tr>' +
      '<tr><th>Sodio</th><td>' +
      escapeHtml(n.sodium) +
      ' mg</td></tr>' +
      '</tbody></table>' +
      '<p class="card__disclaimer">Valores de ejemplo / referencia.</p>'
    )
  }

  function bindFlips(grid) {
    var cards = grid.querySelectorAll('.flip--interactive')
    for (var i = 0; i < cards.length; i++) {
      ;(function (el) {
        el.setAttribute('tabindex', '0')
        el.setAttribute('role', 'button')
        el.setAttribute('aria-pressed', 'false')
        function toggle() {
          var on = el.classList.toggle('is-flipped')
          el.setAttribute('aria-pressed', on ? 'true' : 'false')
        }
        el.addEventListener('click', toggle)
        el.addEventListener('keydown', function (e) {
          var code = e.keyCode || e.which
          if (code === 13 || code === 32) {
            if (e.preventDefault) e.preventDefault()
            toggle()
          }
        })
      })(cards[i])
    }
  }

  function filterProducts(query) {
    var q = foldName(query).trim()
    if (!q) return allProducts.slice()
    var tokens = q.split(/\s+/).filter(Boolean)
    return allProducts.filter(function (p) {
      var hay = productHaystack(p)
      for (var i = 0; i < tokens.length; i++) {
        if (hay.indexOf(tokens[i]) === -1) return false
      }
      return true
    })
  }

  function render(products, query) {
    var grid = document.getElementById('grid')
    var status = document.getElementById('status')
    var meta = document.getElementById('search-meta')
    if (!grid || !status) return

    var q = String(query || '').trim()

    if (!allProducts.length) {
      status.className = 'shelf__status'
      status.textContent = 'Hoy no hay productos publicados todavía.'
      status.hidden = false
      grid.hidden = true
      grid.innerHTML = ''
      if (meta) meta.hidden = true
      return
    }

    if (!products.length) {
      status.className = 'shelf__status'
      status.textContent =
        'No encontramos nada para “' + q + '”. Probá con otra palabra.'
      status.hidden = false
      grid.hidden = true
      grid.innerHTML = ''
      if (meta) {
        meta.hidden = false
        meta.textContent = '0 resultados'
      }
      return
    }

    var html = ''
    for (var i = 0; i < products.length; i++) {
      var p = products[i]
      var img = productImage(p)
      var desc = (p.description || '').trim()
      var present = (p.presentationName || '').trim()
      var ingredients = Array.isArray(p.ingredients) ? p.ingredients : []
      var nutrition = p.nutrition || null
      var hasDetail = ingredients.length > 0 || !!nutrition

      html +=
        '<article class="flip' +
        (hasDetail ? ' flip--interactive' : '') +
        '" style="animation-delay:' +
        Math.min(i * 0.04, 0.4) +
        's">' +
        '<div class="flip__inner">' +
        '<div class="flip__face flip__face--front card">' +
        '<div class="card__media"><img src="' +
        escapeHtml(img) +
        '" alt="" /></div>' +
        '<div class="card__body">' +
        '<h3 class="card__name">' +
        escapeHtml(p.name) +
        '</h3>' +
        (present
          ? '<p class="card__meta">' + escapeHtml(present) + '</p>'
          : '') +
        (desc ? '<p class="card__desc">' + escapeHtml(desc) + '</p>' : '') +
        '<p class="card__price">' +
        money(p.unitPrice) +
        '</p>' +
        (hasDetail
          ? '<p class="card__hint">Tocá para ver ingredientes y nutrición</p>'
          : '') +
        '</div></div>' +
        '<div class="flip__face flip__face--back card card--back">' +
        '<div class="card__back-body">' +
        '<h3 class="card__name">' +
        escapeHtml(p.name) +
        '</h3>' +
        renderIngredients(ingredients) +
        renderNutrition(nutrition) +
        '<p class="card__hint">Tocá para volver</p>' +
        '</div></div>' +
        '</div></article>'
    }

    grid.innerHTML = html
    bindFlips(grid)
    grid.hidden = false
    status.hidden = true
    status.textContent = ''

    if (meta) {
      if (q) {
        meta.hidden = false
        meta.textContent =
          products.length === 1
            ? '1 resultado para “' + q + '”'
            : products.length + ' resultados para “' + q + '”'
      } else {
        meta.hidden = true
        meta.textContent = ''
      }
    }
  }

  function applySearch() {
    var input = document.getElementById('menu-search')
    var clearBtn = document.getElementById('menu-search-clear')
    if (!input) return
    var q = input.value
    if (clearBtn) clearBtn.hidden = !String(q).trim()
    render(filterProducts(q), q)
  }

  function bindSearch() {
    var input = document.getElementById('menu-search')
    var clearBtn = document.getElementById('menu-search-clear')
    if (!input) return

    input.disabled = false

    input.addEventListener('input', function () {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(applySearch, 160)
    })

    input.addEventListener('keydown', function (e) {
      var code = e.keyCode || e.which
      if (code === 27) {
        input.value = ''
        applySearch()
        input.blur()
      }
    })

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = ''
        applySearch()
        input.focus()
      })
    }
  }

  function fail(msg) {
    var status = document.getElementById('status')
    if (!status) return
    status.className = 'shelf__status is-error'
    status.textContent = msg
    status.hidden = false
  }

  function setText(id, text, hideIfEmpty) {
    var el = document.getElementById(id)
    if (!el) return false
    var t = String(text || '').trim()
    el.textContent = t
    if (hideIfEmpty) el.hidden = !t
    return !!t
  }

  function setRow(rowId, valueId, text) {
    var row = document.getElementById(rowId)
    var valEl = document.getElementById(valueId)
    if (!row || !valEl) return false
    var t = String(text || '').trim()
    valEl.textContent = t
    row.hidden = !t
    return !!t
  }

  function applyBakery(bakery, bakeryName) {
    var b = bakery || {}
    var name = String(b.name || bakeryName || 'Panadería Lela').trim()
    setText('hero-brand', name, false)
    setText('hero-eyebrow', b.eyebrow || 'Desde el horno', false)
    setText(
      'hero-lede',
      b.tagline || 'El sabor de cada día, listo para servir.',
      false
    )
    setText('foot-brand', name, false)
    document.title = name + ' — Menú'

    var hasAddress = setRow('info-address-row', 'info-address', b.address)
    var hasPhone = setRow('info-phone-row', 'info-phone', b.phone)
    var hasHours = setRow('info-hours-row', 'info-hours', b.hours)
    var hasNote = setText('info-note', b.note, true)
    setText('foot-note', b.note, true)

    var info = document.getElementById('bakery-info')
    if (info) {
      info.hidden = !(hasAddress || hasPhone || hasHours || hasNote)
    }

    if (hasPhone) {
      var phoneEl = document.getElementById('info-phone')
      if (phoneEl) {
        var tel = String(b.phone || '').replace(/[^\d+]/g, '')
        if (tel) {
          phoneEl.innerHTML =
            '<a href="tel:' +
            escapeHtml(tel) +
            '">' +
            escapeHtml(b.phone) +
            '</a>'
        }
      }
    }
  }

  function load() {
    /* XHR: fetch no existe en Safari iOS 9 (iPad 4). */
    var req = new XMLHttpRequest()
    var done = false
    function finish(ok, data) {
      if (done) return
      done = true
      if (!ok || !data || !data.ok) {
        fail('No se pudo cargar el menú. Abrí http://IP-DE-LA-PC:3000/menu en Wi‑Fi.')
        return
      }
      applyBakery(data.bakery, data.bakeryName)
      allProducts = data.products || []
      bindSearch()
      applySearch()
    }
    req.open('GET', '/api/public/menu', true)
    try {
      req.timeout = 20000
    } catch (e) {}
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return
      if (req.status < 200 || req.status >= 300) {
        finish(false, null)
        return
      }
      try {
        finish(true, JSON.parse(req.responseText || 'null'))
      } catch (err) {
        finish(false, null)
      }
    }
    req.onerror = function () {
      finish(false, null)
    }
    req.ontimeout = function () {
      finish(false, null)
    }
    try {
      req.send(null)
    } catch (e2) {
      finish(false, null)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load)
  } else {
    load()
  }
})()
