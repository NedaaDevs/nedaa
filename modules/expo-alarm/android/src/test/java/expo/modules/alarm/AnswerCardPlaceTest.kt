package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class AnswerCardPlaceTest {

    @Test
    fun everyCardHasAPlaceToSpeak() {
        assertEquals(MathCards.CARD_COUNT, ANSWER_CARD_PLACE.size)
        assertEquals(MathCards.CARD_COUNT, ANSWER_CARD_PLACE.toSet().size)
    }
}
