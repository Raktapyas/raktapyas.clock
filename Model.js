// Bikram Sambat (Nepali BS) calendar math for the raktapyas.clock bar widget.
//
// raktapyas.clock — a Bikram Sambat calendar bar widget for Omarchy, forked from
// omarchy.clock and declared as its clone in manifest.json so it takes that
// widget's place in the bar rather than sitting beside it.
// Author: raktapyas. Plugin id: raktapyas.clock.
//
// Everything here is locale- and Qt-free so it runs under node for tests; the
// QML owns layout and fonts. QLocale has no BS calendar and no Nepali locale, so
// the whole calendar comes from the month-length table below. BS months run
// Baishakh (1) to Chaitra (12) and the year rolls at Baisakh 1, not January 1,
// which is why every function takes a BS year rather than reading Date's year.
//
// The table is `bikram-sambat`'s, the dataset behind Ashesh's Nepali calendar
// (1970-01-01 BS = 1913-04-13 AD). It was picked over two other sources that
// claimed equal coverage: nakarmi23 is a day out on nearly every New Year, and
// @inicrea/bikram-sambat-core has an internally impossible 364-day year at BS
// 2096. This one matches all 14 published Nepali New Year dates checked against
// it, and is self-consistent across every year (no gaps, 365/366 only).

var MS_PER_DAY = 86400000

// 1 Baisakh 1970 BS was 13 April 1913 AD. Every conversion is a whole-day
// offset from that instant, so the two directions are exact inverses.
var EPOCH_YEAR = 1970
var EPOCH_AD_YEAR = 1913
var EPOCH_AD_MONTH = 3 // April, zero-based
var EPOCH_AD_DAY = 13
var EPOCH_UTC = Date.UTC(EPOCH_AD_YEAR, EPOCH_AD_MONTH, EPOCH_AD_DAY)

// Month lengths per BS year, indexed 0-11 for Baishakh..Chaitra. A BS year is
// 365 or 366 days and the leap day lands wherever the Calendar Determination
// Committee puts it, so nothing here can be derived from a formula -- this table
// is the calendar.
var MONTH_LENGTHS = {
  1970: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1971: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],   1972: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1973: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   1974: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1975: [31, 31, 32, 32, 30, 31, 30, 29, 30, 29, 30, 30],
  1976: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   1977: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   1978: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1979: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   1980: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   1981: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  1982: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1983: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   1984: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1985: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   1986: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1987: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1988: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   1989: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],   1990: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1991: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],   1992: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   1993: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1994: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1995: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   1996: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1997: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1998: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   1999: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],   2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2029: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2051: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],   2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2053: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2055: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2056: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2057: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2058: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2062: [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
  2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2064: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2066: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],   2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2068: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],   2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],   2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],   2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],   2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],   2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],   2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],   2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],   2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
}

var BS_YEAR_MIN = EPOCH_YEAR
var BS_YEAR_MAX = 2090

// Latin month names, Baishakh first. English script only: the reference layout
// is a Gregorian-calendar idiom, and a patro that mixes Devanagari month names
// with Latin day numbers reads as neither.
var MONTHS_LATIN = ["Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Aswin",
                    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"]

// Gregorian month names, for the dual date. January is zero-based below.
var AD_MONTHS = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"]

// Weekday names, Sunday first, matching JS Date.getDay() so a week's start can
// be handed straight through as an index. Nepali weeks begin on Sunday.
var WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
var WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
var WEEKDAYS_NARROW = ["S", "M", "T", "W", "T", "F", "S"]
var NEPALI_WEEK_START = 0

// ---- Calendar mode.
//
// The panel shows one of two calendars, not two scripts. EN is the Gregorian
// calendar; NP is Bikram Sambat. Both render in English characters and numerals
// throughout -- the mode swaps the calendar system, never the script, so the
// panel never needs a Devanagari font.
var MODE_EN = "en"
var MODE_NP = "np"
var CAL_MODES = [MODE_EN, MODE_NP]

// Anything unrecognised falls back to EN rather than rendering a blank panel.
function normalizeMode(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "").toLowerCase()
  return text === MODE_NP ? MODE_NP : MODE_EN
}

function isNpMode(value) {
  return normalizeMode(value) === MODE_NP
}

// Saturday has been a weekly public holiday in Nepal for as long as anyone
// cares; the second rest day followed on 2026-04-12 (BS 2082-12-29). Both matter
// here only as a weekend marker on the grid.
var TWO_DAY_WEEKEND_FROM_AD = "2026-04-12"

// Qt's date format has no week-number field, so a hand-written format that asks
// for `ww` would print those two letters literally. Substituting the zero-padded
// ISO week number is what lets a format string carried over from the built-in
// clock keep working here.
function isoWeekLiteral(year, monthIndex, day) {
  return pad2(isoWeekNumber(year, monthIndex, day))
}

function pad2(value) {
  var n = Number(value)
  return (n < 10 ? "0" : "") + n
}

// True when the table has data for this BS year. Outside 1970-2090 there is no
// defensible answer, so callers degrade rather than guess.
function isKnownYear(year) {
  var y = Number(year)
  return isFinite(y) && y >= BS_YEAR_MIN && y <= BS_YEAR_MAX && MONTH_LENGTHS[y] !== undefined
}

function monthLength(year, month) {
  if (!isKnownYear(year)) return 0
  var m = Number(month)
  if (!isFinite(m) || m < 1 || m > 12) return 0
  return MONTH_LENGTHS[Number(year)][m - 1]
}

function yearLength(year) {
  if (!isKnownYear(year)) return 0
  var row = MONTH_LENGTHS[Number(year)]
  var total = 0
  for (var i = 0; i < 12; i++) total += row[i]
  return total
}

// Days from the epoch to the first of this BS month.
function dayOffsetOfMonthStart(year, month) {
  if (!isKnownYear(year)) return 0
  var offset = 0
  for (var y = EPOCH_YEAR; y < Number(year); y++) offset += yearLength(y)
  for (var m = 1; m < Number(month); m++) offset += monthLength(year, m)
  return offset
}

// BS -> AD, as a UTC timestamp in ms. Returns null outside the known range so a
// caller cannot render a confident wrong date.
function bsToAd(year, month, day) {
  if (!isKnownYear(year)) return null
  var d = Number(day)
  if (!isFinite(d) || d < 1 || d > monthLength(year, month)) return null
  return EPOCH_UTC + (dayOffsetOfMonthStart(year, month) + (d - 1)) * MS_PER_DAY
}

// AD -> BS. The local date is read rather than the UTC one: "today" is the
// user's day, and near midnight UTC the two disagree for most of the world.
function adToBs(date) {
  if (!date) return null
  var utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  var remaining = Math.round((utc - EPOCH_UTC) / MS_PER_DAY)

  if (remaining < 0) return null

  var year = EPOCH_YEAR
  while (isKnownYear(year)) {
    var total = yearLength(year)
    if (remaining < total) break
    remaining -= total
    year++
  }
  if (!isKnownYear(year)) return null

  var month = 1
  while (month <= 12) {
    var len = monthLength(year, month)
    if (remaining < len) break
    remaining -= len
    month++
  }
  if (month > 12) return null

  return { year: year, month: month, day: remaining + 1 }
}

