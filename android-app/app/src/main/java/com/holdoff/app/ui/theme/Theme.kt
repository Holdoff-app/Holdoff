package com.holdoff.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val HoldOffDarkColors = darkColorScheme(
    primary              = GlowPurple,
    onPrimary            = OnDarkText,
    primaryContainer     = RoyalPurple,
    onPrimaryContainer   = LavenderHint,
    secondary            = GlowBlue,
    onSecondary          = OnDarkText,
    secondaryContainer   = RomanticBlue,
    onSecondaryContainer = SoftBlue,
    tertiary             = SoftLavender,
    background           = MidnightNavy,
    onBackground         = OnDarkText,
    surface              = DeepPurple,
    onSurface            = OnDarkText,
    surfaceVariant       = SurfaceVariant,
    onSurfaceVariant     = OnDarkTextMuted,
    outline              = DividerColor,
    error                = ErrorRed,
    onError              = OnDarkText
)

/** HoldOff is always dark — midnight velvet is non-negotiable. */
@Composable
fun HoldOffTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HoldOffDarkColors,
        typography  = HoldOffTypography,
        content     = content
    )
}
