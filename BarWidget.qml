import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Calendar date for the bar, and the host for the month popup.
//
// The widget shows whichever calendar the user has selected -- Gregorian or
// Bikram Sambat -- as a single date. Both render in English characters; the mode
// swaps the calendar system, not the script, so the bar never needs a Devanagari
// face. Left click reveals the month grid; right click walks the label formats,
// writing the result back to shell.json so the bar and the config never disagree.
BarWidget {
  id: root
  moduleName: "raktapyas.clock"

  // Re-derived rather than tracked: the widget re-reads the date on every clock
  // tick, and re-running the conversion is far cheaper than binding a property
  // to a JS call that would need invalidating anyway.
  property date now: new Date()
  readonly property var bs: Model.adToBs(now) || { year: 0, month: 1, day: 0 }

  // Which calendar is showing. Shared with the panel through the widget's
  // settings entry, so the bar label and the popup can never disagree.
  readonly property string mode: Model.normalizeMode(setting("language", Model.MODE_EN))
  readonly property bool npMode: Model.isNpMode(mode)

  readonly property string configuredFormat: vertical
    ? setting("verticalFormat", "classic-v")
    : setting("format", "classic")
  // The alternate format the built-in clock pairs with `format`. It joins the
  // cycle so a format string carried over from it stays one click away.
  readonly property string configuredAltFormat: vertical
    ? setting("verticalFormatAlt", "HH\n—\nmm\n'W'ww")
    : setting("formatAlt", "d MMMM 'W'ww yyyy")
  readonly property var formatRing: Model.formatRing(
    Model.barFormats(vertical), configuredFormat, configuredAltFormat)

  // What the bar shows is what shell.json stores, so a cycled format is the
  // format from then on rather than something that reverts on restart.
  readonly property string activeFormat: configuredFormat
  readonly property string displayText: formatted(now, bs)
  readonly property var verticalLines: displayText.split("\n")

  function pad2(value) {
    var n = Number(value)
    return (n < 10 ? "0" : "") + n
  }

  // The one date the label shows, for the active calendar -- never both. EN uses
  // the built-in panel's own format so the bar reads "Wednesday 16:43"; NP shows
  // the Bikram Sambat date.
  readonly property string primaryDate: npMode
    ? Model.formatPrimaryDate(now, mode)
    : Qt.formatDateTime(now, "dddd HH:mm")

  // Whether the active format is one of ours or a hand-written format string.
  // The two render through different engines: our presets are token templates,
  // and anything else is a Qt date format. Splitting here is what lets a format
  // carried over from the built-in clock render instead of printing its own
  // pattern.
  function activeFormatIsPreset() {
    var presets = Model.barFormats(vertical)
    for (var i = 0; i < presets.length; i++) {
      if (presets[i].id === activeFormat) return true
    }
    return false
  }

  function formatted(date, bsDate) {
    if (!activeFormatIsPreset())
      return Qt.formatDateTime(date, String(activeFormat).replace(/ww/g,
        Model.isoWeekLiteral(date.getFullYear(), date.getMonth(), date.getDate())))

    if (npMode ? !bsDate.year : false) return "--"

    var text = Model.formatById(activeFormat, vertical)
      // {DATE} resolves to whichever calendar is active, so the bar follows the
      // mode without the formats having to know about it.
      .replace(/\{DATE\}/g, root.primaryDate)
      .replace(/\{BS_LONG\}/g, bsDate.year ? Model.formatBs(bsDate) : "")
      .replace(/\{AD_LONG\}/g, Model.formatAd(bsDate.year ? bsDate : date))
      .replace(/\{BS_SHORT\}/g, bsDate.year ? Model.monthNameShort(bsDate.month) + " " + bsDate.day : "")
      .replace(/\{AD_SHORT\}/g, Model.formatAdShort(bsDate.year ? bsDate : date))
      .replace(/\{MONTH\}/g, npMode
        ? (bsDate.year ? Model.monthName(bsDate.month) : Model.adMonthName(date.getMonth()))
        : Model.adMonthName(date.getMonth()))
      .replace(/\{MONTH_SHORT\}/g, npMode
        ? (bsDate.year ? Model.monthNameShort(bsDate.month) : Model.adMonthName(date.getMonth()).substr(0, 3))
        : Model.adMonthName(date.getMonth()).substr(0, 3))
      .replace(/\{YYYY\}/g, String(npMode ? bsDate.year : date.getFullYear()))
      .replace(/\{YY\}/g, String(npMode ? bsDate.year : date.getFullYear()).substr(2))
      .replace(/\{WEEKDAY\}/g, Model.weekdayName(date.getDay(), true))
      .replace(/\{D\}/g, String(npMode ? bsDate.day : date.getDate()))
      .replace(/\{H\}/g, String(date.getHours()))
      .replace(/\{M\}/g, pad2(date.getMinutes()))

    return text
  }

  function refresh() {
    now = new Date()
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  // Single writer for this widget's settings entry. Applied locally first so the
  // label changes on the click itself; the shell.json write comes back through
  // the bar as the same value.
  function persist(values) {
    var entry = { id: root.moduleName }
    for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key]
    for (var name in values) entry[name] = values[name]

    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function cycleFormat() {
    var current = String(configuredFormat)
    var next = Model.nextFormat(formatRing, current)
    if (next === "" || next === current) return

    var update = {}
    update[vertical ? "verticalFormat" : "format"] = next
    persist(update)
  }

  // The panel owns calendar mode and writes through its own persistSettings,
  // which also updates this widget's copy. That surface is the keyboard
  // (E/e, N/n), not a header control; this entry point is for the IPC route,
  // where there is no panel to ask.
  function setMode(nextMode) {
    var normalized = Model.normalizeMode(nextMode)
    if (normalized === root.mode) return
    persist({ language: normalized })
  }

  // Week start lives with the panel, which owns the grid; this is the route for
  // a caller with no panel to ask, and the path the bar's own IPC uses.
  function toggleWeekStart() {
    if (panelLoader.item && panelLoader.item.toggleWeekStart)
      panelLoader.item.toggleWeekStart()
  }

  // ---- Calendar popup. Shape contract for shell.summon/hide/toggle routing:
  //      Bar.findPanelWidget requires open/close/opened on the bar-widget root.
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  // The bar fills more slot than it paints a mark for, at both orientations:
  // horizontally it is a text label in a padded slot, so the dot takes the label
  // width; vertically it is a stack of icon-sized lines, so the dot takes one
  // line -- the same mark every icon widget gets, rather than a rule running the
  // height of the whole stack.
  readonly property real openPanelIndicatorWidth: button.labelWidth
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  // Forwarded so this widget can stand in for the panel as the bar's popout
  // identity: Bar.requestPopout prefers closeForPopoutSwitch over close, and
  // KeyboardPanel reads popoutSwitchClosing back off its owner.
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: root.refresh()
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "raktapyas.clock"

    function refresh(): void { root.broadcast("refresh") }
    function cycleFormat(): void { root.cycleFormat() }
    function toggleWeekStart(): void { root.toggleWeekStart() }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    // Typed explicitly: Quickshell's IPC cannot marshal an untyped QVariant
    // argument, so an untyped parameter here is rejected when the handler
    // registers rather than failing at call time.
    function setMode(mode: string): void { root.setMode(mode) }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.vertical ? "" : root.displayText
    labelVisible: !root.vertical
    hasVisualContent: root.vertical ? root.verticalLines.length > 0 : text !== ""
    fixedHeight: root.vertical ? root.verticalLines.length * Style.bar.iconSlot : -1
    horizontalMargin: 8.75
    verticalPadding: 8.75

    onPressed: function(b) {
      if (b === Qt.RightButton) root.cycleFormat()
      else if (b === Qt.MiddleButton) { if (root.bar) root.bar.run("omarchy-menu-timezone") }
      else root.togglePanel()
    }

    Column {
      visible: root.vertical
      anchors.fill: parent

      Repeater {
        model: root.verticalLines

        OpticalGlyph {
          required property string modelData
          width: button.width
          height: Style.bar.iconSlot
          text: modelData
          fontFamily: button.fontFamily
          fontSize: modelData.length > 8 ? button.fontSize * 0.85 : button.fontSize
          color: button.foreground
        }
      }
    }
  }
}
