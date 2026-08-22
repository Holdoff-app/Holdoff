package com.holdoff.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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

data class QuizQuestion(
    val text: String,
    val options: List<String>,
    val scores: List<String> // ANX, AVO, FA, SEC
)

private val QUESTIONS = listOf(
    QuizQuestion("When you haven't heard back from someone you care about, your first thought is:", listOf("They're mad at me or pulling away", "They're busy — I'll hear from them eventually", "I want to reach out but I'm afraid of seeming needy", "They probably just haven't seen it yet"), listOf("ANX", "SEC", "FA", "AVO")),
    QuizQuestion("After an argument, you usually:", listOf("Text multiple times trying to fix it immediately", "Need space and go quiet for a while", "Swing between wanting to talk and wanting to disappear", "Address it calmly when you're both ready"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("When someone gets emotionally close to you:", listOf("I crave it but worry I'll lose it", "I feel uncomfortable and need to pull back", "I want it one moment and feel suffocated the next", "I welcome it and feel safe"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("Your texting style in relationships tends to be:", listOf("Long messages, over-explaining, checking in often", "Short, delayed responses, minimal emotional content", "Intense then suddenly distant", "Warm, clear, and responsive without overthinking"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("When plans get cancelled last minute:", listOf("I spiral wondering if it means something deeper", "I'm relieved — I probably needed the alone time", "I'm hurt but pretend I don't care", "I'm disappointed but flexible about rescheduling"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("The phrase that resonates most:", listOf("I just need to know where I stand", "I need my space to figure things out", "I don't know what I want — I just know I'm scared", "I trust that we'll work through this"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("When someone you're close to is upset with you:", listOf("I panic and try to fix it immediately", "I shut down and wait for it to blow over", "I feel torn between apologizing and defending myself", "I listen, take accountability, and communicate clearly"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("Late at night, you're most likely to:", listOf("Reread old messages looking for reassurance", "Enjoy the solitude without reaching out", "Draft a text you'll probably delete", "Sleep, knowing things will be clearer tomorrow"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("How do you feel about vulnerability?", listOf("I over-share hoping to be understood", "I avoid it — showing emotion feels dangerous", "I crave it but punish myself for wanting it", "I share when it feels safe and appropriate"), listOf("ANX", "AVO", "FA", "SEC")),
    QuizQuestion("In a healthy relationship, you believe:", listOf("They should always reassure me that we're okay", "We should each have separate lives and come together when convenient", "I want closeness but it'll probably end like everything else", "We communicate openly and respect each other's pace"), listOf("ANX", "AVO", "FA", "SEC"))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuizScreen(onBack: () -> Unit, onComplete: (String) -> Unit) {
    var currentQuestion by remember { mutableIntStateOf(0) }
    val scores = remember { mutableStateMapOf("ANX" to 0, "AVO" to 0, "FA" to 0, "SEC" to 0) }
    var showResult by remember { mutableStateOf(false) }
    var resultStyle by remember { mutableStateOf("") }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Attachment Style Quiz", fontWeight = FontWeight.Bold, color = OnDarkText) },
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
                .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
                .verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!showResult) {
                // Progress
                LinearProgressIndicator(
                    progress = { (currentQuestion + 1).toFloat() / QUESTIONS.size },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = GlowPurple,
                    trackColor = SurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                Text("Question ${currentQuestion + 1} of ${QUESTIONS.size}", color = OnDarkTextMuted, fontSize = 13.sp)

                Spacer(Modifier.height(32.dp))
                val q = QUESTIONS[currentQuestion]
                Text(q.text, color = OnDarkText, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, lineHeight = 26.sp)
                Spacer(Modifier.height(24.dp))

                q.options.forEachIndexed { idx, option ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
                            .clickable {
                                val style = q.scores[idx]
                                scores[style] = (scores[style] ?: 0) + 1
                                if (currentQuestion < QUESTIONS.size - 1) {
                                    currentQuestion++
                                } else {
                                    val dominant = scores.maxByOrNull { it.value }?.key ?: "SEC"
                                    resultStyle = dominant
                                    showResult = true
                                }
                            },
                        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(option, modifier = Modifier.padding(16.dp), color = OnDarkText, lineHeight = 22.sp)
                    }
                }
            } else {
                // Result
                Spacer(Modifier.height(24.dp))
                val (emoji, title, desc) = when (resultStyle) {
                    "ANX" -> Triple("\uD83D\uDC9C", "Anxious-Preoccupied", "You crave closeness and reassurance. Your texting often seeks validation — long messages, over-explaining, checking in frequently. You feel deeply but fear abandonment.")
                    "AVO" -> Triple("\uD83D\uDDA4", "Dismissive-Avoidant", "You value independence and self-reliance. You pull away when things get intense, keep texts short, and need space to process. Intimacy can feel threatening.")
                    "FA" -> Triple("\uD83D\uDC9C\uD83D\uDDA4", "Fearful-Avoidant", "You want love but fear it equally. You swing between intense connection and sudden withdrawal. Your texts might be passionate one moment, deleted the next.")
                    else -> Triple("\uD83D\uDC9A", "Secure", "You communicate clearly and calmly. You're comfortable with intimacy and independence. You trust the process and don't spiral over response times.")
                }

                Text(emoji, fontSize = 72.sp)
                Spacer(Modifier.height(16.dp))
                Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = GlowPurple)
                Spacer(Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text(desc, color = OnDarkText, lineHeight = 24.sp)
                    }
                }

                Spacer(Modifier.height(20.dp))
                // Score breakdown
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = RoyalPurple.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text("Your scores:", color = SoftLavender, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(8.dp))
                        val labels = mapOf("ANX" to "Anxious", "AVO" to "Avoidant", "FA" to "Fearful", "SEC" to "Secure")
                        scores.forEach { (key, score) ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(labels[key] ?: key, color = OnDarkText)
                                Text("$score / ${QUESTIONS.size}", color = if (key == resultStyle) GlowPurple else OnDarkTextMuted, fontWeight = if (key == resultStyle) FontWeight.Bold else FontWeight.Normal)
                            }
                            LinearProgressIndicator(
                                progress = { score.toFloat() / QUESTIONS.size },
                                modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                                color = if (key == resultStyle) GlowPurple else SoftLavender.copy(alpha = 0.4f),
                                trackColor = SurfaceVariant
                            )
                            Spacer(Modifier.height(4.dp))
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = { onComplete(resultStyle) },
                    colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp)
                ) { Text("Save My Results", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }

                Spacer(Modifier.height(16.dp))
                Text(
                    "\u26A0\uFE0F This quiz is for self-awareness, not diagnosis. It is not a substitute for professional assessment.",
                    color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center, lineHeight = 16.sp
                )
            }
        }
    }
}
