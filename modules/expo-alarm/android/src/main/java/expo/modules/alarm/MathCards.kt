package expo.modules.alarm

// The arithmetic a math question asks for; `seed` seeds its card layout.
enum class MathOperation(val seed: Int) {
    ADD(1),
    MULTIPLY(2),
}

data class OperandRange(val min: Int, val max: Int)

data class MathLevel(val operation: MathOperation, val left: OperandRange, val right: OperandRange)

data class MathQuestion(val operation: MathOperation, val left: Int, val right: Int) {
    val answer: Int
        get() = when (operation) {
            MathOperation.ADD -> left + right
            MathOperation.MULTIPLY -> left * right
        }
}

// One card per grid position, the answer among them once.
data class MathRound(val question: MathQuestion, val cards: List<Int>) {
    val answer: Int
        get() = question.answer
}

// The math board's questions and cards, as src/utils/mathCards.ts draws
// them. math-round.tsv pins the two.
object MathCards {

    const val CARD_COUNT = 4

    // Gaps between a question's four cards; the answer takes any one slot.
    val CARD_SHAPES: List<List<Int>> = listOf(
        listOf(0, 1, 2, 3),
        listOf(0, 1, 10, 11),
        listOf(0, 2, 10, 12),
        listOf(0, 10, 20, 30),
    )

    // Each difficulty's sum, as JS MATH_LEVELS.
    fun levelOf(difficulty: ChallengeDifficulty): MathLevel = when (difficulty) {
        ChallengeDifficulty.EASY ->
            MathLevel(MathOperation.ADD, OperandRange(2, 9), OperandRange(2, 9))
        ChallengeDifficulty.MEDIUM ->
            MathLevel(MathOperation.ADD, OperandRange(11, 99), OperandRange(2, 9))
        ChallengeDifficulty.HARD ->
            MathLevel(MathOperation.MULTIPLY, OperandRange(11, 19), OperandRange(3, 9))
    }

    // Shapes whose every slot stays positive at the level's smallest answer.
    fun shapesFor(difficulty: ChallengeDifficulty): List<List<Int>> {
        val level = levelOf(difficulty)
        val smallest = MathQuestion(level.operation, level.left.min, level.right.min).answer
        return CARD_SHAPES.filter { shape -> shape.max() < smallest }
    }

    // Four cards in a drawn shape, the answer in a drawn slot, then shuffled;
    // seeded from the question alone, so one question lays out alike.
    fun cardsFor(difficulty: ChallengeDifficulty, question: MathQuestion): List<Int> {
        val rng = TaskRng.seeded(layoutSeed(question).toLong())
        val shapes = shapesFor(difficulty)
        val shape = shapes[TaskRng.drawInt(rng, 0, shapes.lastIndex)]
        val base = question.answer - shape[TaskRng.drawInt(rng, 0, CARD_COUNT - 1)]
        return TaskRng.shuffled(shape.map { gap -> base + gap }, rng)
    }

    // A round at `difficulty`; after a wrong card, `previous` is the question
    // it replaces, and its answer is never asked again at once.
    fun round(difficulty: ChallengeDifficulty, rng: TaskRng.Rng, previous: MathQuestion? = null): MathRound {
        val question = drawQuestion(difficulty, rng, previous)
        return MathRound(question, cardsFor(difficulty, question))
    }

    private fun drawQuestion(difficulty: ChallengeDifficulty, rng: TaskRng.Rng, previous: MathQuestion?): MathQuestion {
        val level = levelOf(difficulty)
        val left = TaskRng.drawInt(rng, level.left.min, level.left.max)
        val right = TaskRng.drawInt(rng, level.right.min, level.right.max)
        val question = MathQuestion(level.operation, left, right)
        if (previous == null || question.answer != previous.answer) return question
        return question.copy(right = stepOperand(right, level.right))
    }

    // The next operand in range, wrapping past the top.
    private fun stepOperand(value: Int, range: OperandRange): Int =
        if (value >= range.max) range.min else value + 1

    private fun layoutSeed(question: MathQuestion): Int =
        question.operation.seed * 10000 + question.left * 100 + question.right
}
