package com.holdoff.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.rememberNavController
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.data.prefs.ConsentManager
import com.holdoff.app.navigation.AppNavigation
import com.holdoff.app.navigation.Routes
import com.holdoff.app.ui.theme.HoldOffTheme

/**
 * Single-activity host. All screens are Composables; navigation
 * is handled by Navigation Compose in AppNavigation.kt.
 *
 * Start destination is driven by explicit onboarding/consent state
 * (ConsentManager), not by token presence:
 *   onboarding incomplete        -> ONBOARDING
 *   onboarded, signed out        -> LOGIN
 *   onboarded, signed in         -> HOME
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            HoldOffTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    val context = LocalContext.current
                    // Read premium status from saved prefs (set during login)
                    var isPremium by remember { mutableStateOf(HoldOffApi.isPremium(context)) }
                    val startDestination = remember {
                        when {
                            !ConsentManager.isOnboardingComplete(context) -> Routes.ONBOARDING
                            HoldOffApi.getToken(context) == null          -> Routes.LOGIN
                            else                                          -> Routes.HOME
                        }
                    }
                    AppNavigation(
                        navController = navController,
                        startDestination = startDestination,
                        isPremium = isPremium,
                        onPremiumChanged = { isPremium = it }
                    )
                }
            }
        }
    }
}
