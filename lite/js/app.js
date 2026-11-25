/* Boot + routing — ES5, iOS 9 */
(function (global) {
  var Lela = global.Lela
  var $ = Lela.$
  var CFG_TABS = [
    { id: 'products', label: 'Catálogo', hash: '#/cfg/products' },
    { id: 'promos', label: 'Combos', hash: '#/cfg/promos' },
    { id: 'materials', label: 'Materia prima', hash: '#/cfg/materials' },
    { id: 'recipes', label: 'Recetas', hash: '#/cfg/recipes' },
    { id: 'photos', label: 'Fotos', hash: '#/cfg/photos' },
    { id: 'suppliers', label: 'Proveedores', hash: '#/cfg/suppliers' },
    { id: 'proposals', label: 'Aprobaciones', hash: '#/cfg/proposals' },
    { id: 'users', label: 'Usuarios', hash: '#/cfg/users' },
    { id: 'bakery', label: 'Menú público', hash: '#/cfg/bakery' },
    { id: 'printer', label: 'Impresora', hash: '#/cfg/printer' },
    { id: 'backups', label: 'Respaldos', hash: '#/cfg/backups' },
  ]

  Lela.state = {
    user: null,
    snapshot: null,
  }

  Lela.state.isAdmin = function () {
    var u = Lela.state.user
    return !!(u && (u.role === 'admin' || u.role === 'principal'))
  }

  Lela.state.go = function (hash) {
    if (location.hash === hash) {
      route()
    } else {
      location.hash = hash
    }
  }

  Lela.state.refreshSnapshot = function (cb) {
    Lela.get('/snapshot', function (data) {
      if (data && (data.products || data.accounts || data.openShift !== undefined)) {
        Lela.state.snapshot = data
        if (!Lela.state.snapshot.products) Lela.state.snapshot.products = []
        if (!Lela.state.snapshot.promos) Lela.state.snapshot.promos = []
        if (!Lela.state.snapshot.sales) Lela.state.snapshot.sales = []
      }
      if (cb) cb(data)
    })
  }

  Lela.onSessionLost = function () {
    Lela.clearToken()
    Lela.state.user = null
    Lela.state.snapshot = null
    showLogin('Sesión expirada. Entrá de nuevo.')
  }

  function setHidden(id, hidden) {
    var node = $(id)
    if (!node) return
    if (node.classList) {
      if (hidden) node.classList.add('is-hidden')
      else node.classList.remove('is-hidden')
    } else if (hidden) {
      if ((' ' + node.className + ' ').indexOf(' is-hidden ') === -1) {
        node.className += ' is-hidden'
      }
    } else {
      node.className = String(node.className || '')
        .replace(/\bis-hidden\b/g, '')
        .replace(/\s+/g, ' ')
    }
    /* !important: .login-editorial / .app-shell usan display:flex !important */
    try {
      if (hidden) node.style.setProperty('display', 'none', 'important')
      else node.style.removeProperty('display')
    } catch (e) {
      node.style.display = hidden ? 'none' : ''
    }
  }

  function showLogin(msg) {
    setHidden('view-login', false)
    setHidden('view-app', true)
    if (Lela.closePosOverlay) Lela.closePosOverlay()
    Lela.closeDrawer()
    var el = $('login-msg')
    if (msg) {
      el.textContent = msg
      el.style.display = 'block'
    } else {
      el.textContent = ''
      el.style.display = 'none'
    }
  }

  function showApp() {
    setHidden('view-login', true)
    setHidden('view-app', false)
    var u = Lela.state.user
    $('user-label').textContent = u
      ? u.displayName || u.username || ''
      : ''
    buildNav()
    if (!location.hash || location.hash.indexOf('#/') !== 0) {
      location.hash = defaultHash()
      /* hashchange dispara route() */
      return
    }
    route()
  }

  function buildNav() {
    var nav = $('main-nav')
    nav.innerHTML = ''
    var tabs = [
      { label: 'Facturar', hash: '#/pos' },
      { label: 'Saldos de inventario', hash: '#/inv' },
      { label: 'Gastos', hash: '#/gastos' },
      { label: 'Cierre', hash: '#/cierre' },
    ]
    if (Lela.state.isAdmin()) {
      tabs.push({ label: 'Resumen', hash: '#/dash' })
      tabs.push({ label: 'Config', hash: '#/cfg/products' })
    }
    var i
    for (i = 0; i < tabs.length; i++) {
      ;(function (t) {
        var b = document.createElement('button')
        b.type = 'button'
        b.textContent = t.label
        b.setAttribute('data-hash', t.hash)
        b.onclick = function () {
          Lela.state.go(t.hash)
        }
        nav.appendChild(b)
      })(tabs[i])
    }
  }

  function markNav(hash) {
    var buttons = $('main-nav').getElementsByTagName('button')
    var i
    for (i = 0; i < buttons.length; i++) {
      var h = buttons[i].getAttribute('data-hash') || ''
      var on =
        hash === h ||
        (h.indexOf('#/cfg/') === 0 && hash.indexOf('#/cfg/') === 0)
      buttons[i].className = on ? 'is-on' : ''
    }

    var sub = $('sub-nav')
    if (hash.indexOf('#/cfg/') === 0 && Lela.state.isAdmin()) {
      sub.style.display = 'block'
      sub.innerHTML = ''
      for (i = 0; i < CFG_TABS.length; i++) {
        ;(function (t) {
          var b = document.createElement('button')
          b.type = 'button'
          b.textContent = t.label
          b.className = hash === t.hash ? 'is-on' : ''
          b.onclick = function () {
            Lela.state.go(t.hash)
          }
          sub.appendChild(b)
        })(CFG_TABS[i])
      }
    } else {
      sub.style.display = 'none'
      sub.innerHTML = ''
    }
  }

  function defaultHash() {
    /* Facturar primero — lo que usan al abrir (admin también). */
    return '#/pos'
  }

  function route() {
    if (!Lela.state.user) return
    if (Lela.closePosOverlay) Lela.closePosOverlay()
    var hash = location.hash || defaultHash()
    if (hash.indexOf('#/') !== 0) hash = defaultHash()
    if (hash.indexOf('#/cfg/') === 0 && !Lela.state.isAdmin()) {
      hash = '#/pos'
      location.hash = hash
    }
    if (hash === '#/dash' && !Lela.state.isAdmin()) {
      hash = '#/pos'
      location.hash = hash
    }
    markNav(hash)
    var main = $('main')
    main.innerHTML = '<p class="empty">Cargando…</p>'

    function paint(snapData) {
      if (!Lela.state.snapshot) {
        var why = 'No se pudo cargar la información.'
        if (snapData && snapData.error === 'timeout') {
          why = 'El servidor no respondió a tiempo.'
        } else if (snapData && snapData.error === 'network') {
          why = 'Sin conexión con el servidor.'
        }
        main.innerHTML =
          '<div class="panel"><p class="msg">' +
          why +
          '</p><p class="empty">Revisá que la PC tenga el sistema encendido y que este aparato esté en la misma Wi‑Fi.</p><p style="text-align:center;margin-top:1rem"><button type="button" class="btn btn-primary" id="btn-retry-snap">Reintentar</button></p></div>'
        var btn = $('btn-retry-snap')
        if (btn) {
          btn.onclick = function () {
            Lela.state.snapshot = null
            route()
          }
        }
        return
      }
      var screens = Lela.screens || {}
      var screen = null
      if (hash === '#/pos') screen = screens.pos
      else if (hash === '#/inv') screen = screens.inv
      else if (hash === '#/gastos') screen = screens.gastos
      else if (hash === '#/cierre') screen = screens.cierre
      else if (hash === '#/dash') screen = screens.dash
      else if (hash === '#/cfg/products') screen = screens.products
      else if (hash === '#/cfg/promos') screen = screens.promos
      else if (hash === '#/cfg/materials') screen = screens.materials
      else if (hash === '#/cfg/recipes') screen = screens.recipes
      else if (hash === '#/cfg/photos') screen = screens.photos
      else if (hash === '#/cfg/suppliers') screen = screens.suppliers
      else if (hash === '#/cfg/proposals') screen = screens.proposals
      else if (hash === '#/cfg/users') screen = screens.users
      else if (hash === '#/cfg/bakery') screen = screens.bakery
      else if (hash === '#/cfg/printer') screen = screens.printer
      else if (hash === '#/cfg/backups') screen = screens.backups

      if (!screen) {
        var keys = []
        var k
        for (k in screens) {
          if (screens.hasOwnProperty(k)) keys.push(k)
        }
        main.innerHTML =
          '<p class="empty">Pantalla no encontrada.</p><p class="hint">hash=' +
          String(hash) +
          ' · screens=' +
          (keys.length ? keys.join(',') : '(vacío — JS ops no cargó)') +
          '</p>'
        return
      }
      try {
        screen(main)
      } catch (err) {
        main.innerHTML =
          '<p class="msg">Error al mostrar: ' +
          String(err && err.message ? err.message : err) +
          '</p>'
      }
    }

    if (!Lela.state.snapshot) {
      Lela.state.refreshSnapshot(function (data) {
        paint(data)
      })
    } else {
      paint(Lela.state.snapshot)
    }
  }

  function doLogin() {
    var username = ($('login-user').value || '').replace(/^\s+|\s+$/g, '')
    var pin = ($('login-pin').value || '').replace(/^\s+|\s+$/g, '')
    var msg = $('login-msg')
    msg.textContent = 'Entrando…'
    msg.style.display = 'block'
    var btn = $('btn-login')
    if (btn) btn.disabled = true
    Lela.post('/auth/login', { username: username, pin: pin }, function (data) {
      if (btn) btn.disabled = false
      if (!data || !data.ok || !data.token) {
        msg.textContent = Lela.friendlyError(
          data && data.error,
          'Usuario o PIN incorrecto.'
        )
        msg.style.display = 'block'
        return
      }
      Lela.setToken(data.token)
      Lela.state.user = data.user
      Lela.state.snapshot = null
      msg.textContent = ''
      msg.style.display = 'none'
      /* Entrar YA — no bloquear el login esperando /snapshot (iPad). */
      try {
        Lela.toast('Bienvenido', 'ok')
      } catch (e) {}
      showApp()
      Lela.state.refreshSnapshot(function () {
        if (Lela.state.user) route()
      })
    })
  }

  function paintLanBanner(info) {
    var box = $('login-lan-banner')
    if (!box) return
    var host = ''
    try {
      host = String(location.hostname || '')
    } catch (e) {}
    var onTunnel = host.indexOf('trycloudflare.com') >= 0
    var lans = (info && info.lan) || []
    if (!onTunnel && !lans.length) {
      box.style.display = 'none'
      box.innerHTML = ''
      return
    }
    var html =
      '<strong>iPad / tablet vieja: usá Wi‑Fi local (no el link trycloudflare)</strong>'
    if (onTunnel) {
      html +=
        'Este túnel HTTPS no abre en iOS 9. En Safari del iPad abrí una de estas URLs (misma Wi‑Fi que la PC): '
    } else {
      html += 'Si otra tablet no carga el túnel, usá: '
    }
    if (lans.length) {
      var i
      for (i = 0; i < lans.length; i++) {
        if (i) html += ' · '
        html +=
          '<a href="' +
          lans[i] +
          '">' +
          lans[i] +
          '</a>'
      }
    } else {
      html += 'http://IP-DE-LA-PC:3000/ (está en ipad-url.txt en la PC)'
    }
    box.innerHTML = html
    box.style.display = 'block'
  }

  function loadAccessHint() {
    /* Silencioso: si el endpoint no existe aún, no mostrar errores. */
    try {
      Lela.get('/public/access', function (data) {
        if (data && data.ok) paintLanBanner(data)
        else paintLanBanner(null)
      })
    } catch (e) {
      paintLanBanner(null)
    }
  }

  function doLogout() {
    Lela.post('/auth/logout', {}, function () {
      Lela.clearToken()
      Lela.state.user = null
      Lela.state.snapshot = null
      location.hash = ''
      showLogin('')
    })
  }

  Lela.doLogin = doLogin

  function boot() {
    var loginBtn = $('btn-login')
    if (loginBtn) loginBtn.onclick = doLogin
    var logoutBtn = $('btn-logout')
    if (logoutBtn) logoutBtn.onclick = doLogout
    $('drawer-close').onclick = function () {
      Lela.closeDrawer()
    }
    $('drawer-scrim').onclick = function () {
      Lela.closeDrawer()
    }
    $('login-pin').onkeydown = function (e) {
      e = e || window.event
      if ((e.keyCode || e.which) === 13) doLogin()
    }
    if (window.addEventListener) {
      window.addEventListener('hashchange', route, false)
    } else {
      window.onhashchange = route
    }

    try {
      loadAccessHint()
    } catch (eHint) {}

    var token = Lela.getToken()
    if (!token) {
      showLogin('')
      return
    }
    Lela.get('/auth/me', function (data) {
      if (data && data.ok && data.user) {
        Lela.state.user = data.user
        showApp()
        Lela.state.refreshSnapshot(function () {
          if (Lela.state.user) route()
        })
      } else {
        Lela.clearToken()
        showLogin('')
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false)
  } else {
    boot()
  }
})(window)