// A "day key" identifying a calendar day without dragging a Date through
// bindings. AD-backed on purpose: the grid compares against today, and today is
// whatever the system clock says it is.
function adKey(date) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
}

function keyForDate(date) {
  return adKey(date)
}

function bsKey(bs) {
  if (!bs) return ""
  return bs.year + "-" + pad2(bs.month) + "-" + pad2(bs.day)
}

// ---- Progress rails.
//
// Both rails measure a position inside a whole, and which whole depends on the
// calendar on screen: a BS year runs Baishakh to Chaitra, a Gregorian one runs
// January to December, and a rail that measured the BS year against the
// Gregorian one would be wrong in half the year. Everything here is a share in
// [0,1] of days completed over days in that year.

// Zero-based day of the BS year containing this date. Counted from the start of
// its own year rather than from the epoch, because a rail needs a position
// within the year and the epoch offset would be a number in the tens of
// thousands.
function dayOfBsYear(year, month, day) {
  if (!isKnownYear(year)) return 0
  var elapsed = Number(day) - 1
  for (var m = 1; m < Number(month); m++) elapsed += monthLength(year, m)
  return elapsed
}

// Share of the BS year gone: 1 Baisakh reads 0%, the last day of Chaitra 100%.
function yearProgressBs(bs) {
  if (!bs || !isKnownYear(bs.year)) return 0
  var total = yearLength(bs.year)
  if (total <= 0) return 0
  return clampShare(dayOfBsYear(bs.year, bs.month, bs.day) / total)
}

// Share of the Gregorian year gone, read from the local calendar date so it
// matches what the rail is showing rather than a UTC approximation.
function yearProgressGregorian(date) {
  if (!date) return 0
  var start = new Date(date.getFullYear(), 0, 1)
  var today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  var total = daysInGregorianYear(date.getFullYear())
  if (total <= 0) return 0
  return clampShare(Math.round((today - start) / MS_PER_DAY) / total)
}

function daysInGregorianYear(year) {
  var y = Number(year)
  if (!isFinite(y)) return 0
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
}

// The year rail for the calendar on screen: Gregorian in EN mode, Bikram
// Sambat in NP.
function yearProgressFor(date, mode) {
  if (isNpMode(mode)) return yearProgressBs(adToBs(date))
  return yearProgressGregorian(date)
}

function yearProgressPercentFor(date, mode) {
  return Math.round(yearProgressFor(date, mode) * 100)
}

function clampShare(value) {
  var n = Number(value)
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

// ---- Memento mori.
//
// A birth year rather than an age, so the rail keeps counting on its own
// instead of going stale the moment it is entered. The default span is a round
// number rather than anything from an actuarial table: the point of the rail is
// the reminder, not the arithmetic.

var DEFAULT_LIFE_EXPECTANCY = 90

// 0 means "not set", which is also what a blank, malformed, future, or
// implausibly distant year means.
function parseBirthYear(value, currentYear) {
  var now = Math.round(Number(currentYear))
  if (!isFinite(now)) return 0
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d{4}$/.test(text)) return 0
  var year = parseInt(text, 10)
  if (!isFinite(year) || year > now || year < now - 120) return 0
  return year
}

// Whole years, the way people say their age: born in 1996 makes you 30 for all
// of 2026, whichever side of the birthday today falls.
function ageFromBirthYear(birthYear, currentYear) {
  var born = parseBirthYear(birthYear, currentYear)
  if (born <= 0) return 0
  return Math.round(Number(currentYear)) - born
}

// Unset or nonsense falls back to the default rather than to zero, so the rail
// always has something to measure against.
function parseLifeExpectancy(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d+$/.test(text)) return DEFAULT_LIFE_EXPECTANCY
  var years = parseInt(text, 10)
  if (!isFinite(years) || years <= 0 || years > 150) return DEFAULT_LIFE_EXPECTANCY
  return years
}

function lifeProgress(age, expectancy) {
  var years = Number(age)
  var span = parseLifeExpectancy(expectancy)
  if (!isFinite(years) || years <= 0 || span <= 0) return 0
  return clampShare(years / span)
}

function lifeProgressPercent(age, expectancy) {
  return Math.round(lifeProgress(age, expectancy) * 100)
}

// ---- Naming.

// Latin month name for a 1-based BS month.
function monthName(month) {
  var m = Number(month)
  if (!isFinite(m) || m < 1 || m > 12) return ""
  return MONTHS_LATIN[m - 1]
}

function monthNameShort(month) {
  return monthName(month).substr(0, 3)
}

function weekdayName(weekday, short) {
  var d = Number(weekday)
  if (!isFinite(d) || d < 0 || d > 6) return ""
  if (short === "narrow") return WEEKDAYS_NARROW[d]
  if (short) return WEEKDAYS_SHORT[d]
  return WEEKDAYS_LONG[d]
}

// Gregorian month name for a 0-based JS month index.
function adMonthName(monthIndex) {
  var m = Number(monthIndex)
  if (!isFinite(m) || m < 0 || m > 11) return ""
  return AD_MONTHS[m]
}

// ---- Dual dates. The panel shows both calendars on one line, so the pair is
//      formatted together rather than each half guessing at the other.

// "Aswin 14, 2083" -- the BS date as a patro prints it.
function formatBs(bs) {
  if (!bs || !bs.year) return ""
  return monthName(bs.month) + " " + bs.day + ", " + bs.year
}

// "September 30, 2026" -- the Gregorian twin, from a Date or a BS date.
// Two spellings, because there are two kinds of Date in this file and reading
// the wrong set of components is a silent off-by-one.
//
// A Date built from bsToAd() sits at UTC midnight, so its UTC parts are the
// intended day -- and in a timezone behind UTC its local parts would be the day
// before. A Date handed in by the system is local: reading its UTC parts shifts
// it by a day east of Greenwich, which at UTC+5:45 is 30 September becoming the
// 29th.
function formatAdDate(date) {
  if (!date) return ""
  return adMonthName(date.getUTCMonth()) + " " + date.getUTCDate() + ", " + date.getUTCFullYear()
}

function formatAdLocal(date) {
  if (!date) return ""
  return adMonthName(date.getMonth()) + " " + date.getDate() + ", " + date.getFullYear()
}

function formatAd(dateOrBs) {
  var date = null
  var local = false
  if (dateOrBs && typeof dateOrBs.getFullYear === "function") {
    date = dateOrBs
    local = true
  } else if (dateOrBs && dateOrBs.year) {
    var ms = bsToAd(dateOrBs.year, dateOrBs.month, dateOrBs.day)
    if (ms === null) return ""
    date = new Date(ms)
  }
  if (!date) return ""
  return local
    ? adMonthName(date.getMonth()) + " " + date.getDate() + ", " + date.getFullYear()
    : adMonthName(date.getUTCMonth()) + " " + date.getUTCDate() + ", " + date.getUTCFullYear()
}

