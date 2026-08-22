package live.shouldiholdoff.holdoff.domain.spiral

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Spiral Lock blocks the Send button for a configurable cool-down when
 * the user is clearly spiraling: multiple hold-off verdicts in a row,
 * rapid typing, late-night, charged draft text.
 *
 * Default cool-down: 10 minutes. Can be overridden in Settings.
 * The user can always type "unlock" + a calming sentence to release early.
 */
class SpiralLock {

    private val _state = MutableStateFlow<SpiralState>(SpiralState.Idle)
    val state: StateFlow<SpiralState> = _state

    private var lockUntil: Long = 0

    fun engage(durationMs: Long = DEFAULT_LOCK_MS) {
        lockUntil = System.currentTimeMillis() + durationMs
        _state.value = SpiralState.Locked(lockUntil)
    }

    fun tick() {
        if (_state.value is SpiralState.Locked && System.currentTimeMillis() >= lockUntil) {
            _state.value = SpiralState.Cooldown
        }
    }

    fun release(reason: ReleaseReason) {
        _state.value = SpiralState.Released(reason)
    }

    fun isLocked(): Boolean = _state.value is SpiralState.Locked

    companion object {
        const val DEFAULT_LOCK_MS = 10L * 60L * 1000L
    }
}

sealed class SpiralState {
    object Idle : SpiralState()
    data class Locked(val until: Long) : SpiralState()
    object Cooldown : SpiralState()
    data class Released(val reason: ReleaseReason) : SpiralState()
}

enum class ReleaseReason { TIMER_EXPIRED, CALM_SENTENCE, MANUAL_OVERRIDE }
