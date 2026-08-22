package com.holdoff.app.ui.screens

import android.Manifest
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.holdoff.app.data.model.SMSThread
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import com.holdoff.app.viewmodel.HomeViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** SMS thread list — the main screen after login. */
@Composable
fun HomeScreen(
    onThreadClick: (String) -> Unit,
    onCompanionClick: () -> Unit,
    onStoryClick: () -> Unit,
    onProfileClick: () -> Unit,
    vm: HomeViewModel = viewModel()
) {
    val context = LocalContext.current
    val state by vm.state.collectAsState()

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results -> if (results.values.all { it }) vm.onPermissionGranted() }

    LaunchedEffect(Unit) {
        val perms = mutableListOf(Manifest.permission.READ_SMS, Manifest.permission.READ_CONTACTS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val granted = perms.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
        if (granted) vm.onPermissionGranted()
        else {
            val reqPerms = mutableListOf(
                Manifest.permission.READ_SMS,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.RECEIVE_SMS
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reqPerms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            permLauncher.launch(reqPerms.toTypedArray())
        }
    }

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
        when {
            !state.hasPermission -> PermissionRequestUI {
                permLauncher.launch(arrayOf(Manifest.permission.READ_SMS, Manifest.permission.READ_CONTACTS))
            }
            state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = GlowPurple)
            }
            state.threads.isEmpty() -> EmptyThreadsUI()
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(state.threads, key = { it.threadId }) { thread ->
                    ThreadListItem(thread = thread, onClick = { onThreadClick(thread.threadId) })
                }
            }
        }
    }
}

@Composable
private fun ThreadListItem(thread: SMSThread, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(52.dp).clip(CircleShape)
                .background(Brush.radialGradient(listOf(VelvetPurple, RoyalPurple))),
            contentAlignment = Alignment.Center
        ) {
            Text(
                thread.contactName.firstOrNull()?.toString() ?: "?",
                fontSize = 20.sp, fontWeight = FontWeight.Bold, color = OnDarkText
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    thread.contactName,
                    fontWeight = if (thread.unreadCount > 0) FontWeight.Bold else FontWeight.Normal,
                    color = OnDarkText, fontSize = 15.sp
                )
                Text(formatTime(thread.lastMessageTime), color = OnDarkTextMuted, fontSize = 12.sp)
            }
            Spacer(Modifier.height(4.dp))
            Text(
                thread.lastMessage.take(60) + if (thread.lastMessage.length > 60) "\u2026" else "",
                color = OnDarkTextMuted, fontSize = 13.sp, maxLines = 1
            )
        }
    }
    HorizontalDivider(color = DividerColor, thickness = 0.5.dp, modifier = Modifier.padding(start = 80.dp))
}

@Composable
private fun PermissionRequestUI(onGrant: () -> Unit) {
    Box(Modifier.fillMaxSize().background(MidnightNavy), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Text("\uD83D\uDCAC", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text(
                "HoldOff needs access to your messages and contacts to help you.",
                color = OnDarkText, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))
            Button(onClick = onGrant, colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple), modifier = Modifier.fillMaxWidth()) {
                Text("Grant Access")
            }
        }
    }
}

@Composable
private fun EmptyThreadsUI() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("\uD83D\uDCED", fontSize = 64.sp)
            Spacer(Modifier.height(12.dp))
            Text("No messages yet", color = OnDarkText, style = MaterialTheme.typography.titleMedium)
            Text("Your threads will appear here", color = OnDarkTextMuted)
        }
    }
}

private fun formatTime(t: Long): String {
    val diff = System.currentTimeMillis() - t
    return when {
        diff < 60_000 -> "now"
        diff < 3_600_000 -> "${diff / 60_000}m"
        diff < 86_400_000 -> "${diff / 3_600_000}h"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(t))
    }
}