// "Sep 30" -- the compact Gregorian half, for a bar label that shows both
// calendars and cannot spare room for the year twice.
function formatAdShort(dateOrBs) {
  var date = null
  var local = false
  if (dateOrBs && typeof dateOrBs.getFullYear === "function") {
    date = dateOrBs
    local = true
  } else if (dateOrBs && dateOrBs.year) {
    var ms = bsToAd(dateOrBs.year, dateOrBs.month, dateOrBs.day)
    if (ms === null) return ""
    date = new Date(ms)
  }
  if (!date) return ""
  return local
    ? adMonthName(date.getMonth()).substr(0, 3) + " " + date.getDate()
    : adMonthName(date.getUTCMonth()).substr(0, 3) + " " + date.getUTCDate()
}

// Both halves, for the panel's dual-date header.
function formatDual(bs) {
  return { bs: formatBs(bs), ad: formatAd(bs) }
}

// "Wednesday, September 30" -- the events-list date header, which wants the
// Gregorian weekday and month with no year.
function formatHeader(date) {
  if (!date) return ""
  return weekdayName(date.getDay()) + ", " + adMonthName(date.getMonth()) + " " + date.getDate()
}

// ---- Month grid.

// Always six rows of seven days. A fixed grid keeps the panel exactly the same
// height in every BS month, so stepping through the year never makes the popup
// jump under the pointer. A BS month is 29-32 days, so six rows always fits.
function monthGrid(bsYear, bsMonth, weekStart, todayKey) {
  var year = Number(bsYear)
  var month = Number(bsMonth)
  if (!isKnownYear(year) || month < 1 || month > 12) return []

  var start = normalizeWeekStart(weekStart)
  var first = bsToAd(year, month, 1)
  if (first === null) return []

  var leading = (new Date(first).getUTCDay() - start + 7) % 7
  var cursor = new Date(first - leading * MS_PER_DAY)
  var today = String(todayKey || "")
  var weeks = []

  for (var w = 0; w < 6; w++) {
    var days = []
    for (var d = 0; d < 7; d++) {
      var cell = new Date(cursor.getTime())
      var key = adKey(cell)
      var converted = adToBs(cell)
      var weekday = cell.getUTCDay()
      days.push({
        key: key,
        bs: converted,
        day: converted ? converted.day : 0,
        weekday: weekday,
        inMonth: converted ? (converted.year === year && converted.month === month) : false,
        weekend: isWeekend(weekday, key),
        today: key === today,
        // The weekday's own events, so a grid cell can carry a dot without the
        // QML walking the whole table for every cell.
        events: converted ? eventsFor(converted) : []
      })
      cursor = new Date(cursor.getTime() + MS_PER_DAY)
    }
    weeks.push({ days: days })
  }
  return weeks
}

// Nepal moved from a Saturday-only weekend to Saturday and Sunday partway
// through 2082 BS, so "is this day a weekend" is a date question, not a
// weekday question. Before that change only Saturday counted.
// "yyyy-MM-dd" from a UTC timestamp. The BS side is keyed by BS date, the
// Gregorian side by AD date, and this is the AD key.
function isoKeyOf(ms) {
  var d = new Date(ms)
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate())
}

// ---- Gregorian grid.
//
// The EN-mode equivalent of monthGrid. Same shape -- six rows of seven, Sunday
// first, out-of-month days dimmed -- so the panel's layout code is identical in
// both modes and only the source of the numbers changes.
function gregorianGrid(year, month, weekStart, todayKey) {
  var y = Number(year)
  var m = Number(month)
  if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return []

  var start = normalizeWeekStart(weekStart)
  var first = Date.UTC(y, m - 1, 1)
  if (!isFinite(first)) return []

  // getUTCDay of the 1st gives the leading offset within the chosen week start.
  var leading = (new Date(first).getUTCDay() - start + 7) % 7
  var cursor = new Date(first - leading * MS_PER_DAY)
  var today = String(todayKey || "")
  var weeks = []

  for (var w = 0; w < 6; w++) {
    var days = []
    for (var d = 0; d < 7; d++) {
      var cell = new Date(cursor.getTime())
      var key = adKey(cell)
      var weekday = cell.getUTCDay()
      days.push({
        key: key,
        day: cell.getDate(),
        month: cell.getMonth() + 1,
        year: cell.getFullYear(),
        weekday: weekday,
        inMonth: cell.getMonth() + 1 === m && cell.getFullYear() === y,
        weekend: isWeekend(weekday, key),
        today: key === today,
        events: eventsForDate(cell, MODE_EN)
      })
      cursor = new Date(cursor.getTime() + MS_PER_DAY)
    }
    weeks.push({ days: days })
  }
  return weeks
}

// ISO 8601 week number: the week owning the Thursday of that date's week, with
// week 1 being the year that contains 4 January. Uses UTC throughout so the
// answer does not depend on the machine's timezone.
function isoWeekNumber(year, monthIndex, day) {
  var d = new Date(Date.UTC(Number(year), Number(monthIndex), Number(day)))
  var weekday = d.getUTCDay() || 7 // Sunday=0 becomes 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday)
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)
}

// The ISO week to print beside a Gregorian grid row. Read from the row's own
// cells so a row spanning two months is still numbered by the days it contains.
function isoWeekForRow(days) {
  if (!days || days.length === 0) return 0
  for (var i = 0; i < days.length; i++) {
    if (days[i] && days[i].inMonth) return isoWeekNumber(days[i].year, days[i].month - 1, days[i].day)
  }
  for (var j = 0; j < days.length; j++) {
    if (days[j]) return isoWeekNumber(days[j].year, days[j].month - 1, days[j].day)
  }
  return 0
}

function isWeekend(weekday, adKeyString) {
  if (weekday === 6) return true
  if (weekday !== 0) return false
  if (!adKeyString) return false
  return String(adKeyString) >= TWO_DAY_WEEKEND_FROM_AD
}

// Read a week start as a weekday index, or null when the value says nothing
// usable. The null is the point: it is what lets a caller tell "configured as
// Sunday" apart from "not configured", which normalizeWeekStart below cannot.
function coerceWeekStart(value) {
  if (value === undefined || value === null) return null
  if (typeof value === "number")
    return isFinite(value) ? ((Math.round(value) % 7) + 7) % 7 : null

  var text = String(value).replace(/^\s+|\s+$/g, "").toLowerCase()
  if (text === "") return null

  for (var i = 0; i < WEEKDAYS_LONG.length; i++)
    if (WEEKDAYS_LONG[i].toLowerCase().indexOf(text) === 0) return i

  var parsed = parseInt(text, 10)
  return isFinite(parsed) ? ((parsed % 7) + 7) % 7 : null
}

function normalizeWeekStart(value) {
  var coerced = coerceWeekStart(value)
  return coerced === null ? NEPALI_WEEK_START : coerced
}

