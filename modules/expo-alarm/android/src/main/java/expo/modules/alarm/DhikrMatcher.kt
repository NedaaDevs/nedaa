package expo.modules.alarm

internal data class DhikrPhrase(val arabic: String, val transliteration: String)

// Mirrors src/utils/dhikrChallenge.ts; fixtures/ holds the cases both run.
internal object DhikrMatcher {

    private val DIACRITICS = Regex("[\\u064B-\\u0652\\u0670\\u0640]")

    // Applied in order: Urdu \u06C3 folds to \u0629, then to \u0647.
    private val LETTER_FOLDS = listOf(
        // Urdu and Persian keyboard letters
        Regex("\\u06CC") to "\u064A",
        Regex("\\u06A9") to "\u0643",
        Regex("[\\u06C1\\u06C2\\u06BE\\u06D5]") to "\u0647",
        Regex("\\u06C3") to "\u0629",
        // Arabic letter families
        Regex("[\\u0623\\u0625\\u0622\\u0671]") to "\u0627",
        Regex("\\u0649") to "\u064A",
        Regex("\\u0629") to "\u0647",
        Regex("\\u0624") to "\u0648",
        Regex("\\u0626") to "\u064A"
    )

    private val NON_LETTERS = Regex("[^\\p{L}]|\\u0621")
    private val DOUBLED_LETTER = Regex("(\\p{L})\\1+")

    // Letters only, no diacritics, one spelling per Arabic letter family, a
    // doubled letter counts once.
    fun normalize(input: String): String =
        LETTER_FOLDS
            .fold(input.lowercase().replace(DIACRITICS, "")) { text, (letters, letter) ->
                text.replace(letters, letter)
            }
            .replace(NON_LETTERS, "")
            .replace(DOUBLED_LETTER, "$1")

    // Either form of the phrase counts, so both keyboards work.
    fun matches(input: String, phrase: DhikrPhrase): Boolean {
        val normalized = normalize(input)
        if (normalized.isEmpty()) return false
        return normalized == normalize(phrase.transliteration) ||
            normalized == normalize(phrase.arabic)
    }
}
