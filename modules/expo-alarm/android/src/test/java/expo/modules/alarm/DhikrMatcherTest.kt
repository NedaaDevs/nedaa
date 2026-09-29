package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Same tables as the JS test in src/utils/__tests__/dhikrChallenge.test.ts.
class DhikrMatcherTest {

    private fun readCases(file: String): List<List<String>> {
        val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream(file)) {
            "missing fixture $file"
        }
        return stream.bufferedReader(Charsets.UTF_8).use { it.readLines() }
            .drop(1)
            .filter { it.isNotEmpty() }
            .map { it.split('\t') }
    }

    private val normalizeCases = readCases("dhikr-normalize.tsv")
    private val matchCases = readCases("dhikr-match.tsv")

    @Test
    fun normalizesEverySharedCase() {
        val failures = normalizeCases.filter { (_, input, normalized) ->
            DhikrMatcher.normalize(input) != normalized
        }
        assertEquals(emptyList<List<String>>(), failures)
    }

    @Test
    fun matchesEverySharedCase() {
        val failures = matchCases.filter { (_, typed, arabic, transliteration, matches) ->
            DhikrMatcher.matches(typed, DhikrPhrase(arabic, transliteration)) != matches.toBooleanStrict()
        }
        assertEquals(emptyList<List<String>>(), failures)
    }

    @Test
    fun everyPhraseMatchesItselfAndNoOther() {
        val phrases = matchCases
            .map { (_, _, arabic, transliteration) -> DhikrPhrase(arabic, transliteration) }
            .distinct()
        for (phrase in phrases) {
            for (typed in listOf(phrase.arabic, phrase.transliteration)) {
                assertEquals(typed, listOf(phrase), phrases.filter { DhikrMatcher.matches(typed, it) })
            }
        }
    }
}
