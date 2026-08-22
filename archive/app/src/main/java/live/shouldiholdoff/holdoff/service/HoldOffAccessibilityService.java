package live.shouldiholdoff.holdoff.service;

import live.shouldiholdoff.holdoff.R;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
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
    private static final String BASE_URL = "https://shouldiholdoff.live";
    private static final String VERDICT_API_URL = BASE_URL + "/api/filter/analyze";
    private static final String INTERCEPT_EVENT_URL = BASE_URL + "/api/filter/intercept-event";

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
    private Button btnHold;
    private Button btnSendAnyway;
    private View btnClose;

    private Handler handler;
    private ExecutorService executor;
    private SharedPreferences prefs;
    private String pendingMessage = "";
    private String pendingVerdict = null;
    private String pendingReframe = null;
    private String pendingRewrite = null;
    private String pendingPattern = null;
    private String activePackage = "";
    private Runnable debounceRunnable;
    private WindowManager windowManager;
    private boolean intercepting = false;

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        executor = Executors.newSingleThreadExecutor();
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        ensureDeviceId();
    }

    private void ensureDeviceId() {
        if (!prefs.contains(KEY_DEVICE_ID)) {
            prefs.edit().putString(KEY_DEVICE_ID, UUID.randomUUID().toString()).apply();
        }
    }

    private String getHoldOffDeviceId() {
        return prefs.getString(KEY_DEVICE_ID, "unknown");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED |
                          AccessibilityEvent.TYPE_VIEW_CLICKED |
                          AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                          AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS |
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.notificationTimeout = 100;
        setServiceInfo(info);

        markFirstLaunchDone();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        String pkg = event.getPackageName() != null ? event.getPackageName().toString() : "";

        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (MESSAGING_PACKAGES.contains(pkg)) {
                activePackage = pkg;
            }
            return;
        }

        if (!MESSAGING_PACKAGES.contains(pkg) && !pkg.equals(activePackage)) {
            return;
        }

        if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            handleTextChanged(event);
        } else if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            handleViewClicked(event);
        }
    }

    private void handleTextChanged(AccessibilityEvent event) {
        AccessibilityNodeInfo source = event.getSource();
        if (source == null) return;

        String text = getTextFromEvent(event);
        if (text != null && !text.trim().isEmpty()) {
            pendingMessage = text;
        }
        source.recycle();
    }

    private void handleViewClicked(AccessibilityEvent event) {
        if (intercepting) return;

        AccessibilityNodeInfo source = event.getSource();
        if (source == null) return;

        boolean isSendButton = isSendButton(source);
        source.recycle();

        if (!isSendButton) return;

        String messageText = pendingMessage;
        if (messageText == null || messageText.trim().isEmpty()) {
            messageText = readCurrentTextField();
        }

        if (messageText == null || messageText.trim().length() < 5) return;

        intercepting = true;
        final String capturedMessage = messageText;

        if (debounceRunnable != null) {
            handler.removeCallbacks(debounceRunnable);
        }

        debounceRunnable = () -> fetchVerdict(capturedMessage);
        handler.postDelayed(debounceRunnable, DEBOUNCE_DELAY_MS);
    }

    private boolean isSendButton(AccessibilityNodeInfo node) {
        String viewId = node.getViewIdResourceName();
        if (viewId != null) {
            for (String[] mapping : SEND_BUTTON_IDS) {
                if (viewId.equals(mapping[1])) return true;
            }
            String lower = viewId.toLowerCase();
            if (lower.contains("send") || lower.contains("btn_send")) return true;
        }

        CharSequence desc = node.getContentDescription();
        if (desc != null) {
            String lower = desc.toString().toLowerCase();
            if (lower.contains("send") || lower.equals("submit")) return true;
        }

        CharSequence text = node.getText();
        if (text != null) {
            String lower = text.toString().toLowerCase();
            if (lower.equals("send") || lower.equals("submit")) return true;
        }

        return false;
    }

    private String readCurrentTextField() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;

        for (String[] mapping : TEXT_FIELD_IDS) {
            List<AccessibilityNodeInfo> fields = root.findAccessibilityNodeInfosByViewId(mapping[1]);
            if (!fields.isEmpty()) {
                AccessibilityNodeInfo field = fields.get(0);
                CharSequence text = field.getText();
                field.recycle();
                root.recycle();
                return text != null ? text.toString() : null;
            }
        }

        root.recycle();
        return null;
    }

    private String getTextFromEvent(AccessibilityEvent event) {
        if (event.getText() != null && !event.getText().isEmpty()) {
            return event.getText().get(0).toString();
        }
        if (event.getContentDescription() != null) {
            return event.getContentDescription().toString();
        }
        return "";
    }

    private void fetchVerdict(String message) {
        executor.execute(() -> {
            try {
                URL url = new URL(VERDICT_API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(API_TIMEOUT_MS);

                JSONObject body = new JSONObject();
                body.put("message", message);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                int responseCode = conn.getResponseCode();
                StringBuilder response = new StringBuilder();
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(
                            responseCode >= 400 ? conn.getErrorStream() : conn.getInputStream(),
                            StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                }

                if (responseCode >= 200 && responseCode < 300) {
                    JSONObject json = new JSONObject(response.toString());
                    String verdict = json.optString("verdict", "HOLD");
                    String reframe = json.optString("grounded_voice", "Take a breath before sending.");
                    String rewrite = json.optString("rewrite", "");
                    String pattern = json.optString("pattern", "");

                    handler.post(() -> showReliefModal(message, verdict, reframe, rewrite, pattern));
                } else {
                    handler.post(() -> showReliefModal(message, "HOLD",
                        "Take a breath. This message can wait.", "", ""));
                }
            } catch (Exception e) {
                handler.post(() -> showReliefModal(pendingMessage, "HOLD",
                    "Take a breath. This message can wait.", "", ""));
            }
        });
    }

    private void showReliefModal(String message, String verdict, String reframe, String rewrite, String pattern) {
        removeOverlay();

        pendingVerdict = verdict;
        pendingReframe = reframe;
        pendingRewrite = rewrite;
        pendingPattern = pattern;

        overlayView = new FrameLayout(this);
        FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        overlayParams.gravity = Gravity.BOTTOM;
        overlayView.setLayoutParams(overlayParams);

        LayoutInflater inflater = LayoutInflater.from(this);
        overlayCard = inflater.inflate(R.layout.overlay_verdict, overlayView, false);

        tvVerdict = overlayCard.findViewById(R.id.tv_verdict);
        tvMessage = overlayCard.findViewById(R.id.tv_message);
        tvReframe = overlayCard.findViewById(R.id.tv_reframe);
        btnHold = overlayCard.findViewById(R.id.btn_hold);
        btnSendAnyway = overlayCard.findViewById(R.id.btn_send_anyway);
        btnClose = overlayCard.findViewById(R.id.btn_close);

        tvVerdict.setText(verdict);

        int badgeColor;
        switch (verdict.toUpperCase()) {
            case "SEND":
                badgeColor = 0xFF22C55E;
                break;
            case "REWRITE":
                badgeColor = 0xFFF59E0B;
                break;
            default:
                badgeColor = 0xFFEF4444;
                break;
        }
        tvVerdict.getBackground().setTint(badgeColor);

        tvMessage.setText(message != null ? message : "");
        tvReframe.setText(reframe != null ? reframe : "");

        btnHold.setOnClickListener(v -> {
            clearMessageField();
            Toast.makeText(this, R.string.holdoff_message_cleared, Toast.LENGTH_SHORT).show();
            logInterceptEvent("hold_intercepted");
            removeOverlay();
            intercepting = false;
            pendingMessage = "";
        });

        btnSendAnyway.setOnClickListener(v -> {
            removeOverlay();
            intercepting = false;
            pendingMessage = "";
        });

        btnClose.setOnClickListener(v -> {
            removeOverlay();
            intercepting = false;
            pendingMessage = "";
        });

        overlayView.addView(overlayCard);

        try {
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            );
            params.gravity = Gravity.BOTTOM;
            windowManager.addView(overlayView, params);
        } catch (Exception e) {
            intercepting = false;
        }

        handler.postDelayed(() -> {
            removeOverlay();
            intercepting = false;
        }, OVERLAY_AUTO_DISMISS_MS);
    }

    private void clearMessageField() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        for (String[] mapping : TEXT_FIELD_IDS) {
            List<AccessibilityNodeInfo> fields = root.findAccessibilityNodeInfosByViewId(mapping[1]);
            if (!fields.isEmpty()) {
                AccessibilityNodeInfo field = fields.get(0);
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, " ");
                field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                field.recycle();
                root.recycle();
                return;
            }
        }

        root.recycle();
    }

    private void logInterceptEvent(String eventType) {
        executor.execute(() -> {
            try {
                URL url = new URL(INTERCEPT_EVENT_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                JSONObject body = new JSONObject();
                body.put("event_type", eventType);
                body.put("device_id", getHoldOffDeviceId());

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                conn.getResponseCode();
            } catch (Exception ignored) {}
        });
    }

    private void removeOverlay() {
        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {}
            overlayView = null;
        }
    }

    private void markFirstLaunchDone() {
        prefs.edit()
            .putLong(KEY_FIRST_LAUNCH, System.currentTimeMillis())
            .putLong(KEY_ENABLED_TIMESTAMP, System.currentTimeMillis())
            .apply();
    }

    public static boolean isAccessibilityEnabled(android.content.Context ctx) {
        android.content.ComponentName serviceComponent = new android.content.ComponentName(
            ctx, HoldOffAccessibilityService.class);
        android.content.pm.PackageManager pm = ctx.getPackageManager();
        try {
            android.content.pm.ServiceInfo serviceInfo = pm.getServiceInfo(serviceComponent, 0);
            String enabledServices = android.provider.Settings.Secure.getString(
                ctx.getContentResolver(),
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (enabledServices != null) {
                return enabledServices.contains(serviceComponent.flattenToString());
            }
        } catch (PackageManager.NameNotFoundException e) {
            // Service not declared
        }
        return false;
    }

    @Override
    public void onInterrupt() {
        removeOverlay();
        intercepting = false;
    }

    @Override
    public void onDestroy() {
        executor.shutdown();
        handler.removeCallbacksAndMessages(null);
        removeOverlay();
        intercepting = false;
        super.onDestroy();
    }
}
