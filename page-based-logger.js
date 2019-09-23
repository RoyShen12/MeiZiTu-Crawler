const chalk = require('chalk').default
const { list } = require('std_library')
const _ = require('lodash')

function timeBasedLogHead() {
  const DateObj = new Date()
  // const year = DateObj.getFullYear()
  // const month = ((DateObj.getMonth() + 1) + '').padStart(2, '0')
  // const day = (DateObj.getDate() + '').padStart(2, '0')
  const hour = (DateObj.getHours() + '').padStart(2, '0')
  const minute = (DateObj.getMinutes() + '').padStart(2, '0')
  const second = (DateObj.getSeconds() + '').padStart(2, '0')
  const msecond = (DateObj.getMilliseconds() + '').padStart(3, '0')
  // return `${year}-${month}-${day} ${hour}:${minute}:${second}.${msecond}`
  return chalk.grey(`${hour}:${minute}:${second}.${msecond}`)
}

let MAX_WIDTH = process.stdout.columns - 2

/**
 * @param {string} line
 */
function cutLongLine(line) {
  if (line.length > MAX_WIDTH) {
    line = _.chunk(line, MAX_WIDTH).map(a => a.join('')).join('\n')
  }
  return line
}

// function hard_sleep(n) {
//   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n)
// }

class FixedSizeArray extends list {
  constructor(maxSize) {
    super()

    /** @type {number} */
    this.__max_capacity = maxSize
  }

  /**
   * @param {number} newSize
   */
  resize(newSize) {
    if (newSize < this.__max_capacity) {
      while(newSize > this.size()) {
        this.popFront()
      }
    }

    this.__max_capacity = newSize
  }

  /**
   * @param {any} item
   */
  push(item) {
    if (super.size() >= this.__max_capacity) {
      super.popFront()
    }

    super.pushBack(item)
  }

  get lackLineCount() {
    // console.log(this.__max_capacity, super.size())
    return this.__max_capacity - super.size()
  }
}

class PageBasedLogger {
  constructor(logLineCount, errorLineCount) {
    logLineCount = logLineCount || Math.round(process.stdout.rows * .6)
    errorLineCount = errorLineCount || (process.stdout.rows - logLineCount)

    this.logLines = new FixedSizeArray(logLineCount)
    this.errorLines = new FixedSizeArray(errorLineCount)

    process.stdout.on('resize', () => {
      const log = Math.round(process.stdout.rows * .6)
      this.logLines.resize(log)
      const err = process.stdout.rows - log
      this.errorLines.resize(err)

      MAX_WIDTH = process.stdout.columns - 2
    })

    this.frameRate = 10

    this.pauseSignal = false
  }

  /**
   * @param {string} line
   */
  push(line) {
    line = timeBasedLogHead() + ' ' + line
    const incommingLines = cutLongLine(line).split('\n')
    incommingLines.forEach(line => this.logLines.push(line))
  }

  /**
   * @param {Error} err
   */
  pushError(err) {
    err = timeBasedLogHead() + ' ' + err.toString()
    const incommingLines = cutLongLine(err).split('\n')
    incommingLines.forEach(line => this.errorLines.push(line))
  }

  clearFrame() {
    process.stdout.write('\u001b[2J')
    process.stdout.write('\u001b[3J')
    // process.stdout.write('\u001b[2J')
    // console.log('\u001bc\\e[3J')
    // process.stdout.write('\x1b[2J')
    // process.stdout.write('\x1b[0f')
    // console.clear()
  }

  freshFrame() {
    this.clearFrame()

    // new Array(this.logLines.lackLineCount).fill(1).forEach(() => console.log(''))
    this.logLines.forEach(line => console.log(line))
    new Array(this.logLines.lackLineCount).fill(1).forEach(() => console.log(''))

    this.errorLines.forEach(line => console.log(line))
    new Array(this.errorLines.lackLineCount).fill(1).forEach(() => console.log(''))
  }

  run() {
    const loop = () => {
      if (!this.pauseSignal) this.freshFrame()

      setTimeout(loop, Math.round(1000 / this.frameRate))
    }

    loop()
  }
}

module.exports = PageBasedLogger

// test

// function randomStr (bits) {
//   let ret = ''
//   for (let index = 0; index < bits; index++) {
//     ret += ((Math.random() * 16 | 0) & 0xf).toString(16)
//   }
//   return ret
// }


// const t = new PageBasedLogger()

// t.run()

// let i = 0, j = 0

// const flush = () => {

//   t.push(randomStr(30) + ' - ' + i++)

//   setTimeout(flush, 100)
// }

// flush()

// const flush2 = () => {

//   t.pushError(chalk.redBright(randomStr(60) + ' - ' + j++))

//   setTimeout(flush2, 400)
// }

// flush2()

