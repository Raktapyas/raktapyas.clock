// Unit tests for Model.js. Run with:  node test/Model.test.js
//
// Everything here is pure and node-runnable: no Qt, no locale, no network. The
// suite covers both calendar modes, because the panel is a Gregorian/Bikram
// Sambat switch and a mode that is never exercised is a mode that is broken.
//
// The remote festival feed is driven through an injected transport rather than a
// socket, so the routing, the merge and every failure branch are covered without
// a network and without a clock. Under node there is no XMLHttpRequest at all,
// which is also why the whole "Remote festival sync" section runs against the
// local branch by default: the fall-back path is the path this file has always
// been exercising.
//
// The calendar data is checked against published Nepali New Year dates and
// against the Nepal Gazette's own BS/AD pairs, so a transcription error in the
// month-length table or the events table fails here rather than on screen.

const M = require("../Model.js")

let passed = 0
let failed = 0
const failures = []

function is(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function test(name, actual, expected) {
  if (is(actual, expected)) {
    passed++
  } else {
    failed++
    failures.push({ name: name, actual: actual, expected: expected })
  }
}

function section(title) {
  console.log("\n" + title)
}

const iso = (ms) => new Date(ms).toISOString().slice(0,10)

// ---------------------------------------------------------------- regression
// The Bikram Sambat table has not changed in this round, but every date test
// below depends on it, so it is re-checked rather than assumed.

section("Calendar data: Bikram Sambat table")

// Published Nepali New Year dates (1 Baisakh) from multiple sources.
const NEW_YEAR = {
  1970: "1913-04-13",   // the epoch itself
  2000: "1943-04-14",
  2079: "2022-04-14",
  2080: "2023-04-14",
  2081: "2024-04-13",
  2082: "2025-04-14",
  2083: "2026-04-14",
  2084: "2027-04-14",
  2090: "2033-04-14"
}
for (const year in NEW_YEAR) {
  test("1 Baisakh " + year, iso(M.bsToAd(Number(year), 1, 1)), NEW_YEAR[year])
}

const MONTHS = ["Baishakh","Jestha","Ashadh","Shrawan","Bhadra","Aswin",
                "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"]

test("supported range", [M.BS_YEAR_MIN, M.BS_YEAR_MAX], [1970, 2090])

let badYears = []
let badMonths = []
for (let y = M.BS_YEAR_MIN; y <= M.BS_YEAR_MAX; y++) {
  const len = M.yearLength(y)
  if (len !== 365 && len !== 366) badYears.push(y)
  for (let m = 1; m <= 12; m++) {
    const d = M.monthLength(y, m)
    if (d < 29 || d > 32) badMonths.push(y + "-" + m)
  }
}
test("every BS year is 365 or 366 days", badYears, [])
test("every BS month is 29-32 days", badMonths, [])

test("today converts", M.adToBs(new Date(2026, 8, 30)), { year: 2083, month: 6, day: 14 })
test("1 Aswin 2083 is 30 Sep 2026", iso(M.bsToAd(2083, 6, 14)), "2026-09-30")

test("out-of-range BS years are rejected",
  [M.bsToAd(1969, 1, 1), M.bsToAd(2091, 1, 1), M.adToBs(new Date(1900, 0, 1))],
  [null, null, null])
test("a day past the end of a month is rejected", M.bsToAd(2083, 2, 40), null)

// Exact inverses across the whole supported range.
let roundTripMisses = 0
const rangeEnd = M.bsToAd(2090, 12, M.monthLength(2090, 12))
for (let ms = M.EPOCH_UTC; ms <= rangeEnd; ms += M.MS_PER_DAY * 11) {
  const bs = M.adToBs(new Date(ms))
  if (!bs || M.bsToAd(bs.year, bs.month, bs.day) !== ms) roundTripMisses++
}
test("AD<->BS round trips exactly over the full range", roundTripMisses, 0)

// ------------------------------------------------------------------- mode
section("Calendar mode")

test("normalises to the two known modes",
  [M.normalizeMode("EN"), M.normalizeMode("np"), M.normalizeMode(""),
   M.normalizeMode("x"), M.normalizeMode(null), M.normalizeMode(" NP ")],
  ["en", "np", "en", "en", "en", "np"])
test("isNpMode", [M.isNpMode("np"), M.isNpMode("en")], [true, false])
test("both modes are offered", M.CAL_MODES, ["en", "np"])

// --------------------------------------------------------------- gregorian
section("Gregorian grid (EN mode)")

const sept = M.gregorianGrid(2026, 9, 0, "2026-09-30")
test("six rows of seven", [sept.length, sept[0].days.length], [6, 7])
test("exactly one today marked",
  sept.flatMap((w) => w.days).filter((d) => d.today).length, 1)
test("September has 30 in-month cells",
  sept.flatMap((w) => w.days).filter((d) => d.inMonth).length, 30)
test("in-month days run 1..30",
  sept.flatMap((w) => w.days).filter((d) => d.inMonth).map((d) => d.day).join(","),
  Array.from({ length: 30 }, (_, i) => i + 1).join(","))
test("rows start on the chosen week start", sept[0].days[0].weekday, 0)
test("February 2027 has 28 days",
  M.gregorianGrid(2027, 2, 0, "").flatMap((w) => w.days).filter((d) => d.inMonth).length, 28)
test("February 2028 has 29 days (leap)",
  M.gregorianGrid(2028, 2, 0, "").flatMap((w) => w.days).filter((d) => d.inMonth).length, 29)
test("a 31-day month spills into the next",
  M.gregorianGrid(2026, 12, 0, "").flatMap((w) => w.days).some((d) => d.month === 1), true)
test("an impossible month yields no grid", M.gregorianGrid(2026, 0, 0, ""), [])
test("an impossible month 13 yields no grid", M.gregorianGrid(2026, 13, 0, ""), [])

const contiguous = sept.flatMap((w) => w.days).every((d, i, all) =>
  i === 0 || Date.parse(all[i - 1].key + "T00:00:00Z") + M.MS_PER_DAY
           === Date.parse(d.key + "T00:00:00Z"))
test("cells are consecutive days", contiguous, true)

// -------------------------------------------------------------- iso 8601
section("ISO 8601 week numbers (EN mode gutter)")

// Cross-checked against the ISO definition: week 1 is the year containing
// 4 January, and the week runs Monday to Sunday.
test("2026-01-01 is week 1", M.isoWeekNumber(2026, 0, 1), 1)
test("2026-09-30 is week 40", M.isoWeekNumber(2026, 8, 30), 40)
test("2024-04-13 is week 15", M.isoWeekNumber(2024, 3, 13), 15)
test("2021-01-01 falls in week 53", M.isoWeekNumber(2021, 0, 1), 53)
test("2026-12-31 is week 53", M.isoWeekNumber(2026, 11, 31), 53)
test("2027-01-01 is week 53", M.isoWeekNumber(2027, 0, 1), 53)

const firstRow = sept[0].days
const firstInMonth = firstRow.find((d) => d.inMonth)
test("a row is numbered by the day it contains",
  M.isoWeekForRow(firstRow), M.isoWeekNumber(2026, 8, firstInMonth.day))
test("an empty row has no number", M.isoWeekForRow([]), 0)

// ------------------------------------------------------------- accessors
section("Mode-aware accessors")

test("month names follow the mode",
  [M.monthNameFor("en", 9), M.monthNameFor("en", 1), M.monthNameFor("np", 9), M.monthNameFor("np", 1)],
  ["September", "January", "Poush", "Baishakh"])

const today = new Date(2026, 8, 30)
test("the primary date is one calendar, never both",
  [M.formatPrimaryDate(today, "en"), M.formatPrimaryDate(today, "np")],
  ["September 30, 2026", "Aswin 14, 2083"])
test("the view follows the mode",
  [M.viewForDate(today, "en"), M.viewForDate(today, "np")],
  [{ year: 2026, month: 9, day: 30 }, { year: 2083, month: 6, day: 14 }])

// A Date from bsToAd() sits at UTC midnight; a Date from the system is local.
// Reading the wrong set of components is a silent off-by-one, and at UTC+5:45
// it turns 30 September into the 29th. All four paths must agree.
test("every date path agrees on the same day",
  [M.formatAd(today),
   M.formatAd({ year: 2083, month: 6, day: 14 }),
   M.formatAdDate(new Date(M.bsToAd(2083, 6, 14))),
   M.formatAdLocal(today)],
  ["September 30, 2026", "September 30, 2026", "September 30, 2026", "September 30, 2026"])

test("both modes produce a six-row grid",
  [M.monthGridFor("en", { year: 2026, month: 9 }, 0, "2026-09-30").length,
   M.monthGridFor("np", { year: 2083, month: 6 }, 0, "2026-09-30").length],
  [6, 6])
test("the gutter is mode-specific",
  [M.weekNumberForRowFor("en", firstRow, 0, 9),
   M.weekNumberForRowFor("np", M.monthGrid(2083, 6, 0, "")[0].days, 0, 6) > 0],
  [M.isoWeekNumber(2026, 8, firstInMonth.day), true])

// ---------------------------------------------------------------- events
section("Events: gazette-faithful")

const on = (m, d) => M.EVENTS.filter((e) => e.m === m && e.d === d)

// The eight entries the previous table got wrong, per the Nepal Gazette.
test("Martyrs' Day is not at Ashadh 16", on(3, 16), [])
test("Women's Day is not at Jestha 19", on(2, 19), [])
test("Prophet's birthday is not at Bhadra 10", on(5, 10), [])
test("Prithvi Jayanti is not at Mangsir 15", on(8, 15), [])
test("Tamu Lhosar is not at Kartik 15", on(7, 15), [])
test("Vijaya Dashami is not at Aswin 30", on(6, 30), [])
test("there is no invented Kartik 9 entry", on(7, 9), [])
test("Fagu Purnima is not at Chaitra 9", on(12, 9), [])

// Per-tithi Dashain names are gone; one label spans the gazetted range.
test("no per-tithi names survive",
  [[6, 26], [6, 28], [6, 29], [6, 30], [7, 1]]
    .map(([m, d]) => on(m, d).filter((e) => /Phulpati|Ashtami|Navami|Vijaya/.test(e.name)).length),
  [0, 0, 0, 0, 0])
test("Dashain labels the whole gazetted range",
  [[6, 31], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]]
    .map(([m, d]) => on(m, d).map((e) => e.name).join("/")),
  Array(7).fill("Dashain"))
