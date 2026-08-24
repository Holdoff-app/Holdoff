package com.holdoff.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.Instant

/**
 * Represents a held/draft message with transactional state management.
 * 
 * State Machine:
 * HELD        → User has created/edited a draft
 * READY_TO_SEND → User has confirmed, ready for send
 * SENT        → Successfully sent via SmsManager
 * DISCARDED   → User deleted the draft
 */
@Entity(tableName = "drafts")
data class DraftEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    // Message content (encrypted by Room via SQLCipher)
    val recipientPhone: String,
    val messageBody: String,
    
    // State machine
    val state: MessageState = MessageState.HELD,
    
    // Metadata
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now(),
    val sentAt: Instant? = null,
    
    // Optional: server-side reference if sent via backend
    val serverMessageId: String? = null,
    
    // Manual-only indicator (requires explicit user send)
    val requiresManualSend: Boolean = false
)

/**
 * Transactional state for drafts to prevent duplicate sends and ensure safety.
 */
enum class MessageState {
    HELD,           // Created/editing
    READY_TO_SEND,  // Confirmed, waiting for user tap
    SENT,           // Successfully sent
    DISCARDED       // Deleted
}
