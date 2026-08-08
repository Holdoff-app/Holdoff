package com.holdoff.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.holdoff.app.BuildConfig
import com.holdoff.app.R
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.theme.*

private const val TERMS_URL = "https://smsholdoff.com/terms"
private const val PRIVACY_URL = "https://smsholdoff.com/privacy"
private const val SUPPORT_URL = "https://smsholdoff.com/support"

@Composable
fun SettingsScreen(onBack: () -> Unit, onDataCleared: () -> Unit = {}) {
    val context = LocalContext.current
    var confirmClear by remember { mutableStateOf(false) }

    fun open(url: String) = context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

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
            SettingsSection("Your data") {
                Card(
                    colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        "HoldOff only ever sees a message you hand it — by pasting it here or " +
                            "picking HoldOff from your text-selection menu. Drafts are sent to " +
                            "our analysis service for the length of that one request and are not " +
                            "stored. HoldOff has no access to your messages, contacts or call log.",
                        color = OnDarkText,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(16.dp)
                    )
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = { confirmClear = true }) {
                    Text("Clear data stored on this device", color = ErrorRed)
                }
            }

            SettingsSection("Legal") {
                TextButton(onClick = { open(TERMS_URL) }) { Text("Terms of Service", color = SoftLavender) }
                TextButton(onClick = { open(PRIVACY_URL) }) { Text("Privacy Policy", color = SoftLavender) }
                TextButton(onClick = { open(SUPPORT_URL) }) { Text("Support", color = SoftLavender) }
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.mental_health_disclaimer),
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    stringResource(R.string.crisis_resources),
                    color = OnDarkTextMuted, style = MaterialTheme.typography.bodySmall
                )
            }

            Text(
                "HoldOff v${BuildConfig.VERSION_NAME}",
                color = OnDarkTextMuted, style = MaterialTheme.typography.bodyMedium
            )
        }
    }

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            containerColor = SurfaceVariant,
            title = { Text("Clear local data?", color = OnDarkText) },
            text = {
                Text(
                    "This removes your attachment-style result and saved preferences from this " +
                        "device. Your subscription is not cancelled — it stays on your Google " +
                        "Play account and comes back the next time HoldOff checks.",
                    color = OnDarkTextMuted
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    HoldOffApi.clearAll(context)
                    confirmClear = false
                    onDataCleared()
                }) { Text("Clear", color = ErrorRed) }
            },
            dismissButton = {
                TextButton(onClick = { confirmClear = false }) { Text("Cancel", color = SoftLavender) }
            }
        )
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
