package expo.modules.alarm

import kotlin.math.floor

// The typed dhikr's rules, as src/utils/dhikrChallenge.ts; dhikr-typed.tsv
// and dhikr-phrases.tsv hold the cases both run.
internal object DhikrTypedRun {

    // JS DHIKR_STRIKE_LIMIT: misses on one phrase before another is drawn.
    const val STRIKE_LIMIT = 3

    // JS DHIKR_TYPED.
    enum class Outcome(val id: String) {
        SOLVED("solved"),
        WRONG("wrong"),
        NEXT("next"),
    }

    data class Submitted(val outcome: Outcome, val strikes: Int)

    // JS DHIKR_PHRASES, by difficulty.
    val PHRASES: Map<ChallengeDifficulty, List<DhikrPhrase>> = mapOf(
        ChallengeDifficulty.EASY to listOf(
            DhikrPhrase("سبحان الله", "Subhanallah"),
            DhikrPhrase("الحمد لله", "Alhamdulillah"),
            DhikrPhrase("الله أكبر", "Allahu Akbar"),
        ),
        ChallengeDifficulty.MEDIUM to listOf(
            DhikrPhrase("سبحان الله وبحمده", "Subhanallahi wa bihamdihi"),
            DhikrPhrase("لا إله إلا الله", "La ilaha illa Allah"),
            DhikrPhrase("أستغفر الله", "Astaghfirullah"),
            DhikrPhrase("أعوذ بالله من الشيطان الرجيم", "A'udhu billahi minash shaytanir rajim"),
        ),
        ChallengeDifficulty.HARD to listOf(
            DhikrPhrase("لا حول ولا قوة إلا بالله", "La hawla wa la quwwata illa billah"),
            DhikrPhrase("سبحان الله وبحمده سبحان الله العظيم", "Subhanallahi wa bihamdihi subhanallahil azim"),
        ),
    )

    // A dhikr task has no difficulty: the default pool, as JS difficultyOf.
    fun poolOf(task: WakeTasks.Task): List<DhikrPhrase> =
        PHRASES.getValue(ChallengeDifficulty.fromId(TaskRun.difficultyOf(task)) ?: ChallengeDifficulty.EASY)

    // A miss keeps the phrase; the limit-th miss asks for another.
    fun submit(input: String, phrase: DhikrPhrase, strikes: Int): Submitted {
        if (DhikrMatcher.matches(input, phrase)) return Submitted(Outcome.SOLVED, strikes)
        val missed = strikes + 1
        return if (missed >= STRIKE_LIMIT) Submitted(Outcome.NEXT, 0) else Submitted(Outcome.WRONG, missed)
    }

    // A phrase's index, never the one just shown unless it is the only one.
    fun pick(size: Int, previous: Int?, rng: TaskRng.Rng): Int {
        val choices = (0 until size).filter { it != previous }.ifEmpty { listOf(0) }
        return choices[floor(rng.next() * choices.size).toInt()]
    }
}
