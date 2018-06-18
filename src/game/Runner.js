import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants'
import { getFPS } from './RuntimeConfig'
import { getImageSprite, setImageSprite, loadImageSprite } from './ImageSprite'
import Horizon from './Horizon'
import DistanceMeter from './DistanceMeter'
import TrexGroup from './TrexGroup';
import { getTimeStamp } from './utils'


export default class Runner {
  static generation = 0

  static config = {
    ACCELERATION: 0.001,
    BG_CLOUD_SPEED: 0.2,
    CLEAR_TIME: 0,
    CLOUD_FREQUENCY: 0.5,
    GAP_COEFFICIENT: 0.6,
    GRAVITY: 0.6,
    INITIAL_JUMP_VELOCITY: 12,
    MAX_CLOUDS: 6,
    MAX_OBSTACLE_LENGTH: 3,
    MAX_SPEED: 13,
    MIN_JUMP_HEIGHT: 35,
    SPEED: 6,
    SPEED_DROP_COEFFICIENT: 3,
    T_REX_COUNT: 1,
    // Events
    onReset: noop,
    onRunning: noop,
    onCrash: noop
  }

  static classes = {
    CANVAS: 'game-canvas',
    CONTAINER: 'game-container'
  }

  static spriteDefinition = {
    CACTUS_LARGE: { x: 332, y: 2 },
    CACTUS_SMALL: { x: 228, y: 2 },
    CLOUD: { x: 86, y: 2 },
    HORIZON: { x: 2, y: 54 },
    PTERODACTYL: { x: 134, y: 2 },
    RESTART: { x: 2, y: 2 },
    TEXT_SPRITE: { x: 655, y: 2 },
    TREX: { x: 848, y: 2 }
  }

  static keycodes = {
    JUMP: { 38: 1, 32: 1 }, // Up, spacebar
    DUCK: { 40: 1 } // Down
  }

  static events = {
    ANIM_END: 'webkitAnimationEnd',
    CLICK: 'click',
    KEYDOWN: 'keydown',
    KEYUP: 'keyup',
    RESIZE: 'resize',
    VISIBILITY: 'visibilitychange',
    BLUR: 'blur',
    FOCUS: 'focus',
    LOAD: 'load'
  }

  constructor(outerContainerId, options) {
    // 单例模式
    if (Runner.instance_) {
      return Runner.instance_
    }

    Runner.instance_ = this

    this.isFirstTime = false
    this.outerContainerEl = document.querySelector(outerContainerId)
    this.generationEl = document.querySelector('./generation')
    this.containerEl = null

    this.config = Object.assign({}, Runner.config, options)

    this.dimensions = {
      WIDTH: CANVAS_WIDTH,
      HEIGHT: CANVAS_HEIGHT
    }

    this.canvas = null
    this.canvasCtx = null

    this.tRex = null

    this.distanceMeter = null
    this.distanceRan = 0

    this.highestScore = 0

    this.time = 0
    this.runningTime = 0
    this.msPerFrame = 1000 / getFPS()
    this.currentSpeed = this.config.SPEED

    this.obstacles = []

    this.activated = false // Whether the easter egg has been activated.
    this.playing = false // Whether the game is currently in play state.
    this.crashed = false
    this.resizeTimerId_ = null

    this.playCount = 0

    // Images.
    this.images = {}
    this.imagesLoaded = 0
  }

  async init() {
    // load background img
    await loadImageSprite()
    // img position
    this.spriteDef = Runner.spriteDefinition

    this.adjustDimensions()
    this.setSpeed()

    this.containerEl = document.createElement('div')
    this.containerEl.className = Runner.classes.CONTAINER
    this.containerEl.style.width = `${this.dimensions.WIDTH}px`

    // Player canvas container
    this.canvas = createCanvas(
      this.containerEl,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT,
      Runner.classes.PLAYER
    )

    this.canvasCtx = this.canvas.getContext('2d')
    this.canvasCtx.fillStyle = '#f7f7f7'
    this.canvasCtx.fill()
    Runner.updateCanvasScaling(this.canvas)

    // Horizon contains clouds, obstacles and the ground.
    this.horizon = new Horizon(
      this.canvas,
      this.spriteDef,
      this.dimensions,
      this.config.GAP_COEFFICIENT
    )

    // Distance meter
    this.distanceMeter = new DistanceMeter(
      this.canvas,
      this.spriteDef.TEXT_SPRITE,
      this.dimensions.WIDTH
    )

    // Draw t-rex
    this.tRexGroup = new TrexGroup(this.config.T_REX_COUNT, this.canvas, this.spriteDef.TREX)
    this.tRexGroup.onRunning = this.config.onRunning
    this.tRexGroup.onCrash = this.config.onCrash
    this.tRex = this.tRexGroup.tRexes[0]

    this.outerContainerEl.appendChild(this.containerEl)

    this.startListening()
    this.update()

    window.addEventListener(
      Runner.events.RESIZE,
      this.debounceResize.bind(this)
    )

    this.restart()

  }

