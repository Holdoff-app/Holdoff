package com.holdoff.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.holdoff.app.ui.theme.*

/**
 * Settings — Launch Conditions (user-checkbox, editable), pattern tracking,
 * notifications, account, legal.
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    var notificationsEnabled by remember { mutableStateOf(true) }
    var patternTracking by remember { mutableStateOf(true) }
    var rapidTypingDetection by remember { mutableStateOf(true) }
    var launchConditions by remember {
        mutableStateOf(setOf("anxious_spiral", "late_night_send"))
    }

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
            SettingsSection("Notifications") {
                SettingsToggle("Message analysis alerts", notificationsEnabled) { notificationsEnabled = it }
            }
            SettingsSection("AI & Pattern Tracking") {
                SettingsToggle("Enable pattern tracking", patternTracking) { patternTracking = it }
                SettingsToggle("Detect rapid typing / urgency", rapidTypingDetection) { rapidTypingDetection = it }
            }
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
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
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
            SettingsSection("My Conditions") {
                Text(
                    "Select any conditions that apply. This helps Sadie understand your patterns better. Not a diagnosis.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(8.dp))
                val myConditions = remember {
                    mutableStateMapOf(
                        "anxiety" to false, "depression" to false, "adhd" to false,
                        "rsd" to false, "autism" to false, "trauma" to false, "addiction" to false,
                        "bpd" to false, "ptsd" to false, "ocd" to false, "bipolar" to false
                    )
                }
                val conditionLabels = mapOf(
                    "anxiety" to "\uD83D\uDCA8 Anxiety",
                    "depression" to "\uD83C\uDF27\uFE0F Depression",
                    "adhd" to "\u26A1 ADHD",
                    "rsd" to "\uD83D\uDC94 Rejection Sensitivity (RSD)",
                    "autism" to "\uD83E\uDDE9 Autism",
                    "trauma" to "\uD83E\uDE79 Trauma / C-PTSD",
                    "addiction" to "\u26D3\uFE0F Addiction",
                    "bpd" to "\uD83C\uDF0A BPD",
                    "ptsd" to "\uD83C\uDF2A\uFE0F PTSD",
                    "ocd" to "\uD83D\uDD04 OCD",
                    "bipolar" to "\u2194\uFE0F Bipolar"
                )
                conditionLabels.forEach { (key, label) ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                    ) {
                        Text(label, color = OnDarkText, modifier = Modifier.weight(1f))
                        Checkbox(
                            checked = myConditions[key] == true,
                            onCheckedChange = { checked -> myConditions[key] = checked },
                            colors = CheckboxDefaults.colors(checkedColor = GlowPurple)
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "\u26A0\uFE0F Self-reported, not a diagnosis. This is for AI personalization only.",
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                )
            }
            SettingsSection("Account") {
                Text("User ID: holdoff_stacy_001", color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { /* TODO */ }) { Text("Change Password", color = GlowPurple) }
                TextButton(onClick = { /* TODO */ }) { Text("Delete Account", color = ErrorRed) }
            }
            SettingsSection("Legal") {
                TextButton(onClick = { /* TODO */ }) { Text("Terms of Service", color = SoftLavender) }
                TextButton(onClick = { /* TODO */ }) { Text("Privacy Policy", color = SoftLavender) }
                TextButton(onClick = { /* TODO */ }) { Text("Mental Health Disclaimer", color = SoftLavender) }
            }
            Text(
                "HoldOff v1.1.0 \u00b7 Not therapy \u00b7 Not diagnosis \u00b7 Not a substitute for professional care",
                color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(title, fontWeight = FontWeight.SemiBold, color = GlowPurple, style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun SettingsToggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(label, color = OnDarkText, modifier = Modifier.weight(1f))
        Switch(
            checked = value,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = OnDarkText,
                checkedTrackColor = GlowPurple,
                uncheckedThumbColor = OnDarkTextMuted,
                uncheckedTrackColor = SurfaceVariant
            )
        )
    }
}

