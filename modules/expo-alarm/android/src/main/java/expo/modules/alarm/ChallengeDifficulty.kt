package expo.modules.alarm

// A wake-up task's difficulty, by the ids JS CHALLENGE_DIFFICULTY saves.
enum class ChallengeDifficulty(val id: String) {
    EASY("easy"),
    MEDIUM("medium"),
    HARD("hard");

    companion object {
        // Null for an id no build saves; the caller picks the fallback.
        fun fromId(id: String): ChallengeDifficulty? = entries.find { it.id == id }
    }
}
