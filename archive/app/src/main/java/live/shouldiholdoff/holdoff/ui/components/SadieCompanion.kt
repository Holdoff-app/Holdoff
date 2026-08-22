package live.shouldiholdoff.holdoff.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import live.shouldiholdoff.holdoff.ui.theme.*

/**
 * Sadie — small animated sticker-style companion in the bottom corner.
 * She pulses gently and shows a thought bubble on long messages.
 */
@Composable
fun SadieCompanion(
    message: String = "",
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "sadie_pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Box(modifier = modifier) {
        Column(horizontalAlignment = Alignment.End) {
            // Thought bubble when message present
            if (message.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .widthIn(max = 220.dp)
                        .padding(bottom = 4.dp),
                    shape = RoundedCornerShape(12.dp, 12.dp, 4.dp, 12.dp),
                    colors = CardDefaults.cardColors(containerColor = TwilightPurple)
                ) {
                    Text(
                        text = message,
                        modifier = Modifier.padding(10.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = SoftLavender,
                        fontStyle = FontStyle.Italic,
                        fontSize = 12.sp
                    )
                }
            }

            // Sadie emoji sticker (placeholder until art assets loaded)
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .scale(scale)
                    .background(TwilightPurple, RoundedCornerShape(50)),
                contentAlignment = Alignment.Center
            ) {
                Text("🌙", fontSize = 24.sp)
            }
        }
    }
}
