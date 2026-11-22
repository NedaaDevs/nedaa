package expo.modules.alarm

// An alarm's ordered wake-up tasks; the rules of src/utils/wakeTasks.ts.
object WakeTasks {

    // Shared with JS through fixtures/wake-task-*.tsv.
    const val MAX_STACK = 3
    const val DEFAULT_DIFFICULTY = "easy"
    const val DEFAULT_STEPS = 1
    val DIFFICULTIES: List<String> = listOf("easy", "medium", "hard")

    // The single challenge the overlay runs, as alarm_settings stores it.
    const val CHALLENGE_NONE = "none"
    const val CHALLENGE_TAP = "tap"
    const val CHALLENGE_MATH = "math"
    const val CHALLENGE_DHIKR = "dhikr"
    val CHALLENGE_TYPES: List<String> =
        listOf(CHALLENGE_NONE, CHALLENGE_TAP, CHALLENGE_MATH, CHALLENGE_DHIKR)

    private val CHALLENGE_COUNTS: List<Int> = (1..10).toList()
    private val STEP_CHOICES: List<Int> = (1..5).toList()

    // Ids are persisted; listed in JS's WAKE_TASK_IDS order.
    enum class Board(val id: String, val hasDifficulty: Boolean, val stepChoices: List<Int>?) {
        TAP("tap", false, null),
        MATH("math", true, CHALLENGE_COUNTS),
        PATTERN("pattern", true, STEP_CHOICES),
        DHIKR("dhikr", false, STEP_CHOICES),
        PRAYERS("prayers", false, null),
    }

    // normalize sets difficulty and steps only on boards that offer them.
    data class Task(val board: Board, val difficulty: String?, val steps: Int?)

    data class Challenge(val type: String, val difficulty: String, val count: Int)

    // One alarm type's challenge columns and its stack.
    data class Stored(val challenge: Challenge, val tasks: List<Task>)

    val DEFAULT_CHALLENGE = Challenge(CHALLENGE_TAP, "medium", 1)
    private val NO_CHALLENGE = Challenge(CHALLENGE_NONE, DEFAULT_DIFFICULTY, 1)

    private const val ID = "id"
    private const val DIFFICULTY = "difficulty"
    private const val STEPS = "steps"
    private const val TASK_SEPARATOR = ';'
    private const val FIELD_SEPARATOR = ','
    private const val VALUE_SEPARATOR = '='
    private val NUMBER = Regex("-?\\d+(\\.\\d+)?")

    private fun <T> pick(choices: List<T>, value: Any?): T? = choices.firstOrNull { it == value }

    // JS Math.round: halves go up; kotlin.math.round would go to even.
    private fun step(choices: List<Int>, value: Any?, fallback: Int): Int {
        val number = (value as? Number)?.toDouble()?.takeIf { it.isFinite() } ?: return fallback
        val clamped = Math.round(number).coerceIn(choices.first().toLong(), choices.last().toLong())
        return choices.firstOrNull { it.toLong() == clamped } ?: fallback
    }

    private fun create(board: Board, saved: Map<*, *>): Task = Task(
        board = board,
        difficulty = if (board.hasDifficulty) {
            pick(DIFFICULTIES, saved[DIFFICULTY]) ?: DEFAULT_DIFFICULTY
        } else null,
        steps = board.stepChoices?.let { step(it, saved[STEPS], DEFAULT_STEPS) },
    )

    // Known boards, each once, at most MAX_STACK; bad options get defaults.
    fun normalize(input: Any?): List<Task> {
        val tasks = mutableListOf<Task>()
        for (entry in input as? List<*> ?: return tasks) {
            if (tasks.size >= MAX_STACK) break
            val saved = entry as? Map<*, *> ?: continue
            val board = Board.entries.firstOrNull { it.id == saved[ID] } ?: continue
            if (tasks.none { it.board == board }) tasks += create(board, saved)
        }
        return tasks
    }

