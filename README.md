# raktapyas.clock

A Bikram Sambat (Nepali BS) calendar for the [Omarchy](https://omarchy.org/) bar.

- **Plugin id** — `raktapyas.clock`
- **Version** — 0.2.0
- **Author** — raktapyas
- **Forked from** — `omarchy.clock`, declared via `omarchy.clonedFrom`

The bar shows the current date in whichever calendar you have selected. Click it to
open a month popup with the full grid; the panel also tracks two progress rails —
how much of the year is gone, and how much of a nominal lifetime — and marks
public holidays and festivals on their days.

Both calendars render in Latin script. Bikram Sambat is the calendar system, not
the writing system, so the widget never needs a Devanagari face and the bar label
stays in your bar font.

### It replaces the built-in clock, it does not sit beside it

This is a fork of `omarchy.clock`, and the manifest says so:

```json
"omarchy": { "clonedFrom": "omarchy.clock" }
```

That one field is what makes the swap behave correctly:

- Enabling it **takes over the built-in clock's place in the bar**, cloning that
  widget's settings (`format`, `formatAlt`, `birthYear`, `lifeExpectancy`) onto
  its own entry. The built-in clock comes off the bar, so there is one date, not
  two.
- Existing callers keep using the built-in id. `SUPER+CTRL+ALT+D` still runs
  `omarchy-shell shell toggle omarchy.clock`, and the shell resolves that to the
  enabled clone — **no keybinding needs changing.**
- `omarchy plugin disable raktapyas.clock` switches back to the built-in source.

### Mouse

| Input | Action |
| --- | --- |
| **Left click** | Open / close the panel. Works identically in **both** Gregorian and Bikram Sambat mode. |
| **Middle click** | Open the timezone picker |
| **Right click** | Cycle the label format |
| Hover the **`W`** heading | Click it to switch the week start day (Sunday ⇄ Monday) |

---

## Hotkeys

The panel is keyboard-driven. **Keys only act while the panel is open and holds
focus**, and every key is suppressed while the life-rail year fields are being
edited, so typing `1996` cannot change the calendar.

### Calendar and navigation

| Key | Action |
| --- | --- |
| **`E`** / **`e`** | Switch to the **Gregorian** calendar |
| **`N`** / **`n`** | Switch to the **Bikram Sambat** calendar |
| `L` | Toggle between the two |
| `[` / `]` | Previous / next month |
| `{` / `}` | Previous / next year |
| `T` / `t` | Back to today |
| `↓` / `j` · `↑` / `k` | Next / previous month |
| `→` · `←` | Next / previous year |
| `Return` · `Space` | Activate — returns to today |
| `Esc` | Close the panel |
| `Tab` / `Shift`+`Tab` | Move to the next / previous panel |

The mode keys say which calendar you want rather than asking you to remember
which one you are on. Both cases are accepted, so `Shift`+`E` and `e` do the same
thing. Pressing the key for the mode already showing does nothing.

> **Note on `l`:** plain `l` is bound to *next year*, so it never reaches the mode
> toggle. Only `Shift`+`L` toggles.

### IPC

The panel answers on the `raktapyas.clock` target:

```sh
qs ipc -i <shell-instance> call raktapyas.clock toggle
qs ipc -i <shell-instance> call raktapyas.clock setMode np
qs ipc -i <shell-instance> call raktapyas.clock toggleWeekStart
qs ipc -i <shell-instance> call raktapyas.clock cycleFormat
```

### Label formats

`format` and `formatAlt` each accept either one of this widget's preset ids —

| id | renders |
| --- | --- |
| `classic` | today's date in the active calendar |
| `bs` | the full Bikram Sambat date |
| `ad` | the full Gregorian date |
| `weekday` | weekday and day-of-month |

— **or any plain Qt date format string**, which is how a format carried over from
the built-in clock (`dddd HH:mm`, `d MMMM 'W'ww yyyy`) keeps working here. An
unrecognised value is rendered as a Qt format rather than being silently
downgraded, and `ww` is resolved as the zero-padded ISO week number, which Qt
does not provide. Right-clicking cycles the presets and both configured formats.

## Theme-derived fluid layout

The panel hardcodes no colours, no font sizes and no pixel dimensions. Every value
comes from the active Omarchy theme, so a theme switch changes the panel without
any code involved.

**Geometry.** Every dimension is expressed through `Style.space(px)`, which
resolves to:

```
px × (spacingScale × fontScale)      fontScale = max(1/12, baseSize / 12)
```

Because `spacingScaleWithFont` defaults to `true`, **spacing tracks your font
size by default** — a larger base size makes the panel roomier as well as larger,
with every ratio preserved. The day cells (52×34), the week-number column (32),
the gutter (14) and the card width (560) are all `space()` calls rather than
literals.

**Type.** Every `font.pixelSize` is a `Style.font.*` token. Each token is built as
`fontToken(key, fontPx(mult))`, so a theme can pin any individual size and the
rest still scale from the base.

The hero date is deliberately the one element *above* that scale — it is the
panel's display element — but it is scaled off the same base size by the same
function:

```
heroIconFontSize  = Style.fontPx(4)       → 48px at base 12
heroDateFontSize  = Style.fontPx(4.333)   → 52px at base 12
```

Deriving it rather than hardcoding 48/52 is what keeps the date from being
stranded at a fixed pixel size on a theme with much larger type.

**Colour.** Nothing is hardcoded. The foreground traces `bar.foreground →
Color.bar.text`; the accent is `Color.accent`; state colours come from
`Style.hoverStateColor`, `Style.selectedStateColor` and `Style.normalBorderFor`;
hierarchy tints are `Qt.darker` / `Qt.rgba` derivations of the themed foreground.
The single literal in the file is `"transparent"`, used for the fill of today's
cell — theme-independent by definition. The card's own background and border are
supplied by the shell's `KeyboardPanel` (`Color.popups.background`,
`Border.surfaceSpec("popups", …)`), so they follow the theme too.

