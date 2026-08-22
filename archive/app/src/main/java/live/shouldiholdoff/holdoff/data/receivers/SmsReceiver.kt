package live.shouldiholdoff.holdoff.data.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Future: trigger background sync on new SMS
        // For MVP, threads are loaded on app open
    }
}
