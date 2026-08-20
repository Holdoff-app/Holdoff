package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import kotlinx.coroutines.launch

/** Sign In / Sign Up / Forgot Password — all in one. Calls real backend. */
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, onPremiumChanged: (Boolean) -> Unit = {}) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }
    var forgotMode by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var passwordVisible by remember { mutableStateOf(false) }
    var successMsg by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple, RomanticBlue)))
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            SadieAvatar(size = SadieSize.LARGE)
            Spacer(Modifier.height(16.dp))
            Text("HoldOff", fontSize = 36.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Text(
                when {
                    forgotMode -> "Reset your password"
                    isSignUp   -> "Create your account"
                    else       -> "Welcome back"
                },
                color = OnDarkTextMuted,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(40.dp))

            OutlinedTextField(
                value = email, onValueChange = { email = it; errorMsg = null },
                label = { Text("Email") },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GlowPurple, unfocusedBorderColor = DividerColor,
                    focusedTextColor = OnDarkText, unfocusedTextColor = OnDarkText,
                    cursorColor = GlowPurple, focusedLabelColor = GlowPurple
                ),
                singleLine = true
            )

            if (!forgotMode) {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = password, onValueChange = { password = it; errorMsg = null },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                tint = GlowPurple
                            )
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GlowPurple, unfocusedBorderColor = DividerColor,
                        focusedTextColor = OnDarkText, unfocusedTextColor = OnDarkText,
                        cursorColor = GlowPurple, focusedLabelColor = GlowPurple
                    ),
                    singleLine = true
                )
            }

            if (!isSignUp && !forgotMode) {
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = { forgotMode = true }, modifier = Modifier.align(Alignment.End)) {
                    Text("Forgot Password?", color = SoftLavender, fontSize = 13.sp)
                }
            }

            // Error / success messages
            errorMsg?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, textAlign = TextAlign.Center)
            }
            successMsg?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = GlowPurple, fontSize = 13.sp, textAlign = TextAlign.Center)
            }

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    scope.launch {
                        isLoading = true
                        errorMsg = null
                        successMsg = null
                        when {
                            forgotMode -> {
                                // TODO: call /api/auth/forgot-password
                                successMsg = "If that email is registered, a reset link is on its way."
                                isLoading = false
                            }
                            isSignUp -> {
                                // For sign-up: call login endpoint; backend handles upsert on free tier
                                val result = HoldOffApi.login(ctx, email, password)
                                if (result.ok) {
                                    onPremiumChanged(result.isPremium)
                                    isLoading = false
                                    onLoginSuccess()
                                } else {
                                    errorMsg = result.error ?: "Sign up failed. Try again."
                                    isLoading = false
                                }
                            }
                            else -> {
                                val result = HoldOffApi.login(ctx, email, password)
                                if (result.ok) {
                                    onPremiumChanged(result.isPremium)
                                    isLoading = false
                                    onLoginSuccess()
                                } else {
                                    errorMsg = result.error ?: "Sign in failed. Check your email and password."
                                    isLoading = false
                                }
                            }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                enabled = !isLoading && email.isNotBlank() && (forgotMode || password.isNotBlank())
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnDarkText, strokeWidth = 2.dp)
                } else {
                    Text(
                        when {
                            forgotMode -> "Send Reset Email"
                            isSignUp   -> "Create Account — Free Trial"
                            else       -> "Sign In"
                        },
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (!forgotMode) {
                Spacer(Modifier.height(16.dp))
                OutlinedButton(
                    onClick = { /* Google SSO — coming soon */ },
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("  Continue with Google", color = OnDarkText)
                }
            }

            Spacer(Modifier.height(24.dp))

            if (!forgotMode) {
                TextButton(onClick = { isSignUp = !isSignUp; errorMsg = null }) {
                    Text(
                        if (isSignUp) "Already have an account? Sign In"
                        else "New here? Start free trial",
                        color = SoftLavender,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                TextButton(onClick = { forgotMode = false; errorMsg = null }) {
                    Text("Back to Sign In", color = SoftLavender)
                }
            }
        }
    }
}
