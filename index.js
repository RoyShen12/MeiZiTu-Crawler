const meow = require('meow')

const cli = meow(`
    Options
      --start, -s <number>
      --end, -e <number>
      --connections, -c <number> default is 12
      --proxy
      --simplelog
`, {
    flags: {
      start: {
        type: 'string',
        alias: 's'
      },
      end: {
        type: 'string',
        alias: 'e'
      },
      connections: {
        type: 'string',
        alias: 'c'
      },
      proxy: {
        type: 'boolean'
      },
      simplelog: {
        type: 'boolean'
      }
    }
})

const { s, e } = cli.flags

const _s = +s, _e = +e

const connections = cli.flags.c ? +(cli.flags.c) : 12

if (isNaN(_s) || isNaN(_e) || _s < 1 || _e < 1 || _s > _e) {
  console.error('bad args, use --help to get more information.')
  process.exit(-1)
}

process.title = `mzitu crawler (${_s}-${_e}) c${connections}`

const fs = require('fs')
const path = require('path')
// const { inspect } = require('util')

// insptect fx
// const splitLine = () => logger.push(chalk.cyanBright('- - - - - - - - - - - - - - - - - - - -'))
const toReadableSize = bytes => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const fsp = fs.promises

const Crawler = require('crawler')
// const Cheerio = require('cheerio')
// const readChunk = require('read-chunk')
const fileType = require('file-type')
// const origin = require('original')
const _ = require('lodash')
const chalk = require('chalk').default

const PageBasedLogger = require('./page-based-logger')

const logger = cli.flags.simplelog ? { push: console.log, pushError: console.error, run: new Function() } : new PageBasedLogger()
logger.run()

// logger.push(`process will crawl from page [ ${_s} ] to [ ${_e} ]`)

const originPoint = 'https://www.mzitu.com'
const range = /*_.range(1, 233, 1)*/_.range(_s, _e + 1, 1)
const startPoints = range.map(c => `${originPoint}/page/${c}`)
const picDir = './pic/'

const picPageUrlName = new Map()
const retryRecorder = new Map()
const updateRetry = k => retryRecorder.has(k) ? retryRecorder.set(k, retryRecorder.get(k) + 1) : retryRecorder.set(k, 1)

fs.existsSync(picDir) || fs.mkdirSync(picDir)

const recordFileDir = './.rec/'
fs.existsSync(recordFileDir) || fs.mkdirSync(recordFileDir)

/**
 * @param {string} uri
 * @param {number} level 1 - page/xx, 2 - pic page (p1), 3 - pic page (p2 - pn), 4 - pic file url
 */
async function recordToFile(uri, level) {
  await fsp.writeFile(path.resolve(recordFileDir, `${level}.txt`), uri + '\n', { flag: 'a', encoding: 'utf-8' })
}

/**
 * @param {string} uri
 */
function seen(uri) {
  const f = path.resolve(recordFileDir, '4.txt')

  if (!fs.existsSync(f)) return false

  return fs.readFileSync(f).toString().split('\n').some(u => u === uri)
}

const crawlerOptions = {
  maxConnections: connections,
  retries: 2,
  retryTimeout: 2500,
  rotateUA: true,
  userAgent: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0',
  ],
  referer: 'https://www.mzitu.com',
  header: {
    'X-Requested-With': 'XMLHttpRequest',
    DNT: '1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8,en;q=0.7,ja;q=0.6',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Host: 'mzitu.com',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1'
  }
}

if (cli.flags.proxy) {
  crawlerOptions.proxy = 'http://localhost:8118'
}

const picCrawler = new Crawler({
  encoding: null,
  jQuery: false,
  // rateLimit: 100,
  callback(err, res, done) {
    if (err) {
      logger.pushError(`File error on "${res.request ? res.request.href : ' - '}"\n${chalk.redBright(err)}`)
      done()
    }
    else {
      if (!Buffer.isBuffer(res.body)) {
        logger.pushError(chalk.yellowBright(`File from ${res.request.href} is not a Buffer`))
        done()
        return
      }

      const fn = path.resolve(picDir, res.options.fd, res.options.fn)

      // if (fs.existsSync(fn)) {
      //   logger.pushError(chalk.yellowBright(`File already exists ${res.options.fd} - ${res.options.fn}`))
      //   done()
      //   return
      // }

      const ftype = fileType(res.body)
      const isImage = ftype.mime.includes('image')
      fs.existsSync(path.resolve(picDir, res.options.fd)) || fs.mkdirSync(path.resolve(picDir, res.options.fd))

      if (!isImage) {
        logger.pushError(chalk.redBright(`File res.body from ${res.request.href} is not a Image File but ${ftype.ext} - ${ftype.mime}`))

        if ((retryRecorder.get(res.request.href) || 0) < 3) {
          logger.pushError(chalk.magentaBright('File retry time < 3, push to bottom and retry'))

          picCrawler.queue({
            uri: res.request.href,
            fd: res.options.fd,
            fn: res.options.fn
          })

          updateRetry(res.request.href)
        }

        done()
      }
      else {

        fsp.writeFile(fn, res.body, {}).then(() => {
          recordToFile(res.request.href, 4)
          done()
          logger.push(chalk.greenBright(`File write to ${fn} ok, size [ ${toReadableSize(Buffer.byteLength(res.body))} ], waiting count [ ${picCrawler.queueSize} ]`))
        }).catch(e => {
          logger.pushError(`File error while WriteStream.write\n${chalk.redBright(e)}`)
          done()
        })

        // fs.createWriteStream(fn).write(res.body, e => {
        //   if (e) {
        //     logger.pushError(`File error while WriteStream.write\n${chalk.redBright(e)}`)
        //     done()
        //   }
        //   else {
            
        //   }
        // })
      }
    }
  },
  ...crawlerOptions
})

