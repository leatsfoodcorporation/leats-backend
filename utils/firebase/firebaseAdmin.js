const admin = require('firebase-admin');

let firebaseApp = null; // For mobile users (leats-food-corporation-6cf78)
let deliveryFirebaseApp = null; // For delivery partners (manoj-ecom2)

/**
 * Initialize Firebase Admin SDK for mobile users
 */
const initializeFirebase = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    }, 'mobile-app');

    console.log('✅ Firebase Admin SDK initialized for mobile users (leats-food-corporation-6cf78)');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    console.log('📱 Push notifications will not be available');
    return null;
  }
};

/**
 * Initialize Firebase Admin SDK for delivery partners
 */
const initializeDeliveryFirebase = () => {
  if (deliveryFirebaseApp) {
    return deliveryFirebaseApp;
  }

  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.DELIVERY_FIREBASE_PROJECT_ID || 'manoj-ecom2',
      private_key: process.env.DELIVERY_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.DELIVERY_FIREBASE_CLIENT_EMAIL,
    };

    deliveryFirebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.DELIVERY_FIREBASE_DATABASE_URL || 'https://manoj-ecom2.firebaseio.com',
    }, 'delivery-app');

    console.log('✅ Firebase Admin SDK initialized for delivery partners (manoj-ecom2)');
    return deliveryFirebaseApp;
  } catch (error) {
    console.error('❌ Delivery Firebase Admin SDK initialization failed:', error.message);
    console.log('📱 Delivery partner push notifications will not be available');
    return null;
  }
};

/**
 * Get Firebase Admin instance
 */
const getFirebaseAdmin = () => {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
};

/**
 * Get Delivery Firebase Admin instance
 */
const getDeliveryFirebaseAdmin = () => {
  if (!deliveryFirebaseApp) {
    return initializeDeliveryFirebase();
  }
  return deliveryFirebaseApp;
};

/**
 * Get Firebase Messaging instance for mobile users
 */
const getMessaging = () => {
  const app = getFirebaseAdmin();
  if (!app) {
    console.warn('⚠️ Firebase not initialized, messaging unavailable');
    return null;
  }
  return admin.messaging(app);
};

/**
 * Get Firebase Messaging instance for delivery partners
 */
const getDeliveryMessaging = () => {
  const app = getDeliveryFirebaseAdmin();
  if (!app) {
    console.warn('⚠️ Delivery Firebase not initialized, messaging unavailable');
    return null;
  }
  return admin.messaging(app);
};

module.exports = {
  initializeFirebase,
  initializeDeliveryFirebase,
  getFirebaseAdmin,
  getDeliveryFirebaseAdmin,
  getMessaging,
  getDeliveryMessaging,
};
