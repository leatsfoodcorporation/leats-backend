const { prisma } = require("../../config/database");

/**
 * Checks if a pincode is serviceable within a given country, optionally optimized by city/state.
 * @param {string} pincode - The pincode to check.
 * @param {string} [country='India'] - The country to check within.
 * @param {string} [city] - Optional city for 100% coverage check.
 * @param {string} [state] - Optional state for 100% coverage check.
 * @returns {Promise<{serviceable: boolean, zone: object|null}>}
 */
const isPincodeServiceable = async (pincode, country = 'India', city = null, state = null) => {
  if (!pincode) return { serviceable: false, zone: null };

  const cleanPincode = pincode.trim();
  
  // 🔧 TEMPORARY: Allow all pincodes for testing (REMOVE IN PRODUCTION)
  // return { serviceable: true, zone: { id: 'temp', country, state, city, pincodes: [cleanPincode], isActive: true } };

  // PRIORITY 1: Check if there is an "Entire City" zone that matches
  if (city && state) {
    const cityZone = await prisma.deliveryZone.findFirst({
      where: {
        country: country || undefined,
        state: state,
        city: city,
        isActive: true,
        isAllPincodes: true,
      },
    });

    if (cityZone) {
      return {
        serviceable: true,
        zone: cityZone,
      };
    }
  }

  // PRIORITY 2: Fallback to checking specific pincode in any active zone
  const whereClause = {
    isActive: true,
    pincodes: {
      has: cleanPincode,
    },
  };

  if (country) {
    whereClause.country = country;
  }

  const pincodeZone = await prisma.deliveryZone.findFirst({
    where: whereClause,
  });

  return {
    serviceable: !!pincodeZone,
    zone: pincodeZone || null,
  };
};

module.exports = {
  isPincodeServiceable,
};