    private fun normalizeChallenge(saved: Challenge) = Challenge(
        type = pick(CHALLENGE_TYPES, saved.type) ?: DEFAULT_CHALLENGE.type,
        difficulty = pick(DIFFICULTIES, saved.difficulty) ?: DEFAULT_CHALLENGE.difficulty,
        count = step(CHALLENGE_COUNTS, saved.count, DEFAULT_CHALLENGE.count),
    )

    // The stack a stored challenge stands for.
    fun fromChallenge(saved: Challenge): List<Task> {
        val challenge = normalizeChallenge(saved)
        val options = mapOf(DIFFICULTY to challenge.difficulty, STEPS to challenge.count)
        return when (challenge.type) {
            CHALLENGE_TAP -> listOf(create(Board.TAP, options))
            CHALLENGE_MATH -> listOf(create(Board.MATH, options))
            CHALLENGE_DHIKR -> listOf(create(Board.DHIKR, options))
            else -> emptyList()
        }
    }

    // The challenge columns a stack maps to, from its first task.
    fun challengeOf(tasks: List<Task>): Challenge {
        val first = tasks.firstOrNull() ?: return NO_CHALLENGE
        return when (first.board) {
            Board.MATH -> Challenge(
                CHALLENGE_MATH,
                first.difficulty ?: DEFAULT_DIFFICULTY,
                first.steps ?: DEFAULT_STEPS,
            )
            Board.DHIKR -> Challenge(CHALLENGE_DHIKR, DEFAULT_DIFFICULTY, first.steps ?: DEFAULT_STEPS)
            // The overlay has no board for these; tap still asks to be awake.
            Board.PATTERN, Board.PRAYERS, Board.TAP -> DEFAULT_CHALLENGE
        }
    }

    // A stored stack the challenge contradicts loses to it. Null: none stored.
    fun resolve(saved: Challenge, stored: String?): List<Task> {
        val derived = fromChallenge(saved)
        if (stored == null) return derived
        val tasks = normalize(decode(stored))
        return if (challengeOf(tasks) == challengeOf(derived)) tasks else derived
    }

    // JS syncWakeTaskFields: a sent stack wins; a sent challenge rebuilds it.
    fun write(current: Stored, sentTasks: Any?, sentChallenge: Challenge?): Stored {
        if (sentTasks != null) {
            val tasks = normalize(sentTasks)
            return Stored(challengeOf(tasks), tasks)
        }
        if (sentChallenge == null) return current
        val challenge = normalizeChallenge(sentChallenge)
        return Stored(challenge, fromChallenge(challenge))
    }

    private fun fields(task: Task): List<Pair<String, Any>> = listOfNotNull(
        ID to task.board.id,
        task.difficulty?.let { DIFFICULTY to it },
        task.steps?.let { STEPS to it },
    )

    // Writes "id=math,difficulty=hard,steps=4;id=tap".
    fun encode(tasks: List<Task>): String = tasks.joinToString(TASK_SEPARATOR.toString()) { task ->
        fields(task).joinToString(FIELD_SEPARATOR.toString()) { (key, value) ->
            "$key$VALUE_SEPARATOR$value"
        }
    }

    // Raw records for normalize; a field with no '=' is dropped.
    fun decode(text: String): List<Map<String, Any>> =
        text.split(TASK_SEPARATOR).filter { it.isNotEmpty() }.map { task ->
            task.split(FIELD_SEPARATOR).mapNotNull { field ->
                val at = field.indexOf(VALUE_SEPARATOR)
                if (at < 0) return@mapNotNull null
                val value = field.substring(at + 1)
                field.substring(0, at) to (if (NUMBER.matches(value)) value.toDouble() else value)
            }.toMap()
        }

    fun toBridge(tasks: List<Task>): List<Map<String, Any>> = tasks.map { fields(it).toMap() }
}
