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
    var v = Number(n)
    if (!isFinite(v)) v = 0
    return (
      '₡' +
      v.toLocaleString('es-CR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    )
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function productHaystack(p) {
    return foldName(
      [p.name, p.presentationName, p.description].filter(Boolean).join(' ')
    )
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
      html +=
        '<article class="card" style="animation-delay:' +
        Math.min(i * 0.04, 0.4) +
        's">' +
        '<div class="card__media"><img src="' +
        escapeHtml(img) +
        '" alt="" loading="lazy" /></div>' +
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
        '</div></article>'
    }

    grid.innerHTML = html
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
      if (e.key === 'Escape') {
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
    fetch('/api/public/menu', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('http_' + res.status)
        return res.json()
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error('bad_payload')
        applyBakery(data.bakery, data.bakeryName)
        allProducts = data.products || []
        bindSearch()
        applySearch()
      })
      .catch(function () {
        fail('No se pudo cargar el menú. Intentá de nuevo en un momento.')
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load)
  } else {
    load()
  }
})()
