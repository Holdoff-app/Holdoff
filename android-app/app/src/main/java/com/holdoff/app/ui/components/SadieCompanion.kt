package com.holdoff.app.ui.components

import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.holdoff.app.R
import com.holdoff.app.ui.theme.DeepPurple
import com.holdoff.app.ui.theme.GlowPurple
import com.holdoff.app.ui.theme.VelvetPurple

/** Small animated Sadie companion avatar — uses the real Sadie character art. */
@Composable
fun SadieAvatar(
    size: SadieSize = SadieSize.SMALL,
    isThinking: Boolean = false
) {
    val scale by animateFloatAsState(
        targetValue = if (isThinking) 1.08f else 1f,
        animationSpec = infiniteRepeatable(tween(800, easing = EaseInOut), RepeatMode.Reverse),
        label = "sadie_pulse"
    )
    val sizeDp = when (size) {
        SadieSize.SMALL  -> 48.dp
        SadieSize.MEDIUM -> 72.dp
        SadieSize.LARGE  -> 96.dp
    }
    Box(
        modifier = Modifier
            .size(sizeDp)
            .scale(if (isThinking) scale else 1f)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(GlowPurple, VelvetPurple, DeepPurple))),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.sadie_companion),
            contentDescription = "Sadie",
            modifier = Modifier.size(sizeDp),
            contentScale = ContentScale.Crop
        )
    }
}

/** Dan companion avatar — uses the real Dan character art. */
@Composable
fun DanAvatar(
    size: SadieSize = SadieSize.SMALL,
    isThinking: Boolean = false
) {
    val scale by animateFloatAsState(
        targetValue = if (isThinking) 1.08f else 1f,
        animationSpec = infiniteRepeatable(tween(800, easing = EaseInOut), RepeatMode.Reverse),
        label = "dan_pulse"
    )
    val sizeDp = when (size) {
        SadieSize.SMALL  -> 48.dp
        SadieSize.MEDIUM -> 72.dp
        SadieSize.LARGE  -> 96.dp
    }
    Box(
        modifier = Modifier
            .size(sizeDp)
            .scale(if (isThinking) scale else 1f)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(GlowPurple, VelvetPurple, DeepPurple))),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.dan_companion),
            contentDescription = "Dan",
            modifier = Modifier.size(sizeDp),
            contentScale = ContentScale.Crop
        )
    }
}

enum class SadieSize { SMALL, MEDIUM, LARGE }