// Same coercion with somewhere to fall back to, so an unset or unusable
// weekStartDay can defer to the locale instead of jumping straight to the Nepali
// default. Omitting the fallback leaves the Nepali default exactly as it was.
function normalizedWeekStart(value, fallback) {
  var coerced = coerceWeekStart(value)
  if (coerced !== null) return coerced
  var fallbackCoerced = coerceWeekStart(fallback)
  return fallbackCoerced === null ? NEPALI_WEEK_START : fallbackCoerced
}

// The name written to shell.json. Full lowercase, because that is what
// normalizeWeekStart reads back, and what another machine's config would carry.
function weekStartSettingName(index) {
  return WEEKDAYS_LONG[normalizedWeekStart(index, 1)].toLowerCase()
}

// The toggle flips between the two conventions people actually switch between.
// A calendar set to any other start (Saturday, say) is shown as-is and lands on
// Monday the first time it is toggled.
function toggledWeekStart(index) {
  return normalizedWeekStart(index, 1) === 1 ? 0 : 1
}

// Day order for the grid's header row.
function weekdayOrder(weekStart) {
  var start = normalizeWeekStart(weekStart)
  var out = []
  for (var i = 0; i < 7; i++) out.push((start + i) % 7)
  return out
}

// The week number to print beside a grid row.
//
// Week 1 is the week containing 1 Baisakh, so weeks restart with the BS year. A
// BS year is 365 or 366 days -- 52 weeks and a bit -- so the count can neither
// run continuously across the new year without inventing weeks that do not
// exist, nor restart at 1 part-way down a grid.
//
// The rule that satisfies both: number the row from the first day it has *in
// the month on screen*, read as a BS date in that day's own month. Rows holding
// no day of the displayed month get 0 and the caller draws them blank, which
// makes the padding rows around a short month read as padding instead of as a
// confusing jump back to week 2 under week 53.
//
// Each cell must be read in its own month: the leading cells of a first row
// belong to the previous month, and coercing one of their day numbers into the
// month on screen is how a gutter ends up counting 27, 24, 25, 26, 27, 23.
function weekNumberForRow(days, weekStart, inMonth) {
  if (!days || days.length === 0) return 0
  var wantMonth = Number(inMonth)
  var anchor = null

  for (var i = 0; i < days.length; i++) {
    if (!days[i].bs) continue
    if (wantMonth && (!days[i].inMonth || days[i].bs.month !== wantMonth)) continue
    anchor = days[i].bs
    break
  }
  if (!anchor) return 0

  var year = Number(anchor.year)
  var start = normalizeWeekStart(weekStart)
  var first = bsToAd(year, 1, 1)
  if (first === null) return 0
  var leading = (new Date(first).getUTCDay() - start + 7) % 7
  var target = bsToAd(year, anchor.month, anchor.day)
  if (target === null) return 0
  var days2 = Math.round((target - first) / MS_PER_DAY)
  if (days2 < 0) return 0
  return Math.floor((days2 + leading) / 7) + 1
}

// Step a BS month, carrying across the Baishakh new year. Clamps rather than
// returning null outside the table: the panel's chevrons should stop at the
// edges of what the data covers, not break.
function stepMonth(year, month, delta) {
  var index = (Number(year) - EPOCH_YEAR) * 12 + (Number(month) - 1) + Number(delta)
  var max = (BS_YEAR_MAX - EPOCH_YEAR) * 12 + 11
  if (index < 0) index = 0
  if (index > max) index = max
  return {
    year: EPOCH_YEAR + Math.floor(index / 12),
    month: (index % 12) + 1
  }
}

function stepYear(year, delta) {
  return stepMonth(year, 1, Number(delta) * 12)
}

// ---- Bar label formats. Right-clicking walks these in order and writes the
//      result back to shell.json, so the label the bar shows and the format the
//      config stores are always the same thing. The tokens are substituted before
//      anything sees the string, because none of them are Qt format specifiers.
var BAR_FORMATS = [
  { id: "classic", label: "{DATE}" },
  { id: "bs", label: "{BS_LONG}" },
  { id: "ad", label: "{AD_LONG}" },
  { id: "weekday", label: "{WEEKDAY}, {D} {MONTH}" }
]

// A vertical bar has room for a few stacked lines and nothing else, so the ring
// stays short and every entry is pre-broken.
var VERTICAL_BAR_FORMATS = [
  { id: "classic-v", label: "{DATE}\n{WEEKDAY}" },
  { id: "bs-v", label: "{BS_LONG}\n{WEEKDAY}" }
]

function barFormats(vertical) {
  return (vertical ? VERTICAL_BAR_FORMATS : BAR_FORMATS).slice()
}

// The presets in a fixed order, reduced to their ids. The order must not depend
// on which entry is current: cycling writes the result back to shell.json, and a
// ring that reshuffled itself around the current value would bounce between two
// entries instead of walking. Stringifying the object would put
// "[object Object]" in the ring, so they are reduced to ids first.
function formatRing(presets, current, alt) {
  var ring = []
  var candidates = (presets || []).concat([alt, current])
  for (var i = 0; i < candidates.length; i++) {
    var value = candidates[i]
    if (value === undefined || value === null) continue
    var id = String(typeof value === "object" ? value.id : value)
    if (id === "" || ring.indexOf(id) !== -1) continue
    ring.push(id)
  }
  return ring.length > 0 ? ring : ["classic"]
}

// Next entry after `current`. An unknown current format (a hand-written one
// that is not in the ring) starts the walk at the top.
function nextFormat(ring, current) {
  if (!ring || ring.length === 0) return ""
  var index = ring.indexOf(String(current === undefined || current === null ? "" : current))
  return ring[(index + 1) % ring.length]
}

// The label a format id renders as. A preset id resolves to its token template;
// anything else is handed back untouched, so a hand-written Qt format string in
// shell.json renders as itself instead of being silently downgraded to the first
// preset. The token replacements downstream are no-ops on a plain format string,
// which is what lets both kinds share one rendering path.
function formatById(id, vertical) {
  var presets = barFormats(vertical)
  for (var i = 0; i < presets.length; i++) if (presets[i].id === id) return presets[i].label
  var raw = String(id === undefined || id === null ? "" : id)
  return raw === "" ? presets[0].label : raw
}

