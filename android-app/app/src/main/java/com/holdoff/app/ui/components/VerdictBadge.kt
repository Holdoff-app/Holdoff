package com.holdoff.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.ui.theme.HoldOffRed
import com.holdoff.app.ui.theme.MaybeAmber
import com.holdoff.app.ui.theme.ReachOutGreen

/** Pill-shaped verdict badge: HOLD OFF / REACH OUT / MAYBE. */
@Composable
fun VerdictBadge(verdict: Verdict, modifier: Modifier = Modifier) {
    val (label, color, emoji) = when (verdict) {
        Verdict.HOLD_OFF  -> Triple("HOLD OFF",  HoldOffRed,    "\uD83D\uDED1")
        Verdict.REACH_OUT -> Triple("REACH OUT", ReachOutGreen, "\uD83D\uDC9A")
        Verdict.MAYBE     -> Triple("MAYBE",     MaybeAmber,    "\uD83E\uDD14")
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(color.copy(alpha = 0.18f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(emoji, fontSize = 14.sp)
        Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
    }
}
