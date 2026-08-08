package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import com.holdoff.app.viewmodel.DraftViewModel

/**
 * The composer. The user pastes or types the message they are about to send and
 * HoldOff reads that one message — nothing else on the device.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: DraftViewModel,
    onVerdictReady: () -> Unit,
    onCompanionClick: () -> Unit,
    onProfileClick: () -> Unit
) {
    val state by vm.state.collectAsState()

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("HoldOff", fontWeight = FontWeight.Bold, color = OnDarkText) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy),
                actions = {
                    IconButton(onClick = onProfileClick) {
                        Icon(Icons.Default.Person, contentDescription = "Profile", tint = SoftLavender)
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCompanionClick,
                containerColor = VelvetPurple,
                contentColor = OnDarkText
            ) { SadieAvatar(size = SadieSize.SMALL) }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Before you send it.",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = OnDarkText,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Paste the message you're about to send. HoldOff reads only what you put here.",
                color = OnDarkTextMuted,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = state.draft,
                onValueChange = vm::updateDraft,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 180.dp),
                placeholder = { Text("I just need to know if you still…", color = OnDarkTextMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GlowPurple,
                    unfocusedBorderColor = DividerColor,
                    focusedTextColor = OnDarkText,
                    unfocusedTextColor = OnDarkText,
                    cursorColor = GlowPurple,
                    focusedContainerColor = SurfaceVariant,
                    unfocusedContainerColor = SurfaceVariant
                )
            )

            Spacer(Modifier.height(20.dp))

            Button(
                // The verdict screen owns the waiting, retry and error states.
                onClick = { vm.analyze(); onVerdictReady() },
                enabled = state.draft.isNotBlank() && !state.isAnalyzing,
                colors = ButtonDefaults.buttonColors(
                    containerColor = VelvetPurple,
                    disabledContainerColor = SurfaceVariant
                ),
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                if (state.isAnalyzing) {
                    CircularProgressIndicator(
                        color = OnDarkText,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text("Reading it…", fontSize = 16.sp)
                } else {
                    Text("Should I send this?", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(28.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = RoyalPurple.copy(alpha = 0.35f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text("Faster way", color = SoftLavender, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "In any messaging app, select your draft, open the selection menu and " +
                            "choose HoldOff. You get the same read without leaving the " +
                            "conversation, and HoldOff can hand back a calmer rewrite in place.",
                        color = OnDarkText,
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(
                "HoldOff is not therapy, not a diagnosis, and not a substitute for professional " +
                    "mental health care.",
                color = OnDarkTextMuted,
                fontSize = 11.sp,
                lineHeight = 16.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}
