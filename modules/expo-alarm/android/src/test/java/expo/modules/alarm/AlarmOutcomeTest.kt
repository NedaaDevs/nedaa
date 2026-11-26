package expo.modules.alarm

import java.lang.reflect.Modifier
import org.junit.Assert.assertEquals
import org.junit.Test

// Same table as the JS test in modules/expo-alarm/src/__tests__/alarmOutcome.test.ts.
class AlarmOutcomeTest {

    private val prefix = "OUTCOME_"

    private val shared: Map<String, String> = sharedTable("alarm-outcome.tsv")
        .associate { (name, value) -> name to value }

    // Every OUTCOME_ constant, so one added in Kotlin alone fails here.
    private val native: Map<String, Any?> = AlarmDatabase::class.java.declaredFields
        .filter { Modifier.isStatic(it.modifiers) && it.name.startsWith(prefix) }
        .associate { it.name.removePrefix(prefix) to it.get(null) }

    @Test
    fun everyOutcomeIsTheStringJsReads() {
        assertEquals(shared, native)
    }
}
