package com.example.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat

data class SmsThread(
    val threadId: Long,
    val address: String,
    val snippet: String,
    val date: Long,
    val unread: Boolean
)

data class SmsMessage(
    val id: Long,
    val address: String,
    val body: String,
    val date: Long,
    val isOutgoing: Boolean
)

/**
 * Reads/sends real device SMS conversations. Backs the Inbox tab so HoldOff
 * shows actual message threads instead of only the local companion chats.
 */
object SmsRepository {
    fun hasReadSmsPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

    fun hasSendSmsPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED

    fun getConversationThreads(context: Context): List<SmsThread> {
        if (!hasReadSmsPermission(context)) return emptyList()
        val threads = LinkedHashMap<Long, SmsThread>()
        val uri = Uri.parse("content://sms")
        val projection = arrayOf("thread_id", "address", "body", "date", "read")
        val cursor = try {
            context.contentResolver.query(uri, projection, null, null, "date DESC")
        } catch (e: Exception) {
            null
        }
        cursor?.use {
            val threadIdIdx = it.getColumnIndex("thread_id")
            val addressIdx = it.getColumnIndex("address")
            val bodyIdx = it.getColumnIndex("body")
            val dateIdx = it.getColumnIndex("date")
            val readIdx = it.getColumnIndex("read")
            while (it.moveToNext()) {
                val threadId = if (threadIdIdx >= 0) it.getLong(threadIdIdx) else -1L
                if (threadId <= 0L || threads.containsKey(threadId)) continue
                val address = if (addressIdx >= 0) it.getString(addressIdx) ?: "Unknown" else "Unknown"
                val body = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                val date = if (dateIdx >= 0) it.getLong(dateIdx) else 0L
                val read = if (readIdx >= 0) it.getInt(readIdx) == 1 else true
                threads[threadId] = SmsThread(threadId, address, body, date, unread = !read)
            }
        }
        return threads.values.sortedByDescending { it.date }
    }

    fun getMessagesForThread(context: Context, threadId: Long): List<SmsMessage> {
        if (!hasReadSmsPermission(context)) return emptyList()
        val messages = mutableListOf<SmsMessage>()
        val uri = Uri.parse("content://sms")
        val projection = arrayOf("_id", "address", "body", "date", "type")
        val cursor = try {
            context.contentResolver.query(uri, projection, "thread_id = ?", arrayOf(threadId.toString()), "date ASC")
        } catch (e: Exception) {
            null
        }
        cursor?.use {
            val idIdx = it.getColumnIndex("_id")
            val addressIdx = it.getColumnIndex("address")
            val bodyIdx = it.getColumnIndex("body")
            val dateIdx = it.getColumnIndex("date")
            val typeIdx = it.getColumnIndex("type") // 1 = inbox (incoming), 2 = sent (outgoing)
            while (it.moveToNext()) {
                val id = if (idIdx >= 0) it.getLong(idIdx) else 0L
                val address = if (addressIdx >= 0) it.getString(addressIdx) ?: "" else ""
                val body = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                val date = if (dateIdx >= 0) it.getLong(dateIdx) else 0L
                val type = if (typeIdx >= 0) it.getInt(typeIdx) else 1
                messages.add(SmsMessage(id, address, body, date, isOutgoing = type == 2))
            }
        }
        return messages
    }

    fun sendSms(context: Context, address: String, body: String): Boolean {
        if (!hasSendSmsPermission(context) || body.isBlank()) return false
        return try {
            val smsManager = android.telephony.SmsManager.getDefault()
            val parts = smsManager.divideMessage(body)
            smsManager.sendMultipartTextMessage(address, null, parts, null, null)
            true
        } catch (e: Exception) {
            false
        }
    }
}
