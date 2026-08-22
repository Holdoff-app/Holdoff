package live.shouldiholdoff.holdoff.ui.theme

import androidx.compose.ui.graphics.Color
import live.shouldiholdoff.holdoff.domain.analysis.Mood

/**
 * MoodColorEngine maps an inferred mood into a midnight-velvet palette
 * variant. The theme stays in the deep-purple / romantic deep-blue family
 * always — no peach, no coral — but tilts warmer or cooler depending on
 * the mood the app is currently sensing.
 */
object MoodColorEngine {

    data class MoodPalette(
        val primary: Color,
        val secondary: Color,
        val accent: Color,
        val background: Color,
        val surface: Color
    )

    private val MIDNIGHT_BG = Color(0xFF0B0420)
    private val MIDNIGHT_SURFACE = Color(0xFF160A33)

    fun paletteFor(mood: Mood): MoodPalette = when (mood) {
        Mood.CALM -> MoodPalette(
            primary = Color(0xFF6E59C7),
            secondary = Color(0xFF3A2A7A),
            accent = Color(0xFF8B7BD6),
            background = MIDNIGHT_BG,
            surface = MIDNIGHT_SURFACE
        )
        Mood.ANXIOUS -> MoodPalette(
            primary = Color(0xFF8A5BD0),
            secondary = Color(0xFF2A1F66),
            accent = Color(0xFFB39CE6),
            background = Color(0xFF0A0322),
            surface = Color(0xFF1A0C3D)
        )
        Mood.ANGRY -> MoodPalette(
            primary = Color(0xFF7C2B7A),
            secondary = Color(0xFF2B0A2B),
            accent = Color(0xFFC25CC0),
            background = Color(0xFF120322),
            surface = Color(0xFF200A3A)
        )
        Mood.HURT -> MoodPalette(
            primary = Color(0xFF4A3A8C),
            secondary = Color(0xFF1A1340),
            accent = Color(0xFF7868B0),
            background = MIDNIGHT_BG,
            surface = MIDNIGHT_SURFACE
        )
        Mood.HOPEFUL -> MoodPalette(
            primary = Color(0xFF5A78D6),
            secondary = Color(0xFF1F2A66),
            accent = Color(0xFF8BA3E6),
            background = Color(0xFF080522),
            surface = Color(0xFF120A3A)
        )
        Mood.NUMB -> MoodPalette(
            primary = Color(0xFF3F3A6E),
            secondary = Color(0xFF161433),
            accent = Color(0xFF6F6AA0),
            background = MIDNIGHT_BG,
            surface = MIDNIGHT_SURFACE
        )
        Mood.EXCITED -> MoodPalette(
            primary = Color(0xFF7A5BE0),
            secondary = Color(0xFF2A1A7A),
            accent = Color(0xFFB6A3FF),
            background = Color(0xFF0A0428),
            surface = Color(0xFF1A0C45)
        )
        Mood.AVOIDANT -> MoodPalette(
            primary = Color(0xFF334C8A),
            secondary = Color(0xFF111A40),
            accent = Color(0xFF6580C0),
            background = MIDNIGHT_BG,
            surface = MIDNIGHT_SURFACE
        )
    }
}