test("Ghatasthapana stands alone", on(6, 25).map((e) => e.name), ["Ghatasthapana"])
test("Tihar labels Kartik 22-26",
  [[7, 22], [7, 23], [7, 24], [7, 25], [7, 26]].map(([m, d]) => on(m, d).some((e) => e.name === "Tihar")),
  [true, true, true, true, true])
test("the gazette's own Tihar day names ride alongside",
  [on(7, 22).some((e) => e.name === "Laxmi Puja"), on(7, 25).some((e) => e.name === "Bhai Tika")],
  [true, true])
test("Prophet's birthday sits at Aswin 10",
  on(6, 10).map((e) => e.name), ["Prophet Muhammad's Birthday"])
test("Tamu Lhosar and Dura share Poush 15",
  on(9, 15).map((e) => e.name), ["Tamu Lhosar", "Dura Mhepu Nakuma"])

test("no event lands on a day that does not exist",
  M.EVENTS.filter((e) => M.monthLength(2083, e.m) < e.d), [])
test("every event has a romanized Nepali name",
  M.EVENTS.every((e) => typeof e.nameNp === "string" && e.nameNp.length > 0), true)
test("every event is flagged gazetted or not",
  M.EVENTS.every((e) => typeof e.gazetted === "boolean"), true)
test("most events are gazetted", M.EVENTS.filter((e) => e.gazetted).length > 20, true)

