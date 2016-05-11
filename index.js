var util = require('util')
var goertzel = require('goertzel')
var Readable = require('readable-stream')

util.inherits(Decoder, Readable)

function Decoder (opts) {
  // TODO: instanceof
  // TODO: opts checks

  Readable.call(this)

  // TODO: will this get me in trouble once I'm doing fully async?
  this._read = function (n) {
  }

  var hasSpace = goertzel({
    targetFrequency: opts.space,
    sampleRate: opts.sampleRate,
    samplesPerFrame: opts.samplesPerFrame
  })

  var hasMark = goertzel({
    targetFrequency: opts.mark,
    sampleRate: opts.sampleRate,
    samplesPerFrame: opts.samplesPerFrame
  })

  var state = 'preamble:space'
  var clock = 0
  var totalTime = 0
  var marksSeen = 0
  var spacesSeen = 0

  this.done = function () {
    this.decideOnSymbol()
  }

  this.handleFrame = function (frame) {
    var s = hasSpace(frame)
    var m = hasMark(frame)

    var bit
    if (s && !m) bit = 0
    else if (!s && m) bit = 1
    else throw new Error('no match: space', s, ' mark', m)

    console.error('bit', bit, '  clock', clock)

    if (state === 'preamble:space') {
      if (bit === 1) {
        console.error('preamble:space done @', totalTime)
        console.error('starting mark clock')
        clock = 0
        state = 'preamble:mark'
      }
    }

    else if (state === 'preamble:mark') {
      if (bit !== 1) {
        throw new Error('got non-mark while in preamble:mark')
      }
      if (clock >= 1) {
        console.error('preamble:mark done @', totalTime)
        console.error('starting decode')
        clock = 0
        state = 'decode'
        return
      }
    }

    else if (state === 'decode') {
      if (bit === 0) spacesSeen++
      else marksSeen++

      if (clock >= 1) {
        this.decideOnSymbol()
      }
    }

    clock += opts.samplesPerFrame / opts.sampleRate
    totalTime += opts.samplesPerFrame / opts.sampleRate
  }

  this.decideOnSymbol = function () {
    // console.error('saw ', spacesSeen, 'spaces and', marksSeen, 'marks')
    if (marksSeen > spacesSeen) {
      console.log('SYMBOL: 1')
      console.error('error ---------> ', spacesSeen)
      this.push(new Buffer('1'))
    } else {
      console.log('SYMBOL: 0')
      console.error('error ---------> ', marksSeen)
      this.push(new Buffer('0'))
    }
    spacesSeen = marksSeen = 0
    clock = opts.samplesPerFrame / opts.sampleRate
  }
}

module.exports = Decoder