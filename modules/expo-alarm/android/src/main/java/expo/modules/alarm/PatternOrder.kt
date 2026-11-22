package expo.modules.alarm

// The four pads, left to right then top to bottom, by the JS PATTERN_PAD ids.
enum class PatternPad(val id: String) {
    CIRCLE("circle"),
    TRIANGLE("triangle"),
    SQUARE("square"),
    LINES("lines"),
}

// An order of pads, a pad may follow itself, and how many are tapped so far.
data class PatternState(val pattern: List<PatternPad>, val done: Int)

sealed interface PatternTap {
    data class Next(val state: PatternState) : PatternTap
    data class Done(val state: PatternState) : PatternTap
    data object Wrong : PatternTap
}

data class PlaybackTiming(val leadIn: Long, val lit: Long, val gap: Long)

data class PlaybackFrame(
    // The index in the order of the pad lit now, if any.
    val lit: Int?,
    // How many pads have lit so far, the lit one included.
    val shown: Int,
    val playing: Boolean,
)

// The pattern board's orders, taps and playback, as src/utils/patternOrder.ts
// plays them. pattern-order.tsv and pattern-playback.tsv pin the two.
object PatternOrder {

    // Playback times in ms; a screen reader widens the gaps.
    const val LEAD_IN_MS = 500L
    const val LEAD_IN_SCREEN_READER_MS = 750L
    const val LIT_MS = 500L
    const val LIT_REDUCED_MOTION_MS = 700L
    const val GAP_MS = 250L
    const val GAP_SCREEN_READER_MS = 750L

    private val PADS = PatternPad.entries

    // How many pads an order holds at each difficulty.
    fun lengthOf(difficulty: ChallengeDifficulty): Int = when (difficulty) {
        ChallengeDifficulty.EASY -> 3
        ChallengeDifficulty.MEDIUM -> 4
        ChallengeDifficulty.HARD -> 5
    }

    // How many orders of `length` there are.
    fun patternCount(length: Int): Int = power(PADS.size, length)

    // The order at `rank`: its base-4 digits over the pads, first pad first.
    fun patternAt(length: Int, rank: Int): List<PatternPad> =
        List(length) { index -> PADS[rank / power(PADS.size, length - 1 - index) % PADS.size] }

    fun rankOf(pattern: List<PatternPad>): Int =
        pattern.fold(0) { rank, pad -> rank * PADS.size + pad.ordinal }

    // Any order of the level's length, each alike, never `previous` again.
    fun draw(difficulty: ChallengeDifficulty, rng: TaskRng.Rng, previous: List<PatternPad>? = null): List<PatternPad> {
        val length = lengthOf(difficulty)
        val count = patternCount(length)
        if (previous?.size != length) return patternAt(length, TaskRng.drawInt(rng, 0, count - 1))
        val skipped = rankOf(previous)
        val rank = TaskRng.drawInt(rng, 0, count - 2)
        return patternAt(length, if (rank >= skipped) rank + 1 else rank)
    }

    // A tap past the last pad is wrong, as in JS.
    fun tap(state: PatternState, pad: PatternPad): PatternTap {
        if (state.pattern.getOrNull(state.done) != pad) return PatternTap.Wrong
        val next = state.copy(done = state.done + 1)
        return if (next.done == next.pattern.size) PatternTap.Done(next) else PatternTap.Next(next)
    }

    fun playbackTiming(reduceMotion: Boolean, screenReader: Boolean): PlaybackTiming = PlaybackTiming(
        leadIn = if (screenReader) LEAD_IN_SCREEN_READER_MS else LEAD_IN_MS,
        lit = if (reduceMotion) LIT_REDUCED_MOTION_MS else LIT_MS,
        gap = if (screenReader) GAP_SCREEN_READER_MS else GAP_MS,
    )

    // Step start times in ms: a lead-in, each pad lit then off, then the
    // turn, which opens as the last pad goes off.
    fun playbackStarts(length: Int, timing: PlaybackTiming): List<Long> = List(2 * length + 1) { step ->
        if (step == 0) return@List 0L
        val pad = (step - 1) / 2
        timing.leadIn + pad * (timing.lit + timing.gap) + if (step % 2 == 0) timing.lit else 0
    }

    fun playbackFrame(step: Int, length: Int): PlaybackFrame = PlaybackFrame(
        lit = if (step % 2 == 1) (step - 1) / 2 else null,
        shown = (step + 1) / 2,
        playing = step < 2 * length,
    )

    private fun power(base: Int, exponent: Int): Int = (0 until exponent).fold(1) { acc, _ -> acc * base }
}