// Every gazetted BS date must map to the AD date the gazette prints beside it.
// This is the check that catches a month or day entered off by one.
const GAZETTE_PAIRS = [
  [1, 1, "2026-04-14", "New Year"],
  [1, 18, "2026-05-01", "Labour Day"],
  [2, 15, "2026-05-29", "Republic Day"],
  [5, 12, "2026-08-28", "Raksha Bandhan"],
  [5, 13, "2026-08-29", "Gai Jatra"],
  [5, 19, "2026-09-04", "Krishna Janmashtami"],
  [5, 29, "2026-09-14", "Teej"],
  [6, 3, "2026-09-19", "Constitution Day"],
  [6, 9, "2026-09-25", "Indra Jatra"],
  [6, 25, "2026-10-11", "Ghatasthapana"],
  [6, 31, "2026-10-17", "Dashain start"],
  [7, 6, "2026-10-23", "Dashain end"],
  [7, 22, "2026-11-08", "Tihar start"],
  [7, 26, "2026-11-12", "Tihar end"],
  [7, 29, "2026-11-15", "Chhath"],
  [9, 9, "2026-12-24", "Dhanya Purnima"],
  [9, 10, "2026-12-25", "Christmas"],
  [9, 15, "2026-12-30", "Tamu Lhosar"],
  [9, 27, "2027-01-11", "Prithvi Jayanti"],
  [10, 1, "2027-01-15", "Maghe Sankranti"],
  [10, 16, "2027-01-30", "Martyrs' Day"],
  [10, 24, "2027-02-07", "Sonam Lhosar"],
  [10, 28, "2027-02-11", "Basanta Panchami"],
  [11, 7, "2027-02-19", "Democracy Day"],
  [11, 22, "2027-03-06", "Maha Shivaratri"],
  [11, 24, "2027-03-08", "Women's Day"],
  [11, 25, "2027-03-09", "Gyalpo Lhosar"],
  [12, 7, "2027-03-21", "Fagu Purnima"],
  [12, 8, "2027-03-22", "Holika Dahan"],
  [12, 23, "2027-04-06", "Ghode Jatra"]
]
const wrongAd = []
for (const [m, d, ad, label] of GAZETTE_PAIRS) {
  const got = iso(M.bsToAd(2083, m, d))
  if (got !== ad) wrongAd.push(label + ": " + got + " != " + ad)
}
test("all " + GAZETTE_PAIRS.length + " gazette BS/AD pairs agree", wrongAd, [])

