/**
 * SpiderWeb Health - ZepOS Watch Face for Amazfit GTR 4
 * API Level 2.0 — uses @zos/ui and @zos/sensor imports
 *
 * Radar chart with 6 health metrics: HR, Steps, Calories, Distance, Stress, SpO2
 * Screen: 466 x 466 px (AMOLED)
 */
import ui from '@zos/ui'
import { Time, HeartRate, Step, Calorie, Distance, Stress, BloodOxygen, Battery } from '@zos/sensor'


// ─── Constants ────────────────────────────────────────────────────────────────

var W = 390   // screen width
var H = 450   // screen height

// Radar chart geometry
var CX = 183   // center X (shifted right to keep left icons on-screen)
var CY = 235   // center Y (moved down to keep top icon clear of header bars)
var R = 115    // max radar radius (bigger chart)
var RINGS = 5     // concentric rings

// Color palette
var COLOR_BG = 0x070707
var COLOR_GRID_OUTER = 0x39FF14  // Bright neon green outer ring
var COLOR_GRID_INNER = 0x1A5C0A  // Dark forest green inner rings
var COLOR_AXIS = 0x2D7A1A        // Medium green axes
var COLOR_FILL = 0x0D3B0A        // Very dark green data fill
var COLOR_FILL2 = 0x2ED573       // Bright emerald green for inner fill
var COLOR_STROKE = 0x5AFB67      // Bright green data polygon stroke
var COLOR_ACCENT = 0x5AFB67      // Accent green
var COLOR_TIME = 0x5AFB67
var COLOR_DATE = 0x5AFB67
var COLOR_VALUE = 0x5AFB67
var COLOR_BATT_OK = 0x39FF14 // Neon Green
var COLOR_BATT_WARN = 0xFFA502
var COLOR_BATT_LOW = 0xFF4757

// Metric definitions: [label, max, axisColor]
// Axis 0=Top(HR) 1=Top-Right(Steps) 2=Bot-Right(Cal)
// Axis 3=Bot(Dist) 4=Bot-Left(Stress) 5=Top-Left(SpO2)
var METRICS = [
    { label: 'HEART', max: 200, color: 0xFF4757, icon: 'heart.png' },
    { label: 'STEPS', max: 10000, color: 0xFFA502, icon: 'steps.png' },
    { label: 'CAL', max: 1000, color: 0xFF6348, icon: 'cal.png' },
    { label: 'DIST', max: 8, color: 0x2ED573, icon: 'dist.png' },  // km
    { label: 'STRESS', max: 100, color: 0xECCC68, icon: 'stress.png' },
    { label: 'SPO2', max: 100, color: 0x5352ED, icon: 'spo2.png' },
]

var N = METRICS.length

// ─── Math helpers ─────────────────────────────────────────────────────────────

function axisAngle(i) {
    return (-Math.PI / 2) + (i / N) * 2 * Math.PI
}

function polarX(r, angle) {
    return Math.round(CX + r * Math.cos(angle))
}

function polarY(r, angle) {
    return Math.round(CY + r * Math.sin(angle))
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v
}

function centerOffsetX(text, charWidth) {
    return Math.round((text.length * charWidth) / 2)
}

// ─── Watch Face ───────────────────────────────────────────────────────────────

