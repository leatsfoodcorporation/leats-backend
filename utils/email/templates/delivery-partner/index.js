/**
 * Delivery Partner Email Templates
 * Centralized export for all delivery partner email templates
 */

const { getApprovedEmailTemplate } = require("./approved");
const { getRejectedEmailTemplate } = require("./rejected");
const { getSuspendedEmailTemplate } = require("./suspended");
const { getRegistrationSubmittedEmailTemplate } = require("./registration-submitted");

module.exports = {
  getApprovedEmailTemplate,
  getRejectedEmailTemplate,
  getSuspendedEmailTemplate,
  getRegistrationSubmittedEmailTemplate,
};
