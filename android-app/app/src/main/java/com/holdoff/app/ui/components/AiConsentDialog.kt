package com.holdoff.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import com.holdoff.app.ui.theme.*

/**
 * The disclosure that makes the privacy policy true.
 *
 * The policy's lawful basis for sending message text to Google is explicit consent, which has
 * to be specific, informed and given by a real affirmative act. So: both recipients are named,
 * the other person's messages are called out as leaving the phone too, and there is no
 * pre-ticked box and no way to dismiss this by tapping outside it. The only routes out are the
 * two buttons, and neither is styled as the obvious one.
 *
 * Refusing is a normal outcome, not a dead end — the copy says what still works, because
 * consent conditioned on the app being unusable is not freely given.
 */
@Composable
fun AiConsentDialog(
    onGrant: () -> Unit,
    onRefuse: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onRefuse,
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        ),
        containerColor = MidnightNavy,
        titleContentColor = OnDarkText,
        textContentColor = OnDarkTextMuted,
        title = {
            Text(
                "Before I read this, you should know where it goes",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "To give you a verdict, HoldOff sends your draft — and the recent messages " +
                        "in this conversation, including the ones the other person sent — off " +
                        "your phone.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "It goes to HoldOff's own server, and from there to Google's Gemini API. " +
                        "Google processes it and sends back the verdict.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "What we can't tell you yet: how long Google keeps it. That depends on the " +
                        "API terms our key sits under, and we haven't confirmed which tier that " +
                        "is. We'd rather say so than guess.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnDarkTextMuted
                )
                HorizontalDivider(color = DividerColor)
                Text(
                    "If you say no, HoldOff still works.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnDarkText,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "The pause, the countdown, your threads and your trusted contacts all keep " +
                        "working. You just won't get an AI verdict or be able to talk to Sadie. " +
                        "Nothing leaves your phone.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "You can change your mind either way in Settings, at any time.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onGrant) {
                Text("Send it to Google", color = GlowPurple, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onRefuse) {
                Text("Keep it on my phone", color = OnDarkTextMuted, fontWeight = FontWeight.Bold)
            }
        }
    )
}
