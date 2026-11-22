package expo.modules.alarm

// One line of text's size: the largest whole sp from max down to min that fits.
object TextFit {
    fun sp(maxSp: Float, minSp: Float, fits: (Float) -> Boolean): Float {
        var sp = maxSp
        while (sp > minSp && !fits(sp)) sp = maxOf(minSp, sp - 1f)
        return sp
    }

    // Width and height both fit; a box with no height yet bounds only width.
    fun fitsBox(width: Float, lineHeight: Float, roomWidth: Int, roomHeight: Int): Boolean =
        width <= roomWidth && (roomHeight <= 0 || lineHeight <= roomHeight)
}
