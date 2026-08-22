package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.domain.verdict.LocalVerdictResult
import live.shouldiholdoff.holdoff.domain.verdict.VerdictKind
import live.shouldiholdoff.holdoff.ui.theme.*

/**
 * VerdictScreen — shows the local VerdictInterpreter result alongside
 * the Sadie + Dan dual readout before the user sends.
 */
@Composable
fun VerdictScreen(
    verdict: LocalVerdictResult,
    onSend: () -> Unit,
    onHold: () -> Unit,
    onEdit: () -> Unit
) {
    val scrollState = rememberScrollState()
    Surface(Modifier.fillMaxSize(), color = DeepSpace) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(24.dp))

            val (emoji, verdictLabel, verdictColor) = when (verdict.kind) {
                VerdictKind.HOLD_OFF -> Triple("🛑", "Hold Off", MaterialTheme.colorScheme.error)
                VerdictKind.REACH_OUT -> Triple("✅", "Reach Out", StarGlow)
                VerdictKind.WAIT_AND_SEE -> Triple("⏸️", "Wait & See", SoftLavender)
            }

            Text(emoji, style = MaterialTheme.typography.displayMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                verdictLabel,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = verdictColor
            )
            Text(
                "Confidence ${verdict.confidence}%",
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.5f)
            )

            Spacer(Modifier.height(24.dp))

            // Sadie card
            CompanionInsightCard(
                emoji = "💜",
                name = "Sadie",
                message = verdict.sadieMessage
            )

            Spacer(Modifier.height(12.dp))

            // Dan card
            CompanionInsightCard(
                emoji = "🌙",
                name = "Dan",
                message = verdict.danMessage
            )

            // Reasoning
            if (verdict.reasoning.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = TwilightPurple)
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "Why?",
                            style = MaterialTheme.typography.titleSmall,
                            color = StarGlow,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(8.dp))
                        verdict.reasoning.forEach { reason ->
                            Text(
                                "• $reason",
                                style = MaterialTheme.typography.bodySmall,
                                color = SoftLavender.copy(alpha = 0.8f),
                                modifier = Modifier.padding(vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(32.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onEdit,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                ) { Text("Edit", color = SoftLavender) }

                if (verdict.kind == VerdictKind.HOLD_OFF) {
                    Button(
                        onClick = onHold,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Hold Off 💜", fontWeight = FontWeight.Bold) }
                } else {
                    Button(
                        onClick = onSend,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Send ✉️", fontWeight = FontWeight.Bold) }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CompanionInsightCard(emoji: String, name: String, message: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = TwilightPurple)
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Text(emoji, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(name, fontWeight = FontWeight.SemiBold, color = StarGlow)
                Spacer(Modifier.height(4.dp))
                Text(message, style = MaterialTheme.typography.bodyMedium, color = SoftLavender)
            }
        }
    }
}
