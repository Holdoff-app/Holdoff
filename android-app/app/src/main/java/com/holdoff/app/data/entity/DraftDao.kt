package com.holdoff.app.data.entity

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Room Data Access Object for draft message persistence.
 * All operations are safe for SQLCipher-backed encrypted storage.
 */
@Dao
interface DraftDao {
    
    /**
     * Insert a new draft (initial HELD state).
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDraft(draft: DraftEntity): Long
    
    /**
     * Update draft state (HELD → READY_TO_SEND → SENT/DISCARDED).
     */
    @Update
    suspend fun updateDraft(draft: DraftEntity)
    
    /**
     * Delete a draft (transitions to DISCARDED state first is preferred).
     */
    @Delete
    suspend fun deleteDraft(draft: DraftEntity)
    
    /**
     * Retrieve all drafts in HELD or READY_TO_SEND state (user's active queue).
     */
    @Query("SELECT * FROM drafts WHERE state IN (:states) ORDER BY updatedAt DESC")
    fun getActiveDrafts(states: List<MessageState> = listOf(MessageState.HELD, MessageState.READY_TO_SEND)): Flow<List<DraftEntity>>
    
    /**
     * Retrieve a specific draft by ID.
     */
    @Query("SELECT * FROM drafts WHERE id = :draftId")
    suspend fun getDraftById(draftId: Long): DraftEntity?
    
    /**
     * Retrieve all drafts for a given recipient phone.
     */
    @Query("SELECT * FROM drafts WHERE recipientPhone = :phone ORDER BY createdAt DESC")
    fun getDraftsByRecipient(phone: String): Flow<List<DraftEntity>>
    
    /**
     * Count unsent/held drafts (user's queue size).
     */
    @Query("SELECT COUNT(*) FROM drafts WHERE state IN (:states)")
    fun countActiveDrafts(states: List<MessageState> = listOf(MessageState.HELD, MessageState.READY_TO_SEND)): Flow<Int>
    
    /**
     * Retrieve drafts in SENT state (historical record, cleanup eligible).
     */
    @Query("SELECT * FROM drafts WHERE state = :state ORDER BY sentAt DESC LIMIT :limit")
    suspend fun getSentDrafts(state: MessageState = MessageState.SENT, limit: Int = 100): List<DraftEntity>
    
    /**
     * Delete old sent records (history cleanup, configurable retention).
     */
    @Query("DELETE FROM drafts WHERE state = :state AND sentAt < datetime('now', '-30 days')")
    suspend fun deleteOldSentDrafts(state: MessageState = MessageState.SENT)
    
    /**
     * Clear all drafts (user onboarding reset or account deletion).
     */
    @Query("DELETE FROM drafts")
    suspend fun clearAllDrafts()
}
