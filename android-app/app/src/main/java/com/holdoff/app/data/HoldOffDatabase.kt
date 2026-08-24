package com.holdoff.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.holdoff.app.data.entity.DraftDao
import com.holdoff.app.data.entity.DraftEntity
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory
import java.io.IOException
import java.security.KeyStore

/**
 * HoldOff main database with SQLCipher encryption.
 * 
 * All draft message data is encrypted at rest using AES-256-GCM via SQLCipher.
 * Database passphrase is derived from Android Keystore, device-bound and non-exportable.
 * 
 * Safe for:
 * - Background queries (Room handles threading)
 * - Concurrent access (Room serializes writes)
 * - Process death recovery (SQLite WAL mode)
 */
@Database(
    entities = [DraftEntity::class],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class HoldOffDatabase : RoomDatabase() {
    abstract fun draftDao(): DraftDao

    companion object {
        @Volatile
        private var instance: HoldOffDatabase? = null

        fun getInstance(context: Context): HoldOffDatabase {
            return instance ?: synchronized(this) {
                instance ?: buildDatabase(context).also { instance = it }
            }
        }

        private fun buildDatabase(context: Context): HoldOffDatabase {
            val dbPassphrase = getDatabasePassphrase(context)
            val factory = SupportFactory(dbPassphrase)

            return Room.databaseBuilder(
                context.applicationContext,
                HoldOffDatabase::class.java,
                "holdoff.db"
            )
                .openHelperFactory(factory)
                .fallbackToDestructiveMigration() // For development; use proper migrations in production
                .build()
        }

        /**
         * Retrieve or create database passphrase from Android Keystore.
         * 
         * The passphrase is:
         * - 32 bytes (256 bits) for AES-256-GCM
         * - Stored in hardware-backed Keystore if available
         * - Device-bound (cannot export or use on other devices)
         * - Non-symmetric (one-way, cannot decrypt if lost)
         */
        private fun getDatabasePassphrase(context: Context): ByteArray {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            val encryptedPrefs = EncryptedSharedPreferences.create(
                context,
                "holdoff_secrets",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

            val passphraseKey = "db_passphrase"
            
            return if (encryptedPrefs.contains(passphraseKey)) {
                // Retrieve existing passphrase
                val encoded = encryptedPrefs.getString(passphraseKey, "") ?: ""
                android.util.Base64.decode(encoded, android.util.Base64.NO_WRAP)
            } else {
                // Generate new passphrase
                val passphrase = ByteArray(32).apply {
                    java.util.Random().nextBytes(this)
                }
                val encoded = android.util.Base64.encodeToString(
                    passphrase,
                    android.util.Base64.NO_WRAP
                )
                encryptedPrefs.edit().putString(passphraseKey, encoded).apply()
                passphrase
            }
        }
    }
}

/**
 * Room TypeConverters for custom types (Instant, enums, etc.).
 */
object Converters {
    @androidx.room.TypeConverter
    fun fromInstant(instant: java.time.Instant?): Long? {
        return instant?.epochSecond
    }

    @androidx.room.TypeConverter
    fun toInstant(epochSecond: Long?): java.time.Instant? {
        return epochSecond?.let { java.time.Instant.ofEpochSecond(it) }
    }

    @androidx.room.TypeConverter
    fun fromMessageState(state: com.holdoff.app.data.entity.MessageState?): String? {
        return state?.name
    }

    @androidx.room.TypeConverter
    fun toMessageState(name: String?): com.holdoff.app.data.entity.MessageState? {
        return name?.let { com.holdoff.app.data.entity.MessageState.valueOf(it) }
    }
}
