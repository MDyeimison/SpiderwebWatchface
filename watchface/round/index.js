/**
 * SpiderWeb Health - ZepOS Watch Face for Amazfit Bip 6
 * API Level 1.x — uses hmUI / hmSensor globals (no @zos/* imports)
 *
 * Radar chart with 6 health metrics: HR, Steps, Calories, Distance, Stress, SpO2
 * Screen: 390 x 450 px (AMOLED)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

var W = 390   // screen width
var H = 450   // screen height

// Radar chart geometry
var CX = 195   // center X
var CY = 250   // center Y
var R = 118   // max radar radius (px)
var RINGS = 5     // concentric rings

// Color palette
var COLOR_BG = 0x0000FF
var COLOR_BG_BAND = 0x0D1020
var COLOR_GRID_OUTER = 0x383870
var COLOR_GRID_INNER = 0x1A1D3A
var COLOR_AXIS = 0x252850
var COLOR_FILL = 0x082030
var COLOR_FILL2 = 0x0A2A40
var COLOR_STROKE = 0x00D4FF
var COLOR_ACCENT = 0x30BCD5
var COLOR_TIME = 0xFFFFFF
var COLOR_DATE = 0x6677AA
var COLOR_VALUE = 0xBBCCDD
var COLOR_BATT_OK = 0x2ED573
var COLOR_BATT_WARN = 0xFFA502
var COLOR_BATT_LOW = 0xFF4757

// Metric definitions: [label, max, axisColor]
// Axis 0=Top(HR) 1=Top-Right(Steps) 2=Bot-Right(Cal)
// Axis 3=Bot(Dist) 4=Bot-Left(Stress) 5=Top-Left(SpO2)
var METRICS = [
    { label: 'HEART', max: 200, color: 0xFF4757 },
    { label: 'STEPS', max: 10000, color: 0xFFA502 },
    { label: 'CAL', max: 1000, color: 0xFF6348 },
    { label: 'DIST', max: 8, color: 0x2ED573 },  // km
    { label: 'STRESS', max: 100, color: 0xECCC68 },
    { label: 'SPO2', max: 100, color: 0x5352ED },
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
        this._initSensors()
        this._draw()
    },

    // ── Canvas ───────────────────────────────────────────────────────────────────

    _createCanvas: function () {
        this.cv = hmUI.createWidget(hmUI.widget.CANVAS, {
            x: 0, y: 0, w: W, h: H
        })
    },

    // ── Sensors ──────────────────────────────────────────────────────────────────

    _initSensors: function () {
        var self = this

        // ── Time (primary redraw trigger) ──
        try {
            var timeSensor = hmSensor.createSensor(hmSensor.id.TIME)
            self._updateTime(timeSensor)
            timeSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self._updateTime(timeSensor)
                self._draw()
            })
        } catch (e) { }

        // ── Heart Rate ──
        try {
            var hrSensor = hmSensor.createSensor(hmSensor.id.HEART_RATE)
            hrSensor.start()
            self.values[0] = hrSensor.current || 0
            hrSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[0] = hrSensor.current || 0
                self._draw()
            })
        } catch (e) { }

        // ── Steps ──
        try {
            var stepSensor = hmSensor.createSensor(hmSensor.id.STEP)
            self.values[1] = stepSensor.current || 0
            stepSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[1] = stepSensor.current || 0
                self._draw()
            })
        } catch (e) { }

        // ── Calories ──
        try {
            var calSensor = hmSensor.createSensor(hmSensor.id.CALORIE)
            self.values[2] = calSensor.current || 0
            calSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[2] = calSensor.current || 0
                self._draw()
            })
        } catch (e) { }

        // ── Distance (meters → km) ──
        try {
            var distSensor = hmSensor.createSensor(hmSensor.id.DISTANCE)
            self.values[3] = (distSensor.current || 0) / 1000
            distSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[3] = (distSensor.current || 0) / 1000
                self._draw()
            })
        } catch (e) { }

        // ── Stress ──
        try {
            var stressSensor = hmSensor.createSensor(hmSensor.id.STRESS)
            self.values[4] = stressSensor.stress || stressSensor.current || 0
            stressSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[4] = stressSensor.stress || stressSensor.current || 0
                self._draw()
            })
        } catch (e) { }

        // ── SpO2 ──
        try {
            var spo2Sensor = hmSensor.createSensor(hmSensor.id.SPO2)
            self.values[5] = spo2Sensor.current || 0
            spo2Sensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.values[5] = spo2Sensor.current || 0
                self._draw()
            })
        } catch (e) { }

        // ── Battery ──
        try {
            var battSensor = hmSensor.createSensor(hmSensor.id.BATTERY)
            self.batt = battSensor.current || 100
            battSensor.addEventListener(hmSensor.event.CHANGE, function () {
                self.batt = battSensor.current || 100
                self._draw()
            })
        } catch (e) { }
    },

    _updateTime: function (t) {
        this.hour = t.hour || 0
        this.minute = t.minute || 0
        this.day = t.day || 1
        this.month = t.month || 1
        this.weekDay = t.weekDay || 0
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
        cv.setPaint({ color: COLOR_BG })
        cv.drawRect({ x1: 0, y1: 0, x2: W, y2: H })
        cv.setPaint({ color: COLOR_BG_BAND })
        cv.drawRect({ x1: 0, y1: 0, x2: W, y2: 100 })
        cv.drawRect({ x1: 0, y1: 405, x2: W, y2: H })
        cv.setPaint({ color: 0x1A1D3A, line_width: 1 })
        cv.drawLine({ x0: 20, y0: 100, x1: W - 20, y1: 100 })
        cv.drawLine({ x0: 20, y0: 405, x1: W - 20, y1: 405 })
    },

    _drawGrid: function (cv) {
        for (var ring = 1; ring <= RINGS; ring++) {
            var r = Math.round((ring / RINGS) * R)
            var xs = [], ys = []
            for (var i = 0; i < N; i++) {
                var a = axisAngle(i)
                xs.push(polarX(r, a))
                ys.push(polarY(r, a))
            }
            cv.setPaint({ color: ring === RINGS ? COLOR_GRID_OUTER : COLOR_GRID_INNER, line_width: ring === RINGS ? 2 : 1 })
            cv.strokePoly({ x_array: xs, y_array: ys })
        }
    },

    _drawAxes: function (cv) {
        cv.setPaint({ color: COLOR_AXIS, line_width: 1 })
        for (var i = 0; i < N; i++) {
            var a = axisAngle(i)
            cv.drawLine({ x0: CX, y0: CY, x1: polarX(R, a), y1: polarY(R, a) })
        }
        cv.setPaint({ color: COLOR_ACCENT })
        cv.drawCircle({ cx: CX, cy: CY, radius: 4 })
        cv.setPaint({ color: 0xFFFFFF })
        cv.drawCircle({ cx: CX, cy: CY, radius: 2 })
    },

    _drawDataPolygon: function (cv) {
        var dxs = [], dys = []
        for (var i = 0; i < N; i++) {
            var norm = clamp01(this.values[i] / METRICS[i].max)
            var r = norm > 0.02 ? Math.round(norm * R) : 6
            var a = axisAngle(i)
            dxs.push(polarX(r, a))
            dys.push(polarY(r, a))
        }
        // Fill
        cv.setPaint({ color: COLOR_FILL })
        cv.drawPoly({ x_array: dxs, y_array: dys })
        // Glow stroke
        cv.setPaint({ color: COLOR_FILL2, line_width: 3 })
        cv.strokePoly({ x_array: dxs, y_array: dys })
        // Neon cyan main stroke
        cv.setPaint({ color: COLOR_STROKE, line_width: 2 })
        cv.strokePoly({ x_array: dxs, y_array: dys })
        // Vertex dots
        for (var j = 0; j < N; j++) {
            cv.setPaint({ color: METRICS[j].color })
            cv.drawCircle({ cx: dxs[j], cy: dys[j], radius: 5 })
            cv.setPaint({ color: 0xFFFFFF })
            cv.drawCircle({ cx: dxs[j], cy: dys[j], radius: 2 })
        }
    },

    _drawLabels: function (cv) {
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)
            var labelR = R + 26
            var lx = polarX(labelR, angle)
            var ly = polarY(labelR, angle)

            // Metric name
            var label = METRICS[i].label
            cv.setPaint({ color: METRICS[i].color, font_size: 17 })
            cv.drawText({ x: lx - centerOffsetX(label, 9), y: ly - 10, w: label.length * 11, text: label })

            // Current value
            var valStr = this._formatValue(i)
            cv.setPaint({ color: COLOR_VALUE, font_size: 14 })
            cv.drawText({ x: lx - centerOffsetX(valStr, 7.5), y: ly + 8, w: valStr.length * 10, text: valStr })
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
        cv.setPaint({ color: COLOR_TIME, font_size: 56 })
        cv.drawText({ x: 40, y: 12, w: 320, text: hStr + ':' + mStr })

        var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        var dateStr = DAYS[this.weekDay] + '  ' + this.day + ' ' + MONTHS[this.month - 1]
        cv.setPaint({ color: COLOR_DATE, font_size: 19 })
        cv.drawText({ x: 95, y: 72, w: 220, text: dateStr })
    },

    _drawBattery: function (cv) {
        var b = this.batt
        var col = b < 20 ? COLOR_BATT_LOW : b < 50 ? COLOR_BATT_WARN : COLOR_BATT_OK
        cv.setPaint({ color: col, font_size: 17 })
        cv.drawText({ x: 100, y: 414, w: 200, text: 'BATTERY  ' + b + '%' })

        var barX = 115, barY = 436, barW = 160, barH = 6
        cv.setPaint({ color: 0x1E2040 })
        cv.drawRect({ x1: barX, y1: barY, x2: barX + barW, y2: barY + barH })
        cv.setPaint({ color: col })
        cv.drawRect({ x1: barX, y1: barY, x2: barX + Math.round((b / 100) * barW), y2: barY + barH })
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────────

    onResume: function () {
        this._draw()
    },

    onDestroy: function () { }
})
