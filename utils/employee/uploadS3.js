/**
 * Employee Document S3 Upload Helpers
 * Reuses the generic uploadToS3 from delivery upload utils
 */

const { uploadToS3, deleteFromS3, getPresignedUrl } = require("../delivery/uploadS3");

const uploadEmployeeProfilePhoto = async (file, employeeId) => {
  return uploadToS3(file, "employees", `${employeeId}/profile-photo`);
};

const uploadEmployeeAadhar = async (file, employeeId) => {
  return uploadToS3(file, "employees", `${employeeId}/documents/aadhar`);
};

const uploadEmployeePAN = async (file, employeeId) => {
  return uploadToS3(file, "employees", `${employeeId}/documents/pan`);
};

const uploadEmployeeIdProof = async (file, employeeId) => {
  return uploadToS3(file, "employees", `${employeeId}/documents/id-proof`);
};

module.exports = {
  uploadEmployeeProfilePhoto,
  uploadEmployeeAadhar,
  uploadEmployeePAN,
  uploadEmployeeIdProof,
  deleteFromS3,
  getPresignedUrl,
};
