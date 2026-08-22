package com.example.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sms.SmsMessage
import com.example.sms.SmsRepository

/**
 * Real SMS thread view. Reads actual device messages for this conversation and
 * runs outgoing drafts through the existing VERDICT analysis before sending
 * anything risky, using SmsManager (SEND_SMS is already granted app-wide).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmsThreadScreen(
    threadId: Long,
    address: String,
    viewModel: MainViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var messages by remember { mutableStateOf<List<SmsMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var verdictText by remember { mutableStateOf<String?>(null) }
    val isAnalyzing by viewModel.isAnalyzing.collectAsState()

    fun refresh() {
        messages = SmsRepository.getMessagesForThread(context, threadId)
    }

    LaunchedEffect(threadId) { refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(address, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                reverseLayout = true
            ) {
                items(messages.reversed()) { msg ->
                    SmsBubble(msg)
                }
            }

            if (isAnalyzing) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            if (verdictText != null) {
                Card(modifier = Modifier.padding(16.dp).fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("VERDICT check:", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(verdictText ?: "")
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                            TextButton(onClick = { verdictText = null }) { Text("Edit Draft") }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    SmsRepository.sendSms(context, address, inputText)
                                    inputText = ""
                                    verdictText = null
                                    refresh()
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                            ) { Text("Send Anyway") }
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Type a message...") },
                    shape = RoundedCornerShape(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                FloatingActionButton(
                    onClick = {
                        val draft = inputText
                        if (draft.isNotBlank()) {
                            viewModel.analyzeOutgoingMessage(draft) { result ->
                                val looksRisky = result.contains("Yellow", true) || result.contains("Red", true)
                                if (looksRisky) {
                                    verdictText = result
                                } else {
                                    SmsRepository.sendSms(context, address, draft)
                                    inputText = ""
                                    refresh()
                                }
                            }
                        }
                    },
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.onPrimary)
                }
            }
        }
    }
}

@Composable
private fun SmsBubble(msg: SmsMessage) {
    val isOut = msg.isOutgoing
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalAlignment = if (isOut) Alignment.End else Alignment.Start
    ) {
        Surface(
            color = if (isOut) MaterialTheme.colorScheme.primary.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(msg.body, modifier = Modifier.padding(12.dp), fontSize = 15.sp)
        }
    }
}
