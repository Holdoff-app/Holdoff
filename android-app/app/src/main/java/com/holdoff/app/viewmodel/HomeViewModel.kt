package com.holdoff.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.model.SMSThread
import com.holdoff.app.data.repository.SMSRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val threads: List<SMSThread> = emptyList(),
    val isLoading: Boolean = true,
    val hasPermission: Boolean = false,
    val error: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = SMSRepository(application)

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state

    fun onPermissionGranted() {
        _state.value = _state.value.copy(hasPermission = true)
        loadThreads()
    }

    fun loadThreads() {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(isLoading = true)
                val threads = repo.getAllThreads()
                _state.value = _state.value.copy(threads = threads, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Could not load messages: ${e.message}"
                )
            }
        }
    }
}