const urlCrawler = new Crawler({
  callback(error, res, done) {
      if (error) {
        logger.pushError(chalk.redBright(error))
      }
      else {
        /** @type {CheerioStatic} */
        const $ = res.$

        // console.log(`---> a page fetched ok, title: ${$('title').text().substr(0, 10)}...`)

        switch (res.options.taskLevel) {
          case 1: {
            const p404 = $('.main-content .currentpath').toArray()
            if (p404.length > 0) {
              const text = p404[0].children[0].data
              if (text.includes('404')) {
                logger.pushError(chalk.redBright(`L1 get to 404 page, current url: ${res.request.href}`))
                break
              }
            }
            const pics = $('ul#pins li a').toArray()
            if (pics.length < 1) {
              logger.pushError(chalk.redBright(`L1 cannot find any pic set from "ul#pins li a" from url: ${res.request.href}, push to bottom and retry, already retied [ ${retryRecorder.get(res.request.href) || 0} ] times`))
              urlCrawler.queue({
                uri: res.request.href,
                taskLevel: 1
              })

              updateRetry(res.request.href)
              break
            }

            pics.forEach(childA => {

              const { href } = childA.attribs

              if (href && !picPageUrlName.has(href)) {

                const imgNode = childA.children.find(chd => chd.tagName === 'img')
                const alt = imgNode ? imgNode.attribs.alt : ''
                picPageUrlName.set(href, alt)

                logger.push(`L1 task url: ${href} ---> L2 queue, task pool size: [ ${urlCrawler.queueSize} ]`)

                urlCrawler.queue({
                  uri: href,
                  taskLevel: 2
                })
              }
            })

            recordToFile(res.request.href, 1)

            // console.log(picPageUrlName)
          }
          break
          case 2: {
            logger.push(`L2 working on -- ${res.request.href} --`)
            // console.log(inspect(res.request, false, 0, true))
            if (!getPicture($)) {
              logger.pushError(chalk.magentaBright(`L2 get wrong page, push to bottom and retry, already retied [ ${retryRecorder.get(res.request.href) || 0} ] times`))
              urlCrawler.queue({
                uri: res.request.href,
                taskLevel: 2
              })

              updateRetry(res.request.href)
            }
            else {
              const navSpans = $('.pagenavi span').toArray()
              const maxPageSpan = navSpans[navSpans.length - 2]
              const maxCount = +maxPageSpan.children[0].data

              _.range(2, maxCount).forEach(page => {

                const url = `${res.request.href}/${page}`

                urlCrawler.queue({
                  uri: url,
                  taskLevel: 3
                })
              })

              logger.push(chalk.blueBright(`L2 detect page: ${res.request.href}'s maxCount: [ ${maxCount} ], pushing, task pool size: [ ${urlCrawler.queueSize} ]`))

              recordToFile(res.request.href, 2)
            }
          }
          break
          case 3: {
            if(!getPicture($)) {
              logger.pushError(chalk.magentaBright(`L3 get wrong page, push to bottom and retry, already retied [ ${retryRecorder.get(res.request.href) || 0} ] times`))
              urlCrawler.queue({
                uri: res.request.href,
                taskLevel: 3
              })

              updateRetry(res.request.href)
            }
            else {
              recordToFile(res.request.href, 3)
            }
          }
          break
          default: break
        }
      }

      done()
  },
  ...crawlerOptions
})

/**
 * @param {CheerioStatic} $
 */
function getPicture($) {
  const mainPic = $('.main-image img').toArray()[0]

  if (!mainPic) {
    // logger.pushError(inspect($, false, 2, true))
    logger.pushError(chalk.redBright('GetPicture cannot find any <img> from ".main-image img"'))
    return false
  }

  if (!mainPic.attribs.src || !mainPic.attribs.alt) {
    // logger.pushError(inspect(mainPic, false, 2, true))
    logger.pushError(chalk.redBright('GetPicture cannot find src or alt from main picture'))
    return false
  }

  // logger.push(chalk.grey(`GetPicture download url: ${mainPic.attribs.src} ---> File`))

  const src = mainPic.attribs.src

  if (!seen(src)) {
    picCrawler.queue({
      uri: src,
      fd: transferBadSymbolOnFileName(mainPic.attribs.alt),
      fn: _.last(src.split('/'))
    })
  }
  else {
    logger.pushError(chalk.cyanBright(`GetPicture reject url: ${src}, seen reported seen`))
  }

  return true
}

function transferBadSymbolOnFileName(fn) {
  return fn.replace(/[\*:"\?<>|]/g, ' ')
}

// process.on('SIGINT', sig => {
//   logger.pushError(`service terminated by user ${sig}`)
//   process.exit(0)
// })

urlCrawler.queue(startPoints.map(sp => ({
  uri: sp,
  taskLevel: 1
})))
