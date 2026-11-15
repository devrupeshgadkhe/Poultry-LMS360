# Preserve JavascriptInterface annotations and methods for WebView bridge
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.poultrylms360.app.MainActivity$PoultryAndroidBridge {
    *;
}
