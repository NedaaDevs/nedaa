package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class GraceTimerTest {

    private val duration = 10_000L

    private class FakeScheduler : GraceTimer.Scheduler {
        var now = 0L
        private val pending = mutableListOf<Pair<Long, () -> Unit>>()

        override fun postDelayed(delayMs: Long, action: () -> Unit) {
            pending += (now + delayMs) to action
        }

        override fun cancelAll() = pending.clear()

        fun advance(ms: Long) {
            val end = now + ms
            while (true) {
                val next = pending.minByOrNull { it.first }?.takeIf { it.first <= end } ?: break
                pending.remove(next)
                now = next.first
                next.second()
            }
            now = end
        }
    }

    private class Events : GraceTimer.Listener {
        val log = mutableListOf<String>()
        override fun onSilence() { log += SILENCE }
        override fun onTick(remainingMs: Long) {}
        override fun onExpired() { log += EXPIRED }
    }

    private val scheduler = FakeScheduler()
    private val events = Events()
    private fun timer(ms: Long = duration) = GraceTimer(ms, { scheduler.now }, scheduler, events)

    @Test
    fun anUntouchedRoundAfterAResetExpiresAndRestartsTheSound() {
        val grace = timer()
        grace.interact()
        scheduler.advance(2_000)
        grace.nextRound()

        scheduler.advance(duration - 1)
        assertEquals(listOf(SILENCE), events.log)
        scheduler.advance(1 + TICK_SLACK)
        assertEquals(listOf(SILENCE, EXPIRED), events.log)
    }

    @Test
    fun aTouchPushesTheExpiryBack() {
        val grace = timer()
        grace.interact()
        scheduler.advance(duration - 1_000)
        grace.interact()
        scheduler.advance(duration - 1_000)

        assertEquals(listOf(SILENCE), events.log)
    }

    @Test
    fun aTouchAfterTheExpirySilencesAgain() {
        val grace = timer()
        grace.interact()
        scheduler.advance(duration + TICK_SLACK)
        grace.interact()

        assertEquals(listOf(SILENCE, EXPIRED, SILENCE), events.log)
    }

    // The sound already rings again; only a touch quiets it.
    @Test
    fun aRoundEndingAfterTheExpiryKeepsItExpired() {
        val grace = timer()
        grace.interact()
        scheduler.advance(duration + TICK_SLACK)
        grace.nextRound()
        scheduler.advance(duration * 2)

        assertEquals(listOf(SILENCE, EXPIRED), events.log)
    }

    @Test
    fun aZeroDurationTimerNeverSilences() {
        val grace = timer(0)
        grace.interact()
        grace.nextRound()
        scheduler.advance(duration * 2)

        assertEquals(emptyList<String>(), events.log)
    }

    @Test
    fun aStoppedTimerNeverExpires() {
        val grace = timer()
        grace.interact()
        grace.stop()
        scheduler.advance(duration * 2)

        assertEquals(listOf(SILENCE), events.log)
    }

    private companion object {
        const val SILENCE = "silence"
        const val EXPIRED = "expired"
        const val TICK_SLACK = GraceTimer.TICK_MS
    }
}