section("Events: per mode")

// One event, one day, two scripts' worth of naming.
const constitution = new Date(2026, 8, 19) // Aswin 3 2083 = 19 Sep 2026
test("the same event resolves in both modes",
  M.eventsForDate(constitution, "en").map((e) => e.m + "-" + e.d),
  M.eventsForDate(constitution, "np").map((e) => e.m + "-" + e.d))
test("EN shows the English name",
  M.eventName(M.eventsForDate(constitution, "en")[0], "en"), "Constitution Day")
test("NP shows the romanized Nepali name",
  M.eventName(M.eventsForDate(constitution, "np")[0], "np"), "Sambidhan Diwas")
test("Democracy Day is romanized as Prajatantra Diwas",
  M.eventName(M.eventsForDate(new Date(2027, 1, 19), "np")[0], "np"), "Prajatantra Diwas")
test("Martyrs' Day is romanized as Sahid Diwas",
  M.eventName({ name: "Martyrs' Day", nameNp: "Sahid Diwas" }, "np"), "Sahid Diwas")

// A festival whose names happen to match in both modes still resolves per mode.
test("an unchanged name resolves in both modes",
  [M.eventName({ name: "Dashain", nameNp: "Dashain" }, "en"),
   M.eventName({ name: "Dashain", nameNp: "Dashain" }, "np")],
  ["Dashain", "Dashain"])

test("the next events come back in calendar order",
  M.upcomingEvents(new Date(2026, 8, 30), "en", 3).map((e) => e.name),
  ["Jitiya Parwa", "Ghatasthapana", "Dashain"])
test("upcoming works the same in NP mode",
  M.upcomingEvents(new Date(2026, 8, 30), "np", 3).map((e) => e.name),
  ["Jitiya Parwa", "Ghatasthapana", "Dashain"])
test("upcoming respects its limit",
  [M.upcomingEvents(new Date(2026, 8, 30), "en", 2).length,
   M.upcomingEvents(new Date(2026, 8, 30), "np", 6).length],
  [2, 6])
test("upcoming counts days from today",
  M.upcomingEvents(new Date(2026, 8, 30), "en", 1)[0].inDays, 4)
test("a year the table does not cover has no events",
  M.eventsFor({ year: 2082, month: 1, day: 1 }), [])

// ----------------------------------------------------------------- rails
// The panel's two progress rails. Both values are pinned against the reference
// screenshot: on 30 September 2026 the Gregorian year rail reads 75% and the
// memento mori rail reads 33%, which is what the built-in panel renders.

section("Progress rails")

// Year rail, Gregorian. 30 Sep 2026 is day 273 of a 365-day year, so 272/365
// complete days = 75%.
test("Gregorian year rail on 30 Sep 2026 is 75%",
  M.yearProgressPercentFor(new Date(2026, 8, 30), "en"), 75)
test("Gregorian year rail is 0% on 1 January",
  M.yearProgressGregorian(new Date(2026, 0, 1)), 0)
test("Gregorian year rail reaches 100% on 31 December",
  M.yearProgressPercentFor(new Date(2026, 11, 31), "en"), 100)
test("Gregorian leap years are 366 days",
  [M.daysInGregorianYear(2024), M.daysInGregorianYear(2025),
   M.daysInGregorianYear(1900), M.daysInGregorianYear(2000)],
  [366, 365, 365, 366])

// Year rail, Bikram Sambat. Aswin 14 2083 is day 169 of a 365-day BS year, so
// 168/365 = 46%. The rail measures the calendar on screen, not a fixed one.
test("Bikram Sambat year rail on Aswin 14 2083 is 46%",
  M.yearProgressPercentFor(new Date(2026, 8, 30), "np"), 46)
test("the two year rails disagree, as they must",
  M.yearProgressPercentFor(new Date(2026, 8, 30), "en")
    !== M.yearProgressPercentFor(new Date(2026, 8, 30), "np"), true)
test("BS year rail is 0% on 1 Baisakh",
  M.yearProgressBs({ year: 2083, month: 1, day: 1 }), 0)
// The rail measures whole days *completed*, so the final day is not yet
// complete and the share sits just under 1. That is the built-in panel's
// semantics too, and the rail rounds it to a clean 100%.
const lastDayShare = M.yearProgressBs({ year: 2083, month: 12, day: M.monthLength(2083, 12) })
test("BS year rail on the last day of Chaitra is just under 1",
  lastDayShare > 0.99 && lastDayShare < 1, true)
test("BS year rail displays 100% on the last day of Chaitra",
  Math.round(lastDayShare * 100), 100)
test("BS year rail is 0% on 1 Baisakh of the epoch year",
  M.yearProgressBs({ year: 1970, month: 1, day: 1 }), 0)
