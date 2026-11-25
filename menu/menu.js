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

  function render(products) {
    var grid = document.getElementById('grid')
    var status = document.getElementById('status')
    if (!grid || !status) return

    if (!products || !products.length) {
      status.textContent = 'Hoy no hay productos publicados todavía.'
      status.hidden = false
      grid.hidden = true
      grid.innerHTML = ''
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
  }

  function fail(msg) {
    var status = document.getElementById('status')
    if (!status) return
    status.className = 'shelf__status is-error'
    status.textContent = msg
    status.hidden = false
  }

  function load() {
    fetch('/api/public/menu', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('http_' + res.status)
        return res.json()
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error('bad_payload')
        var brand = document.querySelector('.hero__brand')
        if (brand && data.bakeryName) brand.textContent = data.bakeryName
        document.title = (data.bakeryName || 'Panadería Lela') + ' — Menú'
        render(data.products || [])
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
