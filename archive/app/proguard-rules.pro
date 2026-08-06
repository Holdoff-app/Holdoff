# HoldOff ProGuard Rules
-keep class live.shouldiholdoff.holdoff.domain.models.** { *; }
-keep class live.shouldiholdoff.holdoff.data.api.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-keepclassmembernames interface * {
    @retrofit2.http.* <methods>;
}
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-dontwarn kotlin.**
-dontwarn okhttp3.**
