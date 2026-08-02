package com.holdoff.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.data.prefs.AiConsent
import com.holdoff.app.data.prefs.AppPrefs
import com.holdoff.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// These must match where the pages are actually published. /terms and /privacy previously
// soft-404'd — they returned 200 but served the site's index.html, so the links went nowhere.
private const val TERMS_URL = "https://smsholdoff.com/legal/terms.html"
private const val PRIVACY_URL = "https://smsholdoff.com/legal/privacy.html"
private const val DELETION_URL = "https://smsholdoff.com/legal/data-deletion.html"

/** Pause length choices, in minutes. */
private val HOLD_CHOICES = listOf(1, 5, 10, 30)

/**
 * Settings — pause length, account, legal.
 *
 * Only controls that change what the app actually does live here. This screen previously
 * carried a notifications switch, a pattern-tracking switch, a launch-conditions checklist
 * and a self-reported mental-health checklist; none of them were read by any code, and the
 * last one collected health data that went nowhere. They are gone rather than relabelled.
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current

    var holdMinutes by remember { mutableIntStateOf(AppPrefs.holdMinutes(ctx)) }
    var aiConsent by remember { mutableStateOf(AiConsent.isGranted(ctx)) }
    val accountEmail = remember { HoldOffApi.getAccountEmail(ctx) }
    val versionName = remember { appVersionName(ctx) }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            SettingsSection("The Pause") {
                Text(
                    "How long the countdown runs when Sadie says hold off",
                    color = OnDarkText, style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HOLD_CHOICES.forEach { minutes ->
                        FilterChip(
                            selected = holdMinutes == minutes,
                            onClick = {
                                holdMinutes = minutes
                                AppPrefs.setHoldMinutes(ctx, minutes)
                            },
                            label = { Text("$minutes min", fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = VelvetPurple,
                                selectedLabelColor = OnDarkText,
                                labelColor = OnDarkTextMuted
                            )
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "You can always send anyway. The countdown is friction, not a lock.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                )
            }
            SettingsSection("Account") {
                Text(
                    accountEmail?.let { "Signed in as $it" } ?: "Not signed in",
                    color = if (accountEmail != null) OnDarkText else OnDarkTextMuted,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "HoldOff works without an account. Your messages stay on this phone unless " +
                        "you ask for a verdict \u2014 see AI analysis below for exactly what leaves.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                )
            }
            SettingsSection("AI analysis") {
                // Withdrawing consent has to be as easy as giving it, so this is one switch and
                // takes effect on the next request. No confirmation step, no dark pattern.
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Send my text to Google",
                            color = OnDarkText, fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Verdicts and Sadie both work by sending your draft \u2014 and the recent " +
                                "messages in that conversation, including the other person's \u2014 to " +
                                "HoldOff's server and on to Google's Gemini API. Turn this off and " +
                                "nothing leaves your phone. The pause itself still works.",
                            color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Switch(
                        checked = aiConsent,
                        onCheckedChange = { granted ->
                            if (granted) AiConsent.grant(ctx) else AiConsent.withdraw(ctx)
                            aiConsent = granted
                        }
                    )
                }
                val decidedAt = AiConsent.decidedAt(ctx)
                if (decidedAt > 0L) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        (if (aiConsent) "You agreed on " else "You turned this off on ") +
                            SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(Date(decidedAt)),
                        color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            SettingsSection("Legal") {
                TextButton(onClick = { openUrl(ctx, TERMS_URL) }) {
                    Text("Terms of Service", color = SoftLavender)
                }
                TextButton(onClick = { openUrl(ctx, PRIVACY_URL) }) {
                    Text("Privacy Policy", color = SoftLavender)
                }
                // Play requires a reachable route to delete an account and its data, and wants
                // it findable from inside the app, not only on the website.
                TextButton(onClick = { openUrl(ctx, DELETION_URL) }) {
                    Text("Delete my account and data", color = SoftLavender)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Mental Health Disclaimer",
                    color = OnDarkText, fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "HoldOff is a pause before you send a message — it is not therapy, it cannot " +
                        "diagnose you, and it is not a crisis service. If you are in crisis or thinking " +
                        "about hurting yourself, please reach a real person now: call your local " +
                        "emergency number or a crisis line.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
                )
            }
            Text(
                (versionName?.let { "HoldOff v$it" } ?: "HoldOff") +
                    " · Not therapy · Not diagnosis · Not a substitute for professional care",
                color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

/**
 * Reads versionName from the installed package, so it tracks build.gradle.kts instead of drifting.
 * PackageManager rather than BuildConfig: this module does not enable the buildConfig feature,
 * so BuildConfig is not generated under AGP 8.
 */
private fun appVersionName(ctx: Context): String? =
    runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull()

/** A device with no browser must not take the app down with it. */
private fun openUrl(ctx: Context, url: String) {
    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(title, fontWeight = FontWeight.SemiBold, color = GlowPurple, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(8.dp))
        content()
    }
}
