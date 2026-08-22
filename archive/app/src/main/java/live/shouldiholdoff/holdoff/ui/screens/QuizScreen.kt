package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.domain.quiz.AttachmentQuiz
import live.shouldiholdoff.holdoff.domain.quiz.QuizAnswer
import live.shouldiholdoff.holdoff.domain.quiz.QuizResult
import live.shouldiholdoff.holdoff.ui.theme.*

@Composable
fun QuizScreen(onComplete: (QuizResult) -> Unit) {
    val answers = remember { mutableStateMapOf<Int, Int>() }
    Surface(Modifier.fillMaxSize(), color = DeepSpace) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                "Attachment-style check-in",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = StarGlow
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "16 quick questions. No right answers. Honest > pretty.",
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.7f)
            )
            Spacer(Modifier.height(12.dp))
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(AttachmentQuiz.QUESTIONS) { q ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = TwilightPurple)
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(q.text, color = SoftLavender)
                            Spacer(Modifier.height(8.dp))
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                (1..5).forEach { v ->
                                    val selected = answers[q.id] == v
                                    FilledTonalButton(
                                        onClick = { answers[q.id] = v },
                                        modifier = Modifier.weight(1f).padding(horizontal = 2.dp),
                                        colors = ButtonDefaults.filledTonalButtonColors(
                                            containerColor = if (selected) MoonlitViolet else TwilightPurple.copy(alpha = 0.5f)
                                        )
                                    ) { Text(v.toString()) }
                                }
                            }
                        }
                    }
                }
            }
            Button(
                onClick = {
                    val list = answers.map { (id, v) -> QuizAnswer(id, v) }
                    onComplete(AttachmentQuiz.score(list))
                },
                enabled = answers.size == AttachmentQuiz.QUESTIONS.size,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    if (answers.size == AttachmentQuiz.QUESTIONS.size)
                        "See my result"
                    else
                        "Answer all ${AttachmentQuiz.QUESTIONS.size} to continue"
                )
            }
        }
    }
}

@Composable
fun QuizResultScreen(result: QuizResult, onContinue: () -> Unit) {
    Surface(Modifier.fillMaxSize(), color = DeepSpace) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("Your Style", style = MaterialTheme.typography.headlineMedium, color = StarGlow, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                result.primary.name.lowercase().replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.displaySmall,
                color = MoonlitViolet,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(16.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = TwilightPurple)
            ) {
                Text(
                    result.summary,
                    modifier = Modifier.padding(20.dp),
                    style = MaterialTheme.typography.bodyLarge,
                    color = SoftLavender
                )
            }
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Continue to HoldOff →", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
