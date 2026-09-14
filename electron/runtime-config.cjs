const fs = require('node:fs')
const path = require('node:path')

function validHost(value) {
  return (
    typeof value === 'string' && value.length <= 253 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(value)
  )
}

function loadOrigin(dist = path.join(__dirname, '../dist')) {
  let host = 'app.live-canvas.local'
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dist, 'runtime.json'), 'utf8'))
    if (!validHost(config.host)) throw Error('Invalid Live Canvas host in runtime.json.')
    host = config.host
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return `live-canvas://${host}/`
}

module.exports = { loadOrigin, validHost }
