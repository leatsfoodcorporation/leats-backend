const { getInvitationEmailTemplate } = require("./invitation");
const { getRoleAssignedEmailTemplate } = require("./role-assigned");
const { getSuspendedEmailTemplate } = require("./suspended");

module.exports = {
  getInvitationEmailTemplate,
  getRoleAssignedEmailTemplate,
  getSuspendedEmailTemplate,
};
