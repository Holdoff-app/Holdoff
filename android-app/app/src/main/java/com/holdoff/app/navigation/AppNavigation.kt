package com.holdoff.app.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.screens.CompanionScreen
import com.holdoff.app.ui.screens.HomeScreen
import com.holdoff.app.ui.screens.OnboardingScreen
import com.holdoff.app.ui.screens.PaywallScreen
import com.holdoff.app.ui.screens.PremiumStoryScreen
import com.holdoff.app.ui.screens.ProfileScreen
import com.holdoff.app.ui.screens.SettingsScreen
import com.holdoff.app.ui.screens.QuizScreen
import com.holdoff.app.ui.screens.VerdictScreen
import com.holdoff.app.viewmodel.DraftViewModel

const val PRIVACY_URL = "https://smsholdoff.com/privacy"

/**
 * All screen routes live here. One place to find and edit navigation.
 */
object Routes {
    const val ONBOARDING     = "onboarding"
    const val HOME           = "home"
    const val VERDICT        = "verdict"
    const val COMPANION      = "companion"
    const val PREMIUM_STORY  = "story"
    const val PAYWALL        = "paywall"
    const val PROFILE        = "profile"
    const val SETTINGS       = "settings"
    const val QUIZ           = "quiz"
}

@Composable
fun AppNavigation(
    navController: NavHostController,
    startDestination: String,
    isPremium: Boolean,
    onPremiumChanged: (Boolean) -> Unit = {}
) {
    // Hoisted here so the composer and the verdict screen read the same draft.
    val draftVm: DraftViewModel = viewModel()

    NavHost(navController = navController, startDestination = startDestination) {

        composable(Routes.ONBOARDING) {
            val context = LocalContext.current
            OnboardingScreen(onFinish = {
                HoldOffApi.markOnboarded(context)
                navController.navigate(Routes.HOME) {
                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                }
            })
        }

        composable(Routes.HOME) {
            HomeScreen(
                vm = draftVm,
                onVerdictReady = {
                    navController.navigate(Routes.VERDICT) { launchSingleTop = true }
                },
                onCompanionClick = { navController.navigate(Routes.COMPANION) },
                onProfileClick = { navController.navigate(Routes.PROFILE) }
            )
        }

        composable(Routes.VERDICT) {
            val state by draftVm.state.collectAsState()
            VerdictScreen(
                verdict = state.verdict,
                isAnalyzing = state.isAnalyzing,
                error = state.error,
                onBack = { navController.popBackStack() },
                onRetry = { draftVm.analyze() },
                onUpgradeClick = { navController.navigate(Routes.PAYWALL) },
                isPremium = isPremium
            )
        }

        composable(Routes.COMPANION) {
            CompanionScreen(
                onBack = { navController.popBackStack() },
                onUpgradeClick = { navController.navigate(Routes.PAYWALL) },
                isPremium = isPremium
            )
        }

        composable(Routes.PREMIUM_STORY) {
            PremiumStoryScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.PAYWALL) {
            val context = LocalContext.current
            PaywallScreen(
                onSubscribed = { navController.popBackStack() },
                onBack = { navController.popBackStack() },
                onPremiumChanged = { premium ->
                    HoldOffApi.savePremium(context, premium)
                    onPremiumChanged(premium)
                }
            )
        }

        composable(Routes.PROFILE) {
            val context = LocalContext.current
            ProfileScreen(
                onBack = { navController.popBackStack() },
                onSettingsClick = { navController.navigate(Routes.SETTINGS) { launchSingleTop = true } },
                onSubscribeClick = { navController.navigate(Routes.PAYWALL) { launchSingleTop = true } },
                onQuizClick = { navController.navigate(Routes.QUIZ) { launchSingleTop = true } },
                onStoryClick = {
                    if (isPremium) navController.navigate(Routes.PREMIUM_STORY)
                    else navController.navigate(Routes.PAYWALL)
                },
                onPrivacyClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL)))
                },
                isPremium = isPremium
            )
        }

        composable(Routes.QUIZ) {
            val context = LocalContext.current
            QuizScreen(
                onBack = { navController.popBackStack() },
                onComplete = { style ->
                    HoldOffApi.saveAttachmentStyle(context, style)
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onDataCleared = {
                    draftVm.clear()
                    onPremiumChanged(false)
                    navController.navigate(Routes.HOME) { popUpTo(0) }
                }
            )
        }
    }
}


