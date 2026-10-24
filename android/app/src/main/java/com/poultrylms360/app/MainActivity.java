package com.poultrylms360.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
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
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1002;
    private static final String APP_URL = "https://poultry-lms-360.vercel.app";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Setup UI dynamically
        swipeRefresh = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        swipeRefresh.addView(webView);
        setContentView(swipeRefresh);

        // Setup WebView settings
        setupWebView();

        // Request runtime permissions if needed
        checkAndRequestAppPermissions();

        // Register APK download receiver for auto-update
        registerApkInstallReceiver();

        // Load application
        webView.loadURL(APP_URL);
    }

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

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false; // Load inside WebView
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
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        // Setup File / Report / APK Download Listener
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                handleDownload(url, contentDisposition, mimeType);
            }
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());
    }

    private void handleDownload(String url, String contentDisposition, String mimeType) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);

            if (url.endsWith(".apk") || (mimeType != null && mimeType.contains("vnd.android.package-archive"))) {
                if (!filename.endsWith(".apk")) filename = "Poultry-LMS-360-update.apk";
                Toast.makeText(this, "नवीन अपडेट डाऊनलोड होत आहे... (Downloading Update)", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "डाऊनलोड सुरू झाले: " + filename, Toast.LENGTH_SHORT).show();
            }

            request.setMimeType(mimeType);
            request.addRequestHeader("User-Agent", webView.getSettings().getUserAgentString());
            request.setDescription("Poultry LMS 360 File Download");
            request.setTitle(filename);
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
            }
        } catch (Exception e) {
            // Fallback: open in external browser
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(i);
            } catch (Exception ex) {
                Toast.makeText(this, "डाऊनलोड अयशस्वी: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    private void registerApkInstallReceiver() {
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        registerReceiver(new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (downloadId != -1) {
                    checkAndInstallDownloadedApk(downloadId);
                }
            }
        }, filter);
    }

    private void checkAndInstallDownloadedApk(long downloadId) {
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;

        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        android.database.Cursor cursor = dm.query(query);

        if (cursor != null && cursor.moveToFirst()) {
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int uriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);

            if (cursor.getInt(statusIndex) == DownloadManager.STATUS_SUCCESSFUL) {
                String localUri = cursor.getString(uriIndex);
                if (localUri != null && localUri.endsWith(".apk")) {
                    installApk(Uri.parse(localUri));
                }
            }
            cursor.close();
        }
    }

    private void installApk(Uri apkUri) {
        try {
            File apkFile = new File(apkUri.getPath());
            if (!apkFile.exists()) {
                String realPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS) + "/" + apkFile.getName();
                apkFile = new File(realPath);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Uri contentUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setDataAndType(Uri.fromFile(apkFile), "application/vnd.android.package-archive");
            }

            // Check Unknown Sources permission on Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    new AlertDialog.Builder(this)
                            .setTitle("ॲप अपडेट परवानगी (Install Permission)")
                            .setMessage("नवीन व्हर्जन इन्स्टॉल करण्यासाठी 'Install unknown apps' परवानगी आवश्यक आहे. कृपया ती ऑन करा.")
                            .setPositiveButton("सेटिंग्ज उघडा", (d, w) -> {
                                Intent reqIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                                reqIntent.setData(Uri.parse("package:" + getPackageName()));
                                startActivity(reqIntent);
                            })
                            .setNegativeButton("रद्द करा", null)
                            .show();
                    return;
                }
            }

            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "अपडेट इन्स्टॉल करण्यात त्रुटी: " + e.getMessage(), Toast.LENGTH_LONG).show();
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
        if (requestCode == PERMISSION_REQUEST_CODE) {
            // Handled permissions
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
