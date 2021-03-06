import Promise from 'bluebird'
const existsAsync = Promise.promisify(require('fs').stat)
const sassRender = Promise.promisify(require('node-sass').render)
import path from 'path'
import chalk from 'chalk'
import url from 'url'
import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import postcssUrl from 'postcss-url'
import {paths as PATHS} from './config'
import {BRANDABLE_VARIANTS} from './variants'
import SASS_STYLE from './sass_style'
import {fileChecksumSync} from './checksum'
import supportedBrowsers from './supportedBrowsers'
import cache from './cache'
import {relativeSassPath, folderForBrandId} from './utils'

function revedUrl (originalUrl, md5) {
  let parsedUrl = url.parse(originalUrl)
  const {dir, name, ext} = path.posix.parse(parsedUrl.pathname)
  parsedUrl.pathname = `/dist${dir}/${name}-${md5}${ext}`
  return url.format(parsedUrl)
}

function warn () {
  console.error(chalk.yellow('brandable_css warning', ...arguments))
}

export default async function compileBundle ({bundleName, variant, brandId}) {
  const sassFile = path.join(PATHS.sass_dir, bundleName)
  let includePaths = [PATHS.sass_dir, path.join(PATHS.sass_dir, 'variants', variant)]
  // pull in 'config/brand_variables.scss' if we should
  if (brandId) {
    if (!BRANDABLE_VARIANTS.has(variant)) throw new Error(`${variant} is not brandable`)
    const fileExists = await existsAsync(path.join(folderForBrandId(brandId), '_brand_variables.scss'))
    if (!fileExists) throw new Error(`_brand_variables.scss file not found for ${brandId}`)
    includePaths.unshift(folderForBrandId(brandId))
  }

  let urlsFoundInCss = new Set()
  function putMD5sInUrls (originalUrl) {
    const parsedUrl = url.parse(originalUrl)
    if (!parsedUrl.pathname || parsedUrl.protocol === 'data:') {
      return originalUrl
    }
    if (parsedUrl.host || parsedUrl.href.indexOf('//') === 0 || !parsedUrl.path) {
      warn(bundleName, variant, 'has an external url() to:', originalUrl, 'that\'s not a problem but normally our css only links to files in our repo')
      return originalUrl
    }
    const pathToFile = path.join(PATHS.public_dir, parsedUrl.pathname)
    const relativePath = relativeSassPath(pathToFile)
    let md5 = cache.file_checksums.data[relativePath]
    if (!md5) {
      md5 = fileChecksumSync(pathToFile)
      if (!md5) {
        warn(bundleName, variant, 'contains a url() to:', originalUrl, 'which doesn\'t exist on disk')
        return originalUrl
      }
      cache.file_checksums.update(relativePath, md5)
    }
    urlsFoundInCss.add(pathToFile)
    return revedUrl(originalUrl, md5)
  }

  const startTime = new Date()
  const nodeSassResult = await sassRender({
    file: sassFile,
    includePaths: includePaths,
    outputStyle: SASS_STYLE,
    sourceComments: SASS_STYLE !== 'compressed',
    sourceMap: false
  })

  const postcssResult = await postcss([
    autoprefixer({browsers: supportedBrowsers}),
    postcssUrl({url: putMD5sInUrls})
  ]).process(nodeSassResult.css, {from: sassFile})

  postcssResult.warnings().forEach(warn)
  console.warn(chalk.green('compiled', bundleName, variant, brandId || '', 'in'), new Date() - startTime, 'ms')

  return {
    css: postcssResult.css,
    includedFiles: nodeSassResult.stats.includedFiles.concat([...urlsFoundInCss])
  }
}
