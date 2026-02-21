/**
 * SpiderWeb Health - ZepOS 2.0 Watch Face for Amazfit Bip 6
 * Displays 6 health metrics as a radar/spider web chart using the CANVAS widget.
 *
 * Metrics: Heart Rate, Steps, Calories, Distance, Stress, SpO2
 * Screen:  390 x 450 px (AMOLED)
 */

import { createWidget, widget } from '@zos/ui'
import {
    HeartRate,
    StepCounter,
    Calorie,
    Distance,
    Stress,
    SpO2,
    Time,
    Battery
} from '@zos/sensor'

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 390   // screen width
const H = 450   // screen height

// Radar chart geometry
const CX = 195   // chart center X
const CY = 250   // chart center Y (shifted down to leave room for time)
const R = 118   // max radar radius in px
const RINGS = 5     // concentric polygon rings

// Colors
const COLOR = {
    BG: 0x080B14,   // deep dark navy
    BG_BAND: 0x0D1020,   // slightly lighter panel strip
    GRID_OUTER: 0x383870,   // outer ring edge
    GRID_INNER: 0x1A1D3A,   // inner ring fill
    AXIS: 0x252850,   // radial axis lines
    FILL: 0x082030,   // data polygon fill (dark teal)
    FILL2: 0x0A2A40,   // data polygon fill glow
    STROKE: 0x00D4FF,   // data polygon neon cyan stroke
    ACCENT: 0x30BCD5,   // center dot
    TIME: 0xFFFFFF,   // time text
    DATE: 0x6677AA,   // date text
    VALUE: 0xBBCCDD,   // metric value text
    BATT_OK: 0x2ED573,   // green battery
    BATT_WARN: 0xFFA502,   // orange battery warning
    BATT_LOW: 0xFF4757,   // red battery critical
}

// Health metric definitions
// Values: [label, maxValue, axisColor]
// Axes arranged clockwise from top:
//   0=Top(HR)  1=Top-Right(Steps)  2=Bot-Right(Cal)
//   3=Bot(Dist) 4=Bot-Left(Stress)  5=Top-Left(SpO2)
const METRICS = [
    { label: 'HEART', unit: 'bpm', max: 200, color: 0xFF4757 },
    { label: 'STEPS', unit: '', max: 10000, color: 0xFFA502 },
    { label: 'CAL', unit: 'kcal', max: 1000, color: 0xFF6348 },
    { label: 'DIST', unit: 'km', max: 8, color: 0x2ED573 },
    { label: 'STRESS', unit: '%', max: 100, color: 0xECCC68 },
    { label: 'SPO2', unit: '%', max: 100, color: 0x5352ED },
]

const N = METRICS.length

// ─── Math helpers ─────────────────────────────────────────────────────────────

/** Convert axis index to radians (0 = top = -90°, clockwise) */
function axisAngle(i) {
    return (-Math.PI / 2) + (i / N) * 2 * Math.PI
}

/** Polar → cartesian relative to radar center */
function polar(r, angle) {
    return [
        Math.round(CX + r * Math.cos(angle)),
        Math.round(CY + r * Math.sin(angle))
    ]
}