Two more tokens are read live from your compositor rather than the theme:
`cornerRadius` mirrors Hyprland's `decoration:rounding` and `gapsOut` mirrors
`general:gaps_out`. Change either in `hyprland.conf` and the panel follows.

**Fitting.** The card is clamped through `fittedContentWidth` and
`fittedContentHeight`, so a very large base size shrinks the card instead of
letting it run off the screen. The card's content reads its width back off that
clamped value, so the two can never disagree.

> On the stock Quattro shell the defaults are `base-size = 12` and
> `spacing.scale = 1.0` with `scale-with-font = true`, which makes `Style.space(px)`
> literally equal to `px`.

## Background sync and offline fallback

Festival names and public-holiday marks are transcribed for BS 2083 from the
Nepal Gazette. The panel also refreshes that data from a live feed in the
background, and **falls back to the transcribed table on any failure whatsoever.**

The sequence, in order:

1. **Resolve the month.** The feed is BS-only, so an English view — whose year and
   month are Gregorian — is converted first. The probe date is mid-month: a
   first-of-month conversion can land either side of the boundary and ask for the
   wrong month.
2. **Check connectivity** from NetworkManager. A panel that fetched on the
   strength of its own optimism would retry on every offline bar, and the failure
   is the slow path — a timeout before the table the panel could have drawn
   immediately.
3. **Four guards**, each a silent no-op: an impossible year/month, no transport
   available, no network, or a request already in flight. The last case *coalesces*
   into a single queued follow-up rather than queueing every month you scroll past.
4. **Request** one BS month with a 4-second timeout. Only one request is ever in
   flight, and the panel debounces by 400ms so a mode switch and a month step in
   quick succession collapse into one call.
5. **Merge.** Rows are keyed by BS date and deduplicated by normalized title. Feed
   rows are admitted first, but the transcribed rows for the same date are kept
   too — the merge is additive, never authoritative, because the feed's holiday
   list for a month is shorter than the gazette's. The revision counter bumps and
   the grid re-derives once.

