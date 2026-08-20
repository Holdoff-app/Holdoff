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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

data class TrustedContact(val name: String, val phone: String, val relation: String)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrustedContactsScreen(onBack: () -> Unit) {
    var contacts by remember { mutableStateOf(listOf<TrustedContact>()) }
    var showAddForm by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newPhone by remember { mutableStateOf("") }
    var newRelation by remember { mutableStateOf("Friend") }

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
            if (contacts.size < 2) {
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
                    Text("\uD83D\uDC65 Your Safety Net", fontWeight = FontWeight.SemiBold, color = GlowPurple)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "During Spiral Lock, all messaging is paused \u2014 except to your trusted contacts. Choose up to 2 people you can always reach.",
                        color = OnDarkText, lineHeight = 22.sp
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
                    Text("Add someone you trust to reach during lockout", color = OnDarkTextMuted, fontSize = 13.sp)
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
                                Text(contact.relation, color = OnDarkTextMuted, fontSize = 13.sp)
                                Text(contact.phone, color = OnDarkTextMuted, fontSize = 12.sp)
                            }
                            IconButton(onClick = {
                                contacts = contacts.toMutableList().also { it.removeAt(idx) }
                            }) {
                                Icon(Icons.Default.Delete, "Remove", tint = Color(0xFFEF4444))
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
                        Spacer(Modifier.height(10.dp))

                        val relations = listOf("Friend", "Family", "Therapist", "Partner", "Other")
                        Text("Relationship", color = OnDarkTextMuted, fontSize = 13.sp)
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            relations.take(3).forEach { rel ->
                                FilterChip(
                                    selected = newRelation == rel,
                                    onClick = { newRelation = rel },
                                    label = { Text(rel, fontSize = 12.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = VelvetPurple,
                                        selectedLabelColor = OnDarkText
                                    )
                                )
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            relations.drop(3).forEach { rel ->
                                FilterChip(
                                    selected = newRelation == rel,
                                    onClick = { newRelation = rel },
                                    label = { Text(rel, fontSize = 12.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = VelvetPurple,
                                        selectedLabelColor = OnDarkText
                                    )
                                )
                            }
                        }

                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(onClick = { showAddForm = false; newName = ""; newPhone = "" }) {
                                Text("Cancel", color = SoftLavender)
                            }
                            Button(
                                onClick = {
                                    if (newName.isNotBlank() && newPhone.isNotBlank()) {
                                        contacts = contacts + TrustedContact(newName, newPhone, newRelation)
                                        showAddForm = false; newName = ""; newPhone = ""
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                                enabled = newName.isNotBlank() && newPhone.isNotBlank()
                            ) { Text("Add Contact") }
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                "\u26A0\uFE0F Trusted contacts are for crisis messaging only. HoldOff is not therapy and not a substitute for professional care.",
                color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center, lineHeight = 16.sp
            )
        }
    }
}