WatchFace({

    onInit: function () {
        this.values = [0, 0, 0, 0, 0, 0]   // hr, steps, cal, dist_km, stress, spo2
        this.batt = 100
        this.hour = 0
        this.minute = 0
        this.day = 1
        this.month = 1
        this.weekDay = 0

        this._createBackground()
        this._createCanvas()
        this._createTextWidgets() // TEXT widgets above canvas, below icons
        this._createIcons()
        this._initSensors()
        this._draw()
        this._startAnimation()
    },

    // ── Background Image ──────────────────────────────────────────────────────────

    _createBackground: function () {
        ui.createWidget(ui.widget.IMG, {
            src: 'background.png',
            x: 0,
            y: 0
        })
    },

    // ── Animation (cycled IMG widget on top of canvas) ────────────────────────────────

    _startAnimation: function () {
        var self = this
        var frame = 0
        var totalFrames = 18

        // Create IMG widget LAST so it is on top of the canvas in Z-order
        // Frames: 75x107, right-side empty space (x=300, mid-height y=195)
        this.animImg = ui.createWidget(ui.widget.IMG, {
            src: 'walking_guy/walking_0.png',
            x: 300,
            y: 200
        })

        // Cycle frames at ~12 fps (every 83ms) via setInterval
        this.animTimer = setInterval(function () {
            frame = (frame + 1) % totalFrames
            if (self.animImg) {
                self.animImg.setProperty(ui.prop.SRC, 'walking_guy/walking_' + frame + '.png')
            }
        }, 83)
    },

    // ── Canvas ───────────────────────────────────────────────────────────────────

    _createCanvas: function () {
        this.cv = ui.createWidget(ui.widget.CANVAS, {
            x: 0, y: 0, w: W, h: H
        })
    },

    // ── TEXT widgets for all dynamic labels ─────────────────────────────────

    _createTextWidgets: function () {
        var ICON_R = R + 20, ICON_HALF = 21
        this.labelWidgets = []
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)
            var ix = polarX(ICON_R, angle)
            var iy = polarY(ICON_R, angle)
            var x, y
            if (i === 0 || i === 3) {
                x = ix + ICON_HALF + 4; y = iy - 28
            } else {
                var xOff = (i === 4 || i === 5) ? -15 : 0
                x = ix - 20 + xOff; y = iy + ICON_HALF - 13
            }

            // Push the counter down by 7 pixels
            y += 7

            this.labelWidgets.push(ui.createWidget(ui.widget.TEXT, {
                x: x, y: y, w: 70, h: 22,
                text: '0', text_size: 16, color: COLOR_VALUE
            }))
        }

        // Time widget (left half of bottom bar) - pushed down from 368 to 375
        this.timeWidget = ui.createWidget(ui.widget.TEXT, {
            x: Math.floor(W / 4 - 35), y: 375, w: 90, h: 35,
            text: '00:00', text_size: 22, color: 0x5AFB67
        })

        // Date widget (right half of bottom bar) - pushed down from 368 to 375
        this.dateWidget = ui.createWidget(ui.widget.TEXT, {
            x: Math.floor(3 * W / 4 - 60) - 20, y: 375, w: 140, h: 35,
            text: '01.01.2026', text_size: 22, color: 0x5AFB67
        })

        // Battery % widget - pushed down from 408 to 415
        this.battWidget = ui.createWidget(ui.widget.TEXT, {
            x: 22, y: 415, w: 60, h: 25,
            text: '100%', text_size: 20, color: 0x5AFB67
        })
    },

    // ── Static Icons ─────────────────────────────────────────

    _createIcons: function () {
        var ICON_R = R + 20
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)
            var lx = polarX(ICON_R, angle)
            var ly = polarY(ICON_R, angle)
            ui.createWidget(ui.widget.IMG, {
                x: lx - 21,
                y: ly - 21,
                src: METRICS[i].icon
            })
        }
    },

    // ── Sensors ──────────────────────────────────────────────────────────────────

    _initSensors: function () {
        var self = this

        // ── Time (primary redraw trigger) ──
        try {
            var timeSensor = new Time()
            self._updateTime(timeSensor)
            timeSensor.onPerMinute(function () {
                self._updateTime(timeSensor)
                self._draw()
            })
        } catch (e) { }

        // ── Heart Rate ──
        try {
            var hrSensor = new HeartRate()
            self.values[0] = hrSensor.getLast() || 0
            hrSensor.onLastChange(function () {
                self.values[0] = hrSensor.getLast() || 0
                self._draw()
            })
        } catch (e) { }

        // ── Steps ──
        try {
            var stepSensor = new Step()
            self.values[1] = stepSensor.getCurrent() || 0
            stepSensor.onChange(function () {
                self.values[1] = stepSensor.getCurrent() || 0
                self._draw()
            })
        } catch (e) { }

        // ── Calories ──
        try {
            var calSensor = new Calorie()
            self.values[2] = calSensor.getCurrent() || 0
            calSensor.onChange(function () {
                self.values[2] = calSensor.getCurrent() || 0
                self._draw()
            })
        } catch (e) { }

        // ── Distance (meters → km) ──
        try {
            var distSensor = new Distance()
            self.values[3] = (distSensor.getCurrent() || 0) / 1000
            distSensor.onChange(function () {
                self.values[3] = (distSensor.getCurrent() || 0) / 1000
                self._draw()
            })
        } catch (e) { }

        // ── Stress ──
        try {
            var stressSensor = new Stress()
            self.values[4] = stressSensor.getCurrent() || 0
            stressSensor.onChange(function () {
                self.values[4] = stressSensor.getCurrent() || 0
                self._draw()
            })
        } catch (e) { }

        // ── SpO2 ──
        try {
            var spo2Sensor = new BloodOxygen()
            self.values[5] = (spo2Sensor.getCurrent() && spo2Sensor.getCurrent().value) || 0
            spo2Sensor.onChange(function () {
                self.values[5] = (spo2Sensor.getCurrent() && spo2Sensor.getCurrent().value) || 0
                self._draw()
            })
        } catch (e) { }

        // ── Battery ──
        try {
            var battSensor = new Battery()
            self.batt = battSensor.getCurrent() || 100
            battSensor.onChange(function () {
                self.batt = battSensor.getCurrent() || 100
                self._draw()
            })
        } catch (e) { }
    },

    _updateTime: function (t) {
        this.hour = t.getHours() || 0
        this.minute = t.getMinutes() || 0
        this.day = t.getDate() || 1
        this.month = t.getMonth() || 1
        this.year = t.getFullYear() || 2026
        this.weekDay = (t.getDay() % 7) || 0
    },

    // ── Drawing ──────────────────────────────────────────────────────────────────

    _draw: function () {
        var cv = this.cv
        if (!cv) return
        this._drawBackground(cv)
        this._drawGrid(cv)
        this._drawAxes(cv)
        this._drawDataPolygon(cv)
        this._drawBattery(cv)
        this._updateTextWidgets()
    },

    _updateTextWidgets: function () {
        // Metric value labels
        for (var i = 0; i < N; i++) {
            if (this.labelWidgets && this.labelWidgets[i]) {
                this.labelWidgets[i].setProperty(ui.prop.MORE, { text: this._formatValue(i) })
            }
        }
        // Time
        var hStr = this.hour < 10 ? '0' + this.hour : String(this.hour)
        var mStr = this.minute < 10 ? '0' + this.minute : String(this.minute)
        if (this.timeWidget) this.timeWidget.setProperty(ui.prop.MORE, { text: hStr + ':' + mStr })
        // Date
        var dStr = this.day < 10 ? '0' + this.day : String(this.day)
        var moStr = this.month < 10 ? '0' + this.month : String(this.month)
        if (this.dateWidget) this.dateWidget.setProperty(ui.prop.MORE, { text: dStr + '.' + moStr + '.' + this.year })
        // Battery %
        if (this.battWidget) this.battWidget.setProperty(ui.prop.MORE, { text: this.batt + '%' })
    },

    _drawBackground: function (cv) {
        // Clear chart interior to prevent ghost fills
        var bgPts = []
        for (var bg = 0; bg < N; bg++) {
            bgPts.push({ x: polarX(R, axisAngle(bg)), y: polarY(R, axisAngle(bg)) })
        }
        cv.drawPoly({ data_array: bgPts, color: 0x000000, drawFill: true })
    },

    _drawGrid: function (cv) {
        for (var ring = 1; ring <= RINGS; ring++) {
            var r = Math.round((ring / RINGS) * R)
            var pts = []
            for (var i = 0; i < N; i++) {
                var a = axisAngle(i)
                pts.push({ x: polarX(r, a), y: polarY(r, a) })
            }
            pts.push({ x: pts[0].x, y: pts[0].y })
            var col = ring === RINGS ? COLOR_GRID_OUTER : COLOR_GRID_INNER
            cv.setPaint({ color: col, line_width: ring === RINGS ? 2 : 1 })
            cv.strokePoly({ data_array: pts, color: col })
        }
    },

    _drawAxes: function (cv) {
        cv.setPaint({ color: COLOR_AXIS, line_width: 1 })
        for (var i = 0; i < N; i++) {
            var a = axisAngle(i)
            cv.drawLine({ x1: CX, y1: CY, x2: polarX(R, a), y2: polarY(R, a) })
        }
        cv.setPaint({ color: COLOR_ACCENT })
        cv.drawCircle({ x: CX, y: CY, radius: 4 })
        cv.setPaint({ color: 0x5AFB67 })
        cv.drawCircle({ x: CX, y: CY, radius: 2 })
    },

    _drawDataPolygon: function (cv) {
        var pts = []
        for (var i = 0; i < N; i++) {
            var norm = clamp01(this.values[i] / METRICS[i].max)
            var r = norm > 0.02 ? Math.round(norm * R) : 6
            var a = axisAngle(i)
            pts.push({ x: polarX(r, a), y: polarY(r, a) })
        }

        var closedPts = pts.concat([{ x: pts[0].x, y: pts[0].y }])
        // Fill
        cv.setPaint({ color: COLOR_FILL })
        cv.drawPoly({ data_array: pts, color: COLOR_FILL, drawFill: true })
        // Glow stroke
        cv.setPaint({ color: COLOR_FILL2, line_width: 3 })
        cv.strokePoly({ data_array: closedPts, color: COLOR_FILL2 })
        // Neon cyan main stroke
        cv.setPaint({ color: COLOR_STROKE, line_width: 2 })
        cv.strokePoly({ data_array: closedPts, color: COLOR_STROKE })
        // Vertex dots
        for (var j = 0; j < N; j++) {
            cv.setPaint({ color: METRICS[j].color })
            cv.drawCircle({ x: pts[j].x, y: pts[j].y, radius: 5, color: METRICS[j].color })
            cv.setPaint({ color: 0x5AFB67 })
            cv.drawCircle({ x: pts[j].x, y: pts[j].y, radius: 2, color: 0x5AFB67 })
        }
    },

    _formatValue: function (i) {
        var v = this.values[i]
        if (v === undefined || v === null || isNaN(v)) v = 0
        if (i === 3) return (Number(v)).toFixed(1) + 'km'
        if (i === 5) return Math.round(Number(v)) + '%'
        return String(Math.round(Number(v)))
    },

    _drawBattery: function (cv) {
        var b = this.batt
        // Bar only — % text handled by battWidget TEXT widget
        // Shorter bar: starts at x=80, ends at x=W-50=340
        var pad = 3
        var barX = 90, barW = W - 130, barY = 425, barH = 14
        var outerX = barX - pad, outerY = barY - pad
        var outerW = barW + pad * 2, outerH = barH + pad * 2
        var fillW = Math.round((b / 100) * barW)

        // Outer bright green border
        cv.setPaint({ color: 0x39FF14, line_width: 2 })
        cv.strokePoly({
            data_array: [
                { x: outerX, y: outerY },
                { x: outerX + outerW, y: outerY },
                { x: outerX + outerW, y: outerY + outerH },
                { x: outerX, y: outerY + outerH },
                { x: outerX, y: outerY }
            ],
            color: 0x39FF14
        })

        // Inner background (empty area) — #45711C
        cv.setPaint({ color: 0x45711C })
        cv.drawPoly({ data_array: [{ x: barX, y: barY }, { x: barX + barW, y: barY }, { x: barX + barW, y: barY + barH }, { x: barX, y: barY + barH }], color: 0x45711C, drawFill: true })

        // Neon green fill proportional to battery %
        if (fillW > 0) {
            cv.setPaint({ color: 0x39FF14 })
            cv.drawPoly({ data_array: [{ x: barX, y: barY }, { x: barX + fillW, y: barY }, { x: barX + fillW, y: barY + barH }, { x: barX, y: barY + barH }], color: 0x39FF14, drawFill: true })
        }
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────────

    onResume: function () {
        this._draw()
    },

    onDestroy: function () {
        if (this.animTimer) { clearInterval(this.animTimer) }
    }
})