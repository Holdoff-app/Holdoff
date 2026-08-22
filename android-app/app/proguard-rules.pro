# Keep model classes for Gson serialization
-keep class com.holdoff.app.data.model.** { *; }

# Compose
-dontwarn androidx.compose.**

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keepattributes Signature
-keepattributes *Annotation*
