package com.poultrylms360.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1002;
    private static final int INSTALL_PERMISSION_REQUEST_CODE = 1003;
    private static final String APP_URL = "https://poultry-lms-360.vercel.app";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ValueCallback<Uri[]> fileUploadCallback;
    private Uri pendingCameraUri;
    private File pendingCameraFile;

    private BroadcastReceiver apkDownloadReceiver;
    private boolean isReceiverRegistered = false;
    private final Map<Long, File> trackedApkTargets = new HashMap<>();
    private long activeUpdateDownloadId = -1L;
    private File pendingInstallApkFile = null;
    private volatile boolean isAtPageTop = true;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final Runnable progressPoller = new Runnable() {
        @Override
        public void run() {
            if (activeUpdateDownloadId == -1L) return;
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) return;

            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(activeUpdateDownloadId);
            Cursor cursor = null;
            try {
                cursor = dm.query(query);
                if (cursor != null && cursor.moveToFirst()) {
                    int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int downloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                    int totalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);

                    int status = statusIdx >= 0 ? cursor.getInt(statusIdx) : -1;
                    long bytesDownloaded = downloadedIdx >= 0 ? cursor.getLong(downloadedIdx) : 0;
                    long bytesTotal = totalIdx >= 0 ? cursor.getLong(totalIdx) : 0;

                    if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED) {
                        int pct = (bytesTotal > 0) ? (int) Math.min(99, (bytesDownloaded * 100L) / bytesTotal) : 15;
                        notifyWebUpdateProgress(pct, "downloading", "Downloading update package...");
                        mainHandler.postDelayed(this, 450);
                    } else if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        long completedId = activeUpdateDownloadId;
                        activeUpdateDownloadId = -1L;
                        notifyWebUpdateProgress(100, "completed", "Download complete. Launching installer...");
                        checkAndInstallDownloadedApk(completedId);
                    } else if (status == DownloadManager.STATUS_FAILED) {
                        activeUpdateDownloadId = -1L;
                        notifyWebUpdateProgress(0, "failed", "Update download failed. Please check internet connection.");
                    }
                } else {
                    mainHandler.postDelayed(this, 600);
                }
            } catch (Exception ignored) {
                activeUpdateDownloadId = -1L;
            } finally {
                if (cursor != null) cursor.close();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            swipeRefresh = new SwipeRefreshLayout(this);
            webView = new WebView(this);
            swipeRefresh.addView(webView);
            setContentView(swipeRefresh);

            setupWebView();
            checkAndRequestAppPermissions();
            registerApkInstallReceiver();

            webView.loadUrl(APP_URL);
        } catch (Throwable t) {
            new AlertDialog.Builder(this)
                    .setTitle("Application Startup Notice")
                    .setMessage("Unable to initialize the browser engine on this device. Please ensure Android System WebView is updated.\n\nDetails: " + t.getMessage())
                    .setPositiveButton("Close", (d, w) -> finish())
                    .setCancelable(false)
                    .show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingInstallApkFile != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getPackageManager().canRequestPackageInstalls()) {
                File apk = pendingInstallApkFile;
                pendingInstallApkFile = null;
                installApkFile(apk);
            }
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (isReceiverRegistered && apkDownloadReceiver != null) {
            try {
                unregisterReceiver(apkDownloadReceiver);
            } catch (Exception ignored) {
            }
            isReceiverRegistered = false;
        }
        if (webView != null) {
            try {
                webView.destroy();
            } catch (Exception ignored) {
            }
        }
        super.onDestroy();
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Expose native Android bridge to web layer
        webView.addJavascriptInterface(new PoultryAndroidBridge(), "PoultryAndroid");

        // Only allow pull-to-refresh when user is genuinely at scroll top
        swipeRefresh.setOnChildScrollUpCallback((parent, child) -> !isAtPageTop || webView.canScrollVertically(-1));
        swipeRefresh.setDistanceToTriggerSync(350);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    // Direct .apk link navigation -> handle cleanly with DownloadManager
                    if (isApkUrl(url)) {
                        handleDownload(url, null, "application/vnd.android.package-archive");
                        return true;
                    }
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
                // Attach lightweight scroll detector so inner overflow containers don't trigger accidental refresh
                String scrollHookJs =
                        "(function(){" +
                        "  if(window.__poultryScrollHook) return;" +
                        "  window.__poultryScrollHook = true;" +
                        "  var checkTop = function(){" +
                        "    var outlet = document.getElementById('erp-routing-outlet');" +
                        "    var top1 = outlet ? outlet.scrollTop : 0;" +
                        "    var top2 = window.scrollY || document.documentElement.scrollTop || 0;" +
                        "    var modals = document.querySelectorAll('.fixed.inset-0');" +
                        "    var atTop = (top1 <= 4) && (top2 <= 4) && (modals.length === 0);" +
                        "    if(window.PoultryAndroid && window.PoultryAndroid.setPageAtTop){" +
                        "      window.PoultryAndroid.setPageAtTop(atTop);" +
                        "    }" +
                        "  };" +
                        "  document.addEventListener('scroll', checkTop, true);" +
                        "  document.addEventListener('touchstart', checkTop, {passive:true});" +
                        "})();";
                view.evaluateJavascript(scrollHookJs, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    swipeRefresh.setRefreshing(false);
                    String fallbackHtml =
                            "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                            "<style>body{font-family:sans-serif;background:#f8fafc;color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;}" +
                            ".card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;max-width:360px;box-shadow:0 10px 25px rgba(0,0,0,.06);}" +
                            "h2{margin:0 0 8px;font-size:20px;color:#0f172a;}p{font-size:14px;color:#64748b;line-height:1.5;margin:0 0 20px;}" +
                            "button{background:#0d9488;color:#fff;border:none;border-radius:12px;padding:12px 24px;font-weight:700;font-size:14px;width:100%;cursor:pointer;}</style>" +
                            "</head><body><div class='card'><h2>Connection Interrupted</h2>" +
                            "<p>Please check your mobile data or Wi-Fi connection and try again.</p>" +
                            "<button onclick=\"window.location.href='" + APP_URL + "'\">Retry Connection</button></div></body></html>";
                    view.loadDataWithBaseURL(null, fallbackHtml, "text/html", "UTF-8", null);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Recover WebView in-place without an Activity restart loop
                runOnUiThread(() -> {
                    try {
                        if (swipeRefresh != null && !isFinishing()) {
                            swipeRefresh.removeAllViews();
                            if (webView != null) {
                                webView.destroy();
                            }
                            webView = new WebView(MainActivity.this);
                            swipeRefresh.addView(webView);
                            setupWebView();
                            webView.loadUrl(APP_URL);
                        }
                    } catch (Exception ignored) {
                    }
                });
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    try {
                        request.grant(request.getResources());
                    } catch (Exception ignored) {
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent contentIntent = fileChooserParams.createIntent();
                List<Intent> extraIntents = new ArrayList<>();

                // Offer Camera capture option alongside Gallery/Document picker
                boolean wantsImage = false;
                String[] acceptTypes = fileChooserParams.getAcceptTypes();
                if (acceptTypes == null || acceptTypes.length == 0) {
                    wantsImage = true;
                } else {
                    for (String type : acceptTypes) {
                        if (type == null || type.isEmpty() || type.contains("image") || type.equals("*/*")) {
                            wantsImage = true;
                            break;
                        }
                    }
                }

                if (wantsImage && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        Intent captureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        File cacheImages = new File(getCacheDir(), "captures");
                        if (!cacheImages.exists()) cacheImages.mkdirs();
                        pendingCameraFile = new File(cacheImages, "bill_" + System.currentTimeMillis() + ".jpg");
                        pendingCameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", pendingCameraFile);
                        captureIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                        captureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        extraIntents.add(captureIntent);
                    } catch (Exception ignored) {
                        pendingCameraUri = null;
                        pendingCameraFile = null;
                    }
                }

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select Bill Image or Document");
                if (!extraIntents.isEmpty()) {
                    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Intent[0]));
                }

                try {
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    pendingCameraUri = null;
                    pendingCameraFile = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                handleDownload(url, contentDisposition, mimeType);
            }
        });
    }

    private boolean isApkUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return lower.contains(".apk") && !lower.endsWith(".html");
    }

    private void notifyWebUpdateProgress(int progress, String status, String message) {
        if (webView == null) return;
        mainHandler.post(() -> {
            try {
                String safeMsg = (message != null ? message : "").replace("'", "\\'");
                String js = "if(typeof window.onAndroidUpdateProgress==='function'){window.onAndroidUpdateProgress(" + progress + ",'" + status + "','" + safeMsg + "');}";
                webView.evaluateJavascript(js, null);
            } catch (Exception ignored) {
            }
        });
    }

    private void handleDownload(String url, String contentDisposition, String mimeType) {
        try {
            if (url == null || url.startsWith("blob:") || url.startsWith("data:")) {
                Toast.makeText(this, "Preparing file export...", Toast.LENGTH_SHORT).show();
                return;
            }

            String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
            boolean isApk = isApkUrl(url)
                    || (filename != null && filename.toLowerCase().endsWith(".apk"))
                    || (mimeType != null && mimeType.contains("vnd.android.package-archive"));

            if (isApk) {
                startApkDownload(url, filename);
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            if (mimeType != null && !mimeType.isEmpty()) {
                request.setMimeType(mimeType);
            }
            request.addRequestHeader("User-Agent", webView.getSettings().getUserAgentString());
            request.setDescription("Poultry LMS 360 File Download");
            request.setTitle(filename);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(this, "Download started: " + filename, Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(i);
            } catch (Exception ex) {
                Toast.makeText(this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    private void startApkDownload(String url, String filenameHint) {
        try {
            String filename = (filenameHint != null && filenameHint.toLowerCase().endsWith(".apk"))
                    ? filenameHint
                    : "Poultry-LMS-360-update.apk";

            // Use app-specific external files directory (works cleanly across Android 7..15 with zero storage permission failures)
            File downloadDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            File targetFile = null;
            if (downloadDir != null) {
                if (!downloadDir.exists()) downloadDir.mkdirs();
                targetFile = new File(downloadDir, filename);
                if (targetFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    targetFile.delete();
                }
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType("application/vnd.android.package-archive");
            request.addRequestHeader("User-Agent", webView.getSettings().getUserAgentString());
            request.setDescription("Downloading Poultry LMS 360 Update");
            request.setTitle(filename);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

            if (downloadDir != null) {
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, filename);
            }

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                long downloadId = dm.enqueue(request);
                trackedApkTargets.put(downloadId, targetFile);
                activeUpdateDownloadId = downloadId;
                notifyWebUpdateProgress(5, "downloading", "Starting update download...");
                mainHandler.removeCallbacks(progressPoller);
                mainHandler.postDelayed(progressPoller, 400);
                Toast.makeText(this, "Downloading Poultry LMS 360 Update...", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            activeUpdateDownloadId = -1L;
            notifyWebUpdateProgress(0, "failed", "Unable to start download: " + e.getMessage());
            Toast.makeText(this, "Update download error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void registerApkInstallReceiver() {
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        apkDownloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId != -1L && trackedApkTargets.containsKey(downloadId)) {
                    if (activeUpdateDownloadId == downloadId) {
                        activeUpdateDownloadId = -1L;
                        mainHandler.removeCallbacks(progressPoller);
                    }
                    checkAndInstallDownloadedApk(downloadId);
                }
            }
        };
        // CRITICAL for targetSdk 34 (Android 14+): explicit RECEIVER_EXPORTED prevents SecurityException crash on launch
        ContextCompat.registerReceiver(this, apkDownloadReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
        isReceiverRegistered = true;
    }

    private void checkAndInstallDownloadedApk(long downloadId) {
        File expectedTarget = trackedApkTargets.remove(downloadId);
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;

        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = null;

        try {
            cursor = dm.query(query);
            if (cursor != null && cursor.moveToFirst()) {
                int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int uriIdx = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);

                if (statusIdx >= 0 && cursor.getInt(statusIdx) == DownloadManager.STATUS_SUCCESSFUL) {
                    File resolvedFile = null;

                    if (expectedTarget != null && expectedTarget.exists() && expectedTarget.length() > 100000) {
                        resolvedFile = expectedTarget;
                    }

                    if (resolvedFile == null && uriIdx >= 0) {
                        String localUriStr = cursor.getString(uriIdx);
                        if (localUriStr != null && localUriStr.startsWith("file://")) {
                            String parsedPath = Uri.parse(localUriStr).getPath();
                            if (parsedPath != null) {
                                File candidate = new File(parsedPath);
                                if (candidate.exists() && candidate.length() > 100000) {
                                    resolvedFile = candidate;
                                }
                            }
                        }
                    }

                    // Fallback for content:// URIs on scoped storage Android 10+
                    if (resolvedFile == null) {
                        try {
                            ParcelFileDescriptor pfd = dm.openDownloadedFile(downloadId);
                            if (pfd != null) {
                                File cacheDir = new File(getCacheDir(), "updates");
                                if (!cacheDir.exists()) cacheDir.mkdirs();
                                File copied = new File(cacheDir, "Poultry-LMS-360-update.apk");
                                try (InputStream in = new FileInputStream(pfd.getFileDescriptor());
                                     OutputStream out = new FileOutputStream(copied)) {
                                    byte[] buf = new byte[8192];
                                    int len;
                                    while ((len = in.read(buf)) > 0) {
                                        out.write(buf, 0, len);
                                    }
                                }
                                pfd.close();
                                if (copied.exists() && copied.length() > 100000) {
                                    resolvedFile = copied;
                                }
                            }
                        } catch (Exception ignored) {
                        }
                    }

                    if (resolvedFile != null) {
                        notifyWebUpdateProgress(100, "completed", "Installing update...");
                        installApkFile(resolvedFile);
                    } else {
                        notifyWebUpdateProgress(0, "failed", "Downloaded update file was incomplete.");
                        Toast.makeText(this, "Downloaded APK file could not be opened.", Toast.LENGTH_LONG).show();
                    }
                } else {
                    notifyWebUpdateProgress(0, "failed", "Download did not complete successfully.");
                }
            }
        } catch (Exception e) {
            notifyWebUpdateProgress(0, "failed", "Install error: " + e.getMessage());
            Toast.makeText(this, "Error preparing update: " + e.getMessage(), Toast.LENGTH_LONG).show();
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private void installApkFile(File apkFile) {
        if (apkFile == null || !apkFile.exists() || apkFile.length() == 0) {
            Toast.makeText(this, "Update file missing or corrupted.", Toast.LENGTH_LONG).show();
            return;
        }

        // Check Unknown Sources permission on Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            pendingInstallApkFile = apkFile;
            new AlertDialog.Builder(this)
                    .setTitle("Install Permission Required")
                    .setMessage("To install this app update, please allow 'Install unknown apps' for Poultry LMS 360 in Android Settings, then press Back.")
                    .setPositiveButton("Open Settings", (d, w) -> launchUnknownSourcesSettings())
                    .setNegativeButton("Cancel", (d, w) -> pendingInstallApkFile = null)
                    .show();
            return;
        }

        try {
            Uri installUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                installUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            } else {
                installUri = Uri.fromFile(apkFile);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(installUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Error launching installer: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void launchUnknownSourcesSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent reqIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                reqIntent.setData(Uri.parse("package:" + getPackageName()));
                startActivityForResult(reqIntent, INSTALL_PERMISSION_REQUEST_CODE);
                return;
            }
        } catch (Exception ignored) {
        }
        try {
            Intent detailsIntent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            detailsIntent.setData(Uri.parse("package:" + getPackageName()));
            startActivityForResult(detailsIntent, INSTALL_PERMISSION_REQUEST_CODE);
        } catch (Exception e) {
            Toast.makeText(this, "Please allow Install Unknown Apps in Android Settings.", Toast.LENGTH_LONG).show();
        }
    }

    private void checkAndRequestAppPermissions() {
        List<String> needed = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK) {
                    if (data != null && data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data != null && data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (pendingCameraUri != null && pendingCameraFile != null && pendingCameraFile.exists() && pendingCameraFile.length() > 0) {
                        results = new Uri[]{pendingCameraUri};
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
                pendingCameraUri = null;
                pendingCameraFile = null;
            }
        } else if (requestCode == INSTALL_PERMISSION_REQUEST_CODE) {
            if (pendingInstallApkFile != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (getPackageManager().canRequestPackageInstalls()) {
                    File apk = pendingInstallApkFile;
                    pendingInstallApkFile = null;
                    installApkFile(apk);
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class PoultryAndroidBridge {
        @JavascriptInterface
        public String getAppVersion() {
            try {
                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                return pInfo.versionName != null ? pInfo.versionName : "1.0.0";
            } catch (Exception e) {
                return "1.0.0";
            }
        }

        @JavascriptInterface
        public long getVersionCode() {
            try {
                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return pInfo.getLongVersionCode();
                }
                return pInfo.versionCode;
            } catch (Exception e) {
                return 1L;
            }
        }

        @JavascriptInterface
        public boolean canRequestPackageInstalls() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                return getPackageManager().canRequestPackageInstalls();
            }
            return true;
        }

        @JavascriptInterface
        public void openInstallPermissionSettings() {
            runOnUiThread(MainActivity.this::launchUnknownSourcesSettings);
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(String apkUrl, String versionTag) {
            runOnUiThread(() -> {
                String cleanTag = (versionTag != null && !versionTag.isEmpty()) ? versionTag : "latest";
                String filename = "Poultry-LMS-360-" + cleanTag.replaceAll("[^a-zA-Z0-9._-]", "") + ".apk";
                startApkDownload(apkUrl, filename);
            });
        }

        @JavascriptInterface
        public void setPageAtTop(boolean atTop) {
            isAtPageTop = atTop;
        }
    }
}
