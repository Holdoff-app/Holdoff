package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.domain.models.User
import live.shouldiholdoff.holdoff.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    user: User?,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit,
    onSubscribe: () -> Unit,
    onManageSubscription: () -> Unit,
    onSuggestionBox: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text("Settings", style = MaterialTheme.typography.headlineMedium, color = StarGlow)
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepSpace)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Account section
            item {
                SettingsSection(title = "Account") {
                    if (user != null) {
                        AccountRow(user = user, onSignOut = onSignOut)
                    } else {
                        SignInRow(onSignIn = onSignIn)
                    }
                }
            }

            // Subscription section
            item {
                SettingsSection(title = "Subscription") {
                    val subStatus = user?.subscriptionStatus ?: "free"
                    if (subStatus in listOf("trial", "active")) {
                        SettingsRow(
                            icon = "✨",
                            title = "Manage Subscription",
                            subtitle = "Currently: ${subStatus.capitalize()}",
                            onClick = onManageSubscription
                        )
                    } else {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = TwilightPurple),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "✨ HoldOff Premium",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = StarGlow
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Unlock the interactive story, advanced relationship insights, and full AI companion.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = SoftLavender.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Button(
                                    onClick = onSubscribe,
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = NightBloom)
                                ) {
                                    Text("Subscribe Now — \$9.99/mo")
                                }
                            }
                        }
                    }
                }
            }

            // Launch Categories
            item {
                SettingsSection(title = "Launch Categories") {
                    LaunchCategoriesRow()
                }
            }

            // Links
            item {
                SettingsSection(title = "Community") {
                    SettingsRow(
                        icon = "💌",
                        title = "Suggestion Box",
                        subtitle = "Share feedback with our team",
                        onClick = onSuggestionBox
                    )
                    SettingsRow(
                        icon = "🤝",
                        title = "Become an Affiliate",
                        subtitle = "Earn sharing HoldOff",
                        onClick = { /* open affiliate link */ }
                    )
                    SettingsRow(
                        icon = "🌐",
                        title = "Partner With Us",
                        subtitle = "Brand & podcast partnerships",
                        onClick = { /* open partnership link */ }
                    )
                }
            }

            // Legal
            item {
                SettingsSection(title = "Legal") {
                    SettingsRow(icon = "📄", title = "Privacy Policy", onClick = { })
                    SettingsRow(icon = "📋", title = "Terms of Service", onClick = { })
                    SettingsRow(icon = "ℹ️", title = "About HoldOff", onClick = { })
                }
            }
        }
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MoonlitViolet,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DuskPurple.copy(alpha = 0.6f)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(4.dp)) {
                content()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsRow(icon: String, title: String, subtitle: String = "", onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.Transparent),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(icon, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(28.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, color = StarlightWhite)
                if (subtitle.isNotEmpty()) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = SoftLavender.copy(alpha = 0.6f)
                    )
                }
            }
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TwilightPurple,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
fun AccountRow(user: User, onSignOut: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            modifier = Modifier.size(40.dp),
            shape = androidx.compose.foundation.shape.CircleShape,
            color = NightBloom
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    user.displayName.firstOrNull()?.toString() ?: "U",
                    style = MaterialTheme.typography.titleMedium,
                    color = StarlightWhite
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(user.displayName, style = MaterialTheme.typography.bodyMedium, color = StarlightWhite)
            Text(user.email, style = MaterialTheme.typography.bodySmall, color = SoftLavender.copy(alpha = 0.7f))
            Text(
                "ID: ${user.userId.take(8)}...",
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.4f)
            )
        }
        TextButton(onClick = onSignOut) {
            Text("Sign Out", color = ErrorRed)
        }
    }
}

@Composable
fun SignInRow(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Sign in to sync your data", style = MaterialTheme.typography.bodyMedium, color = SoftLavender)
        Spacer(modifier = Modifier.height(10.dp))
        Button(
            onClick = onSignIn,
            colors = ButtonDefaults.buttonColors(containerColor = NightBloom),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Sign In with Google")
        }
    }
}

@Composable
fun LaunchCategoriesRow() {
    val categories = remember {
        mutableStateListOf(
            Pair("After a breakup", true),
            Pair("While dating", true),
            Pair("Long distance", false),
            Pair("Post-argument", true),
            Pair("Late night impulse", true),
            Pair("Social anxiety", false),
        )
    }

    Column(modifier = Modifier.padding(12.dp)) {
        Text(
            "Choose when HoldOff should help you pause:",
            style = MaterialTheme.typography.bodySmall,
            color = SoftLavender.copy(alpha = 0.7f)
        )
        Spacer(modifier = Modifier.height(8.dp))
        categories.forEachIndexed { index, (label, checked) ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = { categories[index] = Pair(label, it) },
                    colors = CheckboxDefaults.colors(
                        checkedColor = NightBloom,
                        uncheckedColor = TwilightPurple
                    )
                )
                Text(label, style = MaterialTheme.typography.bodyMedium, color = StarlightWhite)
            }
        }
    }
}
