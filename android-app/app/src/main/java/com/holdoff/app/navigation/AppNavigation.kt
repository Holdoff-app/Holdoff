package com.holdoff.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.screens.CompanionScreen
import com.holdoff.app.ui.screens.HomeScreen
import com.holdoff.app.ui.screens.LoginScreen
import com.holdoff.app.ui.screens.OnboardingScreen
import com.holdoff.app.ui.screens.PaywallScreen
import com.holdoff.app.ui.screens.PremiumStoryScreen
import com.holdoff.app.ui.screens.InsightsScreen
import com.holdoff.app.ui.screens.ProfileScreen
import com.holdoff.app.ui.screens.SettingsScreen
import com.holdoff.app.ui.screens.ThreadDetailScreen
import com.holdoff.app.ui.screens.QuizScreen
import com.holdoff.app.ui.screens.TrustedContactsScreen
import com.holdoff.app.ui.screens.VerdictScreen

/**
 * All screen routes live here. One place to find and edit navigation.
 */
object Routes {
    const val ONBOARDING     = "onboarding"
    const val LOGIN          = "login"
    const val HOME           = "home"
    const val THREAD_DETAIL  = "thread/{threadId}"
    const val VERDICT        = "verdict/{threadId}"
    const val COMPANION      = "companion"
    const val PREMIUM_STORY  = "story"
    const val PAYWALL        = "paywall"
    const val PROFILE        = "profile"
    const val SETTINGS       = "settings"
    const val INSIGHTS       = "insights"
    const val QUIZ           = "quiz"
    const val TRUSTED        = "trusted-contacts"

    fun threadDetail(id: String) = "thread/$id"
    fun verdict(id: String) = "verdict/$id"
}

@Composable
fun AppNavigation(
    navController: NavHostController,
    startDestination: String,
    isPremium: Boolean,
    onPremiumChanged: (Boolean) -> Unit = {}
) {
    NavHost(navController = navController, startDestination = startDestination) {

        composable(Routes.ONBOARDING) {
            OnboardingScreen(onFinish = {
                navController.navigate(Routes.LOGIN) {
                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                }
            })
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onPremiumChanged = onPremiumChanged
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                onThreadClick = { id -> navController.navigate(Routes.threadDetail(id)) },
                onCompanionClick = { navController.navigate(Routes.COMPANION) },
                onStoryClick = {
                    if (isPremium) navController.navigate(Routes.PREMIUM_STORY)
                    else navController.navigate(Routes.PAYWALL)
                },
                onProfileClick = { navController.navigate(Routes.PROFILE) }
            )
        }

        composable(
            route = Routes.THREAD_DETAIL,
            arguments = listOf(navArgument("threadId") { type = NavType.StringType })
        ) { backStack ->
            val id = backStack.arguments?.getString("threadId") ?: return@composable
            ThreadDetailScreen(
                threadId = id,
                onVerdictClick = { navController.navigate(Routes.verdict(id)) },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.VERDICT,
            arguments = listOf(navArgument("threadId") { type = NavType.StringType })
        ) { backStack ->
            val id = backStack.arguments?.getString("threadId") ?: return@composable
            VerdictScreen(
                threadId = id,
                onBack = { navController.popBackStack() },
                onUpgradeClick = { navController.navigate(Routes.PAYWALL) },
                onTrustedContactsClick = {
                    navController.navigate(Routes.TRUSTED) { launchSingleTop = true }
                },
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
            PaywallScreen(
                onSubscribed = { navController.popBackStack() },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.PROFILE) {
            ProfileScreen(
                onBack = { navController.popBackStack() },
                onSettingsClick = { navController.navigate(Routes.SETTINGS) { launchSingleTop = true } },
                onSubscribeClick = { navController.navigate(Routes.PAYWALL) { launchSingleTop = true } },
                onInsightsClick = { navController.navigate(Routes.INSIGHTS) { launchSingleTop = true } },
                onQuizClick = { navController.navigate(Routes.QUIZ) { launchSingleTop = true } },
                onTrustedContactsClick = { navController.navigate(Routes.TRUSTED) { launchSingleTop = true } },
                isPremium = isPremium
            )
        }

        composable(Routes.INSIGHTS) {
            InsightsScreen(
                onBack = { navController.popBackStack() },
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

        composable(Routes.TRUSTED) {
            TrustedContactsScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}


