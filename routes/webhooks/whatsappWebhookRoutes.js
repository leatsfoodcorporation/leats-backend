const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  receiveWebhookEvent
} = require('../../controllers/webhook/whatsappWebhookController');

// GET request for Meta verification handshake
router.get('/whatsapp', verifyWebhook);

// POST request for Meta status events
// NOTE: Signature verification is enforced inside the controller
router.post('/whatsapp', receiveWebhookEvent);

module.exports = router;