/** Clamp value between 0 and 1 */
function clamp(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Estimate X offset to roughly center text.
 * ZepOS canvas draws text from top-left.
 * approxCharWidth is around 10px at font_size 18, 8px at font_size 14.
 */
function textOffsetX(text, charWidth) {
    return Math.round((text.length * charWidth) / 2)
}

// ─── Watch Face ───────────────────────────────────────────────────────────────

WatchFace({

    onInit() {
        /** Sensor values: [hr, steps, cal, dist_km, stress, spo2] */
        this.values = [0, 0, 0, 0, 0, 0]
        this.batt = 100
        this.timeStr = '00:00'
        this.dateStr = ''

        this._initCanvas()
        this._initSensors()
        this._draw()
    },

    // ── Canvas setup ────────────────────────────────────────────────────────────

    _initCanvas() {
        this.cv = createWidget(widget.CANVAS, {
            x: 0, y: 0, w: W, h: H
        })
    },

    // ── Sensors ─────────────────────────────────────────────────────────────────

    _initSensors() {
        const self = this

        const safe = (fn) => { try { fn() } catch (_) { } }

        // Time – primary redraw trigger (every minute)
        safe(() => {
            const t = Time()
            self._updateTime(t)
            t.onChange(() => {
                self._updateTime(t)
                self._draw()
            })
        })

        // Heart Rate
        safe(() => {
            const s = HeartRate()
            s.start()
            self.values[0] = s.current || 0
            s.onChange(() => { self.values[0] = s.current || 0; self._draw() })
        })

        // Steps
        safe(() => {
            const s = StepCounter()
            self.values[1] = s.current || 0
            s.onChange(() => { self.values[1] = s.current || 0; self._draw() })
        })

        // Calories
        safe(() => {
            const s = Calorie()
            self.values[2] = s.current || 0
            s.onChange(() => { self.values[2] = s.current || 0; self._draw() })
        })

        // Distance (returned in meters → convert to km)
        safe(() => {
            const s = Distance()
            self.values[3] = (s.current || 0) / 1000
            s.onChange(() => { self.values[3] = (s.current || 0) / 1000; self._draw() })
        })

        // Stress (0–100)
        safe(() => {
            const s = Stress()
            self.values[4] = s.current || 0
            s.onChange(() => { self.values[4] = s.current || 0; self._draw() })
        })

        // SpO2 (0–100)
        safe(() => {
            const s = SpO2()
            self.values[5] = s.current || 0
            s.onChange(() => { self.values[5] = s.current || 0; self._draw() })
        })

        // Battery
        safe(() => {
            const b = Battery()
            self.batt = b.current || 100
            b.onChange(() => { self.batt = b.current || 100; self._draw() })
        })
    },

    _updateTime(t) {
        const h = String(t.hour).padStart(2, '0')
        const m = String(t.minute).padStart(2, '0')
        this.timeStr = h + ':' + m

        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        this.dateStr = DAYS[t.weekDay] + '  ' + t.day + ' ' + MONTHS[t.month - 1]
    },

    // ── Drawing ──────────────────────────────────────────────────────────────────

    _draw() {
        const cv = this.cv
        if (!cv) return

        this._drawBackground(cv)
        this._drawGrid(cv)
        this._drawAxes(cv)
        this._drawDataPolygon(cv)
        this._drawLabels(cv)
        this._drawTime(cv)
        this._drawBattery(cv)
    },

    /** Fill background with dark navy + accent panel bands */
    _drawBackground(cv) {
        cv.setPaint({ color: COLOR.BG })
        cv.drawRect({ x1: 0, y1: 0, x2: W, y2: H })

        // Top panel band (time area)
        cv.setPaint({ color: COLOR.BG_BAND })
        cv.drawRect({ x1: 0, y1: 0, x2: W, y2: 100 })

        // Bottom panel band (battery area)
        cv.setPaint({ color: COLOR.BG_BAND })
        cv.drawRect({ x1: 0, y1: 405, x2: W, y2: H })

        // Subtle horizontal dividers
        cv.setPaint({ color: 0x1A1D3A, line_width: 1 })
        cv.drawLine({ x0: 20, y0: 100, x1: W - 20, y1: 100 })
        cv.drawLine({ x0: 20, y0: 405, x1: W - 20, y1: 405 })
    },

    /** Draw concentric polygon rings (spider web grid) */
    _drawGrid(cv) {
        for (let ring = 1; ring <= RINGS; ring++) {
            const r = Math.round((ring / RINGS) * R)
            const xs = [], ys = []

            for (let i = 0; i < N; i++) {
                const [x, y] = polar(r, axisAngle(i))
                xs.push(x)
                ys.push(y)
            }

            // Outer ring is slightly brighter than inner ones
            const col = ring === RINGS ? COLOR.GRID_OUTER : COLOR.GRID_INNER
            cv.setPaint({ color: col, line_width: ring === RINGS ? 2 : 1 })
            cv.strokePoly({ x_array: xs, y_array: ys })
        }
    },

    /** Draw radial axis lines from center to each outer vertex */
    _drawAxes(cv) {
        cv.setPaint({ color: COLOR.AXIS, line_width: 1 })
        for (let i = 0; i < N; i++) {
            const [x, y] = polar(R, axisAngle(i))
            cv.drawLine({ x0: CX, y0: CY, x1: x, y1: y })
        }

        // Center accent dot
        cv.setPaint({ color: COLOR.ACCENT })
        cv.drawCircle({ cx: CX, cy: CY, radius: 4 })
        cv.setPaint({ color: 0xFFFFFF })
        cv.drawCircle({ cx: CX, cy: CY, radius: 2 })
    },

    /** Compute normalized data points and render filled + stroked polygon */
    _drawDataPolygon(cv) {
        const dxs = [], dys = []

        for (let i = 0; i < N; i++) {
            const norm = clamp(this.values[i] / METRICS[i].max)
            // Ensure minimum visible size (6px) even for zero values
            const r = norm > 0.02 ? Math.round(norm * R) : 6
            const [x, y] = polar(r, axisAngle(i))
            dxs.push(x)
            dys.push(y)
        }

        // Inner fill (very dark teal)
        cv.setPaint({ color: COLOR.FILL })
        cv.drawPoly({ x_array: dxs, y_array: dys })

        // Secondary fill pass for a slight glow
        cv.setPaint({ color: COLOR.FILL2, line_width: 3 })
        cv.strokePoly({ x_array: dxs, y_array: dys })

        // Main neon cyan stroke
        cv.setPaint({ color: COLOR.STROKE, line_width: 2 })
        cv.strokePoly({ x_array: dxs, y_array: dys })

        // Colored dots at each data vertex
        for (let i = 0; i < N; i++) {
            cv.setPaint({ color: METRICS[i].color })
            cv.drawCircle({ cx: dxs[i], cy: dys[i], radius: 5 })
            cv.setPaint({ color: 0xFFFFFF })
            cv.drawCircle({ cx: dxs[i], cy: dys[i], radius: 2 })
        }
    },

    /** Draw axis labels (metric name + current value) at each tip */
    _drawLabels(cv) {
        for (let i = 0; i < N; i++) {
            const angle = axisAngle(i)
            const labelR = R + 26
            const [lx, ly] = polar(labelR, angle)

            // ── Metric name
            const label = METRICS[i].label
            const labelX = lx - textOffsetX(label, 9)
            cv.setPaint({ color: METRICS[i].color, font_size: 17 })
            cv.drawText({
                x: labelX,
                y: ly - 10,
                w: label.length * 11,
                text: label
            })

            // ── Current value
            const valStr = this._formatValue(i)
            const valX = lx - textOffsetX(valStr, 7.5)
            cv.setPaint({ color: COLOR.VALUE, font_size: 14 })
            cv.drawText({
                x: valX,
                y: ly + 8,
                w: valStr.length * 10,
                text: valStr
            })
        }
    },

    /** Format a metric value for display */
    _formatValue(i) {
        const v = this.values[i]
        switch (i) {
            case 0: return String(Math.round(v))          // HR: bpm
            case 1: return String(Math.round(v))          // Steps
            case 2: return String(Math.round(v))          // Cal: kcal
            case 3: return v.toFixed(1) + 'km'            // Distance
            case 4: return String(Math.round(v))          // Stress
            case 5: return String(Math.round(v)) + '%'   // SpO2
            default: return '0'
        }
    },

    /** Draw large time + date in the top panel */
    _drawTime(cv) {
        // Time (HH:MM)
        cv.setPaint({ color: COLOR.TIME, font_size: 56 })
        cv.drawText({
            x: 40,
            y: 12,
            w: 320,
            text: this.timeStr
        })

        // Date
        cv.setPaint({ color: COLOR.DATE, font_size: 19 })
        cv.drawText({
            x: 95,
            y: 72,
            w: 220,
            text: this.dateStr
        })
    },

    /** Draw battery percentage in the bottom panel */
    _drawBattery(cv) {
        const b = this.batt
        const col = b < 20 ? COLOR.BATT_LOW : b < 50 ? COLOR.BATT_WARN : COLOR.BATT_OK
        const txt = 'BATTERY  ' + b + '%'

        cv.setPaint({ color: col, font_size: 17 })
        cv.drawText({
            x: 100,
            y: 414,
            w: 200,
            text: txt
        })

        // Draw a small horizontal bar indicator
        const barW = 160
        const barH = 6
        const barX = 115
        const barY = 436
        const fillW = Math.round((b / 100) * barW)

        // Background bar
        cv.setPaint({ color: 0x1E2040 })
        cv.drawRect({ x1: barX, y1: barY, x2: barX + barW, y2: barY + barH })

        // Fill bar
        cv.setPaint({ color: col })
        cv.drawRect({ x1: barX, y1: barY, x2: barX + fillW, y2: barY + barH })
    },

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    onResume() {
        this._draw()
    },

    onDestroy() {
        // Sensors are cleaned up by the OS
    }
})
