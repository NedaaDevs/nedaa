package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AlarmMigrationsTest {

    private val latest = AlarmMigrations.LATEST_VERSION

    @Test
    fun everyStartVersionRunsEachLaterStepOldestFirst() {
        val expected = mapOf(
            1 to listOf(2, 3, 3, 4, 5),
            2 to listOf(3, 3, 4, 5),
            3 to listOf(4, 5),
            4 to listOf(5),
            5 to emptyList(),
        )
        for ((old, versions) in expected) {
            assertEquals("from v$old", versions, AlarmMigrations.steps(old, latest).map { it.version })
        }
    }

    @Test
    fun aVersionOneDatabaseCreatesTheCompletedQueueBeforeAlteringIt() {
        val sql = AlarmMigrations.steps(1, latest).map { it.sql }
        val create = sql.indexOfFirst { it.contains("CREATE TABLE IF NOT EXISTS completed_queue") }
        val alter = sql.indexOfFirst { it.startsWith("ALTER TABLE completed_queue") }
        assertTrue("create at $create, alter at $alter", create in 0 until alter)
    }

    @Test
    fun stepVersionsNeverGoDown() {
        val versions = AlarmMigrations.STEPS.map { it.version }
        assertEquals(versions.sorted(), versions)
    }

    @Test
    fun applyRunsTheStepsInOrder() {
        val ran = mutableListOf<String>()
        AlarmMigrations.apply(1, latest) { ran += it }
        assertEquals(AlarmMigrations.STEPS.map { it.sql }, ran)
    }

    @Test
    fun applySkipsAColumnThatIsAlreadyThere() {
        val ran = mutableListOf<String>()
        AlarmMigrations.apply(1, latest) { sql ->
            if (sql.startsWith("ALTER TABLE")) throw RuntimeException(DUPLICATE)
            ran += sql
        }
        assertEquals(AlarmMigrations.STEPS.filterNot { it.addsColumn }.map { it.sql }, ran)
    }

    @Test
    fun applyStopsOnAnyOtherFailure() {
        val missing = RuntimeException(MISSING_TABLE)
        val ran = mutableListOf<String>()
        try {
            AlarmMigrations.apply(4, latest) { sql -> ran += sql; throw missing }
            fail("a missing table must fail the upgrade")
        } catch (e: RuntimeException) {
            assertSame(missing, e)
        }
        assertEquals(1, ran.size)
    }

    @Test
    fun aDuplicateNameOnACreateIsNotSkipped() {
        val duplicate = RuntimeException(DUPLICATE)
        try {
            AlarmMigrations.apply(1, 2) { throw duplicate }
            fail("only an added column may already exist")
        } catch (e: RuntimeException) {
            assertSame(duplicate, e)
        }
    }

    private companion object {
        // SQLite's own wording, as SQLiteException carries it.
        const val DUPLICATE = "duplicate column name: outcome (code 1 SQLITE_ERROR)"
        const val MISSING_TABLE = "no such table: completed_queue (code 1 SQLITE_ERROR)"
    }
}
