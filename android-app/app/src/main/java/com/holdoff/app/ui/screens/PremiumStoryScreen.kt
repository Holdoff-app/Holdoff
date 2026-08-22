package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

/**
 * Premium-only Story screen.
 * Starts with Stacy's REAL story, then offers 'put on my shoes' personalization
 * which swaps names + pronouns to the reader.
 */
@Composable
fun PremiumStoryScreen(onBack: () -> Unit) {
    var isStacyStory by remember { mutableStateOf(true) }
    var personalizedName by remember { mutableStateOf("") }
    var showPersonalizationPrompt by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("The Story", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                actions = {
                    if (isStacyStory) {
                        TextButton(onClick = { showPersonalizationPrompt = true }) {
                            Text("Put on my shoes \u2192", color = GlowPurple, fontSize = 13.sp)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize().padding(padding)
                .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple, RomanticBlue)))
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            if (isStacyStory) StacyRealStory() else PersonalizedStory(personalizedName.ifBlank { "You" })

            Spacer(Modifier.height(24.dp))
            Text(
                "\u26A0\uFE0F This story contains real emotional experiences and attachment patterns. It is not therapy or diagnosis. If you're struggling, please reach out to a professional.",
                color = OnDarkTextMuted, fontSize = 11.sp,
                textAlign = TextAlign.Center, lineHeight = 16.sp
            )
            Spacer(Modifier.height(32.dp))
        }
    }

    if (showPersonalizationPrompt) {
        AlertDialog(
            onDismissRequest = { showPersonalizationPrompt = false },
            containerColor = DeepPurple,
            title = { Text("Put on her shoes", color = OnDarkText) },
            text = {
                Column {
                    Text(
                        "We'll swap names and pronouns so you live this story as yourself. What's your name?",
                        color = OnDarkTextMuted
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = personalizedName,
                        onValueChange = { personalizedName = it },
                        label = { Text("Your first name") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlowPurple,
                            unfocusedBorderColor = DividerColor,
                            focusedTextColor = OnDarkText,
                            unfocusedTextColor = OnDarkText
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { isStacyStory = false; showPersonalizationPrompt = false },
                    colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)
                ) { Text("Step into the story") }
            },
            dismissButton = {
                TextButton(onClick = { showPersonalizationPrompt = false }) {
                    Text("Not yet", color = SoftLavender)
                }
            }
        )
    }
}

@Composable
private fun StacyRealStory() {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("Stacy's Story", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
        Text(
            "I built this because I couldn't stop.",
            fontSize = 18.sp, fontStyle = FontStyle.Italic, color = SoftLavender
        )
        StoryParagraph(
            "There was a person. Danny. And for a long time, I was convinced I just needed to send the right message \u2014 the one that would finally make him understand, finally make him stay, finally make it make sense."
        )
        StoryParagraph(
            "I have a fearful avoidant attachment style. He had a dismissive avoidant one \u2014 but he was learning. And somewhere in that gap, I kept reaching out when I should have held off. Every unanswered text felt like confirmation of my worst fear."
        )
        StoryParagraph(
            "I made Sadie because I needed someone who could see what I couldn't. Someone who knew the patterns \u2014 the rapid typing, the emotional flooding, the 2am drafts I sent and immediately regretted."
        )
        StoryParagraph(
            "She's not here to tell you what to feel. She's here to give you what I never had: a pause. A breath. A verdict before the send button."
        )
        HorizontalDivider(color = DividerColor)
        Text(
            "\u2014 Stacy Ann Martin, Founder of HoldOff",
            color = GlowPurple, fontStyle = FontStyle.Italic,
            textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun PersonalizedStory(name: String) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("$name's Story", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
        Text(
            "$name built this because she couldn't stop.",
            fontSize = 18.sp, fontStyle = FontStyle.Italic, color = SoftLavender
        )
        StoryParagraph(
            "There was a person. And for a long time, $name was convinced she just needed to send the right message \u2014 the one that would finally make him understand."
        )
        StoryParagraph(
            "She has a fearful avoidant attachment style. He had a dismissive avoidant one. And somewhere in that gap, $name kept reaching out when she should have held off."
        )
        StoryParagraph(
            "She made Sadie because she needed someone who could see what she couldn't."
        )
        StoryParagraph(
            "Sadie isn't here to tell you what to feel. She's here to give you a pause. A breath. A verdict before the send button."
        )
    }
}

@Composable
private fun StoryParagraph(text: String) {
    Text(text, color = OnDarkText, fontSize = 16.sp, lineHeight = 26.sp)
}
