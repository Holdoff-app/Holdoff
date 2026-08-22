/**
 * In-process cron job startup for Render compatibility.
 * render.yaml crons — Blaxel migration complete. During shadow migration, this keeps Render functional.
 * Guarded by HOLDOFF_IN_PROCESS_CRONS_ENABLED so Blaxel shadow (which sets it to false) doesn't start it.
 */
if (process.env.HOLDOFF_IN_PROCESS_CRONS_ENABLED === 'true') {
  const VERDICT_MONITOR_INTERVAL_MS = 60_000;
  const { run } = require('./verdict-monitor');
  setInterval(() => {
    run().catch(err => {
      console.error('[in-process-crons] verdict-monitor error:', err?.message);
    });
  }, VERDICT_MONITOR_INTERVAL_MS);
  console.log(`[in-process-crons] Verdict monitor scheduled every ${VERDICT_MONITOR_INTERVAL_MS / 1000}s`);

  // Daily site health check — weekdays at 9am local (checked every minute)
  const { run: runDailyHealth } = require('./daily-site-health-check');
  const DAILY_CHECK_MS = 60_000;
  setInterval(() => {
    const now = new Date();
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    if (isWeekday && now.getHours() === 9 && now.getMinutes() === 0) {
      runDailyHealth().catch(err => {
        console.error('[in-process-crons] daily-site-health-check error:', err?.message);
      });
    }
  }, DAILY_CHECK_MS);
  console.log('[in-process-crons] Daily site health check scheduled for weekdays at 9:00am');
}