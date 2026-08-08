package com.holdoff.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.screens.VerdictScreen
import com.holdoff.app.ui.theme.HoldOffTheme
import com.holdoff.app.viewmodel.DraftViewModel

/**
 * Entry point from the text-selection toolbar (ACTION_PROCESS_TEXT) and from
 * share sheets (ACTION_SEND). The user hands us exactly the text they chose;
 * we never read anything they did not select.
 *
 * When the host app allows editing, accepting a rewrite returns it via
 * EXTRA_PROCESS_TEXT so it replaces the selection in place.
 */
class ProcessTextActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val selected = intent
            ?.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
            ?.toString()
            ?: intent?.getStringExtra(Intent.EXTRA_TEXT)
            ?: ""

        val readOnly = intent?.getBooleanExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, false) ?: false
        val canReplace = !readOnly && intent?.action == Intent.ACTION_PROCESS_TEXT

        if (selected.isBlank()) {
            finish()
            return
        }

        setContent {
            HoldOffTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val vm: DraftViewModel = viewModel()
                    val state by vm.state.collectAsState()

                    LaunchedEffect(selected) { vm.analyze(selected) }

                    VerdictScreen(
                        verdict = state.verdict,
                        isAnalyzing = state.isAnalyzing,
                        error = state.error,
                        onBack = { finishWith(null) },
                        onRetry = { vm.analyze(selected) },
                        onUpgradeClick = { openApp() },
                        onUseRewrite = if (canReplace) ({ text -> finishWith(text) }) else null,
                        onSendAnyway = { finishWith(null) },
                        isPremium = HoldOffApi.isPremium(this)
                    )
                }
            }
        }
    }

    /** [replacement] non-null writes the revised text back over the selection. */
    private fun finishWith(replacement: String?) {
        if (replacement != null) {
            setResult(Activity.RESULT_OK, Intent().putExtra(Intent.EXTRA_PROCESS_TEXT, replacement))
        } else {
            setResult(Activity.RESULT_CANCELED)
        }
        finish()
    }

    private fun openApp() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        finishWith(null)
    }
}
