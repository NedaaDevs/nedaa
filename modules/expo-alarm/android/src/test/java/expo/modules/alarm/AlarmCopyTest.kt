package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class AlarmCopyTest {

    private val english = "{title} (Snoozed {count}/{max})"
    private val arabic = "{title} (مؤجّل {count}/{max})"

    @Test
    fun fillsTheTemplate() {
        assertEquals("الفجر (مؤجّل 1/3)", AlarmCopy.fillSnoozedTitle(arabic, "الفجر", 1, 3))
    }

    @Test
    fun aSecondSnoozeReplacesTheCountInsteadOfAddingOne() {
        assertEquals("Fajr (Snoozed 2/3)", AlarmCopy.fillSnoozedTitle(english, "Fajr (Snoozed 1/3)", 2, 3))
    }

    @Test
    fun aTitleWithoutTheSuffixIsKept() {
        assertEquals("Fajr", AlarmCopy.stripSnoozed(english, "Fajr"))
    }

    @Test
    fun regexCharactersInTheTemplateAreLiteral() {
        assertEquals("Fajr", AlarmCopy.stripSnoozed("{title} [x.{count}+{max}]", "Fajr [x.1+3]"))
    }
}
