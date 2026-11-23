package expo.modules.alarm

// A fixture table the JS tests read too: rows as lists, header dropped.
fun sharedTable(name: String): List<List<String>> {
    val stream = checkNotNull(SharedTableAnchor::class.java.classLoader?.getResourceAsStream(name)) {
        "missing fixture $name"
    }
    return stream.bufferedReader(Charsets.UTF_8).use { it.readLines() }
        .drop(1)
        .filter { it.isNotEmpty() }
        .map { it.split('\t') }
}

private object SharedTableAnchor

fun String.ints(): List<Int> = split(',').map { it.toInt() }

// The cell for no value, such as no outcome or no previous question.
const val FIXTURE_NONE = "-"

// What a spoken line in the tables calls its gap; FIXTURE_GAP in wakeTaskFixtures.test.ts matches.
const val FIXTURE_GAP = "gap"

// The words the tables use; FIXTURE_OP in wakeTaskFixtures.test.ts matches.
object FixtureOp {
    const val NEXT = "next"
    const val INT = "int"
    const val SHUFFLE = "shuffle"
    const val SHUFFLE_INT = "shuffleInt"
    const val START = "start"
    const val ADVANCE = "advance"
    const val TICKS = "ticks"
    const val RESTART = "restart"
    const val END = "end"
    const val RESUME = "resume"
    const val TAP = "tap"
    const val RESHUFFLE = "reshuffle"
    const val DRAW = "draw"
    const val REDRAW = "redraw"
    const val REPLACE = "replace"
    const val STEP = "step"
    const val HOLD = "hold"
}

// Tap outcomes as the JS PRAYER_TAP, PATTERN_TAP and MATH_TAP write them.
object FixtureOutcome {
    const val PLACED = "placed"
    const val DONE = "done"
    const val WRONG = "wrong"
    const val IGNORED = "ignored"
    const val NEXT = "next"
    const val SOLVED = "solved"
}
