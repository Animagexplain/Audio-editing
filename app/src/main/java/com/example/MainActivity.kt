package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        enableEdgeToEdge()
        hideSystemBars()

        setContent {
            AudioEditorAppScreen()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    private fun hideSystemBars() {
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insetsController.hide(WindowInsetsCompat.Type.systemBars())
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun AudioEditorAppScreen() {
    val context = LocalContext.current
    var hasMicPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasMicPermission = isGranted
    }

    LaunchedEffect(Unit) {
        if (!hasMicPermission) {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // File picker callback for <input type="file">
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val data = result.data
            val clipData = data?.clipData
            if (clipData != null) {
                Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (data?.data != null) {
                arrayOf(data.data!!)
            } else {
                null
            }
        } else {
            null
        }
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .windowInsetsPadding(
                WindowInsets.safeDrawing.only(
                    WindowInsetsSides.Horizontal + WindowInsetsSides.Top
                )
            )
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(0xFF020617.toInt())

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        mediaPlaybackRequiresUserGesture = false
                        cacheMode = WebSettings.LOAD_DEFAULT
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        displayZoomControls = false
                        builtInZoomControls = false
                    }

                    webViewClient = object : WebViewClient() {}

                    webChromeClient = object : WebChromeClient() {
                        override fun onPermissionRequest(request: PermissionRequest?) {
                            // Grant audio capture permissions for Web Audio recording
                            request?.grant(request.resources)
                        }

                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCb: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?
                        ): Boolean {
                            filePathCallback?.onReceiveValue(null)
                            filePathCallback = filePathCb

                            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                type = "audio/*"
                                addCategory(Intent.CATEGORY_OPENABLE)
                                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                            }
                            filePickerLauncher.launch(
                                Intent.createChooser(intent, "Select Audio File")
                            )
                            return true
                        }
                    }

                    if (ctx is Activity) {
                        addJavascriptInterface(AndroidAudioBridge(ctx), "AndroidBridge")
                    }

                    loadUrl("file:///android_asset/index.html")
                }
            },
            update = { webView ->
                // Keep webview in sync
            }
        )
    }
}

class AndroidAudioBridge(private val activity: Activity) {

    @JavascriptInterface
    fun isAvailable(): Boolean {
        return true
    }

    @JavascriptInterface
    fun saveAudioFile(base64Data: String, mimeType: String, fileName: String): String {
        return try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val audioBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // MediaStore API (Android 10+)
                val contentValues = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Audio.Media.MIME_TYPE, mimeType)
                    put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/AudioEditor")
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }

                val resolver = activity.contentResolver
                val uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, contentValues)
                    ?: resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)

                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { outputStream ->
                        outputStream.write(audioBytes)
                        outputStream.flush()
                    }
                    contentValues.clear()
                    contentValues.put(MediaStore.Audio.Media.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)

                    activity.runOnUiThread {
                        Toast.makeText(
                            activity,
                            "Audio exported: Music/AudioEditor/$fileName",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                    "Music/AudioEditor/$fileName"
                } else {
                    saveToInternalFallback(audioBytes, fileName)
                }
            } else {
                // Android 9 and below
                val musicDir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                    "AudioEditor"
                )
                if (!musicDir.exists()) {
                    musicDir.mkdirs()
                }
                val destFile = File(musicDir, fileName)
                FileOutputStream(destFile).use { fos ->
                    fos.write(audioBytes)
                    fos.flush()
                }

                MediaScannerConnection.scanFile(
                    activity,
                    arrayOf(destFile.absolutePath),
                    arrayOf(mimeType),
                    null
                )

                activity.runOnUiThread {
                    Toast.makeText(
                        activity,
                        "Audio saved to: ${destFile.name}",
                        Toast.LENGTH_LONG
                    ).show()
                }
                destFile.absolutePath
            }
        } catch (e: Exception) {
            e.printStackTrace()
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "Export failed: ${e.localizedMessage ?: "Unknown error"}",
                    Toast.LENGTH_LONG
                ).show()
            }
            "error: ${e.message}"
        }
    }

    private fun saveToInternalFallback(bytes: ByteArray, fileName: String): String {
        val appMusicDir = activity.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            ?: activity.filesDir
        val destFile = File(appMusicDir, fileName)
        FileOutputStream(destFile).use { fos ->
            fos.write(bytes)
            fos.flush()
        }
        activity.runOnUiThread {
            Toast.makeText(
                activity,
                "Saved to: ${destFile.name}",
                Toast.LENGTH_LONG
            ).show()
        }
        return destFile.absolutePath
    }

    @JavascriptInterface
    fun shareAudioFile(base64Data: String, mimeType: String, fileName: String) {
        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val audioBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val cacheFolder = File(activity.cacheDir, "audio_exports").apply {
                if (!exists()) mkdirs()
            }
            val exportFile = File(cacheFolder, fileName)
            FileOutputStream(exportFile).use { fos ->
                fos.write(audioBytes)
                fos.flush()
            }

            val fileUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                exportFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, fileUri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(Intent.createChooser(shareIntent, "Share Audio via"))
        } catch (e: Exception) {
            e.printStackTrace()
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "Share error: ${e.localizedMessage ?: "Could not share file"}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