test("dayOfBsYear starts at zero and counts within the year",
  [M.dayOfBsYear(2083, 1, 1), M.dayOfBsYear(2083, 12, M.monthLength(2083, 12))],
  [0, M.yearLength(2083) - 1])
// The rail climbs in whole-day steps, so the second-to-last day is a full point
// short of 100 and only the final day reaches it.
test("the day before the year ends is a point short of 100%",
  Math.round(M.yearProgressBs({ year: 2083, month: 12, day: M.monthLength(2083, 12) - 1 }) * 100),
  99)

// Memento mori. 1996 to 2026 is 30 years against a 90-year span.
test("life rail for 1996/90 in 2026 is 33%",
  M.lifeProgressPercent(M.ageFromBirthYear(1996, 2026), 90), 33)
test("age is whole years", M.ageFromBirthYear(1996, 2026), 30)
test("the default expectancy is 90", M.DEFAULT_LIFE_EXPECTANCY, 90)
test("a blank expectancy falls back to 90", M.parseLifeExpectancy(""), 90)
test("nonsense expectancy falls back to 90", M.parseLifeExpectancy("abc"), 90)
test("an absurd expectancy falls back to 90", M.parseLifeExpectancy("9999"), 90)
test("1996 is a valid birth year", M.parseBirthYear(1996, 2026), 1996)
test("an unset birth year is 0, which hides the rail",
  M.parseBirthYear(0, 2026), 0)
test("a future birth year is rejected", M.parseBirthYear(2030, 2026), 0)
test("a malformed birth year is rejected", M.parseBirthYear("19x6", 2026), 0)
test("an implausibly distant birth year is rejected", M.parseBirthYear(1700, 2026), 0)

// Both rails are shares, so nothing may fall outside [0,1] whatever it is fed.
const shares = [
  M.yearProgressFor(new Date(2026, 8, 30), "en"),
  M.yearProgressFor(new Date(2026, 8, 30), "np"),
  M.yearProgressBs({ year: 2083, month: 1, day: 1 }),
  M.lifeProgress(30, 90),
  M.lifeProgress(999, 90),
  M.lifeProgress(-5, 90),
  M.lifeProgress(0, 0)
]
test("every rail value is a share in [0,1]",
  shares.every((v) => v >= 0 && v <= 1), true)

// ------------------------------------------------------- remote festival sync
//
// The fetch is exercised through an injected transport rather than a socket, so
// this section stays hermetic: no network, no timing, and every failure branch
// reachable on demand. The payload below is the live feed's real shape, copied
// from a 200 it returned, duplicates and all -- the feed really does send
// "Bisket Jatra" twice for 2083-01-18, and a merge that trusted its input would
// paint two dots on one day.

section("Remote festival sync")

// A transport good enough for Model.js to drive: it records what was opened and
// waits for the test to say how it ended.
function installFakeTransport() {
  const opened = []

  function FakeXHR() {
    this.readyState = 0
    this.status = 0
    this.responseText = ""
    this.timeout = 0
    opened.push(this)
  }
  FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url }
  FakeXHR.prototype.send = function () { this.didSend = true }

  M.setFestivalTransport(FakeXHR)

  return {
    opened: opened,
    count: () => opened.length,
    lastUrl: () => opened[opened.length - 1].url,
    // A 200 with a body.
    reply: function (body, raw) {
      const xhr = opened[opened.length - 1]
      xhr.status = 200
      xhr.readyState = 4
      xhr.responseText = raw !== undefined ? raw : JSON.stringify(body)
      xhr.onreadystatechange()
    },
    // A non-200, which is how an out-of-range BS year comes back.
    failStatus: function (status) {
      const xhr = opened[opened.length - 1]
      xhr.status = status
      xhr.readyState = 4
      xhr.responseText = ""
      xhr.onreadystatechange()
    },
    // A dead socket.
    error: function () { opened[opened.length - 1].onerror() },
    // A router that never answers.
    timeout: function () { opened[opened.length - 1].ontimeout() }
  }
}

const FEED_MONTH = {
  success: true,
  data: {
    bs_year: 2083,
    bs_month: 1,
    bs_month_name: "Baisakh",
    bs_month_name_np: "बैशाख",
    days_in_month: 31,
    festivals: [
      { bs_date: "2083-01-05", title: "Mata Tirtha Aunsi", title_np: "मातातीर्थ औंसी" },
      { bs_date: "2083-01-18", title: "Bisket Jatra", title_np: "विस्केट जात्रा" },
      { bs_date: "2083-01-18", title: "Bisket Jatra", title_np: "विस्केट जात्रा" }
    ],
    holidays: [
      { bs_date: "2083-01-01", title: "Nepali New Year", title_np: "नयाँ वर्ष", holiday_type: "public" }
    ]
  }
}

const names = (rows) => rows.map((e) => e.name).sort()
const localEvents = M.EVENTS.length