// ---- Events.
//
// Static data for BS 2083 only, rebuilt from the Ministry of Home Affairs
// public-holidays notice for 2083 (Nepal Gazette, Volume 75, Number 67, Part 5,
// published 2082 Falgun 18 / 2 March 2026). The table below is what the panel
// falls back to, and the only source for a year the live feed does not answer
// for; a background sync merges extra festivals on top rather than replacing it.
//
// Each entry carries:
//   m, d      BS month and day
//   name      English name, shown in EN (Gregorian) mode
//   nameNp    Romanized Nepali name, shown in NP (Bikram Sambat) mode
//   gazetted  true for a public holiday in the gazette. Observances that the
//             gazette lists under "Nationally Observed Days When Offices
//             Remain Open", or that are cultural rather than official, are
//             false, and the panel dims them so a real day off reads differently
//             from a festival.
//
// Two deliberate omissions, both on the grounds that a wrong festival name on a
// given day is worse than a generic one:
//
//  - Dashain is labelled "Dashain" across the whole gazetted range (Aswin 31 to
//    Kartik 6) rather than per-tithi. The individual tithi names -- Phulpati,
//    Maha Ashtami, Maha Navami, Vijaya Dashami -- are derivable from Ghatasthapana
//    at Aswin 25, and the derivation checks out against both endpoints of the
//    gazette range, but they are not themselves gazetted, so a single honest
//    label is used instead. Ghatasthapana is gazetted in its own right and is
//    kept separate.
//  - Tihar is labelled "Tihar" across Kartik 22 to 26, with the two days the
//    gazette names by hand kept as additional entries on the same date: Laxmi
//    Puja on 22 and Bhai Tika on 25.
//
// Aswin 26 to 30 carry no entry. The gazette lists no holiday there, and
// inventing one would be the same error in reverse.
//
// Lunar dates (Eid, Arafat, Islamic New Year) are fixed by observation rather
// than by the solar calendar and are re-declared every year. The BS dates below
// are the ones published for 2083 by the Embassy of Nepal in Cairo.
var EVENTS = [
  // ---- Baishakh
  { m: 1, d: 1, name: "Nepali New Year", nameNp: "Nepali New Year", gazetted: true },
  { m: 1, d: 11, name: "Loktantra Diwas", nameNp: "Loktantra Diwas", gazetted: false },
  { m: 1, d: 18, name: "International Labour Day", nameNp: "Labour Day", gazetted: true },
  { m: 1, d: 18, name: "Buddha Jayanti", nameNp: "Buddha Jayanti", gazetted: true },
  { m: 1, d: 18, name: "Chandi Purnima", nameNp: "Chandi Purnima", gazetted: true },

  // ---- Jestha. Eid is lunar; dates are the Cairo embassy's for 2083.
  { m: 2, d: 12, name: "Arafat's Day", nameNp: "Arafat Din", gazetted: true, lunar: true },
  { m: 2, d: 13, name: "Eid al-Adha", nameNp: "Bakre Eid", gazetted: true, lunar: true },
  { m: 2, d: 15, name: "Republic Day", nameNp: "Republic Day", gazetted: true },
  { m: 2, d: 21, name: "Caste Discrimination Day", nameNp: "Bhimbal Kremi Bihid Din", gazetted: false },

  // ---- Ashadh
  { m: 3, d: 3, name: "Islamic New Year", nameNp: "Islamic Naya Saal", gazetted: true, lunar: true },

  // ---- Shrawan
  { m: 4, d: 7, name: "July 23 Revolution Day", nameNp: "July 23 Revolution Day", gazetted: false },

  // ---- Bhadra
  { m: 5, d: 12, name: "Raksha Bandhan", nameNp: "Raksha Bandhan", gazetted: true },
  { m: 5, d: 13, name: "Gai Jatra", nameNp: "Gai Jatra", gazetted: false },
  { m: 5, d: 19, name: "Krishna Janmashtami", nameNp: "Krishna Janmashtami", gazetted: true },
  { m: 5, d: 22, name: "Civil Service Day", nameNp: "Civil Service Day", gazetted: false },
  { m: 5, d: 23, name: "Gen-Z Martyrs' Day", nameNp: "Gen-Z Sahid Diwas", gazetted: false },
  { m: 5, d: 29, name: "Haritalika Teej", nameNp: "Haritalika Teej", gazetted: false },

  // ---- Aswin
  { m: 6, d: 3, name: "Constitution Day", nameNp: "Sambidhan Diwas", gazetted: true },
  { m: 6, d: 9, name: "Indra Jatra", nameNp: "Indra Jatra", gazetted: false },
  { m: 6, d: 10, name: "Prophet Muhammad's Birthday", nameNp: "Muhammad Jayanti", gazetted: true, lunar: true },
  { m: 6, d: 18, name: "Jitiya Parwa", nameNp: "Jitiya Parwa", gazetted: false },
  { m: 6, d: 25, name: "Ghatasthapana", nameNp: "Ghatasthapana", gazetted: true },
  // Dashain, gazetted Aswin 31 to Kartik 6, as one label across the range.
  { m: 6, d: 31, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 1, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 2, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 3, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 4, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 5, name: "Dashain", nameNp: "Dashain", gazetted: true },
  { m: 7, d: 6, name: "Dashain", nameNp: "Dashain", gazetted: true },

  // ---- Kartik. Tihar gazetted 22 to 26; the gazette names Laxmi Puja on 22
  // and Bhai Tika on 25, so those ride alongside the Tihar label.
  { m: 7, d: 22, name: "Tihar", nameNp: "Tihar", gazetted: true },
  { m: 7, d: 22, name: "Laxmi Puja", nameNp: "Laxmi Puja", gazetted: true },
  { m: 7, d: 23, name: "Tihar", nameNp: "Tihar", gazetted: true },
  { m: 7, d: 24, name: "Tihar", nameNp: "Tihar", gazetted: true },
  { m: 7, d: 25, name: "Tihar", nameNp: "Tihar", gazetted: true },
  { m: 7, d: 25, name: "Bhai Tika", nameNp: "Bhai Tika", gazetted: true },
  { m: 7, d: 25, name: "Falgunanda Jayanti", nameNp: "Falgunanda Jayanti", gazetted: false },
  { m: 7, d: 26, name: "Tihar", nameNp: "Tihar", gazetted: true },
  { m: 7, d: 29, name: "Chhath Parwa", nameNp: "Chhath Parwa", gazetted: false },

  // ---- Mangsir
  { m: 8, d: 17, name: "Day of Persons with Disabilities", nameNp: "Apangata Din", gazetted: false },

  // ---- Poush
  { m: 9, d: 9, name: "Dhanya Purnima", nameNp: "Dhanya Purnima", gazetted: true },
  { m: 9, d: 10, name: "Christmas Day", nameNp: "Christmas Day", gazetted: true },
  { m: 9, d: 15, name: "Tamu Lhosar", nameNp: "Lhosar", gazetted: true },
  { m: 9, d: 15, name: "Dura Mhepu Nakuma", nameNp: "Dura Mhepu Nakuma", gazetted: false },
  { m: 9, d: 27, name: "Prithvi Jayanti", nameNp: "Prithvi Jayanti", gazetted: true },

  // ---- Magh
  { m: 10, d: 1, name: "Maghe Sankranti", nameNp: "Maghe Sankranti", gazetted: true },
  { m: 10, d: 16, name: "Martyrs' Day", nameNp: "Sahid Diwas", gazetted: true },
  { m: 10, d: 24, name: "Sonam Lhosar", nameNp: "Sonam Lhosar", gazetted: true },
  { m: 10, d: 26, name: "Non-Resident Nepali Day", nameNp: "Prabhat Pravasi Diwas", gazetted: false },
  { m: 10, d: 28, name: "Basanta Panchami", nameNp: "Basanta Panchami", gazetted: false },

  // ---- Falgun
  { m: 11, d: 7, name: "National Democracy Day", nameNp: "Prajatantra Diwas", gazetted: true },
  { m: 11, d: 22, name: "Maha Shivaratri", nameNp: "Maha Shivaratri", gazetted: true },
  { m: 11, d: 24, name: "International Women's Day", nameNp: "Mahila Diwas", gazetted: true },
  { m: 11, d: 25, name: "Gyalpo Lhosar", nameNp: "Gyalpo Lhosar", gazetted: true },

  // ---- Chaitra. Fagu Purnima falls on 7 in the hill districts and 8 in the
  // Terai, so both carry it; Holika Dahan rides with the Terai date.
  { m: 12, d: 7, name: "Fagu Purnima", nameNp: "Fagu Purnima", gazetted: true },
  { m: 12, d: 8, name: "Fagu Purnima", nameNp: "Fagu Purnima", gazetted: true },
  { m: 12, d: 8, name: "Holika Dahan", nameNp: "Holika Dahan", gazetted: true },
  { m: 12, d: 23, name: "Ghode Jatra", nameNp: "Ghode Jatra", gazetted: false }
]

