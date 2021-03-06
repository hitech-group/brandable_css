import {promisify} from 'bluebird'
const gzip = promisify(require('node-zopfli').gzip)
import {debug} from './utils'

export default async function handleGzip (params) {
  const css = params.Body
  if (css.length > 150) { // gzipping small files is not worth it
    const gzipped = await gzip(new Buffer(css))
    const compression = Math.round(100 - (100.0 * gzipped.length / css.length))

    // If we couldn't compress more than 5%, the gzip decoding cost to the
    // client makes it is not worth serving gzipped
    if (compression > 5) {
      debug(`uploading gzipped ${params.Key} was: ${css.length} now: ${gzipped.length} saved: ${compression}%`)
      params.ContentEncoding = 'gzip'
      params.Body = gzipped
      return params
    }
  }
  debug(`uploading ungzipped ${params.Key}`)
  return params
}