  // adjust game space dimensions on resize
  adjustDimensions() {
    clearInterval(this.resizeTimerId_)
    this.resizeTimerId_ = null
    
    const boxStyles = window.getComputedStyle(this.outerContainerEl)
    // 获得纯数字
    const padding = Number(boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2))

    this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2

    // redraw the canvas
    if (this.canvas) {
      this.canvas.width = this.dimensions.WIDTH
      // FIX: not to redraw the height of the canvas

      Runner.updateCanvasScaling(this.canvas)

      this.distanceMeter.calcXPos(this.dimensions.WIDTH)
      this.clearCanvas()
      this.horizon.update(0, 0, true)
      this.tRexGroup.update(0)

      // outer container and distance meter
      if (this.playing || this.crashed) {
        this.containerEl.style.width = `${this.dimensions.WIDTH}px`
        this.containerEl.style.height = `${this.dimensions.HEIGHT}px`
        this.distanceMeter.update(0, Math.ceil(this.distanceRan))
        this.stop()
      } else {
        this.tRexGroup.draw(0, 0)
      }
    }
  }

  static updateCanvasScaling(canvas, width, height) {
    const context = canvas.getContext('2d')

    // query the various pixel ratios
    const devicePixelRatio = Math.floor(window.devicePixelRatio) || 1
    // 适配retina屏幕
    const backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1
    const ratio = devicePixelRatio / backingStoreRatio

    // Upscale the canvas if the two ratios don't match
    if (devicePixelRatio !== backingStoreRatio) {
      const oldWidth = width || canvas.width
      const oldHeight = height || canvas.height

      canvas.width = oldWidth * ratio
      canvas.height = oldHeight * ratio

      canvas.style.width = `${oldWidth}px`
      canvas.style.height = `${oldHeight}px`

      // Scale the context to counter the fact that we've manually scaled
      // our canvas element.
      context.scale(ratio, ratio)
      return true
    } else if (devicePixelRatio === 1) {
      // Reset the canvas width / height. Fixes scaling bug when the page is
      // zoomed and the devicePixelRatio changes accordingly.
      canvas.style.width = `${canvas.width}px`
      canvas.style.height = `${canvas.height}px`
    }
    return false
  }

  setSpeed(speed) {
    this.currentSpeed = speed || this.currentSpeed
  }

  /**
   * Debounce the resize event.
   */
  debounceResize() {
    if (!this.resizeTimerId_) {
      this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250);
    }
  }

  restart() {
    if (!this.raqId) {
      this.playCount += 1;
      this.runningTime = 0;
      this.playing = true;
      this.crashed = false;
      this.distanceRan = 0;
      this.setSpeed(this.config.SPEED);
      this.time = getTimeStamp();
      this.clearCanvas();
      this.distanceMeter.reset(this.highestScore);
      this.horizon.reset();
      this.tRexGroup.reset();
      this.config.onReset({ tRexes: this.tRexGroup.tRexes });
      this.update();
    } else {
      this.isFirstTime = true;
      this.tRexGroup.reset();
      this.config.onReset({ tRexes: this.tRexGroup.tRexes });
      if (!this.playing) {
        this.playing = true;
        this.update();
      }
    }
    Runner.generation += 1;
  }

  update() {
    this.updatePending = false

    const now = getTimeStamp();
    let deltaTime = now - (this.time || now);
    this.time = now;

    // TODO: go on 
  }
}

function createCanvas(container, width, height, className) {
  const canvas = document.createElement('canvas')
  canvas.className = className
    ? `${Runner.classes.CANVAS} ${className}`
    : Runner.classes.CANVAS
  canvas.width = width
  canvas.height = height
  container.appendChild(canvas)

  return canvas
}

function noop() {}
