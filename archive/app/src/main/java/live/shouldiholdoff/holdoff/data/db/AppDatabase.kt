package live.shouldiholdoff.holdoff.data.db

import android.content.Context
import androidx.room.*
import live.shouldiholdoff.holdoff.domain.models.*

@Dao
interface ThreadDao {
    @Query("SELECT * FROM sms_threads ORDER BY lastMessageTime DESC")
    suspend fun getAllThreads(): List<SMSThread>

    @Upsert
    suspend fun upsertThreads(threads: List<SMSThread>)

    @Query("SELECT * FROM sms_threads WHERE threadId = :id")
    suspend fun getThread(id: String): SMSThread?

    @Query("UPDATE sms_threads SET verdict = :verdict, verdictScore = :score, relationshipInsight = :insight WHERE threadId = :id")
    suspend fun updateVerdict(id: String, verdict: String, score: Float, insight: String)
}

@Dao
interface ContactDao {
    @Query("SELECT * FROM contacts ORDER BY name ASC")
    suspend fun getAllContacts(): List<Contact>

    @Upsert
    suspend fun upsertContacts(contacts: List<Contact>)
}

@Dao
interface CompanionDao {
    @Query("SELECT * FROM companion_messages ORDER BY timestamp ASC")
    suspend fun getAllMessages(): List<CompanionMessage>

    @Insert
    suspend fun insertMessage(message: CompanionMessage): Long

    @Query("DELETE FROM companion_messages WHERE id < (SELECT id FROM companion_messages ORDER BY id DESC LIMIT 1 OFFSET 200)")
    suspend fun pruneOldMessages()
}

@Database(
    entities = [SMSThread::class, Contact::class, CompanionMessage::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun threadDao(): ThreadDao
    abstract fun contactDao(): ContactDao
    abstract fun companionDao(): CompanionDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "holdoff_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
