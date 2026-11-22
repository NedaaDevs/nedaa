package expo.modules.alarm

// What one event does to a run's quiet time, and the sound change it calls
// for; stepQuiet in src/utils/taskClock.ts. quiet-step.tsv pins the two.
object TaskQuiet {

    // Ids as QUIET_EVENT writes them.
    enum class Event(val id: String) {
        OPEN("open"),
        TICK("tick"),
        // The alarm can be heard again.
        HEAR("hear"),
        RESTART("restart"),
        LEAVE("leave"),
    }

    // Ids as QUIET_SIGNAL writes them.
    enum class Signal(val id: String) { START("start"), ENDING("ending"), END("end") }

    // A clock and the moment it was last read.
    data class Reading(val clock: TaskClock, val now: Long)

    data class Step(val reading: Reading, val signal: Signal?)

    private fun tickSignal(was: TaskClock.QuietPhase, now: TaskClock.QuietPhase): Signal? = when {
        now == was -> null
        now == TaskClock.QuietPhase.ENDING -> Signal.ENDING
        now == TaskClock.QuietPhase.SOUNDING -> Signal.END
        else -> null
    }

    // An unheard alarm gets no signal.
    fun step(before: Reading, event: Event, now: Long, quietMs: Long, audible: Boolean): Step {
        val sounding = before.clock.quietPhase(before.now) == TaskClock.QuietPhase.SOUNDING
        return when (event) {
            Event.OPEN -> Step(before, if (audible && !sounding) Signal.START else null)
            Event.TICK -> {
                val clock = before.clock.advance(now, audible)
                val was = before.clock.quietPhase(before.now)
                Step(Reading(clock, now), if (audible) tickSignal(was, clock.quietPhase(now)) else null)
            }
            Event.HEAR -> Step(Reading(before.clock.endQuiet(now, false), now), null)
            Event.RESTART -> Step(
                Reading(before.clock.restartQuiet(now, quietMs, audible), now),
                if (audible && sounding) Signal.START else null,
            )
            Event.LEAVE -> Step(
                Reading(before.clock.endQuiet(now, audible), now),
                if (audible && !sounding) Signal.END else null,
            )
        }
    }
}