// The table is BS 2083. Anything outside that year has no events rather than
// events borrowed from the wrong year, so a future date shows an honest empty
// list instead of last year's festivals landing on the wrong day.
var EVENTS_YEAR = 2083

// Event name for the given calendar mode. Both modes render in English
// characters; NP mode uses the romanized Nepali name so the panel reads like a
// patro without switching script.
function eventName(event, mode) {
  if (!event) return ""
  return normalizeMode(mode) === MODE_NP && event.nameNp ? event.nameNp : event.name
}

// ---------------------------------------------------------------- remote sync
//
// The gazette table above is one BS year, transcribed. A live feed carries every
// year, and festivals the table never had, so the panel asks for the month it is
// showing and merges whatever arrives on top. Everything here is additive and
// every failure path is a no-op: the overlay stays empty, the table keeps
// serving, and nothing on screen moves. A calendar that goes blank because a
// wifi handshake was slow is worse than one a fortnight out of date.
//
// The transport is injectable so the routing below is testable without a socket.
// Under node there is no XMLHttpRequest at all, so the suite lands on the local
// branch and exercises exactly the path it did before.

var FESTIVAL_ENDPOINT = "https://pradipsubedi1.com.np/api/patro.php"

// Long enough for a cold TLS handshake on a slow link, short enough that a
// wedged router is forgotten before the user looks at the panel again.
var FESTIVAL_TIMEOUT_MS = 4000

// Keyed "2083-01-01". Kept separate from EVENTS on purpose: the tests assert
// against EVENTS as a static table, and a background fetch must never be able to
// edit what they read.
var festivalOverlay = {}
var festivalRevisionCounter = 0
var festivalSourceName = "local"
var festivalSinkObject = null
var festivalTransportOverride = null
var festivalOnline = true
var festivalInFlight = null
var festivalQueued = null
var festivalUnionCache = null

// The transport, or null where there is none. XMLHttpRequest is a global in the
// QML engine -- verified against a live request, including from inside a .js
// resource import, which is how this file is consumed -- and absent in node,
// which is the whole reason the local branch is reachable rather than
// hypothetical.
function festivalTransport() {
  if (festivalTransportOverride) return festivalTransportOverride
  if (typeof XMLHttpRequest !== "undefined") return XMLHttpRequest
  return null
}

function setFestivalTransport(transport) {
  festivalTransportOverride = transport || null
}

function setFestivalOnline(value) {
  festivalOnline = !!value
}

function festivalRevision() {
  return festivalRevisionCounter
}

function festivalSource() {
  return festivalSourceName
}

// Plain JS carries no Qt notify signal, so a binding that read Model state
// directly would never re-evaluate when a fetch landed. QML registers a sink
// object and this is the one place that reaches into it; the sink holds the
// result in real QML properties, and that assignment is what wakes the bindings.
function setFestivalSink(sink) {
  festivalSinkObject = sink || null
}

function notifyFestivalSink() {
  var sink = festivalSinkObject
  if (!sink || typeof sink.applyFestivalRows !== "function") return
  try {
    sink.applyFestivalRows(festivalRevisionCounter, festivalSourceName)
  } catch (e) {
    // A sink that throws must not take the calendar down with it.
  }
}

