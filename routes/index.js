/**
 * Routes entry point — mounts all route groups.
 */
const express = require('express');
const router = express.Router();

router.use(require('./meta'));
router.use(require('./stripe-webhook'));
router.use('/auth', require('./auth'));
router.use('/filter', require('./filter'));
router.use('/waitlist', require('./waitlist'));
router.use('/checkout', require('./checkout'));
router.use('/blast', require('./blast'));
router.use('/share', require('./share'));
router.use('/admin', require('./admin'));
router.use('/detox', require('./detox'));
router.use('/contact', require('./contact'));
router.use('/outreach', require('./outreach'));
router.use('/download', require('./download'));
router.use('/referral', require('./referral'));
router.use('/affiliates', require('./affiliates'));
router.use('/journal', require('./journal'));
router.use('/quiz', require('./quiz'));
router.use('/verdict', require('./verdict'));
router.use('/push', require('./push'));
router.use('/abandoned-checkout', require('./abandoned-checkout'));
module.exports = router;
