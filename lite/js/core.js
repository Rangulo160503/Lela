/* ES5 core — iOS 9 */
(function (global) {
  var TOKEN_KEY = 'panaderia-lela-token'
  var API = '/api'
  var toastTimer = null
  /** Respaldo si localStorage falla (Safari privado / iOS 9). */
  var memoryToken = null

  function $(id) {
    return document.getElementById(id)
  }

  function getToken() {
    if (memoryToken) return memoryToken
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch (e) {
      return null
    }
  }

  function setToken(token) {
    memoryToken = token || null
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch (e) {
      /* memoria alcanza para la sesión */
    }
  }

  function clearToken() {
    setToken(null)
  }

  function money(n) {
    var v = Math.round(Number(n) || 0)
    return '₡' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  }

  /** Mensajes simples para la gente de la panadería (sin códigos técnicos). */
  function friendlyError(code, fallback) {
    var c = String(code || '')
    if (c === 'bad_json' || c === 'network' || c === 'timeout') {
      return 'No se pudo conectar. Probá de nuevo.'
    }
    if (c === 'unauthorized') return 'Sesión expirada. Entrá de nuevo.'
    if (c === 'opening_cash_required') {
      return 'Indicá el monto de apertura.'
    }
    if (c === 'already_open') return 'Ya hay un turno abierto.'
    if (c === 'not_open') return 'No hay turno abierto.'
    if (c === 'forbidden') return 'No tenés permiso para eso.'
    if (!c || c === 'null' || c === 'undefined') {
      return fallback || 'No se pudo completar.'
    }
    if (/^[a-z0-9_]+$/i.test(c) && c.indexOf(' ') < 0 && c.length < 40) {
      return fallback || 'No se pudo completar. Probá de nuevo.'
    }
    return c
  }

  function toast(text, tone) {
    var host = $('toast-host')
    if (!host) return
    host.innerHTML = ''
    var el = document.createElement('div')
    el.className = 'toast ' + (tone === 'err' ? 'err' : tone === 'ok' ? 'ok' : '')
    var p = document.createElement('p')
    p.className = 'toast__text'
    p.textContent = text || ''
    var x = document.createElement('button')
    x.type = 'button'
    x.className = 'toast__x'
    x.textContent = 'Cerrar'
    x.onclick = function () {
      host.innerHTML = ''
    }
    el.appendChild(p)
    el.appendChild(x)
    host.appendChild(el)
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      host.innerHTML = ''
    }, 4200)
  }

  function confirmSoft(opts, onYes) {
    var host = $('confirm-host')
    host.innerHTML = ''
    var scrim = document.createElement('div')
    scrim.className = 'confirm-scrim'
    var box = document.createElement('div')
    box.className = 'confirm'
    var h = document.createElement('h2')
    h.textContent = opts.title || '¿Continuar?'
    var p = document.createElement('p')
    p.textContent = opts.body || ''
    var acts = document.createElement('div')
    acts.className = 'confirm__acts'
    var cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn btn-ghost'
    cancel.textContent = opts.cancelLabel || 'Cancelar'
    cancel.onclick = function () {
      host.innerHTML = ''
    }
    var ok = document.createElement('button')
    ok.type = 'button'
    ok.className = opts.danger ? 'btn btn-danger' : 'btn btn-primary'
    ok.style.width = '48%'
    ok.textContent = opts.confirmLabel || 'Sí'
    ok.onclick = function () {
      host.innerHTML = ''
      if (onYes) onYes()
    }
    acts.appendChild(cancel)
    acts.appendChild(ok)
    box.appendChild(h)
    if (opts.body) box.appendChild(p)
    box.appendChild(acts)
    scrim.appendChild(box)
    host.appendChild(scrim)
  }

  function withToken(path) {
    var token = getToken()
    var url = path || ''
    if (token && url.indexOf('token=') === -1) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(token)
    }
    return url
  }

  function xhr(method, path, body, cb) {
    var req = new XMLHttpRequest()
    var done = false
    var watchdog = null
    var isGet = String(method || '').toUpperCase() === 'GET'
    function finish(data, status) {
      if (done) return
      done = true
      if (watchdog) clearTimeout(watchdog)
      try {
        cb(data, status)
      } catch (e) {
        if (typeof console !== 'undefined' && console.log) {
          console.log('Lela callback error', e)
        }
      }
    }
    /* Token solo en query: iOS 9 cuelga con Authorization / headers custom. */
    req.open(method, API + withToken(path), true)
    try {
      req.timeout = 20000
    } catch (e) {}
    watchdog = setTimeout(function () {
      try {
        req.abort()
      } catch (e2) {}
      finish({ ok: false, error: 'timeout' }, 0)
    }, 22000)
    if (!isGet) {
      try {
        req.setRequestHeader('Content-Type', 'application/json')
      } catch (e3) {}
    }
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return
      var data = null
      var raw = req.responseText || ''
      try {
        data = JSON.parse(raw || 'null')
      } catch (e) {
        finish({ ok: false, error: 'bad_json', status: req.status }, req.status)
        return
      }
      if (req.status === 401) {
        clearToken()
        if (global.Lela && global.Lela.onSessionLost) global.Lela.onSessionLost()
        finish({ ok: false, error: 'unauthorized', status: 401 }, 401)
        return
      }
      if (req.status === 0) {
        finish({ ok: false, error: 'network', status: 0 }, 0)
        return
      }
      finish(data, req.status)
    }
    req.onerror = function () {
      finish({ ok: false, error: 'network' }, 0)
    }
    req.ontimeout = function () {
      finish({ ok: false, error: 'timeout' }, 0)
    }
    try {
      req.send(body ? JSON.stringify(body) : null)
    } catch (e) {
      finish({ ok: false, error: 'network' }, 0)
    }
  }

  function get(path, cb) {
    xhr('GET', path, null, cb)
  }
  function post(path, body, cb) {
    xhr('POST', path, body || {}, cb)
  }

  function isActive(row) {
    return row && row.active !== 0 && row.active !== false
  }

  function fileToJpegDataUrl(file, maxSide, quality, cb) {
    if (!file) {
      cb(null)
      return
    }
    var reader = new FileReader()
    reader.onload = function () {
      var img = new Image()
      img.onload = function () {
        var w = img.width
        var h = img.height
        var max = maxSide || 1280
        if (w > max || h > max) {
          if (w >= h) {
            h = Math.round((h * max) / w)
            w = max
          } else {
            w = Math.round((w * max) / h)
            h = max
          }
        }
        var canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        var ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        var out = canvas.toDataURL('image/jpeg', quality || 0.82)
        cb(out)
      }
      img.onerror = function () {
        cb(null)
      }
      img.src = reader.result
    }
    reader.onerror = function () {
      cb(null)
    }
    reader.readAsDataURL(file)
  }

  function uploadDataUrl(dataUrl, kind, cb) {
    post('/uploads', { dataUrl: dataUrl, kind: kind || 'product' }, cb)
  }

  function openDrawer(title, bodyHtml, footHtml) {
    $('drawer-title').textContent = title || 'Editar'
    $('drawer-body').innerHTML = bodyHtml || ''
    $('drawer-foot').innerHTML = footHtml || ''
    $('drawer').style.display = 'block'
    $('drawer').setAttribute('aria-hidden', 'false')
  }

  function closeDrawer() {
    $('drawer').style.display = 'none'
    $('drawer').setAttribute('aria-hidden', 'true')
    $('drawer-body').innerHTML = ''
    $('drawer-foot').innerHTML = ''
  }

  var SEED_PHOTOS = {
    'mock-pan': '/images/products/pan.jpg',
    'mock-bolillo': '/images/products/bolillo.jpg',
    'mock-cuernito': '/images/products/cuernito.jpg',
    'mock-concha': '/images/products/concha.jpg',
    'mock-oreja': '/images/products/oreja.jpg',
    'mock-galleta': '/images/products/galleta.jpg',
    'mock-pastelito': '/images/products/pastelito.jpg',
    'mock-reposteria': '/images/products/reposteria.jpg',
    'mock-cafe': '/images/products/cafe.jpg',
    'mock-empanada': '/images/products/empanada.jpg',
  }

  var NAME_PHOTOS = [
    { key: 'pan', path: '/images/products/pan.jpg' },
    { key: 'bolillo', path: '/images/products/bolillo.jpg' },
    { key: 'cuernito', path: '/images/products/cuernito.jpg' },
    { key: 'concha', path: '/images/products/concha.jpg' },
    { key: 'oreja', path: '/images/products/oreja.jpg' },
    { key: 'galleta', path: '/images/products/galleta.jpg' },
    { key: 'pastelito', path: '/images/products/pastelito.jpg' },
    { key: 'reposteria', path: '/images/products/reposteria.jpg' },
    { key: 'cafe', path: '/images/products/cafe.jpg' },
    { key: 'empanada', path: '/images/products/empanada.jpg' },
  ]

  function foldName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ñ/g, 'n')
  }

  /** Misma lógica que productImage() de la versión que les gusta. */
  function productImage(product) {
    if (!product) return '/images/bread-loaf.jpg'
    if (product.photoPath) return product.photoPath
    if (product.id && SEED_PHOTOS[product.id]) return SEED_PHOTOS[product.id]
    var n = foldName(product.name)
    var i
    for (i = 0; i < NAME_PHOTOS.length; i++) {
      if (n.indexOf(NAME_PHOTOS[i].key) !== -1) return NAME_PHOTOS[i].path
    }
    if (n.indexOf('croissant') !== -1) return '/images/products/cuernito.jpg'
    return '/images/bread-loaf.jpg'
  }

  function thumbStyle(path) {
    var p = String(path || '').replace(/"/g, '')
    return p ? 'background-image:url("' + p + '")' : ''
  }

  global.Lela = global.Lela || {}
  global.Lela.$ = $
  global.Lela.TOKEN_KEY = TOKEN_KEY
  global.Lela.getToken = getToken
  global.Lela.setToken = setToken
  global.Lela.clearToken = clearToken
  global.Lela.money = money
  global.Lela.friendlyError = friendlyError
  global.Lela.toast = toast
  global.Lela.confirmSoft = confirmSoft
  global.Lela.get = get
  global.Lela.post = post
  global.Lela.isActive = isActive
  global.Lela.fileToJpegDataUrl = fileToJpegDataUrl
  global.Lela.uploadDataUrl = uploadDataUrl
  global.Lela.openDrawer = openDrawer
  global.Lela.closeDrawer = closeDrawer
  global.Lela.productImage = productImage
  global.Lela.thumbStyle = thumbStyle
})(window)
