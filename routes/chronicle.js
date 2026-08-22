/**
 * Chronicle route — Personalized tips based on user session history and usage patterns.
 * Owns: GET /chronicle (page), GET /api/chronicle/tips (tips API).
 */
const express = require('express');
const router = express.Router();
const { getCookieTokens } = require('../lib/auth');
const { getVerdictHistory, getVerdictStats } = require('../db/verdict-history');
const { getInsights, topPatterns, timeHeatmap, getStreak } = require('../db/journal');
const { getVerdictLogCount } = require('../db/verdict-logs');
const { findUserById } = require('../db/users');

/** Require authentication — return 401 JSON if not logged in. */
function requireAuth(req, res, next) {
  const tokens = getCookieTokens(req);
  const payload = tokens.accessPayload || tokens.refreshPayload;
  if (!payload?.id) return res.status(401).json({ error: 'Not authenticated' });
  req.userId = payload.id;
  next();
}

/**
 * Analyze user patterns and generate personalized tips.
 */
async function generateTips(userId) {
  const tips = [];
  
  try {
    // Get user stats
    const [verdictStats, journalInsights, verdictCount, user] = await Promise.all([
      getVerdictStats(userId),
      getInsights(userId).catch(() => null),
      getVerdictLogCount(userId),
      findUserById(userId),
    ]);

    // Get verdict history for pattern analysis
    const { entries: recentVerdicts } = await getVerdictHistory(userId, { limit: 20 });

    // TIP 1: Streak encouragement
    if (verdictStats.currentStreak > 0) {
      if (verdictStats.currentStreak < 3) {
        tips.push({
          type: 'streak',
          priority: 'high',
          icon: '🔥',
          title: 'Keep Your Streak Going!',
          message: `You're on a ${verdictStats.currentStreak}-day streak. One more day and you'll hit ${verdictStats.currentStreak + 1}!`,
          action: 'Check in daily to maintain momentum.',
        });
      } else if (verdictStats.currentStreak >= 3 && verdictStats.currentStreak < 7) {
        tips.push({
          type: 'streak',
          priority: 'high',
          icon: '🔥',
          title: 'Impressive Streak!',
          message: `${verdictStats.currentStreak} days strong! You're building real self-awareness.`,
          action: 'Keep reflecting on your patterns daily.',
        });
      } else if (verdictStats.currentStreak >= 7) {
        tips.push({
          type: 'streak',
          priority: 'high',
          icon: '🏆',
          title: 'Streak Master!',
          message: `${verdictStats.currentStreak} days! You've made this a habit. Your longest streak is ${verdictStats.longestStreak} days.`,
          action: 'Share your progress with a trusted friend.',
        });
      }
    } else if (verdictStats.totalVerdicts > 0) {
      tips.push({
        type: 'streak',
        priority: 'medium',
        icon: '💫',
        title: 'Start a New Streak',
        message: 'Daily check-ins help you spot patterns before they spiral.',
        action: 'Submit a verdict today to start fresh.',
      });
    }

    // TIP 2: Pattern recognition
    if (journalInsights && journalInsights.top_patterns && journalInsights.top_patterns.length > 0) {
      const topPattern = journalInsights.top_patterns[0];
      tips.push({
        type: 'pattern',
        priority: 'high',
        icon: '🎯',
        title: 'You Have a Pattern',
        message: `"${topPattern.pattern_name}" has shown up ${topPattern.count} times. Recognizing it is the first step.`,
        action: `Reflect: What triggers this pattern? Journal about it.`,
      });

      // If pattern is recent, add urgency
      if (topPattern.days_since !== null && topPattern.days_since <= 2) {
        tips.push({
          type: 'pattern',
          priority: 'urgent',
          icon: '⚠️',
          title: 'Pattern Alert',
          message: `"${topPattern.pattern_name}" appeared ${topPattern.days_since === 0 ? 'today' : topPattern.days_since === 1 ? 'yesterday' : topPattern.days_since + ' days ago'}. It's active right now.`,
          action: 'Be mindful of this pattern in your next message.',
        });
      }
    }

    // TIP 3: Time-of-day insight
    if (journalInsights && journalInsights.peak_hour !== null) {
      const hour = journalInsights.peak_hour;
      const timeLabel = hour < 6 ? 'very late at night' :
                       hour < 12 ? 'in the morning' :
                       hour < 17 ? 'in the afternoon' :
                       hour < 22 ? 'in the evening' : 'late at night';
      
      if (hour >= 22 || hour < 6) {
        tips.push({
          type: 'timing',
          priority: 'high',
          icon: '🌙',
          title: 'Late-Night Pattern',
          message: `Most of your messages are checked ${timeLabel} (around ${hour % 12 || 12}${hour >= 12 ? 'pm' : 'am'}). This is when emotions run highest.`,
          action: 'Try the 12-hour rule: wait until morning before sending.',
        });
      } else if (hour >= 6 && hour < 9) {
        tips.push({
          type: 'timing',
          priority: 'medium',
          icon: '🌅',
          title: 'Morning Checker',
          message: `You check messages early in the morning (around ${hour}am). That is a grounded time to reflect.`,
          action: 'Use this clarity to review yesterday drafts.',
        });
      }
    }

    // TIP 4: Verdict balance analysis
    const holdCount = recentVerdicts.filter(v => v.verdict === 'HOLD').length;
    const sendCount = recentVerdicts.filter(v => v.verdict === 'SEND').length;
    const rewriteCount = recentVerdicts.filter(v => v.verdict === 'REWRITE').length;
    const totalRecent = holdCount + sendCount + rewriteCount;

    if (totalRecent >= 5) {
      const holdRate = Math.round((holdCount / totalRecent) * 100);
      
      if (holdRate > 70) {
        tips.push({
          type: 'balance',
          priority: 'medium',
          icon: '🛑',
          title: 'You Hold A Lot',
          message: `${holdRate}% of your recent messages were held. That is great impulse control, but make sure you are not avoiding communication.`,
          action: 'Check if you are using holding as avoidance.',
        });
      } else if (holdRate < 30) {
        tips.push({
          type: 'balance',
          priority: 'medium',
          icon: '📤',
          title: 'You Send A Lot',
          message: `Only ${holdRate}% of recent messages were held. You might be sending more impulsively than you realize.`,
          action: 'Try holding one more message this week.',
        });
      } else {
        tips.push({
          type: 'balance',
          priority: 'low',
          icon: '⚖️',
          title: 'Balanced Approach',
          message: `Your hold rate is ${holdRate}%. You are finding balance between caution and authenticity.`,
          action: 'Keep trusting your judgment.',
        });
      }
    }

    // TIP 5: Attachment style insight
    if (user && user.attachment_style) {
      const style = user.attachment_style.toLowerCase();
      if (style.includes('anxious')) {
        tips.push({
          type: 'attachment',
          priority: 'medium',
          icon: '💭',
          title: 'Anxious Attachment Insight',
          message: 'Anxious texters often over-explain or seek reassurance. You can communicate connection without flooding.',
          action: 'Before sending, ask: "Is this about me or them?"',
        });
      } else if (style.includes('avoidant')) {
        tips.push({
          type: 'attachment',
          priority: 'medium',
          icon: '🚪',
          title: 'Avoidant Attachment Insight',
          message: 'Avoidant texters might hold back too much. Vulnerability is not weakness--it is connection.',
          action: 'Practice sending one emotionally honest message this week.',
        });
      } else if (style.includes('secure')) {
        tips.push({
          type: 'attachment',
          priority: 'low',
          icon: '✅',
          title: 'Secure Attachment',
          message: 'Your secure style shows in your balanced texting. Keep modeling healthy communication.',
          action: 'Use your clarity to help others.',
        });
      }
    }

    // TIP 6: Journal engagement
    if (journalInsights && journalInsights.streak) {
      const streak = journalInsights.streak;
      if (streak.total_entries === 0) {
        tips.push({
          type: 'journal',
          priority: 'medium',
          icon: '📔',
          title: 'Start Journaling',
          message: 'The pattern journal helps you track triggers and outcomes over time.',
          action: 'Add your first entry today.',
        });
      } else if (streak.current_streak === 0 && streak.total_entries > 0) {
        tips.push({
          type: 'journal',
          priority: 'medium',
          icon: '📔',
          title: 'Journal Again',
          message: `You have journaled ${streak.total_entries} times before. Reconnect with your patterns.`,
          action: 'Write one entry this week.',
        });
      }
    }

    // TIP 7: Milestone celebration
    if (verdictStats.totalVerdicts > 0) {
      if (verdictStats.totalVerdicts === 1) {
        tips.push({
          type: 'milestone',
          priority: 'high',
          icon: '🎉',
          title: 'First Verdict!',
          message: 'You just took your first step toward mindful communication.',
          action: 'Keep checking in--it gets easier.',
        });
      } else if (verdictStats.totalVerdicts === 10) {
        tips.push({
          type: 'milestone',
          priority: 'high',
          icon: '🎉',
          title: '10 Verdicts Milestone',
          message: 'Ten check-ins! You are building real self-awareness.',
          action: 'Reflect on what has changed since you started.',
        });
      } else if (verdictStats.totalVerdicts === 50) {
        tips.push({
          type: 'milestone',
          priority: 'high',
          icon: '🏆',
          title: '50 Verdicts!',
          message: 'Fifty verdicts is serious commitment. You have rewired your texting habits.',
          action: 'Share your progress--it might inspire someone.',
        });
      } else if (verdictStats.totalVerdicts % 100 === 0) {
        tips.push({
          type: 'milestone',
          priority: 'high',
          icon: '🌟',
          title: `${verdictStats.totalVerdicts} Verdicts!`,
          message: 'You are a mindful communication champion.',
          action: 'Look back at your first verdict--see how far you have come.',
        });
      }
    }

    // TIP 8: Inactivity nudge
    if (verdictStats.lastVerdictAt) {
      const daysSince = Math.floor((Date.now() - new Date(verdictStats.lastVerdictAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 7 && daysSince < 30) {
        tips.push({
          type: 'engagement',
          priority: 'medium',
          icon: '👋',
          title: 'We Miss You',
          message: `It has been ${daysSince} days since your last check-in. Your patterns do not disappear--they just hide.`,
          action: 'Submit one verdict today to reconnect.',
        });
      } else if (daysSince >= 30) {
        tips.push({
          type: 'engagement',
          priority: 'high',
          icon: '🔄',
          title: 'Come Back',
          message: `${daysSince} days is a long time. The work you did before still matters.`,
          action: 'Start fresh--one message at a time.',
        });
      }
    }

    // Sort tips by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Return top 5 tips
    return tips.slice(0, 5);

  } catch (err) {
    console.error('[chronicle] Error generating tips:', err);
    return [{
      type: 'error',
      priority: 'low',
      icon: '💡',
      title: 'Keep Checking In',
      message: 'Every message you review is a step toward self-awareness.',
      action: 'Come back tomorrow.',
    }];
  }
}

/** GET /chronicle — chronicle tips page. */
router.get('/', requireAuth, (req, res) => {
  res.render('chronicle', { user: { id: req.userId } });
});

/** GET /api/chronicle/tips — get personalized tips. */
router.get('/tips', requireAuth, async (req, res) => {
  try {
    const tips = await generateTips(req.userId);
    res.json({ tips });
  } catch (err) {
    console.error('[chronicle] /tips error:', err.message);
    res.status(500).json({ error: 'Failed to generate tips' });
  }
});

module.exports = router;
