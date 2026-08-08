package live.shouldiholdoff.holdoff.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── Midnight Velvet Palette ──────────────────────────────────────────────────
val DeepSpace      = Color(0xFF0A0612)   // background deepest
val MidnightVelvet = Color(0xFF120A24)   // surface base
val DuskPurple     = Color(0xFF1E0F3A)   // card / container
val TwilightPurple = Color(0xFF2D1B5E)   // elevated surface
val NightBloom     = Color(0xFF4A2C8A)   // primary purple
val MoonlitViolet  = Color(0xFF7B4FD4)   // secondary / accent
val StarGlow       = Color(0xFFB59CF7)   // text on dark / highlight
val StarlightWhite = Color(0xFFF0EAFF)   // primary text
val RomanticBlue   = Color(0xFF1A2856)   // deep blue accent
val MidnightBlue   = Color(0xFF0D1A3D)   // blue container
val AzureGlow      = Color(0xFF4F72D4)   // blue accent
val SoftLavender   = Color(0xFFD4C6FF)   // soft on-surface
val GlowPink       = Color(0xFFE85FA0)   // verdict warm
val HoldRed        = Color(0xFFE84055)   // hold off verdict
val GoGreen        = Color(0xFF2ECC88)   // reach out verdict
val WarnAmber      = Color(0xFFFFB347)   // caution verdict
val ErrorRed       = Color(0xFFFF4D6A)
val SurfaceAlpha   = Color(0xCC1E0F3A)   // semi-transparent card

private val HoldOffColorScheme = darkColorScheme(
    primary           = NightBloom,
    onPrimary         = StarlightWhite,
    primaryContainer  = TwilightPurple,
    onPrimaryContainer = SoftLavender,
    secondary         = MoonlitViolet,
    onSecondary       = StarlightWhite,
    secondaryContainer = DuskPurple,
    onSecondaryContainer = StarGlow,
    tertiary          = AzureGlow,
    onTertiary        = StarlightWhite,
    background        = DeepSpace,
    onBackground      = StarlightWhite,
    surface           = MidnightVelvet,
    onSurface         = StarlightWhite,
    surfaceVariant    = DuskPurple,
    onSurfaceVariant  = SoftLavender,
    outline           = TwilightPurple,
    error             = ErrorRed,
    onError           = StarlightWhite,
)

@Composable
fun HoldOffTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = HoldOffColorScheme,
        typography  = HoldOffTypography,
        content     = content,
    )
}
