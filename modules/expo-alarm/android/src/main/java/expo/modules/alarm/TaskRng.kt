package expo.modules.alarm

import kotlin.math.floor

// The wake-up boards' random source, as src/utils/rng.ts draws it, so one
// seed draws the same boards in both builds. rng.tsv pins the two.
object TaskRng {

    // A draw in [0, 1), like Math.random.
    fun interface Rng {
        fun next(): Double
    }

    // Mulberry32 on the seed's low 32 bits, bit for bit as seededRng.
    fun seeded(seed: Long): Rng {
        var state = seed.toInt()
        return Rng {
            state += MULBERRY_STEP
            var t = state
            t = (t xor (t ushr 15)) * (t or 1)
            t = t xor (t + (t xor (t ushr 7)) * (t or 61))
            ((t xor (t ushr 14)).toLong() and UINT_MASK) / UINT_RANGE
        }
    }

    // A whole number from `min` to `max`, both included.
    fun drawInt(rng: Rng, min: Int, max: Int): Int =
        min + floor(rng.next() * (max - min + 1)).toInt()

    // Fisher–Yates from the last item down, as the JS shuffled.
    fun <T> shuffled(items: List<T>, rng: Rng): List<T> {
        val out = items.toMutableList()
        for (i in out.lastIndex downTo 1) {
            val j = drawInt(rng, 0, i)
            out[i] = out[j].also { out[j] = out[i] }
        }
        return out
    }

    private const val MULBERRY_STEP = 0x6d2b79f5
    private const val UINT_MASK = 0xffffffffL
    private const val UINT_RANGE = 4294967296.0
}
