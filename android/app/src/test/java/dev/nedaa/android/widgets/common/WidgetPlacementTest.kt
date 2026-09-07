package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetPlacementTest {

    @Test
    fun `placed when any receiver in the family has an instance`() {
        val ids = mapOf("a.Small" to intArrayOf(), "a.Large" to intArrayOf(7))
        assertTrue(WidgetPlacement.anyPlaced({ ids[it] ?: intArrayOf() }, listOf("a.Small", "a.Large")))
    }

    @Test
    fun `not placed when every receiver is empty`() {
        assertFalse(WidgetPlacement.anyPlaced({ intArrayOf() }, listOf("a.Small", "a.Large")))
    }

    @Test
    fun `every family names at least one receiver and all twelve are covered once`() {
        val all = WidgetPlacement.Family.values().flatMap { it.receivers }
        assertEquals(12, all.size)
        assertEquals(12, all.toSet().size)
        WidgetPlacement.Family.values().forEach { assertTrue(it.name, it.receivers.isNotEmpty()) }
    }
}
