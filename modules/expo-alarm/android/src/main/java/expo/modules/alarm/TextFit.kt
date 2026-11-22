package expo.modules.alarm

// One line of text's size: the largest whole sp from max down to min that fits.
object TextFit {
    fun sp(maxSp: Float, minSp: Float, fits: (Float) -> Boolean): Float {
        var sp = maxSp
        while (sp > minSp && !fits(sp)) sp = maxOf(minSp, sp - 1f)
        return sp
    }
}
