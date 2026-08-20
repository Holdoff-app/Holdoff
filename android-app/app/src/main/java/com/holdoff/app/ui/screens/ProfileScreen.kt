package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

@Composable
fun ProfileScreen(
    onBack: () -> Unit,
    onSettingsClick: () -> Unit,
    onSubscribeClick: () -> Unit,
    onInsightsClick: () -> Unit = {},
    onQuizClick: () -> Unit = {},
    onTrustedContactsClick: () -> Unit = {},
    isPremium: Boolean = false
) {
    // TODO: load from auth/DataStore
    val userName = "Stacy Ann Martin"
    val userEmail = "stacyfoster30@gmail.com"

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Profile", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, "Settings", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier.size(90.dp).clip(CircleShape)
                    .background(Brush.radialGradient(listOf(GlowPurple, VelvetPurple, DeepPurple))),
                contentAlignment = Alignment.Center
            ) {
                Text(userName.firstOrNull()?.toString() ?: "S",
                    fontSize = 36.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            }
            Spacer(Modifier.height(16.dp))
            Text(userName, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Text(userEmail, color = OnDarkTextMuted)
            Text("User ID: holdoff_stacy_001", color = OnDarkTextMuted, fontSize = 11.sp)
            Spacer(Modifier.height(12.dp))

            if (isPremium) {
                Row(
                    modifier = Modifier.clip(RoundedCornerShape(20.dp))
                        .background(VelvetPurple.copy(alpha = 0.3f))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("\u2728", fontSize = 14.sp)
                    Text(if (isPremium) "Lifetime Founder ✨" else "Premium Member", color = GlowPurple, fontWeight = FontWeight.SemiBold)
                }
            } else {
                Button(onClick = onSubscribeClick, colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)) {
                    Text("Subscribe Now \u2728")
                }
            }

            Spacer(Modifier.height(32.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem("0", "Verdicts")
                    StatItem("0", "Hold Offs")
                    StatItem("0", "Days Active")
                }
            }

            Spacer(Modifier.height(24.dp))


            // Danny's Gift – the origin story
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = VelvetPurple.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
                border = androidx.compose.foundation.BorderStroke(1.dp, GlowPurple.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("\uD83C\uDF81", fontSize = 20.sp)
                        Text("Gift HoldOff", fontWeight = FontWeight.Bold, color = OnDarkText, fontSize = 16.sp)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "\u201CIt was my idea \u2014 to make something so people like me could gift it to the person they can\u2019t stop thinking about. Because I knew she needed it. And honestly\u2026 I needed her to have it, too.\u201D",
                        color = SoftLavender,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Normal,
                        lineHeight = 22.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "\u2014 Danny",
                        color = GlowPurple,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Give someone you love the gift of clarity. Send them HoldOff.",
                        color = OnDarkTextMuted,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = onSubscribeClick,
                        colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Send a Gift \u2728")
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            val menu = listOf(
                Triple(Icons.Default.Settings, "Settings", onSettingsClick),
                Triple(Icons.Default.Quiz, "Attachment Style Quiz", onQuizClick),
                Triple(Icons.Default.Shield, "Trusted Contacts", onTrustedContactsClick),
                Triple(Icons.Default.Star, "Insights", onInsightsClick),
                Triple(Icons.AutoMirrored.Filled.Send, "Suggestion Box") { /* TODO: open form */ },
                Triple(Icons.Default.CardGiftcard, "Gift HoldOff", onSubscribeClick),
                Triple(Icons.Default.People, "Affiliate Program") { /* TODO */ },
                Triple(Icons.Default.Handshake, "Partner With Us") { /* TODO */ },
                Triple(Icons.Default.Description, "Terms & Privacy") { /* TODO */ },
                Triple(Icons.AutoMirrored.Filled.Logout, "Sign Out") { /* TODO */ }
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                menu.forEachIndexed { i, (icon, label, action) ->
                    MenuRow(icon, label, action)
                    if (i < menu.size - 1) HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
                }
            }
        }
    }
}

@Composable
private fun StatItem(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = GlowPurple)
        Text(label, color = OnDarkTextMuted, fontSize = 12.sp)
    }
}

@Composable
private fun MenuRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(icon, contentDescription = label, tint = SoftLavender)
        Text(label, color = OnDarkText, modifier = Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, null, tint = OnDarkTextMuted)
    }
}


