package com.example.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.ui.MainViewModel

@Composable
fun MainScreen(viewModel: MainViewModel, onLogout: () -> Unit) {
    val navController = rememberNavController()
    val navItems = listOf(
        NavigationItem("inbox", "Inbox", Icons.Default.Email),
        NavigationItem("shield", "Shield", Icons.Default.Home),
        NavigationItem("dashboard", "Dashboard", Icons.Default.Person),
        NavigationItem("toolkit", "Toolkit", Icons.Default.Build),
        NavigationItem("check_in", "Check-In", Icons.Default.DateRange),
        NavigationItem("curriculum", "Learn", Icons.AutoMirrored.Filled.List),
        NavigationItem("community", "I.T.T.S.O.A.", Icons.Default.Groups),
        NavigationItem("profile", "Profile", Icons.Default.AccountCircle)
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                val showBottomBar = currentDestination?.route in navItems.map { it.route }

                if (showBottomBar) {
                    navItems.forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "shield",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("shield") {
                ContactsScreen(
                    viewModel = viewModel,
                    onContactClick = { contact ->
                        navController.navigate("chat/${contact.name}")
                    },
                    onDetailClick = { contact ->
                        viewModel.selectContact(contact.id)
                        navController.navigate("contact_detail")
                    }
                )
            }
            composable("contact_detail") {
                ContactDetailScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
            composable("chat/{contactName}") { backStackEntry ->
                val contactName = backStackEntry.arguments?.getString("contactName") ?: ""
                ChatScreen(
                    contactName = contactName,
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
            composable("dashboard") {
                DashboardScreen(
                    viewModel = viewModel,
                    onUpgrade = { navController.navigate("pricing") }
                )
            }
            composable("toolkit") {
                CommunicationToolkitScreen(viewModel = viewModel)
            }
            composable("check_in") {
                CheckInScreen(viewModel)
            }
            composable("curriculum") {
                CurriculumScreen()
            }
            composable("profile") {
                ProfileScreen(
                    viewModel = viewModel, 
                    onLogout = onLogout,
                    onUpgrade = { navController.navigate("pricing") },
                    onNavigateToPrivacy = { navController.navigate("privacy_dashboard") }
                )
            }
            composable("community") {
                CommunityChatScreen(viewModel)
            }
            composable("pricing") {
                PricingScreen(onBack = { navController.popBackStack() })
            }
            composable("privacy_dashboard") {
                PrivacyDashboard(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() },
                    onWipeData = {
                        viewModel.nukeAllData()
                        onLogout()
                    }
                )
            }
        }
    }
}

data class NavigationItem(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)
