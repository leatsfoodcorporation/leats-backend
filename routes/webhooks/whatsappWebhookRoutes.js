const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  receiveWebhookEvent,
  getTrackedMessages
} = require('../../controllers/webhook/whatsappWebhookController');

// GET request for Meta verification handshake
router.get('/whatsapp', verifyWebhook);

// POST request for Meta status events
router.post('/whatsapp', receiveWebhookEvent);

// Debug route to view currently tracked messages
router.get('/whatsapp/tracked', getTrackedMessages);

module.exports = router;
