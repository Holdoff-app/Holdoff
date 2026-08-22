package com.holdoff.app.ui.screens

import android.content.Intent
import android.provider.Settings
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
import com.holdoff.app.service.HoldOffAccessibilityService
import com.holdoff.app.ui.theme.*

/**
 * Settings — Message Guardian (accessibility), Launch Conditions (user-checkbox, editable),
 * pattern tracking, notifications, account, legal.
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var notificationsEnabled by remember { mutableStateOf(true) }
    var patternTracking by remember { mutableStateOf(true) }
    var rapidTypingDetection by remember { mutableStateOf(true) }
    var launchConditions by remember {
        mutableStateOf(setOf("anxious_spiral", "late_night_send"))
    }

    // Re-check accessibility state every time this composable recomposes
    val isAccessibilityEnabled = remember {
        derivedStateOf { HoldOffAccessibilityService.isAccessibilityEnabled(context) }
    }.value

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
            // ── Message Guardian (Accessibility Service) ──────────────────────
            SettingsSection("Message Guardian") {
                Text(
                    "HoldOff intercepts your outgoing messages in your SMS app so Sadie can weigh in before you send. Requires Accessibility permission.",
                    color = OnDarkTextMuted,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Intercept outgoing messages",
                            color = OnDarkText,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            if (isAccessibilityEnabled) "Active — Sadie is watching" else "Tap to enable in Settings",
                            color = if (isAccessibilityEnabled) GlowPurple else androidx.compose.ui.graphics.Color(0xFFEF4444),
                            fontSize = 12.sp
                        )
                    }
                    Button(
                        onClick = {
                            context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isAccessibilityEnabled) SurfaceVariant else VelvetPurple
                        )
                    ) {
                        Text(if (isAccessibilityEnabled) "Enabled" else "Enable")
                    }
                }
            }

            // ── Notifications ─────────────────────────────────────────────────
            SettingsSection("Notifications") {
                SettingsToggle("Message analysis alerts", notificationsEnabled) { notificationsEnabled = it }
            }

            // ── AI & Pattern Tracking ─────────────────────────────────────────
            SettingsSection("AI & Pattern Tracking") {
                SettingsToggle("Enable pattern tracking", patternTracking) { patternTracking = it }
                SettingsToggle("Detect rapid typing / urgency", rapidTypingDetection) { rapidTypingDetection = it }
            }

            // ── Launch Conditions ─────────────────────────────────────────────
            SettingsSection("Launch Conditions") {
                Text(
                    "Choose what triggers a HoldOff alert. Required \u2014 you can add or remove these anytime.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(8.dp))
                val conditions = mapOf(
                    "anxious_spiral"     to "Anxious spiral detected",
                    "late_night_send"    to "Late-night send (2am+)",
                    "rapid_messages"     to "3+ messages in a row without reply",
                    "emotional_flooding" to "Emotional flooding / all-caps",
                    "long_silence"       to "Long silence broken suddenly",
                    "rebound_texting"    to "Post-argument rebound texting"
                )
                conditions.forEach { (key, label) ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, color = OnDarkText, modifier = Modifier.weight(1f))
                        Checkbox(
                            checked = key in launchConditions,
                            onCheckedChange = { checked ->
                                launchConditions = if (checked) launchConditions + key else launchConditions - key
                            },
                            colors = CheckboxDefaults.colors(checkedColor = GlowPurple)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            title,
            color = SoftLavender,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.titleSmall
        )
        content()
    }
}

@Composable
fun SettingsToggle(label: String, checked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = OnDarkText, modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(checkedThumbColor = GlowPurple)
        )
    }
}
