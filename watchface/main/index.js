/**
 * SpiderWeb Health - ZepOS Watch Face for Amazfit GTR 4
 * API Level 2.0 — uses @zos/ui and @zos/sensor imports
 *
 * Radar chart with 6 health metrics: HR, Steps, Calories, Distance, Stress, SpO2
 * Screen: 466 x 466 px (AMOLED)
 */
import ui from '@zos/ui'
import { Time, HeartRate, Step, Calorie, Distance, Stress, BloodOxygen, Battery } from '@zos/sensor'
import { getDeviceInfo } from '@zos/device'

var scaleRatio = 1
try {
    var deviceInfo = getDeviceInfo()
    if (deviceInfo && deviceInfo.width) {
        scaleRatio = 390 / deviceInfo.width
    }
} catch (e) { }

function unscale(px) {
    return Math.round(px * scaleRatio)
}

// ─── Constants ────────────────────────────────────────────────────────────────

var W = 390   // screen width
var H = 450   // screen height

// Radar chart geometry
var CX = 168   // center X (shifted left by 15px from 183)
var CY = 215   // <-- CHANGE THIS FROM 235 TO 225
var R = 115    // max radar radius (bigger chart)
var RINGS = 5  // concentric rings

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
        this.isScreenOn = true // Track state to save battery during screen off

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
        // Unscale bounds so the 390x450 physical image isn't cropped inside a smaller bounding box
        ui.createWidget(ui.widget.IMG, {
            src: 'background.png',
            x: 0,
            y: 0,
            w: unscale(390),
            h: unscale(450)
        })
    },

    // ── Animation (cycled IMG widget on top of canvas) ────────────────────────────────

    _startAnimation: function () {
        this.frame = 0
        this.totalFrames = 18

        // Back to the standard IMG widget that we know works!
        this.animImg = ui.createWidget(ui.widget.IMG, {
            src: 'walking_guy/walking_0.png',
            x: 300, // Moved 5px right from 300
            y: 170, // Moved 15px up from 200,
            w: unscale(94), // Upscaled by 25% (75 -> 94)
            h: unscale(134) // Upscaled by 25% (107 -> 134)
        })

        this._resumeAnimation()
    },

    _resumeAnimation: function () {
        var self = this
        // Clear any existing timer to prevent double-speed glitches
        if (this.animTimer) {
            clearInterval(this.animTimer)
        }

        // Cycle frames at ~12 fps
        this.animTimer = setInterval(function () {
            self.frame = (self.frame + 1) % self.totalFrames
            if (self.animImg) {
                self.animImg.setProperty(ui.prop.SRC, 'walking_guy/walking_' + self.frame + '.png')
            }
        }, 83)
    },

    _pauseAnimation: function () {
        // Kill the JS timer to save battery when the screen is off
        if (this.animTimer) {
            clearInterval(this.animTimer)
            this.animTimer = null
        }
    },

    // ── Canvas ───────────────────────────────────────────────────────────────────

    _createCanvas: function () {
        this.cv = ui.createWidget(ui.widget.CANVAS, {
            x: 0, y: 0, w: W, h: H
        })
    },

    // ── TEXT widgets for all dynamic labels ─────────────────────────────────

    _createTextWidgets: function () {
        var ICON_R = R + 25, ICON_HALF = 21
        this.labelWidgets = []
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)
            var ix = polarX(ICON_R, angle)
            var iy = polarY(ICON_R, angle)
            var x, y

            if (i === 0 || i === 3) {
                // Heart Rate (Top) and Distance (Bottom)
                x = ix + ICON_HALF + 4;
                y = iy - 28
            } else {
                // Steps, Calories, Stress, SpO2
                var xOff = (i === 4 || i === 5) ? -15 : 0
                x = ix - 20 + xOff;
                y = iy + ICON_HALF - 13

                // Push these 4 corner counters 10 pixels to the right total
                x += 10
            }

            // Push all counters down by 17 pixels (moved down an extra 10px)
            y += 17

            this.labelWidgets.push(ui.createWidget(ui.widget.TEXT, {
                x: x, y: y,
                w: 70, h: 32,          // <-- Increased height to prevent clipping
                text: '0',
                text_size: 24,         // <-- Increased font size from 20 to 24
                color: COLOR_VALUE
            }))
        }

        // Time widget (left half of bottom bar)
        this.timeWidget = ui.createWidget(ui.widget.TEXT, {
            x: Math.floor(W / 4 - 35), y: 375, w: 90, h: 40,
            text: '00:00', text_size: 26, color: 0x5AFB67
        })

        // Date widget (right half of bottom bar)
        this.dateWidget = ui.createWidget(ui.widget.TEXT, {
            x: Math.floor(3 * W / 4 - 60) - 20, y: 375, w: 140, h: 40,
            text: '01.01.2026', text_size: 26, color: 0x5AFB67
        })

        // Battery % widget
        this.battWidget = ui.createWidget(ui.widget.TEXT, {
            x: 90, y: 412, w: 65, h: 35,  // <-- Increased width/height for larger text
            text: '100%', text_size: 28, color: 0x5AFB67 // Increased text size from 24 to 28
        })
        // Fake bold overlay (shifted 1px right)
        this.battWidgetBold = ui.createWidget(ui.widget.TEXT, {
            x: 91, y: 412, w: 65, h: 35,
            text: '100%', text_size: 28, color: 0x5AFB67
        })
    },

    // ── Static Icons ─────────────────────────────────────────

    _createIcons: function () {
        var ICON_R = R + 25  // <-- Change this line
        for (var i = 0; i < N; i++) {
            var angle = axisAngle(i)
            var lx = polarX(ICON_R, angle)
            var ly = polarY(ICON_R, angle)
            ui.createWidget(ui.widget.IMG, {
                x: lx - 21,
                y: ly - 21,
                w: unscale(42),
                h: unscale(42),
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

                // Force-poll Stress, SpO2, and Battery because their onChange events are unreliable
                // ONLY when the screen is active, to conserve hardware battery
                if (self.isScreenOn) {
                    if (self.stressSensor) {
                        var st = self.stressSensor.getCurrent()
                        self.values[4] = (st && st.value !== undefined) ? st.value : 0
                    }
                    if (self.spo2Sensor) {
                        var sp = self.spo2Sensor.getCurrent()
                        self.values[5] = (sp && sp.value !== undefined) ? sp.value : 0
                    }
                    if (self.battSensor) {
                        var b = self.battSensor.getCurrent()
                        if (b !== undefined && b !== null) self.batt = (b.value !== undefined) ? b.value : b
                    }
                }

                self._draw()
            })
        } catch (e) { }

        // ── Heart Rate ──
        try {
            var hrSensor = new HeartRate()
            // Try to get live current HR, fallback to last recorded if unavailable
            self.values[0] = hrSensor.getCurrent() || hrSensor.getLast() || 0

            // Listen for live continuous updates
            if (hrSensor.onCurrentChange) {
                hrSensor.onCurrentChange(function () {
                    self.values[0] = hrSensor.getCurrent() || 0
                    self._draw()
                })
            } else if (hrSensor.onLastChange) {
                hrSensor.onLastChange(function () {
                    self.values[0] = hrSensor.getLast() || 0
                    self._draw()
                })
            }
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
            self.stressSensor = new Stress()
            var st = self.stressSensor.getCurrent()
            self.values[4] = (st && st.value !== undefined) ? st.value : 0
            self.stressSensor.onChange(function () {
                var newSt = self.stressSensor.getCurrent()
                self.values[4] = (newSt && newSt.value !== undefined) ? newSt.value : 0
                self._draw()
            })
        } catch (e) { }

        // ── SpO2 ──
        try {
            self.spo2Sensor = new BloodOxygen()
            var sp = self.spo2Sensor.getCurrent()
            self.values[5] = (sp && sp.value !== undefined) ? sp.value : 0
            self.spo2Sensor.onChange(function () {
                var newSp = self.spo2Sensor.getCurrent()
                self.values[5] = (newSp && newSp.value !== undefined) ? newSp.value : 0
                self._draw()
            })
        } catch (e) { }

        // ── Battery ──
        try {
            self.battSensor = new Battery()
            var initB = self.battSensor.getCurrent()
            self.batt = (initB !== undefined && initB !== null) ? ((initB.value !== undefined) ? initB.value : initB) : 100

            self.battSensor.onChange(function () {
                var newB = self.battSensor.getCurrent()
                if (newB !== undefined && newB !== null) {
                    self.batt = (newB.value !== undefined) ? newB.value : newB
                    self._draw()
                }
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
        if (!this.isScreenOn) return // Do not draw heavy graphics if screen is physically off

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
        if (this.battWidgetBold) this.battWidgetBold.setProperty(ui.prop.MORE, { text: this.batt + '%' })
    },

    _drawBackground: function (cv) {
        // Clear chart interior to prevent ghost fills
        cv.setPaint({ color: 0x000000 })
        var bgPts = []
        for (var bg = 0; bg < N; bg++) {
            bgPts.push({ x: polarX(R, axisAngle(bg)), y: polarY(R, axisAngle(bg)) })
        }
        bgPts.push({ x: bgPts[0].x, y: bgPts[0].y }) // Explicitly close the loop
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

        var pad = 3
        // Shorter bar, shifted to the right to sit perfectly next to the centered text
        var barX = 153, barW = 140, barY = 425, barH = 14  // <-- Moved down 3px (422 -> 425)
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
        this.isScreenOn = true // Re-enable drawing
        this._draw() // Force an immediate redraw to clear stale values generated while sleeping
        // Start walking when screen wakes up
        this._resumeAnimation()
    },

    onPause: function () {
        this.isScreenOn = false // Stop responding to heavy sensor changes
        // Stop walking when screen turns off (Saves your battery!)
        this._pauseAnimation()
    },

    onDestroy: function () {
        this._pauseAnimation()
    }
})