package live.shouldiholdoff.holdoff

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.android.billingclient.api.ProductDetails
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import kotlinx.coroutines.launch
import live.shouldiholdoff.holdoff.billing.BillingManager
import live.shouldiholdoff.holdoff.sync.SyncWorker
import live.shouldiholdoff.holdoff.ui.screens.*
import live.shouldiholdoff.holdoff.ui.theme.*

sealed class Screen(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Home      : Screen("home", "Home", Icons.Default.Home)
    object Companion : Screen("companion", "Sadie", Icons.Default.Favorite)
    object Settings  : Screen("settings", "Settings", Icons.Default.Settings)
}

private object Routes {
    const val COMPANION_INTRO = "companion_intro"
    const val QUIZ            = "quiz"
    const val PAYWALL         = "paywall"
    const val STORY           = "story"
}

val bottomNavItems = listOf(Screen.Home, Screen.Companion, Screen.Settings)

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()
    private lateinit var billingManager: BillingManager

    // Permission launcher
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val smsGranted = permissions[Manifest.permission.READ_SMS] == true
        if (smsGranted) {
            viewModel.loadThreads()
            // Analyze on-device right away, but only sync to the server if the
            // user has separately opted in. enqueue() no-ops otherwise.
            SyncWorker.enqueue(this)
        }
    }

    // Google Sign-In launcher
    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
            account?.idToken?.let { idToken ->
                kotlinx.coroutines.MainScope().launch {
                    viewModel.signInWithGoogle(idToken)
                }
            }
        } catch (e: Exception) {
            // Sign-in failed
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Connect Play Billing
        billingManager = BillingManager(this)
        billingManager.connect()

        // Request SMS + contacts permission on launch
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.READ_SMS,
                Manifest.permission.READ_CONTACTS
            )
        )

        setContent {
            HoldOffTheme {
                val billingProducts by billingManager.products.collectAsState()
                HoldOffApp(
                    viewModel = viewModel,
                    billingProducts = billingProducts,
                    onSignIn = { launchGoogleSignIn() },
                    onOpenUrl = { url -> openUrl(url) },
                    onSubscribe = { product -> billingManager.launchPurchaseFlow(this, product) }
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Refresh entitlement on every resume (handles restored subscriptions)
        billingManager.refreshEntitlement()
    }

    override fun onDestroy() {
        super.onDestroy()
        billingManager.disconnect()
    }

    private fun launchGoogleSignIn() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken("YOUR_WEB_CLIENT_ID") // Replace with actual client ID from Firebase/GCP
            .requestEmail()
            .build()
        val client = GoogleSignIn.getClient(this, gso)
        signInLauncher.launch(client.signInIntent)
    }

    private fun openUrl(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HoldOffApp(
    viewModel: MainViewModel,
    billingProducts: List<ProductDetails>,
    onSignIn: () -> Unit,
    onOpenUrl: (String) -> Unit,
    onSubscribe: (ProductDetails) -> Unit
) {
    val navController = rememberNavController()
    val uiState by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()

    // Load companion messages on first composition
    LaunchedEffect(Unit) {
        viewModel.loadCompanionMessages()
    }

    // Show paywall dialog when gate fires
    if (uiState.showPaywall) {
        PaywallScreen(
            products = billingProducts,
            onSubscribe = { product ->
                viewModel.dismissPaywall()
                onSubscribe(product)
            },
            onDismiss = { viewModel.dismissPaywall() }
        )
        return
    }

    Scaffold(
        containerColor = DeepSpace,
        bottomBar = {
            NavigationBar(containerColor = MidnightVelvet) {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                bottomNavItems.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = StarGlow,
                            selectedTextColor = StarGlow,
                            unselectedIconColor = SoftLavender.copy(alpha = 0.5f),
                            unselectedTextColor = SoftLavender.copy(alpha = 0.5f),
                            indicatorColor = TwilightPurple
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                if (uiState.selectedThread != null) {
                    ThreadDetailScreen(
                        thread = uiState.selectedThread!!,
                        isAnalyzing = uiState.isAnalyzingThread,
                        onBack = { viewModel.clearSelectedThread() },
                        onAskSadie = {
                            viewModel.clearSelectedThread()
                            navController.navigate(Screen.Companion.route)
                        }
                    )
                } else {
                    HomeScreen(
                        threads = uiState.threads,
                        isLoading = uiState.isLoadingThreads,
                        onThreadClick = { thread -> viewModel.selectThread(thread) },
                        onAskSadie = { navController.navigate(Screen.Companion.route) }
                    )
                }
            }

            composable(Screen.Companion.route) {
                // Show disclosure first if not acknowledged
                if (!uiState.companionDisclosureAcknowledged) {
                    CompanionIntroScreen(
                        onAcknowledge = { viewModel.acknowledgeCompanionDisclosure() }
                    )
                } else {
                    CompanionScreen(
                        messages = uiState.companionMessages,
                        isPremium = viewModel.isPremium,
                        isLoading = uiState.isCompanionLoading,
                        onSendMessage = { text -> viewModel.sendCompanionMessage(text) },
                        onStoryClick = { navController.navigate(Routes.STORY) },
                        onUpgrade = { navController.navigate(Routes.PAYWALL) }
                    )
                }
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    user = uiState.user,
                    onSignIn = onSignIn,
                    onSignOut = { viewModel.signOut() },
                    onSubscribe = { navController.navigate(Routes.PAYWALL) },
                    onManageSubscription = { onOpenUrl("https://shouldiholdoff.live/account") },
                    onSuggestionBox = { onOpenUrl("https://shouldiholdoff.live/suggest") }
                )
            }

            composable(Routes.QUIZ) {
                var quizResult by remember { mutableStateOf<live.shouldiholdoff.holdoff.domain.quiz.QuizResult?>(null) }
                if (quizResult == null) {
                    QuizScreen(onComplete = { result -> quizResult = result })
                } else {
                    QuizResultScreen(
                        result = quizResult!!,
                        onContinue = {
                            viewModel.saveQuizResult(quizResult!!)
                            navController.popBackStack()
                        }
                    )
                }
            }

            composable(Routes.PAYWALL) {
                PaywallScreen(
                    products = billingProducts,
                    onSubscribe = { product ->
                        onSubscribe(product)
                        navController.popBackStack()
                    },
                    onDismiss = { navController.popBackStack() }
                )
            }

            composable(Routes.STORY) {
                PremiumStoryScreen(
                    onBack = { navController.popBackStack() },
                    onUpgrade = { navController.navigate(Routes.PAYWALL) },
                    isPremium = viewModel.isPremium
                )
            }
        }
    }
}