function normalizeEventTitle(title) {
  return String(title === undefined || title === null ? "" : title)
    .replace(/^\s+|\s+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function bsKeyOfEvent(event) {
  return String(event.year) + "-" + pad2(event.m) + "-" + pad2(event.d)
}

// One row out of the feed. Only `title` is taken: the feed's `title_np` is
// Devanagari, and this widget renders both modes in Latin script on purpose, so
// a Devanagari name would be the one string on the panel the bar font cannot
// draw.
function normalizeRemoteRow(item, gazetted) {
  if (!item) return null
  var parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(item.bs_date || ""))
  if (!parts) return null
  var name = String(item.title === undefined || item.title === null ? "" : item.title)
    .replace(/^\s+|\s+$/g, "")
  if (!name) return null
  return {
    year: parseInt(parts[1], 10),
    m: parseInt(parts[2], 10),
    d: parseInt(parts[3], 10),
    name: name,
    nameNp: name,
    gazetted: !!gazetted
  }
}

// Accepts the decoded object or the raw body, because the fake transport in the
// tests hands over an object and the real one hands over text. A 200 carrying
// `success:false` -- which is what an out-of-range BS year gets -- is not data.
function parseRemoteMonth(payload) {
  var body = payload
  if (typeof body === "string") {
    try {
      body = JSON.parse(body)
    } catch (e) {
      return { ok: false, rows: [] }
    }
  }
  if (!body || typeof body !== "object") return { ok: false, rows: [] }
  if (body.success === false) return { ok: false, rows: [] }

  var data = body.data || {}
  var lists = [
    { source: data.festivals, gazetted: false },
    { source: data.holidays, gazetted: true }
  ]
  var rows = []

  for (var l = 0; l < lists.length; l++) {
    var items = lists[l].source
    if (!items || typeof items.length !== "number") continue
    for (var i = 0; i < items.length; i++) {
      var row = normalizeRemoteRow(items[i], lists[l].gazetted)
      if (row) rows.push(row)
    }
  }

  return { ok: true, rows: rows, year: data.bs_year, month: data.bs_month }
}

// Feed and table merged, keyed by BS date. Feed rows are admitted first so a live
// spelling wins, but a date present in both keeps its table rows too: the
// gazette list here is longer than the feed's holiday list, and treating the
// feed as authoritative for a whole month would quietly drop Labour Day and
// Chandi Purnima from a Baisakh the feed had answered for.
function rebuildFestivalUnion() {
  var index = {}
  var seen = {}

  function admit(row) {
    var key = bsKeyOfEvent(row)
    var mark = key + "|" + normalizeEventTitle(row.name)
    if (seen[mark]) return
    seen[mark] = true
    if (!index[key]) index[key] = []
    index[key].push(row)
  }

  var overlayKeys = []
  for (var k in festivalOverlay) {
    if (Object.prototype.hasOwnProperty.call(festivalOverlay, k)) overlayKeys.push(k)
  }
  for (var o = 0; o < overlayKeys.length; o++) {
    var remote = festivalOverlay[overlayKeys[o]]
    for (var r = 0; r < remote.length; r++) admit(remote[r])
  }

  for (var e = 0; e < EVENTS.length; e++) {
    var local = EVENTS[e]
    admit({
      year: EVENTS_YEAR,
      m: local.m,
      d: local.d,
      name: local.name,
      nameNp: local.nameNp,
      gazetted: local.gazetted
    })
  }

  return index
}

function festivalUnion() {
  if (!festivalUnionCache) festivalUnionCache = rebuildFestivalUnion()
  return festivalUnionCache
}

function applyFestivalRows(rows) {
  if (!rows || typeof rows.length !== "number" || rows.length === 0) return false

  for (var i = 0; i < rows.length; i++) {
    var key = bsKeyOfEvent(rows[i])
    if (!festivalOverlay[key]) festivalOverlay[key] = []
    festivalOverlay[key].push(rows[i])
  }

  festivalUnionCache = null
  festivalRevisionCounter++
  festivalSourceName = "remote"
  notifyFestivalSink()
  return true
}

// Back to the transcribed table alone. Nothing on the panel calls this; it is
// here so the suite can leave the model the way it found it, and so an offline
// affordance has something to call.
function clearFestivalOverlay() {
  festivalOverlay = {}
  festivalUnionCache = null
  festivalRevisionCounter++
  festivalSourceName = "local"
  notifyFestivalSink()
}

// Ask for one BS month. True when a request actually went out.
//
// Four guards, each a silent no-op by design: no transport (node), no network,
// one already in flight, or a year/month that is not a month.
function requestFestivalMonth(year, month) {
  var y = Math.round(Number(year))
  var m = Math.round(Number(month))
  if (!isFinite(y) || m < 1 || m > 12) return false

  var transport = festivalTransport()
  if (!transport) return false
  if (!festivalOnline) return false

  if (festivalInFlight) {
    // One request at a time. Holding a month key would otherwise put the feed
    // over its rate limit fetching months the user has already scrolled past.
    festivalQueued = { year: y, month: m }
    return false
  }

  sendFestivalRequest(transport, y, m)
  return true
}

function sendFestivalRequest(transport, year, month) {
  festivalInFlight = { year: year, month: month }

  // A timeout and a readystatechange can both land for one request, so settling
  // is latched rather than counted.
  var settled = false
  function settle() {
    if (settled) return
    settled = true
    festivalInFlight = null

    var queued = festivalQueued
    festivalQueued = null
    if (queued) {
      var next = festivalTransport()
      if (next) sendFestivalRequest(next, queued.year, queued.month)
    }
  }

  var xhr
  try {
    xhr = new transport()
  } catch (e) {
    settle()
    return
  }

  try {
    xhr.open("GET", FESTIVAL_ENDPOINT + "?action=month&year=" + year + "&month=" + month, true)
    xhr.timeout = FESTIVAL_TIMEOUT_MS
  } catch (e) {
    settle()
    return
  }

  xhr.onreadystatechange = function() {
    // 4 is XMLHttpRequest.DONE in every engine this runs on. Spelled as a
    // literal so the fake transport in the tests need not carry the constant.
    if (xhr.readyState === 4 && xhr.status === 200) {
      var parsed = parseRemoteMonth(xhr.responseText)
      if (parsed.ok) applyFestivalRows(parsed.rows)
    }
    settle()
  }
  xhr.onerror = function() { settle() }
  xhr.ontimeout = function() { settle() }

  try {
    xhr.send()
  } catch (e) {
    settle()
  }
}

// The BS month a view is showing. The feed is BS-only, so an EN view -- whose
// year and month are Gregorian -- has to be converted before it can be asked for
// anything. Mid-month is the probe date: a first-of-month conversion can land
// either side of the boundary and ask for the wrong month entirely.
function bsMonthForView(mode, view) {
  if (!view) return null
  if (isNpMode(mode)) return { year: Number(view.year), month: Number(view.month) }

  var y = Number(view.year)
  var m = Number(view.month)
  if (!isFinite(y) || m < 1 || m > 12) return null

  var converted = adToBs(new Date(Date.UTC(y, m - 1, 15)))
  if (!converted) return null
  return { year: converted.year, month: converted.month }
}

// Events for a BS date. Each row in the union carries its own year, so a year
// the table has never heard of can answer as long as the feed supplied it, and a
// year neither knows is still honestly empty.
function eventsFor(bs) {
  if (!bs) return []
  var y = Math.round(Number(bs.year))
  var m = Math.round(Number(bs.month))
  var d = Math.round(Number(bs.day))
  if (!isFinite(y) || m < 1 || m > 12) return []
  return festivalUnion()[y + "-" + pad2(m) + "-" + pad2(d)] || []
}

// Events for a calendar date in either mode. Both modes go through the BS date
// now that the union is keyed by it: bsToAd and adToBs are exact inverses across
// the table's own years, so the Gregorian index this replaced answered with the
// same rows, and one key is one lookup whether a row came from the feed or the
// gazette.
function eventsForDate(date, mode) {
  if (!date) return []
  return eventsFor(adToBs(date))
}

function hasEvent(date, mode) {
  return eventsForDate(date, mode).length > 0
}

// Events on or after a date, in calendar order, each carrying the days from
// that date so the caller can show "in 3 days" without recomputing. Used when
// the day being read has nothing on it: a list that is empty two days running is
// the common case, and an empty panel says nothing, whereas the next few things
// coming up is what a person actually wants to know.
function upcomingEvents(date, mode, limit) {
  var isNp = normalizeMode(mode) === MODE_NP
  var startMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  var startBs = isNp ? adToBs(date) : null
  var union = festivalUnion()
  var out = []

  // Every row in the union, in BS order. Walking the union rather than EVENTS is
  // what lets a feed month reach this list at all -- and because each row
  // carries its own year, NP mode filters on the year the view is actually in
  // instead of the one year the table happened to cover.
  var rows = []
  for (var key in union) {
    if (!Object.prototype.hasOwnProperty.call(union, key)) continue
    var dayRows = union[key]
    for (var n = 0; n < dayRows.length; n++) rows.push(dayRows[n])
  }

  for (var i = 0; i < rows.length; i++) {
    var e = rows[i]
    var eventMs
    if (isNp) {
      // NP mode walks BS dates directly: the view may be a BS year nothing here
      // has an AD index for.
      if (startBs && Number(e.year) === Number(startBs.year)) {
        if (e.m < startBs.month) continue
        if (e.m === startBs.month && e.d < startBs.day) continue
      } else if (startBs && Number(e.year) !== Number(startBs.year)) {
        continue
      }
      eventMs = bsToAd(e.year, e.m, e.d)
      if (eventMs === null) continue
      if (eventMs < startMs) continue
    } else {
      eventMs = bsToAd(e.year, e.m, e.d)
      if (eventMs === null || eventMs < startMs) continue
    }

    out.push({
      name: eventName(e, isNp ? MODE_NP : MODE_EN),
      nameEn: e.name,
      nameNp: e.nameNp,
      kind: e.gazetted ? "holiday" : "festival",
      gazetted: e.gazetted,
      month: e.m,
      day: e.d,
      year: e.year,
      inDays: Math.round((eventMs - startMs) / MS_PER_DAY)
    })
  }

  out.sort(function(a, b) {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    if (a.day !== b.day) return a.day - b.day
    return a.name < b.name ? -1 : 1
  })
  return typeof limit === "number" ? out.slice(0, limit) : out
}


// ---- Mode-aware accessors.
//
// The panel calls these and never branches on the mode itself, so the two
// calendars stay side by side in one layout path instead of two copies of it.

// The month name for a 1-based month of whichever calendar is active.
function monthNameFor(mode, month) {
  return isNpMode(mode) ? monthName(month) : adMonthName(Number(month) - 1)
}

// The six-week grid for the active calendar. `view` is {year, month} with a
// 1-based month in both cases.
function monthGridFor(mode, view, weekStart, todayKey) {
  if (isNpMode(mode)) return monthGrid(view.year, view.month, weekStart, todayKey)
  return gregorianGrid(view.year, view.month, weekStart, todayKey)
}

// The week number to print in the gutter: ISO 8601 in EN, counted from Baisakh 1
// in NP. A BS month number is meaningful only in NP and a Gregorian one only in
// EN, so the mode decides which to ask for.
function weekNumberForRowFor(mode, days, weekStart, month) {
  if (isNpMode(mode)) return weekNumberForRow(days, weekStart, month)
  return isoWeekForRow(days)
}

// The single date the header and the bar label show: the Gregorian date in EN
// mode, the Bikram Sambat date in NP. Never both.
function formatPrimaryDate(date, mode) {
  if (!date) return ""
  if (isNpMode(mode)) {
    var bs = adToBs(date)
    return bs ? formatBs(bs) : ""
  }
  return formatAdLocal(date)
}

// "Wednesday, September 30" -- the events-list heading, following the mode.
function formatListHeading(date, mode) {
  if (!date) return ""
  if (isNpMode(mode)) {
    var bs = adToBs(date)
    return bs ? (Model_weekday(bs, date) + ", " + formatBs(bs)) : ""
  }
  return formatHeader(date)
}

function Model_weekday(bs, date) {
  return weekdayName(date.getDay())
}

// The view a mode should show for a given day: "today" in that calendar.
function viewForDate(date, mode) {
  if (isNpMode(mode)) {
    var bs = adToBs(date)
    if (!bs) return null
    return { year: bs.year, month: bs.month, day: bs.day }
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

if (typeof module !== "undefined") {
  module.exports = {
    MS_PER_DAY: MS_PER_DAY,
    EPOCH_YEAR: EPOCH_YEAR,
    EPOCH_UTC: EPOCH_UTC,
    BS_YEAR_MIN: BS_YEAR_MIN,
    BS_YEAR_MAX: BS_YEAR_MAX,
    MONTHS_LATIN: MONTHS_LATIN,
    AD_MONTHS: AD_MONTHS,
    WEEKDAYS_LONG: WEEKDAYS_LONG,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,
    NEPALI_WEEK_START: NEPALI_WEEK_START,
    MODE_EN: MODE_EN,
    MODE_NP: MODE_NP,
    CAL_MODES: CAL_MODES,
    TWO_DAY_WEEKEND_FROM_AD: TWO_DAY_WEEKEND_FROM_AD,
    EVENTS: EVENTS,
    EVENTS_YEAR: EVENTS_YEAR,
    pad2: pad2,
    isKnownYear: isKnownYear,
    monthLength: monthLength,
    yearLength: yearLength,
    dayOffsetOfMonthStart: dayOffsetOfMonthStart,
    bsToAd: bsToAd,
    adToBs: adToBs,
    adKey: adKey,
    keyForDate: keyForDate,
    bsKey: bsKey,
    monthName: monthName,
    monthNameShort: monthNameShort,
    weekdayName: weekdayName,
    adMonthName: adMonthName,
    formatBs: formatBs,
    formatAd: formatAd,
    formatAdShort: formatAdShort,
    formatDual: formatDual,
    formatHeader: formatHeader,
    monthGrid: monthGrid,
    isWeekend: isWeekend,
    normalizeMode: normalizeMode,
    isNpMode: isNpMode,
    isoKeyOf: isoKeyOf,
    gregorianGrid: gregorianGrid,
    isoWeekNumber: isoWeekNumber,
    isoWeekForRow: isoWeekForRow,
    dayOfBsYear: dayOfBsYear,
    yearProgressBs: yearProgressBs,
    yearProgressGregorian: yearProgressGregorian,
    yearProgressFor: yearProgressFor,
    yearProgressPercentFor: yearProgressPercentFor,
    daysInGregorianYear: daysInGregorianYear,
    DEFAULT_LIFE_EXPECTANCY: DEFAULT_LIFE_EXPECTANCY,
    parseBirthYear: parseBirthYear,
    ageFromBirthYear: ageFromBirthYear,
    parseLifeExpectancy: parseLifeExpectancy,
    lifeProgress: lifeProgress,
    lifeProgressPercent: lifeProgressPercent,
    monthNameFor: monthNameFor,
    monthGridFor: monthGridFor,
    weekNumberForRowFor: weekNumberForRowFor,
    formatPrimaryDate: formatPrimaryDate,
    formatAdDate: formatAdDate,
    formatAdLocal: formatAdLocal,
    formatListHeading: formatListHeading,
    viewForDate: viewForDate,
    normalizeWeekStart: normalizeWeekStart,
    normalizedWeekStart: normalizedWeekStart,
    weekStartSettingName: weekStartSettingName,
    toggledWeekStart: toggledWeekStart,
    isoWeekLiteral: isoWeekLiteral,
    weekdayOrder: weekdayOrder,
    weekNumberForRow: weekNumberForRow,
    stepMonth: stepMonth,
    stepYear: stepYear,
    barFormats: barFormats,
    formatRing: formatRing,
    nextFormat: nextFormat,
    formatById: formatById,
    eventName: eventName,
    eventsFor: eventsFor,
    hasEvent: hasEvent,
    eventsForDate: eventsForDate,
    upcomingEvents: upcomingEvents,
    FESTIVAL_ENDPOINT: FESTIVAL_ENDPOINT,
    FESTIVAL_TIMEOUT_MS: FESTIVAL_TIMEOUT_MS,
    setFestivalTransport: setFestivalTransport,
    setFestivalOnline: setFestivalOnline,
    setFestivalSink: setFestivalSink,
    requestFestivalMonth: requestFestivalMonth,
    bsMonthForView: bsMonthForView,
    parseRemoteMonth: parseRemoteMonth,
    applyFestivalRows: applyFestivalRows,
    clearFestivalOverlay: clearFestivalOverlay,
    festivalRevision: festivalRevision,
    festivalSource: festivalSource
  }
}
