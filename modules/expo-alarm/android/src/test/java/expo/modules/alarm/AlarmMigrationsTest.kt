package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AlarmMigrationsTest {

    private val latest = AlarmMigrations.LATEST_VERSION

    @Test
    fun everyStartVersionRunsEachLaterStepOldestFirst() {
        val expected = mapOf(
            1 to listOf(2, 3, 3, 4, 5, 6, 7, 7, 7, 7, 8, 8),
            2 to listOf(3, 3, 4, 5, 6, 7, 7, 7, 7, 8, 8),
            3 to listOf(4, 5, 6, 7, 7, 7, 7, 8, 8),
            4 to listOf(5, 6, 7, 7, 7, 7, 8, 8),
            5 to listOf(6, 7, 7, 7, 7, 8, 8),
            6 to listOf(7, 7, 7, 7, 8, 8),
            7 to listOf(8, 8),
            8 to emptyList(),
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
    fun versionSixAddsTheTaskStackAfterTheSettingsTableExists() {
        val sql = AlarmMigrations.steps(1, latest).map { it.sql }
        val create = sql.indexOfFirst { it.contains("CREATE TABLE IF NOT EXISTS alarm_settings") }
        val add = sql.indexOf(AlarmMigrations.ADD_TASKS_COLUMN)
        assertTrue("create at $create, add at $add", create in 0 until add)
    }

    // NULL is "no stack saved": the row's challenge stands for it.
    @Test
    fun theTaskColumnStartsEmptySoAnOldRowKeepsItsChallenge() {
        val step = AlarmMigrations.STEPS.single { it.sql == AlarmMigrations.ADD_TASKS_COLUMN }
        assertEquals(6, step.version)
        assertTrue(step.addsColumn)
        assertFalse(step.sql.contains("DEFAULT"))
    }

    @Test
    fun versionSevenAltersTheSnoozeQueueAfterItExists() {
        val sql = AlarmMigrations.steps(1, latest).map { it.sql }
        val create = sql.indexOfFirst { it.contains("CREATE TABLE IF NOT EXISTS snooze_queue") }
        val alter = sql.indexOfFirst { it.startsWith("ALTER TABLE snooze_queue") }
        assertTrue("create at $create, alter at $alter", create in 0 until alter)
    }

    @Test
    fun versionSevenCreatesTheQuietLedgerOnce() {
        val steps = AlarmMigrations.STEPS.filter { it.sql == AlarmMigrations.CREATE_QUIET_LEDGER }
        assertEquals(listOf(7), steps.map { it.version })
        assertFalse(steps.single().addsColumn)
    }

    // NULL is "no moment stored": an old row's ring shows the clock.
    @Test
    fun versionEightAddsThePrayerMomentWithNoValueForAnOldRow() {
        val steps = AlarmMigrations.steps(7, latest)
        assertEquals(
            listOf(AlarmMigrations.ADD_MOMENT_AT_COLUMN, AlarmMigrations.ADD_MOMENT_ZONE_COLUMN),
            steps.map { it.sql },
        )
        for (step in steps) {
            assertTrue(step.sql, step.sql.startsWith("ALTER TABLE alarms ADD COLUMN"))
            assertTrue(step.addsColumn)
            assertFalse(step.sql, step.sql.contains("DEFAULT") || step.sql.contains("NOT NULL"))
        }
    }

    @Test
    fun theFreshSchemaHasEveryColumnTheMomentStepsAdd() {
        for (sql in listOf(AlarmMigrations.ADD_MOMENT_AT_COLUMN, AlarmMigrations.ADD_MOMENT_ZONE_COLUMN)) {
            val column = sql.removePrefix("ALTER TABLE alarms ADD COLUMN ")
            assertTrue(column, AlarmMigrations.CREATE_ALARMS.contains(column))
        }
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
