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
var CX = 170   // center X
var CY = 225   // center y (moved up slightly)
var R = 95   // max radar radius (px) (shrunk to fit icons)
var RINGS = 5     // concentric rings

// Color palette
var COLOR_BG = 0x070707
var COLOR_GRID_OUTER = 0x50576A
var COLOR_GRID_INNER = 0x2A2E3D
var COLOR_AXIS = 0x2A2E3D
var COLOR_FILL = 0x08A8C8 // Translucent Neon Blue (simulated on opaque target)
var COLOR_FILL2 = 0x12D4FA
var COLOR_STROKE = 0x3CF7FF // Bright stroke
var COLOR_ACCENT = 0x3CF7FF
var COLOR_TIME = 0x3CF7FF
var COLOR_DATE = 0x3CF7FF
var COLOR_VALUE = 0xFFFFFF
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

        this._createCanvas()
        this._createIcons()
        this._initSensors()
        this._draw()
    },

    // ── Canvas ───────────────────────────────────────────────────────────────────

    _createCanvas: function () {
        this.cv = ui.createWidget(ui.widget.CANVAS, {
            x: 0, y: 0, w: W, h: H
        })
    },

    // ── Static Icons ─────────────────────────────────────────────────────────────

    _createIcons: function () {
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)

            // Icons moved outside the vertices slightly
            var labelR = R + 25
            var lx = polarX(labelR, angle)
            var ly = polarY(labelR, angle)

            ui.createWidget(ui.widget.IMG, {
                x: lx - 16,
                y: ly - 16,
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
        this._drawLabels(cv)
        this._drawTime(cv)
        this._drawBattery(cv)
    },

    _drawBackground: function (cv) {
        if (cv.clear) { cv.clear({ x: 0, y: 0, w: W, h: H }) }
        cv.setPaint({ color: COLOR_BG })
        cv.drawRect({ x: 0, y: 0, w: W, h: H, color: COLOR_BG })
    },

    _drawGrid: function (cv) {
        for (var ring = 1; ring <= RINGS; ring++) {
            var r = Math.round((ring / RINGS) * R)
            var pts = []
            for (var i = 0; i < N; i++) {
                var a = axisAngle(i)
                pts.push({ x: polarX(r, a), y: polarY(r, a) })
            }
            // Explicitly close the polygon for ZeppOS 2.0
            pts.push({ x: pts[0].x, y: pts[0].y })

            cv.setPaint({ color: ring === RINGS ? COLOR_GRID_OUTER : COLOR_GRID_INNER, line_width: ring === RINGS ? 2 : 1 })
            cv.strokePoly({ data_array: pts })
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
        cv.setPaint({ color: 0xFFFFFF })
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

        // Explicitly close the stroke loop
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
            cv.setPaint({ color: 0xFFFFFF })
            cv.drawCircle({ x: pts[j].x, y: pts[j].y, radius: 2, color: 0xFFFFFF })
        }
    },

    _drawLabels: function (cv) {
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)

            // Nudge value string INWARD from the vertex
            var labelR = R - 25
            var lx = polarX(labelR, angle)
            var ly = polarY(labelR, angle)

            var valStr = this._formatValue(i)
            cv.setPaint({ color: COLOR_VALUE, font_size: 16 })
            cv.drawText({
                x: lx - centerOffsetX(valStr, 9),
                y: ly - 10,
                w: valStr.length * 15, h: 30,
                text: valStr
            })
        }
    },

    _formatValue: function (i) {
        var v = this.values[i]
        if (i === 3) return (v).toFixed(1) + 'km'
        if (i === 5) return Math.round(v) + '%'
        return String(Math.round(v))
    },

    _drawTime: function (cv) {
        var hStr = this.hour < 10 ? '0' + this.hour : String(this.hour)
        var mStr = this.minute < 10 ? '0' + this.minute : String(this.minute)

        var dStr = this.day < 10 ? '0' + this.day : String(this.day)
        var moStr = this.month < 10 ? '0' + this.month : String(this.month)
        var dateStr = dStr + '.' + moStr + '.' + this.year

        // Top Centered Date (Width 390, char string ~100px)
        cv.setPaint({ color: COLOR_DATE, font_size: 20 })
        cv.drawText({ x: 135, y: 30, w: 120, h: 40, text: dateStr })

        // Vertically Stacked Time on the Right Margin
        cv.setPaint({ color: COLOR_TIME, font_size: 78 })
        cv.drawText({ x: 300, y: 155, w: 100, h: 90, text: hStr })
        cv.drawText({ x: 300, y: 220, w: 100, h: 90, text: mStr })
    },

    _drawBattery: function (cv) {
        var b = this.batt
        var col = b < 20 ? COLOR_BATT_LOW : b < 50 ? COLOR_BATT_WARN : COLOR_BATT_OK

        // Compact Bottom Bar Layout (Moved Higher)
        var barX = 150, barY = 380, barW = 90, barH = 12
        cv.setPaint({ color: 0x1E2040 })
        cv.drawRect({ x: barX, y: barY, w: barW, h: barH, color: 0x1E2040 })
        cv.setPaint({ color: col })
        cv.drawRect({ x: barX, y: barY, w: Math.round((b / 100) * barW), h: barH, color: col })

        cv.setPaint({ color: COLOR_VALUE, font_size: 20 })
        cv.drawText({ x: 177, y: 400, w: 100, h: 40, text: b + '%' })
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────────

    onResume: function () {
        this._draw()
    },

    onDestroy: function () { }
})