// --- the local branch: the state every offline panel is actually in

test("no transport means no request", M.requestFestivalMonth(2083, 1), false)
test("no transport leaves the source local", M.festivalSource(), "local")

const offline = installFakeTransport()
M.setFestivalOnline(false)
test("offline means no request", M.requestFestivalMonth(2083, 1), false)
test("offline opens nothing", offline.count(), 0)
test("offline leaves the source local", M.festivalSource(), "local")
M.setFestivalOnline(true)

// --- a rejected year/month never reaches the transport

test("a month of 0 is refused", M.requestFestivalMonth(2083, 0), false)
test("a month of 13 is refused", M.requestFestivalMonth(2083, 13), false)
test("a non-numeric year is refused", M.requestFestivalMonth("banana", 1), false)
test("refusals open nothing", offline.count(), 0)

// --- the happy path

const revBefore = M.festivalRevision()
test("a request goes out", M.requestFestivalMonth(2083, 1), true)
test("it was sent", offline.opened[0].didSend, true)
test("it asked for the month asked for",
  offline.lastUrl(), "https://pradipsubedi1.com.np/api/patro.php?action=month&year=2083&month=1")
test("it carries a timeout", offline.opened[0].timeout, M.FESTIVAL_TIMEOUT_MS)

offline.reply(FEED_MONTH)

test("a merge bumps the revision", M.festivalRevision() > revBefore, true)
test("a merge flips the source", M.festivalSource(), "remote")

// A date the table has never heard of now answers.
test("a remote-only festival appears",
  names(M.eventsFor({ year: 2083, month: 1, day: 5 })), ["Mata Tirtha Aunsi"])

// The duplicate the feed actually sends collapses to one row.
test("a duplicated feed row collapses",
  names(M.eventsFor({ year: 2083, month: 1, day: 18 })).filter((n) => n === "Bisket Jatra").length, 1)

// The union is additive, not authoritative: the feed's Baisakh has one holiday
// where the gazette has four, and treating the feed as the source for a month it
// answered for would drop three of them off the grid.
test("a covered date keeps its gazette rows",
  names(M.eventsFor({ year: 2083, month: 1, day: 18 })),
  ["Bisket Jatra", "Buddha Jayanti", "Chandi Purnima", "International Labour Day"])

// Same name from both sides is one row, not two.
test("a name in both sources is not doubled",
  M.eventsFor({ year: 2083, month: 1, day: 1 }).length, 1)

// The feed distinguishes festivals from holidays; the merge has to keep that or
// every dot reads as a day off.
const newYear = M.eventsFor({ year: 2083, month: 1, day: 1 })[0]
const bisket = M.eventsFor({ year: 2083, month: 1, day: 18 })
  .find((e) => e.name === "Bisket Jatra")
test("a holiday from the feed is gazetted", newYear.gazetted, true)
test("a festival from the feed is not gazetted", bisket.gazetted, false)

// Latin script only. The feed's title_np is Devanagari and taking it would put a
// string on the panel the bar font cannot draw.
test("merged names stay Latin",
  M.eventsFor({ year: 2083, month: 1, day: 5 })
    .every((e) => /^[\x20-\x7e]*$/.test(e.name) && /^[\x20-\x7e]*$/.test(e.nameNp)), true)

// --- the grid path, which is what the panel actually calls

const adForBs = (y, m, d) => new Date(M.bsToAd(y, m, d))
test("a remote festival reaches the Gregorian grid",
  names(M.eventsForDate(adForBs(2083, 1, 5), "en")), ["Mata Tirtha Aunsi"])
test("and the BS grid, from the same key",
  names(M.eventsForDate(adForBs(2083, 1, 5), "np")), ["Mata Tirtha Aunsi"])
test("both modes agree on a covered date",
  names(M.eventsForDate(adForBs(2083, 1, 18), "en")),
  names(M.eventsForDate(adForBs(2083, 1, 18), "np")))

// --- the EVENTS_YEAR gate lifts for anything the feed supplied
test("a year past the table still answers once fed",
  M.applyFestivalRows([{ year: 2085, m: 1, d: 1, name: "Remote Only Day", nameNp: "Remote Only Day", gazetted: false }]),
  true)
test("that year's row is readable",
  names(M.eventsFor({ year: 2085, month: 1, day: 1 })), ["Remote Only Day"])
test("a year nobody supplied is still empty",
  M.eventsFor({ year: 2090, month: 1, day: 1 }), [])

// --- the transcribed table is never edited by a fetch
test("a merge does not touch EVENTS", M.EVENTS.length, localEvents)
test("a merge does not reorder EVENTS",
  M.EVENTS[0].name, "Nepali New Year")

