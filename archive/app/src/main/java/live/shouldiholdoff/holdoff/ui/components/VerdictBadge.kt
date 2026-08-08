package live.shouldiholdoff.holdoff.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import live.shouldiholdoff.holdoff.ui.theme.*

@Composable
fun VerdictBadge(verdict: String, modifier: Modifier = Modifier) {
    val (label, color) = when (verdict) {
        "hold_off"   -> "Hold Off 🛑" to HoldRed
        "reach_out"  -> "Reach Out 💜" to GoGreen
        "wait"       -> "Wait & See ⏳" to WarnAmber
        "pending"    -> "Analyzing..." to MoonlitViolet
        else         -> verdict to MoonlitViolet
    }

    Text(
        text = label,
        modifier = modifier
            .background(color.copy(alpha = 0.18f), RoundedCornerShape(20.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        color = color,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp
    )
}
