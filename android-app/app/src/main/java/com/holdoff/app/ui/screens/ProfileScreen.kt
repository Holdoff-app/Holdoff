package com.holdoff.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

@Composable
fun ProfileScreen(
    onBack: () -> Unit,
    onSettingsClick: () -> Unit,
    onSubscribeClick: () -> Unit,
    onQuizClick: () -> Unit = {},
    onStoryClick: () -> Unit = {},
    onPrivacyClick: () -> Unit = {},
    isPremium: Boolean = false
) {
    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("You", fontWeight = FontWeight.Bold, color = OnDarkText) },
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
            ) { Text("💜", fontSize = 36.sp) }

            Spacer(Modifier.height(16.dp))

            if (isPremium) {
                Row(
                    modifier = Modifier.clip(RoundedCornerShape(20.dp))
                        .background(VelvetPurple.copy(alpha = 0.3f))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("✨", fontSize = 14.sp)
                    Text("Premium", color = GlowPurple, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Managed in your Google Play account.",
                    color = OnDarkTextMuted, fontSize = 12.sp, textAlign = TextAlign.Center
                )
            } else {
                Text(
                    "HoldOff Free",
                    fontSize = 20.sp, fontWeight = FontWeight.Bold, color = OnDarkText
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Every draft you paste gets a verdict. Premium adds Sadie’s rewrite.",
                    color = OnDarkTextMuted, fontSize = 13.sp,
                    textAlign = TextAlign.Center, lineHeight = 18.sp
                )
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = onSubscribeClick,
                    colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)
                ) { Text("See Premium ✨") }
            }

            Spacer(Modifier.height(32.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = VelvetPurple.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, GlowPurple.copy(alpha = 0.3f))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        "“I made it because I needed it — honestly, because I was bugging him. " +
                            "But maybe it’ll help someone else too.”",
                        color = SoftLavender, fontSize = 14.sp,
                        lineHeight = 22.sp, fontStyle = FontStyle.Italic
                    )
                    Spacer(Modifier.height(6.dp))
                    Text("— the reason HoldOff exists", color = GlowPurple, fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(24.dp))

            val menu = listOf(
                Triple(Icons.Default.Settings, "Settings", onSettingsClick),
                Triple(Icons.Default.Quiz, "Attachment Style Quiz", onQuizClick),
                Triple(Icons.Default.AutoStories, "The Story", onStoryClick),
                Triple(Icons.Default.Description, "Terms & Privacy", onPrivacyClick)
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
