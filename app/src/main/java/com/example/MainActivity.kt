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

    private var pendingSaveFile: File? = null
    private val createDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data?.data != null) {
            val destUri = result.data?.data!!
            val fileToSave = pendingSaveFile
            if (fileToSave != null && fileToSave.exists()) {
                try {
                    contentResolver.openOutputStream(destUri)?.use { os ->
                        fileToSave.inputStream().use { input ->
                            input.copyTo(os)
                        }
                        os.flush()
                    }
                    Toast.makeText(this, "Saved: ${fileToSave.name}", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Save error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    fun promptSaveAs(file: File, mimeType: String) {
        pendingSaveFile = file
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType
            putExtra(Intent.EXTRA_TITLE, file.name)
        }
        createDocumentLauncher.launch(intent)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        enableEdgeToEdge()
        hideSystemBars()

        setContent {
            AudioEditorAppScreen(activity = this)
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
fun AudioEditorAppScreen(activity: MainActivity) {
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

                    addJavascriptInterface(AndroidAudioBridge(activity), "AndroidBridge")

                    loadUrl("file:///android_asset/index.html")
                }
            },
            update = { webView ->
                // Keep webview in sync
            }
        )
    }
}

class AndroidAudioBridge(private val activity: MainActivity) {

    private var currentTempFile: File? = null
    private var currentFileOutputStream: FileOutputStream? = null
    private var currentFileName: String = "export.wav"
    private var currentMimeType: String = "audio/wav"
    private var lastExportedFile: File? = null

    @JavascriptInterface
    fun isAvailable(): Boolean {
        return true
    }

    @JavascriptInterface
    fun startSave(fileName: String, mimeType: String): Boolean {
        return try {
            currentFileOutputStream?.close()
            currentFileOutputStream = null

            val cacheDir = File(activity.cacheDir, "audio_exports").apply {
                if (!exists()) mkdirs()
            }
            val tempFile = File(cacheDir, "temp_${System.currentTimeMillis()}_$fileName")
            currentTempFile = tempFile
            currentFileName = fileName
            currentMimeType = mimeType
            currentFileOutputStream = FileOutputStream(tempFile)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    @JavascriptInterface
    fun writeChunk(chunkBase64: String): Boolean {
        return try {
            val fos = currentFileOutputStream ?: return false
            val clean = if (chunkBase64.contains(",")) chunkBase64.substringAfter(",") else chunkBase64
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            fos.write(bytes)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    @JavascriptInterface
    fun cancelSave() {
        try {
            currentFileOutputStream?.close()
            currentFileOutputStream = null
            currentTempFile?.delete()
            currentTempFile = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun finishSave(): String {
        return try {
            currentFileOutputStream?.flush()
            currentFileOutputStream?.close()
            currentFileOutputStream = null

            val tempFile = currentTempFile ?: return "error: No file written"
            if (!tempFile.exists() || tempFile.length() == 0L) {
                return "error: Empty file"
            }

            var savedLocation = ""

            // 1. Android 10+ (API 29+) MediaStore entry
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = activity.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, currentFileName)
                    put(MediaStore.Audio.Media.TITLE, currentFileName.substringBeforeLast("."))
                    put(MediaStore.Audio.Media.MIME_TYPE, currentMimeType)
                    put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/AudioEditor")
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }

                var uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, contentValues)
                if (uri == null) {
                    contentValues.clear()
                    contentValues.put(MediaStore.Downloads.DISPLAY_NAME, currentFileName)
                    contentValues.put(MediaStore.Downloads.MIME_TYPE, currentMimeType)
                    contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AudioEditor")
                    contentValues.put(MediaStore.Downloads.IS_PENDING, 1)
                    uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                }

                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { os ->
                        tempFile.inputStream().use { input -> input.copyTo(os) }
                        os.flush()
                    }
                    contentValues.clear()
                    contentValues.put(MediaStore.Audio.Media.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)
                    savedLocation = "Music/AudioEditor/$currentFileName"
                }
            }

            // 2. Direct File storage in Music or Download directory
            try {
                val publicMusicDir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                    "AudioEditor"
                )
                if (!publicMusicDir.exists()) {
                    publicMusicDir.mkdirs()
                }
                val publicFile = File(publicMusicDir, currentFileName)
                tempFile.copyTo(publicFile, overwrite = true)
                lastExportedFile = publicFile

                MediaScannerConnection.scanFile(
                    activity,
                    arrayOf(publicFile.absolutePath),
                    arrayOf(currentMimeType),
                    null
                )
                if (savedLocation.isEmpty()) {
                    savedLocation = publicFile.absolutePath
                }
            } catch (e: Exception) {
                // Secondary fallback: App-specific external Music dir
                val appMusicDir = activity.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
                    ?: activity.filesDir
                val fallbackFile = File(appMusicDir, currentFileName)
                tempFile.copyTo(fallbackFile, overwrite = true)
                lastExportedFile = fallbackFile
                if (savedLocation.isEmpty()) {
                    savedLocation = fallbackFile.absolutePath
                }
            }

            val finalLocation = savedLocation.ifEmpty { "Music/AudioEditor/$currentFileName" }

            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "Audio saved: Music/AudioEditor/$currentFileName",
                    Toast.LENGTH_LONG
                ).show()
            }

            finalLocation
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

    @JavascriptInterface
    fun saveAudioFile(base64Data: String, mimeType: String, fileName: String): String {
        startSave(fileName, mimeType)
        writeChunk(base64Data)
        return finishSave()
    }

    @JavascriptInterface
    fun shareLastExported(): Boolean {
        return try {
            val fileToShare = lastExportedFile ?: currentTempFile
            if (fileToShare == null || !fileToShare.exists()) {
                activity.runOnUiThread {
                    Toast.makeText(activity, "No exported file to share", Toast.LENGTH_SHORT).show()
                }
                return false
            }

            val fileUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                fileToShare
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = currentMimeType
                putExtra(Intent.EXTRA_STREAM, fileUri)
                putExtra(Intent.EXTRA_SUBJECT, fileToShare.name)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(Intent.createChooser(shareIntent, "Share Audio via"))
            true
        } catch (e: Exception) {
            e.printStackTrace()
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "Share error: ${e.localizedMessage}",
                    Toast.LENGTH_SHORT
                ).show()
            }
            false
        }
    }

    @JavascriptInterface
    fun shareAudioFile(base64Data: String, mimeType: String, fileName: String) {
        try {
            startSave(fileName, mimeType)
            writeChunk(base64Data)
            currentFileOutputStream?.flush()
            currentFileOutputStream?.close()
            currentFileOutputStream = null

            val tempFile = currentTempFile ?: return
            lastExportedFile = tempFile

            val fileUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                tempFile
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
                Toast.makeText(activity, "Share error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun promptSaveAs(): Boolean {
        return try {
            val fileToSave = lastExportedFile ?: currentTempFile
            if (fileToSave != null && fileToSave.exists()) {
                activity.runOnUiThread {
                    activity.promptSaveAs(fileToSave, currentMimeType)
                }
                true
            } else {
                false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