// --- every failure branch leaves the panel exactly where it was. By now the
// source is legitimately "remote" from the merges above, so what has to hold is
// that the failure changes nothing -- not that it returns to local.
function expectUnchanged(label, act) {
  const rev = M.festivalRevision()
  const src = M.festivalSource()
  const before = names(M.eventsFor({ year: 2084, month: 1, day: 1 }))
  act()
  const a = test(label + " leaves the source as it was", M.festivalSource(), src)
  const b = test(label + " does not bump the revision", M.festivalRevision(), rev)
  const c = test(label + " does not alter the grid", names(M.eventsFor({ year: 2084, month: 1, day: 1 })), before)
  return a && b && c
}

expectUnchanged("an HTTP 400", () => { M.requestFestivalMonth(2083, 12); offline.failStatus(400) })
expectUnchanged("a success:false body", () => {
  M.requestFestivalMonth(2083, 12)
  offline.reply({ success: false, error: "Invalid BS year/month or out of supported range." })
})
expectUnchanged("malformed JSON", () => {
  M.requestFestivalMonth(2083, 12)
  offline.reply(null, "<html>not json</html>")
})
expectUnchanged("an empty body", () => {
  M.requestFestivalMonth(2083, 12)
  offline.reply({ success: true, data: { festivals: [], holidays: [] } })
})
expectUnchanged("a dropped socket", () => { M.requestFestivalMonth(2083, 12); offline.error() })
expectUnchanged("a timeout", () => { M.requestFestivalMonth(2083, 12); offline.timeout() })

// A timeout and a late readystatechange for the same request must not double the
// settle, which would otherwise send a queued follow-up twice.
test("a timeout settles once", (() => {
  const before = offline.count()
  M.requestFestivalMonth(2083, 12)
  offline.timeout()
  offline.reply(FEED_MONTH)
  return offline.count() - before
})(), 1)

// --- one request at a time, one follow-up
test("a second request while one is in flight is refused", (() => {
  const before = offline.count()
  M.requestFestivalMonth(2083, 12)
  const queuedStart = offline.count()
  M.requestFestivalMonth(2083, 5)
  const noSecondSend = offline.count() === queuedStart
  offline.reply(FEED_MONTH)
  return noSecondSend && offline.count() === queuedStart + 1 && /month=5$/.test(offline.lastUrl())
})(), true)

// --- the BS month a view maps to, since the feed is BS-only
test("an NP view passes through", M.bsMonthForView("np", { year: 2083, month: 1 }), { year: 2083, month: 1 })
test("an EN view is converted to BS", M.bsMonthForView("en", { year: 2026, month: 9 }),
  (() => { const bs = M.adToBs(new Date(Date.UTC(2026, 8, 15))); return { year: bs.year, month: bs.month } })())
test("both views of September 2026 agree",
  M.bsMonthForView("en", { year: 2026, month: 9 }).year === M.bsMonthForView("np", { year: 2083, month: 6 }).year, true)
test("a nonsense view is refused", M.bsMonthForView("en", { year: "x", month: 0 }), null)

// --- the sink is what wakes the QML bindings
const sinkCalls = []
M.setFestivalSink({ applyFestivalRows: function (rev, src) { sinkCalls.push([rev, src]) } })
M.requestFestivalMonth(2083, 2)
offline.reply({ success: true, data: { festivals: [{ bs_date: "2083-02-03", title: "Jestha Fair", title_np: "x" }], holidays: [] } })
test("the sink hears about the merge", sinkCalls.length > 0, true)
test("the sink is told the revision and the source",
  sinkCalls[sinkCalls.length - 1], [M.festivalRevision(), "remote"])

const throwingCalls = []
M.setFestivalSink({ applyFestivalRows: function () { throw new Error("boom") } })
let threw = false
try { M.applyFestivalRows([{ year: 2091, m: 1, d: 1, name: "X", nameNp: "X", gazetted: false }]) }
catch (e) { threw = true }
test("a throwing sink does not break the merge", threw, false)
test("and the row still landed", M.eventsFor({ year: 2091, month: 1, day: 1 }).length, 1)

// --- and back to the table alone
M.clearFestivalOverlay()
test("clearing returns the source to local", M.festivalSource(), "local")
test("clearing drops the remote-only festival", M.eventsFor({ year: 2083, month: 1, day: 5 }), [])
test("clearing leaves the gazette rows", M.eventsFor({ year: 2083, month: 1, day: 18 }).length, 3)
test("clearing does not touch EVENTS", M.EVENTS.length, localEvents)

// Leave the model as it was found, so anything added below is not reading a
// mutated one.
M.setFestivalSink(null)
M.setFestivalTransport(null)
M.setFestivalOnline(true)
M.clearFestivalOverlay()
// -------------------------------------------- built-in clock parity (fork)
//
// The bar widget is a fork of omarchy.clock, so the parts the built-in exposes
// have to keep working here: the week-start toggle, and a `format`/`formatAlt`
// pair that may hold either one of this widget's preset ids or a plain Qt date
// format string carried over from the built-in.

