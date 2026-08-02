package com.holdoff.app.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives WAP_PUSH_DELIVER. Required for default-SMS-handler eligibility — Play rejects the
 * declaration if it is absent.
 *
 * MMS retrieval is not implemented. Doing it properly means parsing the PDU and fetching the
 * body from the carrier MMSC over a dedicated network request. Until that exists, incoming
 * MMS is dropped while HoldOff is the default app, so this must be built before any release
 * that asks users to switch.
 */
class MmsDeliverReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.w(TAG, "MMS received but retrieval is unimplemented; message dropped: ${intent.action}")
    }

    private companion object {
        const val TAG = "MmsDeliverReceiver"
    }
}