Every other outcome is a **no-op with no visible consequence**:

| Outcome | Result |
| --- | --- |
| HTTP 400 / out-of-range year | unchanged |
| `success: false` in a 200 body | unchanged |
| Malformed or empty body | unchanged |
| Dropped socket | unchanged |
| Timeout | unchanged |

In all of these the overlay stays empty, the source stays `local`, the transcribed
table keeps serving, and **nothing on screen moves**. A calendar that goes blank
because a wifi handshake was slow is worse than one a fortnight out of date. The
fetch is additive and never removes data it already has.

The feed rate-limits to 120 requests per minute per IP, comfortably above the one
request per view change this plugin makes.

### Data sources

| What | Where it comes from |
| --- | --- |
| BS month-length table | `bikram-sambat` (the dataset behind Ashesh's Nepali calendar) |
| Festival & holiday table, BS 2083 | Nepal Gazette, Volume 75, Number 67, Part 5, plus the Embassy of Nepal in Cairo for the lunar dates |
| Live festival refresh | `pradipsubedi1.com.np` |

## Development

```sh
node --test test/            # 193 tests
omarchy plugin validate .    # manifest against the plugin schema
```

`Model.js` is deliberately free of Qt and of any network at import time, so the
whole suite runs under plain node. The remote-sync paths are driven through an
injected transport rather than a socket, which means the routing, the merge and
every failure branch are covered hermetically — no network, no clock, no flakes.

The panel itself can be previewed without touching a live bar. Quickshell takes a
single import path, so the shell's modules are symlinked in beside a stub
`shell.qml`:

```sh
mkdir -p /tmp/panel-preview && cd /tmp/panel-preview
ln -s /usr/share/omarchy/shell/{Commons,Ui} .
ln -s ~/Projects/raktapyas.clock/{Panel.qml,Model.js} .
# then a shell.qml that hosts Panel.qml in a PanelWindow, with a stub QtObject
# standing in for the bar's `bar` and `anchorItem` properties
qs -p /tmp/panel-preview/shell.qml
```

The anchor window is a transparent `WlrLayer.Background` surface, so the preview
never steals a click, a hover or focus from your real bar. Set
`RAKTAPYAS_PREVIEW_BASE_SIZE=20` to drive the base size inside the preview
process alone — never `shell.toml` — and check the fluid layout at a larger font.

## Installing for development

The supported installer only clones from git, so a local checkout is linked in
instead. The shell's plugin scan follows symlinks, so this is a real install:

```sh
ln -s ~/Projects/raktapyas.clock ~/.config/omarchy/plugins/raktapyas.clock
omarchy-shell shell rescanPlugins
omarchy plugin enable raktapyas.clock     # no placement argument
```

**No placement argument** is the part that matters: it is what triggers the
in-place takeover of the built-in clock's bar entry and the copying of its
settings. Passing `--section` would bypass that and put a second date on the bar.

Because your project directory *is* the installed plugin, edits take effect after
`omarchy restart shell`. Quickshell's file watcher is disabled for the shell, and
the registry's own watcher only sees writes inside `~/.config/omarchy/plugins`, so
a restart is the reload.

```sh
omarchy plugin remove raktapyas.clock --yes   # unlinks only, and restores the built-in clock
```

`omarchy update` does not conflict with this. The migrations that reference
`omarchy.clock` have all already run, so they never re-run, and `omarchy-bar put`
has an explicit fallback that retries without a `--after` neighbour it cannot
find — which is what would happen if a future migration anchored on the built-in id.

### Files

| File | Role |
| --- | --- |
| `manifest.json` | Plugin manifest — id, name, entry points, `clonedFrom` |
| `BarWidget.qml` | The bar label, format cycling, and the panel host |
| `Panel.qml` | The month popup: hero, rails, grid, navigation |
| `Model.js` | All calendar math, festival data and remote sync |
| `test/Model.test.js` | Test suite |