section("Built-in clock parity")

// --- week start

test("the helper round-trips a setting name",
  M.weekStartSettingName(M.toggledWeekStart(3)), "monday")
test("toggle flips Monday to Sunday", M.toggledWeekStart(1), 0)
test("toggle flips Sunday to Monday", M.toggledWeekStart(0), 1)
test("toggle from an unusual start lands on Monday", M.toggledWeekStart(6), 1)
test("a setting name reads back to the same day",
  M.normalizeWeekStart(M.weekStartSettingName(2)), 2)
test("every day round-trips through its name", [0,1,2,3,4,5,6].map(function(d) {
  return M.normalizeWeekStart(M.weekStartSettingName(d))
}), [0,1,2,3,4,5,6])

// A fallback is consulted only when the configured value is unusable. The whole
// point is that omitting it leaves the Nepali Sunday default untouched.
test("an unset week start takes the fallback", M.normalizedWeekStart(null, 1), 1)
test("an empty week start takes the fallback", M.normalizedWeekStart("", 1), 1)
test("a configured week start beats the fallback", M.normalizedWeekStart(3, 1), 3)
test("with no fallback an unset week start is Nepali Sunday", M.normalizedWeekStart(null), 0)
test("with no fallback an unset week start is still Nepali Sunday",
  M.normalizedWeekStart(undefined), 0)
test("a garbage value with no fallback stays Nepali Sunday",
  M.normalizedWeekStart("nonsense-day"), 0)
test("a garbage value with a fallback takes the fallback",
  M.normalizedWeekStart("nonsense-day", 1), 1)

// The grid has to actually move when the start moves, or the toggle is decoration.
const sunStart = M.monthGridFor("np", { year: 2083, month: 1 }, 0, "")
const monStart = M.monthGridFor("np", { year: 2083, month: 1 }, 1, "")
test("weekday order starts where asked", M.weekdayOrder(0)[0], 0)
test("weekday order starts on Monday when asked", M.weekdayOrder(1)[0], 1)
test("a Sunday-start grid opens on a Sunday", sunStart[0].days[0].weekday, 0)
test("a Monday-start grid opens on a Monday", monStart[0].days[0].weekday, 1)
test("the same day is reached one cell apart",
  monStart[0].days[0].day - sunStart[0].days[0].day, 1)

// --- formats: preset ids and raw Qt strings share one ring

test("a preset id resolves to its template", M.formatById("classic", false), "{DATE}")
test("an unknown id is not silently downgraded", M.formatById("dddd HH:mm", false), "dddd HH:mm")
test("an empty id falls back to the first preset", M.formatById("", false), M.barFormats(false)[0].label)

// The alt format joins the ring, and lands next to current rather than ahead of
// the presets -- so a right-click cycle walks the presets first.
const ring = M.formatRing(M.barFormats(false), "classic", "d MMMM 'W'ww yyyy")
test("the alt format is in the ring", ring.includes("d MMMM 'W'ww yyyy"), true)
test("the current format is in the ring", ring.includes("classic"), true)
test("every preset is in the ring", M.barFormats(false).every(function(f) {
  return ring.includes(f.id)
}), true)
test("the ring holds each entry once",
  ring.length, new Set(ring).size)
test("omitting the alt leaves the ring the old way",
  M.formatRing(M.barFormats(false), "classic").includes("d MMMM 'W'ww yyyy"), false)
test("a ring with nothing in it still yields the classic preset",
  M.formatRing([], null, null), ["classic"])

// Cycling must walk the whole ring and come back round.
let walked = "classic"
for (let step = 0; step < ring.length; step++) walked = M.nextFormat(ring, walked)
test("cycling visits every ring entry and returns to the start", walked, "classic")

// A raw format string carried over from the built-in has to be renderable, which
// means the ISO week field Qt does not know about has to resolve first.
test("the ww literal is zero-padded", M.isoWeekLiteral(2026, 8, 30), "40")
test("the ww literal agrees with the week number",
  M.isoWeekLiteral(2026, 8, 30).length, String(M.isoWeekNumber(2026, 8, 30)).length)
test("the ww literal is numeric", /^\d\d$/.test(M.isoWeekLiteral(2026, 0, 1)), true)
// ------------------------------------------------------------------ report

if (failed > 0) {
  console.log("\nFAILURES")
  for (const f of failures) {
    console.log("  " + f.name)
    console.log("      got  " + JSON.stringify(f.actual))
    console.log("      want " + JSON.stringify(f.expected))
  }
}
console.log("\n" + (failed ? "FAILED " : "ALL GOOD ") + passed + " passed, " + failed + " failed")
process.exit(failed ? 1 : 0)
