// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

module.exports = trim

function trim (s) {
  if (!/^\r?\n/.test(s)) return s
  return deindent(s)
}

function deindent (s) {
  if (!/^\r?\n/.test(s)) return s
  var indent = (s.match(/\n([ ]+)/m) || [])[1] || ''
  s = indent + s
  return s.split('\n')
    .map(l => replace(indent, l))
    .join('\n')
}

function replace (prefix, line) {
  return line.slice(0, prefix.length) === prefix ? line.slice(prefix.length) : line
}
