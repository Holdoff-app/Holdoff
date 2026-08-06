package live.shouldiholdoff.holdoff.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import live.shouldiholdoff.holdoff.data.api.RetrofitClient
import live.shouldiholdoff.holdoff.data.api.SyncThreadRequest
import live.shouldiholdoff.holdoff.data.db.AppDatabase
import live.shouldiholdoff.holdoff.data.repositories.SMSRepository
import live.shouldiholdoff.holdoff.data.repositories.AuthRepository
import java.util.concurrent.TimeUnit

/**
 * SyncWorker — periodically syncs SMS threads to the HoldOff server.
 *
 * Schedule: every 15 minutes on WiFi or charging (battery-conscious).
 * On each run:
 *  1. Read SMS threads from device (READ_SMS permission required).
 *  2. POST /api/sync/threads with threads since lastSyncAt.
 *  3. Update local Room cache.
 *  4. Store new lastSyncAt timestamp.
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HoldOff/SyncWorker"
        private const val WORK_NAME = "holdoff_sms_sync"
        private const val PREF_LAST_SYNC = "last_sms_sync_at"
        private const val PREFS = "holdoff_sync"
        private const val PREF_SYNC_ENABLED = "sms_sync_opt_in"

        /**
         * Whether the user has explicitly opted in to uploading SMS threads.
         *
         * Defaults to false. Granting READ_SMS lets HoldOff analyze messages on
         * this device; it is NOT consent to upload them, so sync stays off until
         * the user turns it on.
         */
        fun isSyncEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(PREF_SYNC_ENABLED, false)

        /** Record the user's choice and start or stop syncing to match. */
        fun setSyncEnabled(context: Context, enabled: Boolean) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PREF_SYNC_ENABLED, enabled)
                .apply()
            if (enabled) enqueue(context) else cancel(context)
        }

        /** Stop periodic syncing. */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Periodic SMS sync cancelled")
        }

        /**
         * Enqueue a periodic sync. Safe to call multiple times — WorkManager
         * deduplicates by unique work name. No-op unless the user has opted in.
         */
        fun enqueue(context: Context) {
            if (!isSyncEnabled(context)) {
                Log.d(TAG, "SMS sync not opted in — not enqueueing")
                return
            }
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Periodic SMS sync enqueued")
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "SyncWorker started")

        // Require auth — skip if not logged in
        // Guard for work enqueued by a build that predates the opt-in, and for
        // the case where the user revokes consent while a run is already queued.
        if (!isSyncEnabled(applicationContext)) {
            Log.d(TAG, "SMS sync not opted in — cancelling")
            cancel(applicationContext)
            return Result.success()
        }

        val authRepo = AuthRepository(applicationContext)
        val token = authRepo.getAuthToken() ?: run {
            Log.d(TAG, "No auth token — skipping sync")
            return Result.success()
        }

        // Load lastSyncAt from shared prefs
        val prefs = applicationContext.getSharedPreferences("holdoff_sync", Context.MODE_PRIVATE)
        val lastSyncAt = prefs.getLong(PREF_LAST_SYNC, 0L)

        // Read SMS threads from device
        val smsRepo = SMSRepository(applicationContext)
        val threads = try {
            smsRepo.readThreads()
        } catch (e: Exception) {
            Log.e(TAG, "SMS read failed: ${e.message}")
            return Result.retry()
        }

        if (threads.isEmpty()) {
            Log.d(TAG, "No threads to sync")
            return Result.success()
        }

        // Filter to threads modified since last sync
        val newThreads = if (lastSyncAt == 0L) threads else
            threads.filter { it.lastMessageTime > lastSyncAt }

        if (newThreads.isEmpty()) {
            Log.d(TAG, "No new threads since last sync")
            return Result.success()
        }

        // Build sync payload
        val payload = newThreads.map { thread ->
            mapOf(
                "threadId" to thread.threadId,
                "contactName" to thread.contactName,
                "phoneNumber" to thread.phoneNumber,
                "lastMessage" to thread.lastMessage,
                "lastMessageTime" to thread.lastMessageTime,
                "unreadCount" to thread.unreadCount
            )
        }

        // POST to server
        return try {
            RetrofitClient.api.syncThreads(
                SyncThreadRequest(threads = payload, lastSyncAt = lastSyncAt),
                token = "******"
            )
            // Cache locally
            val db = AppDatabase.getDatabase(applicationContext)
            db.threadDao().upsertThreads(newThreads)

            // Save new lastSyncAt
            prefs.edit()
                .putLong(PREF_LAST_SYNC, System.currentTimeMillis())
                .apply()

            Log.d(TAG, "Synced ${newThreads.size} threads successfully")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed: ${e.message}")
            Result.retry()
        }
    }
}
