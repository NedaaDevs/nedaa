package io.nedaa.nedaaApp


import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import es.antonborri.home_widget.actionStartActivity

object WidgetComposables {
    @Composable
    fun DisplayErrorMsg(context: Context) {
        val backgroundColor = GlanceTheme.colors.background
        val textColor = GlanceTheme.colors.onBackground
        val buttonColor = GlanceTheme.colors.primary

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(backgroundColor)
                .padding(8.dp),
            horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            Text(
                text = context.getString(R.string.enable_exact_alarm_permission_message),
                style = TextStyle(
                    color = textColor,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal
                ),
                modifier = GlanceModifier.padding(bottom = 8.dp)
            )

            Button(
                text = context.getString(R.string.allow),
                style = TextStyle(
                    color = GlanceTheme.colors.onPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                ),
                onClick = actionStartActivity<MainActivity>(
                    context,
                    Uri.parse("nedaaWidget://requestPermission?message=test")
                ),
                modifier = GlanceModifier
                    .background(buttonColor)
                    .padding(4.dp)
            )
        }
    }
}