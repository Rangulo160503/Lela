/* Strip trailing commas before ) — Safari iOS 9 SyntaxError */
var fs = require('fs')
var path = require('path')
var root = path.join(__dirname, '..', 'lite', 'js')
;['screens-ops.js', 'screens-admin.js', 'app.js', 'core.js'].forEach(function (name) {
  var p = path.join(root, name)
  var before = fs.readFileSync(p, 'utf8')
  var s = before
  var next = s.replace(/,(\s*\))/g, '$1')
  while (next !== s) {
    s = next
    next = s.replace(/,(\s*\))/g, '$1')
  }
  s = next
  var rem = (before.match(/,(\s*\))/g) || []).length
  fs.writeFileSync(p, s)
  console.log(name + ': removed ~' + rem + ' trailing-comma-before-)')
})
