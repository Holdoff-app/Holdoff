package com.holdoff.app.service;

import com.holdoff.app.R;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class HoldOffAccessibilityService extends AccessibilityService {

    private static final String PREFS_NAME = "holdoff_prefs";
    private static final String KEY_FIRST_LAUNCH = "first_launch_accessibility";
    private static final String KEY_ENABLED_TIMESTAMP = "accessibility_enabled_at";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final int DEBOUNCE_DELAY_MS = 300;
    private static final int API_TIMEOUT_MS = 10000;
    private static final int OVERLAY_AUTO_DISMISS_MS = 30000;
    private static final String BASE_URL = "https://api.smsholdoff.com";
    private static final String VERDICT_API_URL = BASE_URL + "/api/verdict";
    private static final int THREAD_HISTORY_LIMIT = 30;

    // Track the active phone number so we can read thread history
    private String activePhoneNumber = null;

    private static final Set<String> MESSAGING_PACKAGES = new HashSet<>(Arrays.asList(
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.google.android.apps.messaging",
        "com.android.mms",
        "com.samsung.android.messaging",
        "org.thoughtcrime.securesms",
        "org.telegram.messenger",
        "com.facebook.orca",
        "com.instagram.android",
        "com.snapchat.android"
    ));

    private static final String[][] SEND_BUTTON_IDS = {
        {"com.whatsapp", "com.whatsapp:id/send"},
        {"com.whatsapp.w4b", "com.whatsapp.w4b:id/send"},
        {"com.google.android.apps.messaging", "com.google.android.apps.messaging:id/send_message_button_container"},
        {"com.android.mms", "com.android.mms:id/send_button"},
        {"com.samsung.android.messaging", "com.samsung.android.messaging:id/send_button"},
        {"org.thoughtcrime.securesms", "org.thoughtcrime.securesms:id/send_button"},
        {"org.telegram.messenger", "org.telegram.messenger:id/send_button"},
        {"com.facebook.orca", "com.facebook.orca:id/send_button"},
    };

    private static final String[][] TEXT_FIELD_IDS = {
        {"com.whatsapp", "com.whatsapp:id/entry"},
        {"com.whatsapp.w4b", "com.whatsapp.w4b:id/entry"},
        {"com.google.android.apps.messaging", "com.google.android.apps.messaging:id/compose_message_text"},
        {"com.android.mms", "com.android.mms:id/edt_input_box"},
        {"com.samsung.android.messaging", "com.samsung.android.messaging:id/edit_text_content"},
        {"org.thoughtcrime.securesms", "org.thoughtcrime.securesms:id/embedded_text_editor"},
        {"org.telegram.messenger", "org.telegram.messenger:id/chat_message_edit_text"},
        {"com.facebook.orca", "com.facebook.orca:id/edit_text"},
    };

    private FrameLayout overlayView;
    private View overlayCard;
    private TextView tvVerdict;
    private TextView tvMessage;
    private TextView tvReframe;
    private Button btnHoldOff;
    private Button btnSendAnyway;
    private WindowManager windowManager;
    private Handler mainHandler;
    private ExecutorService executor;
    private Runnable autoDismissRunnable;
    private String pendingMessage;
    private String currentPackage;
    private AccessibilityNodeInfo pendingTextField;
    private boolean overlayShowing = false;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private Runnable debounceRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        mainHandler = new Handler(Looper.getMainLooper());
        executor = Executors.newSingleThreadExecutor();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_VIEW_CLICKED
            | AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
            | AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        String pkg = event.getPackageName() != null ? event.getPackageName().toString() : "";
        if (!MESSAGING_PACKAGES.contains(pkg)) return;
        currentPackage = pkg;

        int type = event.getEventType();

        // Track which thread/contact is open so we can read history
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            resolveActivePhoneNumber(pkg);
        }

        if (type == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            AccessibilityNodeInfo source = event.getSource();
            if (source == null) return;
            String viewId = source.getViewIdResourceName();
            if (isSendButton(pkg, viewId)) {
                String draft = readDraftText(pkg);
                if (draft != null && !draft.isEmpty()) {
                    pendingMessage = draft;
                    pendingTextField = findTextField(pkg);
                    if (debounceRunnable != null) debounceHandler.removeCallbacks(debounceRunnable);
                    debounceRunnable = () -> interceptSend(draft);
                    debounceHandler.postDelayed(debounceRunnable, DEBOUNCE_DELAY_MS);
                }
            }
        }
    }

    // ── Phone number resolution ───────────────────────────────────────────────

    /**
     * When the user opens a conversation, attempt to read the most recent SMS
     * address for the active thread. We fall back to null — all thread-history
     * reads are best-effort and non-fatal.
     */
    private void resolveActivePhoneNumber(String pkg) {
        try {
            Uri smsUri = Uri.parse("content://sms/inbox");
            String[] proj = {"address"};
            try (Cursor c = getContentResolver().query(
                    smsUri, proj, null, null, "date DESC LIMIT 1")) {
                if (c != null && c.moveToFirst()) {
                    activePhoneNumber = c.getString(c.getColumnIndexOrThrow("address"));
                }
            }
        } catch (Exception e) {
            // non-fatal; activePhoneNumber stays as-is
        }
    }

    // ── Thread history ────────────────────────────────────────────────────────

    /**
     * Reads the last `limit` SMS messages for the given phone number from the
     * device ContentProvider. Returns an empty list on any failure.
     */
    private List<Map<String, Object>> readThreadHistory(String phoneNumber, int limit) {
        List<Map<String, Object>> history = new ArrayList<>();
        if (phoneNumber == null || phoneNumber.isEmpty()) return history;
        Uri smsUri = Uri.parse("content://sms");
        String[] proj = {"body", "date", "type"};
        try (Cursor c = getContentResolver().query(
                smsUri, proj, "address = ?", new String[]{phoneNumber},
                "date ASC LIMIT " + limit)) {
            if (c != null) {
                while (c.moveToNext()) {
                    Map<String, Object> msg = new HashMap<>();
                    msg.put("body", c.getString(c.getColumnIndexOrThrow("body")));
                    msg.put("timestamp", c.getLong(c.getColumnIndexOrThrow("date")));
                    // type=2 means sent by device user
                    msg.put("direction", c.getInt(c.getColumnIndexOrThrow("type")) == 2 ? "sent" : "received");
                    history.add(msg);
                }
            }
        } catch (Exception e) {
            // non-fatal; return whatever we have
        }
        return history;
    }

    // ── Intercept logic ───────────────────────────────────────────────────────

    private void interceptSend(String message) {
        if (overlayShowing) return;
        executor.execute(() -> fetchVerdict(message));
    }

    private void fetchVerdict(String message) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);

            JSONObject body = new JSONObject();
            body.put("outgoingMessage", message);

            // Include full thread context (30-message cap)
            List<Map<String, Object>> history = readThreadHistory(activePhoneNumber, THREAD_HISTORY_LIMIT);
            JSONArray historyArr = new JSONArray();
            for (Map<String, Object> msg : history) {
                JSONObject m = new JSONObject();
                m.put("direction", msg.get("direction"));
                m.put("body", msg.get("body"));
                m.put("timestamp", msg.get("timestamp"));
                historyArr.put(m);
            }
            body.put("threadHistory", historyArr);

            URL url = new URL(VERDICT_API_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            if (token != null && !token.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            conn.setConnectTimeout(API_TIMEOUT_MS);
            conn.setReadTimeout(API_TIMEOUT_MS);
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int responseCode = conn.getResponseCode();
            StringBuilder responseBody = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(
                        responseCode >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                        StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) responseBody.append(line);
            }

            if (responseCode == 200) {
                JSONObject result = new JSONObject(responseBody.toString());
                mainHandler.post(() -> showOverlay(result, message));
            }
        } catch (Exception e) {
            // Non-fatal: let the message go through if we can't reach the API
        }
    }

    // ── Overlay display ───────────────────────────────────────────────────────

    private void showOverlay(JSONObject verdict, String originalMessage) {
        if (overlayShowing) return;
        overlayShowing = true;

        LayoutInflater inflater = LayoutInflater.from(this);
        overlayCard = inflater.inflate(R.layout.overlay_verdict, null);

        tvVerdict = overlayCard.findViewById(R.id.tvVerdictLabel);
        tvMessage = overlayCard.findViewById(R.id.tvMessagePreview);
        tvReframe = overlayCard.findViewById(R.id.tvReframe);
        btnHoldOff = overlayCard.findViewById(R.id.btnHoldOff);
        btnSendAnyway = overlayCard.findViewById(R.id.btnSendAnyway);

        String safetyLevel = verdict.optString("safetyLevel", "yellow");
        String feedbackText = verdict.optString("feedback_text", "Pause and review.");
        String reframe = verdict.optString("rewrite", "");

        if (tvVerdict != null) tvVerdict.setText(safetyLabel(safetyLevel));
        if (tvMessage != null) tvMessage.setText(originalMessage);
        if (tvReframe != null) {
            tvReframe.setText(reframe.isEmpty() ? feedbackText : reframe);
        }

        if (btnHoldOff != null) {
            btnHoldOff.setOnClickListener(v -> {
                clearDraft();
                dismissOverlay();
                showToast(getString(R.string.holdoff_message_cleared));
            });
        }

        if (btnSendAnyway != null) {
            btnSendAnyway.setOnClickListener(v -> dismissOverlay());
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            android.graphics.PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM;

        windowManager.addView(overlayCard, params);

        autoDismissRunnable = this::dismissOverlay;
        mainHandler.postDelayed(autoDismissRunnable, OVERLAY_AUTO_DISMISS_MS);
    }

    private void dismissOverlay() {
        if (!overlayShowing) return;
        overlayShowing = false;
        if (overlayCard != null && overlayCard.isAttachedToWindow()) {
            windowManager.removeView(overlayCard);
        }
        if (autoDismissRunnable != null) mainHandler.removeCallbacks(autoDismissRunnable);
    }

    private void clearDraft() {
        if (pendingTextField == null) return;
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
        pendingTextField.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isSendButton(String pkg, String viewId) {
        if (viewId == null) return false;
        for (String[] pair : SEND_BUTTON_IDS) {
            if (pair[0].equals(pkg) && pair[1].equals(viewId)) return true;
        }
        return false;
    }

    private String readDraftText(String pkg) {
        AccessibilityNodeInfo field = findTextField(pkg);
        if (field == null) return null;
        CharSequence text = field.getText();
        return text != null ? text.toString().trim() : null;
    }

    private AccessibilityNodeInfo findTextField(String pkg) {
        for (String[] pair : TEXT_FIELD_IDS) {
            if (pair[0].equals(pkg)) {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root == null) return null;
                List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(pair[1]);
                return (nodes != null && !nodes.isEmpty()) ? nodes.get(0) : null;
            }
        }
        return null;
    }

    private String safetyLabel(String level) {
        switch (level.toLowerCase()) {
            case "green": return "Good to send";
            case "red":   return "Hold Off";
            case "spiral": return "Spiral Lock";
            default:      return "Pause";
        }
    }

    private void showToast(String msg) {
        mainHandler.post(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    // ── Static utility ────────────────────────────────────────────────────────

    public static boolean isAccessibilityEnabled(Context context) {
        try {
            int enabled = Settings.Secure.getInt(
                context.getContentResolver(),
                Settings.Secure.ACCESSIBILITY_ENABLED);
            if (enabled != 1) return false;
            String flat = Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            return flat != null && flat.contains(context.getPackageName() + "/.service.HoldOffAccessibilityService");
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onInterrupt() {}
}
