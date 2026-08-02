package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
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
import com.holdoff.app.data.prefs.AppPrefs
import com.holdoff.app.ui.theme.*

private const val MAX_TRUSTED_CONTACTS = 2

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrustedContactsScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val contacts = remember { mutableStateListOf<AppPrefs.TrustedContact>().apply { addAll(AppPrefs.trustedContacts(ctx)) } }
    var showAddForm by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newPhone by remember { mutableStateOf("") }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Trusted Contacts", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        },
        floatingActionButton = {
            if (contacts.size < MAX_TRUSTED_CONTACTS) {
                FloatingActionButton(
                    onClick = { showAddForm = true },
                    containerColor = VelvetPurple,
                    contentColor = OnDarkText
                ) { Icon(Icons.Default.Add, "Add contact") }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
                .verticalScroll(rememberScrollState()).padding(24.dp)
        ) {
            // Info card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text("\uD83D\uDC65 Someone Safer to Text", fontWeight = FontWeight.SemiBold, color = GlowPurple)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "A trusted contact is a person you'd rather reach out to instead of sending the message you're holding. Keep up to 2 here so you're not hunting for a name at 2am.",
                        color = OnDarkText, lineHeight = 22.sp
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "HoldOff doesn't message them for you, and it doesn't block anyone. This is just your list.",
                        color = OnDarkTextMuted, fontSize = 13.sp, lineHeight = 18.sp
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            if (contacts.isEmpty()) {
                // Empty state
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("\uD83D\uDC65", fontSize = 56.sp)
                    Spacer(Modifier.height(12.dp))
                    Text("No trusted contacts yet", color = OnDarkText, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Add someone you'd text instead when you're holding off",
                        color = OnDarkTextMuted, fontSize = 13.sp, textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { showAddForm = true },
                        colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)
                    ) { Text("Add a Trusted Contact") }
                }
            } else {
                contacts.forEachIndexed { idx, contact ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier.size(48.dp).clip(CircleShape)
                                    .background(Brush.radialGradient(listOf(VelvetPurple, RoyalPurple))),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(contact.name.firstOrNull()?.toString() ?: "?", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
                            }
                            Spacer(Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(contact.name, color = OnDarkText, fontWeight = FontWeight.SemiBold)
                                Text(contact.number, color = OnDarkTextMuted, fontSize = 13.sp)
                            }
                            IconButton(onClick = {
                                contacts.removeAt(idx)
                                AppPrefs.setTrustedContacts(ctx, contacts.toList())
                            }) {
                                Icon(Icons.Default.Delete, "Remove ${contact.name}", tint = ErrorRed)
                            }
                        }
                    }
                }
            }

            // Add form
            if (showAddForm) {
                Spacer(Modifier.height(20.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text("Add Trusted Contact", fontWeight = FontWeight.SemiBold, color = GlowPurple)
                        Spacer(Modifier.height(12.dp))

                        OutlinedTextField(
                            value = newName, onValueChange = { newName = it },
                            label = { Text("Name") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GlowPurple,
                                unfocusedBorderColor = SurfaceVariant,
                                focusedTextColor = OnDarkText,
                                unfocusedTextColor = OnDarkText,
                                focusedLabelColor = SoftLavender,
                                unfocusedLabelColor = OnDarkTextMuted
                            )
                        )
                        Spacer(Modifier.height(10.dp))

                        OutlinedTextField(
                            value = newPhone, onValueChange = { newPhone = it },
                            label = { Text("Phone number") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GlowPurple,
                                unfocusedBorderColor = SurfaceVariant,
                                focusedTextColor = OnDarkText,
                                unfocusedTextColor = OnDarkText,
                                focusedLabelColor = SoftLavender,
                                unfocusedLabelColor = OnDarkTextMuted
                            )
                        )

                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(onClick = { showAddForm = false; newName = ""; newPhone = "" }) {
                                Text("Cancel", color = SoftLavender)
                            }
                            Button(
                                onClick = {
                                    if (newName.isNotBlank() && newPhone.isNotBlank() && contacts.size < MAX_TRUSTED_CONTACTS) {
                                        contacts.add(AppPrefs.TrustedContact(newName.trim(), newPhone.trim()))
                                        AppPrefs.setTrustedContacts(ctx, contacts.toList())
                                        showAddForm = false; newName = ""; newPhone = ""
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                                enabled = newName.isNotBlank() && newPhone.isNotBlank() && contacts.size < MAX_TRUSTED_CONTACTS
                            ) { Text("Add Contact") }
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                "\u26A0\uFE0F HoldOff is not therapy and not a substitute for professional care.",
                color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center, lineHeight = 16.sp
            )
        }
    }
}
