package io.nedaa.nedaaApp

import HomeWidgetGlanceWidgetReceiver

class NedaaWidgetReceiver : HomeWidgetGlanceWidgetReceiver<NedaaWidget>() {
    override val glanceAppWidget = NedaaWidget()
}