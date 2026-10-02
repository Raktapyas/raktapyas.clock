import QtQuick
import Quickshell
import Quickshell.Networking
import qs.Commons
import qs.Ui
import "Model.js" as Model

// The calendar popup: a hero date, two progress rails, a month grid and month
// stepping.
//
// This mirrors the built-in calendar panel's composition and metrics rather than
// approximating it: the same 560px card, the same 52x34 day cells, the same rail
// and grid geometry, and the same Style.* token path. That token path is what
// makes the panel pick up the active theme's accent -- the orange here is the
// theme's popup text colour reached through bar.foreground, not a hardcoded
// value, so changing theme changes the panel with it. The type scale follows
// the same path: every font size here, including the hero, is derived from the
// theme's base size, so a theme with larger type grows the whole panel
// proportionally rather than clipping the date.
//
// The panel shows either the Gregorian or the Bikram Sambat calendar, as a
// single date and a single grid, with the year rail measuring whichever year is
// on screen. There is no chip for that in the header -- the calendar is a
// setting, reached by keyboard (E/e and N/n) or over IPC, both of which call
// setMode.
//
// BarWidget.qml owns the bar label and holds the settings entry the mode lives
// in, and hands this panel the button to anchor against.
Panel {
  id: root
  moduleName: "raktapyas.clock"
  ipcTarget: "raktapyas.clock"
  manageIpc: false

  property var anchorItem: null

  // The bar tracks the widget mounted in its slot -- BarWidget.qml -- not this
  // nested panel. Everything the bar identifies a panel by has to be that widget.
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  // ---- Grid metrics, matching the built-in calendar panel exactly. The theme
  //      this runs under sets spacing scale 1.0 with a 12px base font, so
  //      Style.space(px) is px and these are the literal sizes on screen.
  readonly property int cellWidth: Style.space(52)
  readonly property int cellHeight: Style.space(34)
  readonly property int cellSpacing: Style.space(2)
  readonly property int weekColumnWidth: Style.space(32)
  readonly property int gutterWidth: Style.space(14)
  readonly property int headHeight: Style.space(16)

  // ---- Hero type. It sits above the Style.font.* scale on purpose -- it is
  //      the panel's one display element -- but it is scaled off the same base
  //      size every other token is, so a theme with a larger base-size grows
  //      the card, the grid and the hero together instead of leaving the hero
  //      stranded at a fixed pixel size. Style.fontPx is the function the font
  //      tokens themselves are built from, so this tracks the base size by the
  //      same rule the rest of the shell does. At the theme's 12px base these
  //      resolve to 48 and 52, matching the built-in panel exactly.
  readonly property int heroIconFontSize: Style.fontPx(4)
  readonly property int heroDateFontSize: Style.fontPx(4.333)

  // ---- Today. SystemClock keeps this honest across midnight so the highlight
  //      rolls over without the panel being reopened.
  property date today: new Date()
  readonly property string todayKey: Model.keyForDate(today)
  readonly property var todayBs: Model.adToBs(today) || { year: 0, month: 1, day: 0 }
  readonly property var todayView: Model.viewForDate(today, root.mode)

  // Which calendar is showing, read from the widget's settings entry so the bar
  // label and this panel can never disagree. The defaults stand in for a
  // shell.json entry that does not exist while the plugin is not installed.
  readonly property string mode: Model.normalizeMode(setting("language", Model.MODE_EN))
  readonly property bool npMode: Model.isNpMode(mode)

  // The month on screen, in whichever calendar is active.
  property int viewYear: todayView ? todayView.year : 0
  property int viewMonth: todayView ? todayView.month : 1
  readonly property bool viewingCurrentMonth: todayView
    && viewYear === todayView.year && viewMonth === todayView.month

  // Nepali weeks begin on Sunday; the Gregorian grid uses the same row start so
  // switching modes does not reflow the rows under the pointer. With nothing
  // configured the two calendars differ about which default is right -- a BS
  // week opens on Sunday, a Gregorian one on whatever the locale says -- so the
  // fallback is mode-aware rather than one compromise for both.
  readonly property int weekStart: Model.normalizedWeekStart(
    setting("weekStartDay", null),
    npMode ? undefined : Qt.locale().firstDayOfWeek)
  readonly property var weekdays: Model.weekdayOrder(weekStart)

  // What the week-start control is about to switch to, so the label can name it
  // rather than describe the action abstractly.
  readonly property int nextWeekStart: Model.toggledWeekStart(weekStart)
  readonly property string nextWeekStartLabel: Qt.locale().dayName(nextWeekStart, Locale.LongFormat)

  // ---- Festival data. Model holds the gazette table and merges a live feed on
  //      top of it, but plain JS has no notify signal, so a binding that read
  //      Model's state would never re-run when a fetch landed. The sink is the
  //      bridge: Model writes into it, and this `revision` read below is what
  //      re-derives the grid. `source` is "local" until a fetch has landed, so
  //      nothing here can tell whether the panel is online.
  QtObject {
    id: festivalSink
    property int revision: 0
    property string source: "local"

    function applyFestivalRows(nextRevision, nextSource) {
      revision = nextRevision
      source = nextSource
    }
  }

  readonly property int festivalRevision: festivalSink.revision
  readonly property string festivalSource: festivalSink.source

  // NetworkManager, not a reachability probe. A panel that fetches on the
  // strength of its own optimism would try on every offline bar, and the
  // failure is the slow path: four seconds of nothing before the same table the
  // panel could have drawn immediately.
  readonly property bool online: {
    if (Networking.backend !== NetworkBackendType.NetworkManager) return false
    const devices = Networking.devices ? Networking.devices.values : []
    for (let i = 0; i < devices.length; i++) {
      if (devices[i].connected) return true
    }
    return false
  }

  // The BS month the feed is asked for. The feed is BS-only, so an EN view's
  // Gregorian year/month have to be converted before anything can be requested.
  readonly property var feedMonth: Model.bsMonthForView(mode, { year: viewYear, month: viewMonth })

  // One request per view, not per keystroke: holding a month key walks a dozen
  // months in a second, and the feed rate-limits per minute. Debounced, because
  // the panel is also opened by a mode switch and a year step.
  function syncFestivals() {
    Model.setFestivalOnline(online)
    if (!online || !feedMonth) return
    Model.requestFestivalMonth(feedMonth.year, feedMonth.month)
  }

  // The grid carries each day's own events on every cell. `festivalRevision` is read
  // here purely as a dependency: it is what makes this binding re-derive when a
  // fetch lands rather than waiting for a month step to reveal it.
  readonly property var weeks: {
    const revision = festivalRevision
    return Model.monthGridFor(mode, { year: viewYear, month: viewMonth }, weekStart, todayKey)
  }

  // ---- Rails. The year rail measures the calendar on screen; the life rail is
  //      the memento mori, hidden until a birth year is set.
  readonly property real yearDone: Model.yearProgressFor(today, mode)
  readonly property int yearDonePercent: Math.round(yearDone * 100)
  readonly property string yearLabel: String(npMode ? todayBs.year : today.getFullYear())

  // 1996/90 is the default so the panel shows the rail it is meant to show with
  // no configuration at all; both stay overridable through the settings entry.
  readonly property int birthYear: Model.parseBirthYear(setting("birthYear", 1996), today.getFullYear())
  readonly property int age: Model.ageFromBirthYear(birthYear, today.getFullYear())
  readonly property int lifeExpectancy: Model.parseLifeExpectancy(setting("lifeExpectancy", 0))
  readonly property real lifeDone: Model.lifeProgress(age, lifeExpectancy)
  readonly property int lifeDonePercent: Model.lifeProgressPercent(age, lifeExpectancy)
  property bool editingLife: false

  // Guarded so the widget renders before the bar is injected (the bar-widget
  // contract instantiates it bare).
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  function open() {
    refresh()
    festivalSync.restart()
    root.controller.show()
    // Set after showing, not before: showing hands the popout coordinator over,
    // which closes whichever panel was open, and that close clears the shared
    // flag. Deferring means the panel taking over always wins.
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    // Dismissing mid-edit would otherwise leave the inputs up behind a closed
    // popup for the next time it opens.
    if (root.editingLife) root.cancelEditingLife()
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  // Summoning by hotkey moves no pointer, so a hover the bar was still holding
  // must not keep the center indicators revealed behind the panel.
  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && typeof root.bar.setCenterHoverRevealSuppressed === "function")
      root.bar.setCenterHoverRevealSuppressed(value)
    else if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  // Calendar mode. persistSettings is the single writer: it updates this
  // panel's copy, the host widget's copy and shell.json, so the bar label, the
  // popup and the config cannot disagree. Reached from the keyboard (E/e, N/n)
  // rather than a header control.
  function setMode(nextMode) {
    var normalized = Model.normalizeMode(nextMode)
    if (normalized === root.mode) return

    persistSettings({ language: normalized })

    // Re-anchor to the current month of the newly-selected calendar. Carrying
    // the old year/month across would land on an unrelated date.
    var view = Model.viewForDate(root.today, normalized)
    if (view) {
      root.viewYear = view.year
      root.viewMonth = view.month
    }
  }

  function refresh() {
    // Assigning `today` is enough: todayView is a binding over it and mode, so it
    // re-derives on its own. Assigning it here would write a readonly property.
    root.today = new Date()
    root.goToToday()
  }

  function goToToday() {
    if (!root.todayView) return
    root.viewYear = root.todayView.year
    root.viewMonth = root.todayView.month
  }

  // Debounce for the feed. Long enough that a mode switch and a month step in
  // quick succession collapse into one request, short enough that the panel has
  // already drawn by the time anything is expected to change.
  Timer {
    id: festivalSync
    interval: 400
    onTriggered: root.syncFestivals()
  }

  Component.onCompleted: {
    Model.setFestivalSink(festivalSink)
    // A bar that comes up already showing a month has nobody left to press a key
    // for it, so the first sync is queued here rather than on open alone.
    festivalSync.restart()
  }

  Component.onDestruction: Model.setFestivalSink(null)

  // A mode switch changes the BS month under an EN view, and a year step changes
  // it outright. Both are already bindings, so watching the derived month is
  // enough and needs no per-action hook.
  onFeedMonthChanged: if (root.opened) festivalSync.restart()

  // Step a month in whichever calendar is active. NP stepping crosses the
  // Baishakh new year inside Model; EN rolls the Gregorian year.
  function moveMonth(delta) {
    if (root.npMode) {
      var next = Model.stepMonth(viewYear, viewMonth, delta)
      root.viewYear = next.year
      root.viewMonth = next.month
    } else {
      var d = new Date(viewYear, viewMonth - 1 + delta, 1)
      root.viewYear = d.getFullYear()
      root.viewMonth = d.getMonth() + 1
    }
  }

  function moveYear(delta) {
    if (root.npMode) {
      var next = Model.stepMonth(viewYear, viewMonth, delta * 12)
      root.viewYear = next.year
      root.viewMonth = next.month
    } else {
      root.viewYear = viewYear + delta
    }
  }

  // Applied locally first so the panel redraws on the click itself; the
  // shell.json write comes back through the bar as the same value.
  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]

    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  // Week start is a persisted preference, so it goes through the same single
  // writer as everything else: the grid redraws on the click, and shell.json is
  // brought in line behind it rather than being the thing that triggers the draw.
  function setWeekStart(day) {
    var next = Model.normalizedWeekStart(day, root.weekStart)
    if (next === root.weekStart) return
    persistSettings({ weekStartDay: Model.weekStartSettingName(next) })
  }

  function toggleWeekStart() {
    setWeekStart(root.nextWeekStart)
  }

  // ---- Memento mori editing, mirroring the built-in panel's behaviour: the
  //      life rail is a shared component, so the hit target is a zero-height
  //      sibling rather than the rail itself.
  function startEditingLife() {
    root.editingLife = true
    Qt.callLater(function() {
      bornField.text = root.birthYear > 0 ? String(root.birthYear) : ""
      expectancyField.text = String(root.lifeExpectancy)
      bornField.selectAll()
      bornField.forceActiveFocus()
    })
  }

  function cancelEditingLife() {
    root.editingLife = false
    Qt.callLater(function() { if (keyCatcher) keyCatcher.forceActiveFocus() })
  }

  // Shared by both fields: Tab hops between them, Enter commits the pair,
  // Escape drops the lot.
  function handleLifeKey(event, other) {
    if (event.key === Qt.Key_Escape) {
      root.cancelEditingLife()
      event.accepted = true
    } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      root.commitLife()
      event.accepted = true
    } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
      other.selectAll()
      other.forceActiveFocus()
      event.accepted = true
    }
  }

  function clearLife() {
    if (root.birthYear <= 0) return
    persistSettings({ birthYear: 0 })
  }

  function commitLife() {
    var born = Model.parseBirthYear(bornField.text, today.getFullYear())
    var span = Model.parseLifeExpectancy(expectancyField.text)
    if (born !== root.birthYear || span !== root.lifeExpectancy)
      persistSettings({ birthYear: born, lifeExpectancy: span })
    cancelEditingLife()
  }

  // The hero: the day and month of whatever calendar is on screen. The year is
  // deliberately left to the rail beneath it, so this stays a single date rather
  // than becoming a second copy of the header.
  readonly property string heroDate: npMode
    ? (Model.monthName(todayBs.month, true) + " " + root.devanagariDay(todayBs.day))
    : Qt.formatDate(root.today, "MMMM d")

  // NP mode keeps English characters, so the day is ASCII; the helper exists so
  // the two branches cannot drift apart on shape.
  function devanagariDay(day) { return String(day) }

  // Uppercase weekday headings, short form, matching the built-in panel.
  function weekdayLabel(weekday) {
    return Model.weekdayName(weekday, true).toUpperCase()
  }

  // The rail itself. A local component rather than repeated markup, because the
  // year and life rails are the same shape and only the numbers differ.
  component ProgressRail: Item {
    id: rail
    property string label: ""
    property int percent: 0
    property real done: 0
    property bool railVisible: true
    property bool editing: false

    width: parent ? parent.width : 0
    height: railVisible ? railBlock.height : 0

    Item {
      id: railBlock
      anchors.horizontalCenter: parent.horizontalCenter
      width: gridColumn.width
      height: Math.max(railLabel.implicitHeight, Style.space(10))

      Text {
        id: railLabel
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: rail.label
        color: Qt.darker(root.contentForeground, 1.5)
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.bodySmall
        font.letterSpacing: 1
      }

      Text {
        id: railPercent
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        text: rail.percent + "%"
        color: root.contentForeground
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.bodySmall
      }

      Rectangle {
        anchors.left: railLabel.right
        anchors.right: railPercent.left
        anchors.leftMargin: Style.space(12)
        anchors.rightMargin: Style.space(12)
        anchors.verticalCenter: parent.verticalCenter
        height: Style.space(6)
        radius: Style.cornerRadius > 0 ? height / 2 : 0
        color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)

        Rectangle {
          width: Math.round(parent.width * rail.done)
          height: parent.height
          radius: parent.radius
          color: Style.selectedStateColor(root.contentForeground, Color.accent)

          Behavior on width { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
        }
      }
    }
  }

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: root.refresh()
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    // Both card dimensions are fitted to what the screen can actually give.
    // The height has to be, because it is composed from the rails, six grid
    // rows and the nav row; the width is fitted for the same reason at a base
    // size large enough that 560px of scaled spacing would no longer fit.
    // panelContent below reads its width back off contentWidth so the card
    // and its content can never disagree about how wide they are.
    contentWidth: panel.fittedContentWidth(Style.space(560))
    // The card sizes to its content rather than to a fixed height, so the two
    // rails, six grid rows and the nav row compose to whatever they need.
    contentHeight: panel.fittedContentHeight(calendarColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.editingLife
      onMoveRequested: function(dx, dy) {
        if (dx !== 0) root.moveMonth(dx)
        if (dy !== 0) root.moveYear(dy)
      }
      onActivateRequested: root.goToToday()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      // Calendar mode is keyed rather than toggled: E/e picks Gregorian and
      // N/n picks Bikram Sambat, so the key says which calendar it wants
      // instead of asking the user to remember which one they are on. Both
      // cases are matched because event.text is case-exact, and shift-L is
      // kept as an alias -- plain `l` never arrives, the key catcher above
      // spends it on move-right.
      onTextKey: function(t) {
        if (t === "[") root.moveMonth(-1)
        else if (t === "]") root.moveMonth(1)
        else if (t === "{") root.moveYear(-1)
        else if (t === "}") root.moveYear(1)
        else if (t === "t" || t === "T") root.goToToday()
        else if (t === "e" || t === "E") root.setMode(Model.MODE_EN)
        else if (t === "n" || t === "N") root.setMode(Model.MODE_NP)
        else if (t === "l" || t === "L")
          root.setMode(root.npMode ? Model.MODE_EN : Model.MODE_NP)
      }

      // The four sections stack in a Column rather than as siblings in a bare
      // Item: sibling Items all sit at y=0 and would paint over each other.
      Column {
        id: calendarColumn
        width: Math.max(panelContent.width, gridColumn.width)
        spacing: Style.space(8)

        Item {
          id: panelContent
          width: panel.contentWidth
          height: heroRow.height

          // ---- Hero: today's date for the calendar on screen, centred. Once the
          //      view has stepped back this is also the way home, so it carries
          //      the click that returns to today.
          Row {
            id: heroRow
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Style.space(22)

            Text {
              // Baseline-aligned, not centre-aligned: the glyph carries matras
              // above and below, so centring the two boxes leaves the icon
              // visibly low against the digits.
              anchors.baseline: heroDateText.baseline
              text: "󰃭"
              color: heroMouse.containsMouse
                ? Style.hoverStateColor(root.contentForeground, Color.accent)
                : root.contentForeground
              font.family: root.contentFontFamily
              // Decorative, and deliberately above the Style.font.* scale.
              font.pixelSize: root.heroIconFontSize
            }

            Text {
              id: heroDateText
              textFormat: Text.PlainText
              anchors.verticalCenter: parent.verticalCenter
              text: root.heroDate
              color: heroMouse.containsMouse
                ? Style.hoverStateColor(root.contentForeground, Color.accent)
                : root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: root.heroDateFontSize
              font.bold: true
            }
          }

          // No mode chip in the header. The calendar this panel shows is a
          // setting, not a header control: a chip row competing with the date
          // for the width the hero needs is the one thing in here that costs
          // the panel its calm. It is reachable by keyboard (E/e and N/n) and
          // over IPC, both of which land on the same setMode.

          MouseArea {
            id: heroMouse
            x: heroRow.x
            y: heroRow.y
            width: heroRow.width
            height: heroRow.height
            enabled: !root.viewingCurrentMonth
            hoverEnabled: enabled
            cursorShape: Qt.PointingHandCursor
            onClicked: root.goToToday()

            PanelToolTip {
              visible: heroMouse.containsMouse
              text: "Back to today"
              fontFamily: root.contentFontFamily
            }
          }
        }

        // ---- Year rail, doubling as the rule under the hero: a plain hairline
        //      said nothing, and whole days done over days in the year says the
        //      same thing louder.
        ProgressRail {
          label: root.yearLabel
          percent: root.yearDonePercent
          done: root.yearDone
        }

        // ---- Memento mori: the same rail measured against a nominal lifetime.
        ProgressRail {
          railVisible: root.birthYear > 0
          label: "LIFE"
          percent: root.lifeDonePercent
          done: root.lifeDone
        }

        // Editing controls for the life rail. They replace the rail while active
        // rather than sitting under it, so the band does not change height.
        Item {
          width: parent.width
          height: root.editingLife ? lifeEditRow.height : 0
          visible: root.birthYear > 0

          Row {
            id: lifeEditRow
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Style.space(10)

            Text {
              anchors.verticalCenter: parent.verticalCenter
              text: "BORN"
              color: Qt.darker(root.contentForeground, 1.5)
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              font.letterSpacing: 1
            }

            TextField {
              id: bornField
              width: Style.space(70)
              anchors.verticalCenter: parent.verticalCenter
              placeholderText: "year"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              inputMethodHints: Qt.ImhDigitsOnly

              Keys.onPressed: function(event) { root.handleLifeKey(event, expectancyField) }
            }

            Text {
              anchors.verticalCenter: parent.verticalCenter
              text: "LIVE TO"
              color: Qt.darker(root.contentForeground, 1.5)
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              font.letterSpacing: 1
            }

            TextField {
              id: expectancyField
              width: Style.space(60)
              anchors.verticalCenter: parent.verticalCenter
              placeholderText: "90"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              inputMethodHints: Qt.ImhDigitsOnly

              Keys.onPressed: function(event) { root.handleLifeKey(event, bornField) }
            }
          }
        }

        // Double-tapping the life rail opens the editor. The rail is a shared
        // component, so the hit target is a sibling rather than the rail itself.
        Item {
          width: parent.width
          height: 0

          TapHandler {
            enabled: !root.editingLife
            onDoubleTapped: root.startEditingLife()
          }
        }

        // ---- Month grid: week numbers down a gutter, a hairline, then the
        //      seven day columns. Always six rows, so the panel is exactly as
        //      tall in every month of either calendar.
        Item {
          width: parent.width
          height: gridColumn.y + gridColumn.height

          WheelHandler {
            onWheel: function(event) {
              // Horizontal wheels and touchpad side-scrolls report y === 0;
              // without this they would every one read as "next month".
              if (event.angleDelta.y === 0) return
              root.moveMonth(event.angleDelta.y > 0 ? -1 : 1)
            }
          }

          Column {
            id: gridColumn
            // The rail above is a solid rule; the grid needs room to read as its
            // own block rather than hanging off it.
            y: Style.space(18)
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: root.cellSpacing

            Row {
              id: headerRow
              spacing: root.cellSpacing

              // The week-number heading doubles as the week-start control, the same cell the
              // built-in clock uses: a heading that already sits above the week
              // numbers is the one place in the panel where "which day do weeks
              // start on" needs no new chrome to explain itself.
              Rectangle {
                id: weekStartCell
                width: root.weekColumnWidth
                height: root.headHeight
                radius: Style.cornerRadius
                color: weekStartMouse.containsMouse
                  ? Style.hoverFillFor(root.contentForeground, Color.accent)
                  : "transparent"

                Text {
                  anchors.centerIn: parent
                  text: "W"
                  color: weekStartMouse.containsMouse
                    ? Style.hoverStateColor(root.contentForeground, Color.accent)
                    : Qt.darker(root.contentForeground, 1.9)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  font.letterSpacing: 1
                  font.bold: true
                }

                MouseArea {
                  id: weekStartMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.toggleWeekStart()
                }

                PanelToolTip {
                  visible: weekStartMouse.containsMouse
                  text: "Start weeks on " + root.nextWeekStartLabel
                  fontFamily: root.contentFontFamily
                }
              }

              Item {
                width: root.gutterWidth
                height: root.headHeight
              }

              Repeater {
                model: root.weekdays

                Text {
                  textFormat: Text.PlainText
                  required property var modelData
                  width: root.cellWidth
                  height: root.headHeight
                  horizontalAlignment: Text.AlignHCenter
                  verticalAlignment: Text.AlignVCenter
                  text: root.weekdayLabel(modelData)
                  color: Qt.darker(root.contentForeground, 1.5)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  font.letterSpacing: 1
                  font.bold: true
                }
              }
            }

            Repeater {
              model: root.weeks

              Row {
                required property var modelData
                spacing: root.cellSpacing

                // ISO 8601 weeks in EN, counted from Baisakh 1 in NP. Numbered
                // from a day the row has in the month on screen, so the padding
                // rows around a short month draw blank.
                Text {
                  textFormat: Text.PlainText
                  width: root.weekColumnWidth
                  height: root.cellHeight
                  horizontalAlignment: Text.AlignHCenter
                  verticalAlignment: Text.AlignVCenter
                  text: String(Model.weekNumberForRowFor(
                    root.mode, modelData.days, root.weekStart, root.viewMonth))
                  color: Qt.darker(root.contentForeground, 1.9)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                }

                Rectangle {
                  width: 1
                  height: root.cellHeight
                  color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)
                }

                Item {
                  width: root.gutterWidth - 1
                  height: root.cellHeight
                }

                Repeater {
                  model: modelData.days

                  Rectangle {
                    id: dayCell
                    required property var modelData

                    // Both sources land here in the same shape: the transcribed
                    // gazette rows and the merged feed rows are one list, so the
                    // cell never asks which it is looking at.
                    readonly property var dayEvents: (modelData && modelData.events) ? modelData.events : []
                    readonly property bool hasHoliday: dayEvents.some(function(e) { return e.gazetted })
                    readonly property bool hasFestival: dayEvents.length > 0

                    width: root.cellWidth
                    height: root.cellHeight
                    radius: Style.cornerRadius
                    // Today is outlined, not filled: a lit-up block would shout
                    // over a grid this quiet, and the outline is what the built-in
                    // panel does.
                    color: "transparent"
                    border.width: modelData.today ? Style.spacing.hairline : 0
                    border.color: Style.normalBorderFor(root.contentForeground, Color.accent)

                    // The mark. A gazetted public holiday gets a filled accent dot
                    // and a festival an outlined one, so a day off is legible at a
                    // glance without a second colour legend to explain.
                    Rectangle {
                      id: eventMark
                      visible: dayCell.hasFestival
                      anchors.horizontalCenter: parent.horizontalCenter
                      anchors.bottom: parent.bottom
                      anchors.bottomMargin: Style.space(3)
                      width: Style.space(5)
                      height: width
                      radius: dayCell.hasHoliday ? width / 2 : 0
                      color: dayCell.hasHoliday ? Color.accent : "transparent"
                      border.width: dayCell.hasHoliday ? 0 : Math.max(1, Style.space(1))
                      border.color: Color.accent
                    }

                    Text {
                      textFormat: Text.PlainText
                      // Nudged up to clear the mark, or the dot lands under the
                      // digits and reads as part of the number.
                      anchors.centerIn: parent
                      anchors.verticalCenterOffset: dayCell.hasFestival ? -Style.space(3) : 0
                      text: String(modelData.day)
                      color: modelData.inMonth
                        ? (modelData.weekend
                          ? Qt.darker(root.contentForeground, 1.45)
                          : root.contentForeground)
                        : Qt.darker(root.contentForeground, 2.2)
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.body
                      font.bold: modelData.today
                    }

                    // The name on hover. Model.eventName picks the romanized
                    // Nepali name in NP mode, and every merged row carries that
                    // in Latin script, so neither mode can ask the bar font for a
                    // glyph it does not have.
                    HoverHandler {
                      id: dayHover
                    }

                    PanelToolTip {
                      visible: dayHover.hovered && dayCell.hasFestival
                      text: dayCell.dayEvents.map(function(e) {
                        return Model.eventName(e, root.mode)
                      }).join(", ")
                      fontFamily: root.contentFontFamily
                    }
                  }
                }
              }
            }
          }

          // Hairline down the gutter, drawn only beside the day rows so it does
          // not cut through the heading band.
          Rectangle {
            x: gridColumn.x + root.weekColumnWidth + root.cellSpacing
              + Math.round((root.gutterWidth - width) / 2)
            y: gridColumn.y + headerRow.height + gridColumn.spacing
            width: Style.spacing.hairline
            height: gridColumn.height - headerRow.height - gridColumn.spacing
            color: root.contentForeground
            opacity: 0.1
          }
        }

        // ---- Month stepping, spanning the grid it drives. The chevrons sit on
        //      the grid's outer bounds, the same edges the year rail above uses,
        //      so the row reads as the panel's other full-width rail.
        Item {
          width: parent.width
          height: monthNav.height

          Item {
            id: monthNav
            anchors.horizontalCenter: parent.horizontalCenter
            width: gridColumn.width
            height: monthLabel.implicitHeight + Style.space(10)

            Text {
              id: monthLabel
              textFormat: Text.PlainText
              anchors.horizontalCenter: parent.horizontalCenter
              anchors.verticalCenter: parent.verticalCenter
              // Inset between the chevrons rather than centred in the row, so a
              // long month name cannot collide with them.
              width: parent.width - Style.space(68)
              horizontalAlignment: Text.AlignHCenter
              elide: Text.ElideRight
              text: root.npMode
                ? (Model.monthName(root.viewMonth).toUpperCase() + " " + root.viewYear)
                : Qt.formatDate(new Date(root.viewYear, root.viewMonth - 1, 1), "MMMM yyyy").toUpperCase()
              color: Qt.darker(root.contentForeground, 1.4)
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              font.letterSpacing: 1
            }

            PanelActionButton {
              // Pulled out by the button's own padding so the glyph, not its hit
              // box, lines up with the grid edge.
              anchors.left: parent.left
              anchors.leftMargin: -Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              iconText: "‹"
              tooltipText: "Previous month"
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.moveMonth(-1)
            }

            PanelActionButton {
              anchors.right: parent.right
              anchors.rightMargin: -Style.space(8)
              anchors.verticalCenter: parent.verticalCenter
              iconText: "›"
              tooltipText: "Next month"
              foreground: root.contentForeground
              fontFamily: root.contentFontFamily
              onClicked: root.moveMonth(1)
            }
          }
        }
      }
    }
  }
}
