const { prisma } = require("../../config/database");
const { generateInvoiceNumber } = require("../../utils/order/invoiceGenerator");
const { calculateOrderTotals: calculateGSTTotals } = require("../../utils/order/gstCalculator");
const { getFinancialPeriod } = require("../../utils/finance/financialPeriod");
const { updateStockAfterOrder } = require("../../utils/inventory/stockUpdateService");
const { createOnlineTransaction } = require("../../utils/finance/transactionService");
const { sendOrderPlacedNotification, sendToEmployeesByPermission } = require("../../utils/notification/sendNotification");
const { isPincodeServiceable } = require("../../utils/online/serviceability");
const { sendToAdmin } = require("../../utils/socket/socketHandler");

/**
 * Resolve the final shipping charge for an order.
 * Priority: Active DeliveryCharge rule from DB → product-level fallback
 *
 * When an active rule exists:
 *   - subtotal >= rule.minOrderValue → charge = rule.chargeAmount (e.g. 0 = free)
 *   - subtotal <  rule.minOrderValue → charge = rule.chargeAmount (the threshold charge, e.g. 50)
 * Note: Individual product shippingCharge/freeShipping fields are IGNORED when a rule is active.
 *
 * When NO active rule exists:
 *   - Falls back to product-level: MAX of product shippingCharges (0 if any item is freeShipping)
 *
 * @param {number} subtotal - Cart subtotal before discounts
 * @param {Array}  cartItemsWithDetails - Cart items with product details
 * @param {object} tx - Prisma transaction client (or prisma directly)
 * @returns {Promise<number>} Final shipping charge
 */
const resolveShippingCharge = async (subtotal, cartItemsWithDetails, tx) => {
  // Fetch active delivery charge rules ordered by minOrderValue DESC (highest first)
  const activeRules = await tx.deliveryCharge.findMany({
    where: { isActive: true },
    orderBy: { minOrderValue: 'desc' },
  });

  if (activeRules.length > 0) {
    // Primary rule is the one with the highest threshold (first in DESC sort)
    const primaryRule = activeRules[0];

    if (subtotal >= primaryRule.minOrderValue) {
      // ✅ Cart meets threshold -> FREE delivery
      console.log(`✅ Delivery rule matched: subtotal ₹${subtotal} >= ₹${primaryRule.minOrderValue} → FREE (₹0)`);
      return 0;
    } else {
      // ✅ Cart below threshold -> apply rule's chargeAmount (e.g. ₹50)
      console.log(`✅ Delivery rule applied: subtotal ₹${subtotal} < ₹${primaryRule.minOrderValue} → charge ₹${primaryRule.chargeAmount}`);
      return primaryRule.chargeAmount;
    }
  }

  // No active rules — fall back to product-level shipping
  console.log('⚠️ No active delivery charge rules found. Falling back to product-level shipping.');
  const hasFreeShipping = cartItemsWithDetails.some(item => item.product.freeShipping);
  if (hasFreeShipping) return 0;

  const productCharges = cartItemsWithDetails
    .map(item => item.product.shippingCharge || 0)
    .filter(c => c > 0);

  if (productCharges.length === 0) return 0;
  return Math.max(...productCharges);
};

/**
 * Update customer analytics (total orders, total spent, last order date)
 */
const updateCustomerAnalytics = async (customerId, orderTotal, orderDate) => {
  try {
    // Find customer in Customer collection
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      console.log(`⚠️ Customer not found in Customer collection: ${customerId}`);
      return;
    }

    // Update customer analytics
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalOrders: customer.totalOrders + 1,
        totalSpent: customer.totalSpent + orderTotal,
        lastOrderDate: orderDate ? new Date(orderDate) : new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`📊 Customer analytics updated: ${customer.name} - Orders: ${customer.totalOrders + 1}, Spent: ₹${(customer.totalSpent + orderTotal).toFixed(2)}`);
  } catch (error) {
    console.error("❌ Error updating customer analytics:", error);
    throw error;
  }
};

/**
 * Generate unique order number
 */
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ONL${timestamp}${random}`;
};

/**
 * Create online order
 * POST /api/online/orders
 */
const createOrder = async (req, res) => {
  try {
    const { userId, deliveryAddressId, paymentMethod, couponCode } = req.body;

    console.log("📦 Create Order Request:", { userId, deliveryAddressId, paymentMethod, couponCode });

    if (!userId) return res.status(400).json({ success: false, error: "User ID is required" });
    if (!deliveryAddressId) return res.status(400).json({ success: false, error: "Delivery address is required" });
    if (!paymentMethod) return res.status(400).json({ success: false, error: "Payment method is required" });

    if (paymentMethod === "razorpay" || paymentMethod === "stripe") {
      console.log("→ Routing to prepareOnlinePaymentOrder");
      return await prepareOnlinePaymentOrder(req, res);
    }

    if (paymentMethod === "cod") {
      console.log("→ Routing to createCODOrder");
      return await createCODOrder(req, res);
    }

    return res.status(400).json({ success: false, error: "Invalid payment method" });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create order" });
  }
};

/**
 * Prepare order for online payment (Razorpay/Stripe)
 */
const prepareOnlinePaymentOrder = async (req, res) => {
  const { userId, deliveryAddressId, paymentMethod, couponCode } = req.body;

  try {
    const orderPreparation = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { userId },
        include: { cartItems: { include: { customer: true } } },
      });

      if (!customer) throw new Error("Customer not found");
      if (!customer.cartItems || customer.cartItems.length === 0) throw new Error("Cart is empty");

      let address;
      
      // Handle special case for profile address
      if (deliveryAddressId === "profile-address") {
        // Fetch user profile data
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || !user.address || !user.city || !user.state || !user.zipCode || !user.country) {
          throw new Error("Profile address is incomplete. Please add a complete address.");
        }
        
        // Create address object from user profile
        address = {
          id: "profile-address",
          customerId: customer.id,
          name: user.name,
          phone: user.phoneNumber || "",
          alternatePhone: "",
          addressLine1: user.address,
          addressLine2: "",
          landmark: "",
          city: user.city,
          state: user.state,
          pincode: user.zipCode,
          country: user.country,
          addressType: "home",
          isDefault: false,
        };
      } else {
        // Regular saved address
        address = await tx.customerAddress.findUnique({ where: { id: deliveryAddressId } });
        if (!address || address.customerId !== customer.id) throw new Error("Invalid delivery address");
      }

      // Check delivery serviceability
      const { serviceable, zone } = await isPincodeServiceable(address.pincode, address.country, address.city, address.state);
      if (!serviceable) {
        throw new Error(`Delivery is not available for the selected location (${address.pincode}). Please choose a different address.`);
      }

      const cartItemsWithDetails = [];
      for (const cartItem of customer.cartItems) {
        const product = await tx.onlineProduct.findUnique({ where: { id: cartItem.productId } });
        if (!product) throw new Error(`Product ${cartItem.productId} not found`);

        const variant = product.variants[cartItem.variantIndex];
        if (!variant) throw new Error(`Variant not found for product ${cartItem.productId}`);
        
        // 🔧 UOM-aware stock validation
        // If variant has UOM (e.g., 500g per unit), convert stock from base UOM to variant UOM
        let availableUnits = variant.variantStockQuantity;
        
        if (variant.variantUom && variant.variantUomValue && variant.variantUomValue > 0) {
          // Stock is in base UOM (e.g., 0.8 kg), need to convert to variant UOM (e.g., g)
          let stockInVariantUom = variant.variantStockQuantity;
          
          // Convert base UOM to variant UOM if needed
          if (variant.variantUom === 'g' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // kg → g
          } else if (variant.variantUom === 'ml' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // L → ml
          }
          
          // Calculate how many units can be made from available stock
          availableUnits = Math.floor(stockInVariantUom / variant.variantUomValue);
        }
        
        if (availableUnits < cartItem.quantity) {
          throw new Error(`Insufficient stock for ${variant.variantName}. Available: ${availableUnits} units`);
        }

        cartItemsWithDetails.push({ ...cartItem, product, variant, gstPercentage: product.gstPercentage });
      }

      // Calculate subtotal
      const subtotal = cartItemsWithDetails.reduce((sum, item) => sum + item.variantSellingPrice * item.quantity, 0);

      let couponDiscount = 0;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (!coupon) throw new Error("Invalid coupon code");

        const now = new Date();
        if (!coupon.isActive || now < coupon.validFrom || now > coupon.validUntil) {
          throw new Error("Coupon is not valid");
        }

        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
          throw new Error(`Minimum order value of ₹${coupon.minOrderValue} required`);
        }

        if (coupon.discountType === "percentage") {
          couponDiscount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
        } else {
          couponDiscount = coupon.discountValue;
        }
      }

      // ✅ Calculate shipping charge using active DeliveryCharge rules from DB
      const finalShippingCharge = await resolveShippingCharge(subtotal, cartItemsWithDetails, tx);

      const orderDataForGST = {
        items: cartItemsWithDetails.map((item) => ({
          id: item.id,
          productId: item.productId,
          inventoryProductId: item.inventoryProductId,
          productName: item.shortDescription,
          variantName: item.variant.variantName || item.variantName,
          displayName: item.variant.displayName || item.variant.variantName || item.variantName,
          brand: item.brand,
          productImage: item.variantImage || item.product.thumbnail,
          selectedCuttingStyle: item.selectedCuttingStyle,
          unitPrice: item.variantSellingPrice,
          mrp: item.variantMRP,
          quantity: item.quantity,
          gstPercentage: item.gstPercentage || 0,
          barcodes: item.variant.variantBarcode ? [item.variant.variantBarcode] : [],
          // 🆕 UOM fields for stock deduction
          variantUom: item.variant.variantUom || null,
          variantUomValue: item.variant.variantUomValue || null,
          variantIndex: item.variantIndex,
          // 🆕 Combo metadata for stock deduction
          isComboProduct: item.product.type === "combo",
          comboItems: item.product.type === "combo" ? item.product.comboItems : undefined,
        })),
        deliveryAddress: {
          name: address.name,
          phone: address.phone,
          alternatePhone: address.alternatePhone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country,
          addressType: address.addressType,
        },
        discount: 0,
        couponDiscount: couponDiscount,
        shippingCharge: finalShippingCharge,
      };

      const totals = await calculateGSTTotals(orderDataForGST);
      const orderNumber = generateOrderNumber();

      return { orderNumber, customer, address, cartItemsWithDetails, totals };
    });

    const gateway = await prisma.paymentGateway.findFirst({
      where: { name: paymentMethod, isActive: true },
    });

    if (!gateway || !gateway.apiKey) {
      return res.status(400).json({ success: false, error: `${paymentMethod} payment gateway is not configured` });
    }

    if (paymentMethod === "razorpay") {
      const Razorpay = require("razorpay");
      const razorpay = new Razorpay({ key_id: gateway.apiKey, key_secret: gateway.secretKey });

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(orderPreparation.totals.total * 100),
        currency: "INR",
        receipt: orderPreparation.orderNumber,
        notes: { orderNumber: orderPreparation.orderNumber, userId },
      });

      console.log(`✅ Razorpay order created: ${razorpayOrder.id}`);

      return res.status(200).json({
        success: true,
        requiresPayment: true,
        data: {
          orderNumber: orderPreparation.orderNumber,
          total: orderPreparation.totals.total,
          paymentMethod,
          razorpay: {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: gateway.apiKey,
          },
        },
        message: "Complete payment to place order",
      });
    }

    return res.status(400).json({ success: false, error: "Payment method not supported yet" });
  } catch (error) {
    console.error("Error preparing online payment order:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to prepare order" });
  }
};

// In-memory lock to prevent race conditions for order creation
const processingOrders = new Set();

/**
 * Create COD order immediately
 */
const createCODOrder = async (req, res) => {
  const { userId, deliveryAddressId, couponCode, orderType, scheduledDate, scheduledSlot, isScheduled } = req.body;

  // Prevent double-submission (Race Condition Protection)
  const lockKey = `${userId}_cod_order`;
  if (processingOrders.has(lockKey)) {
    console.log(`🔒 Request locked: Concurrent order creation attempt for user ${userId}`);
    return res.status(429).json({ 
      success: false, 
      message: "Your order is being processed. Please wait." 
    });
  }

  processingOrders.add(lockKey);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check for duplicate order (Idempotency)
      // Look for an order created by this user with the same total amount in the last 30 seconds
      const tenSecondsAgo = new Date(Date.now() - 30 * 1000);
      
      const recentOrder = await tx.onlineOrder.findFirst({
        where: {
          userId,
          paymentMethod: 'cod',
          createdAt: { gt: tenSecondsAgo }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentOrder) {
        console.log(`⚠️ Prevented duplicate COD order for user ${userId}. Returning existing order: ${recentOrder.orderNumber}`);
        return { 
          orderNumber: recentOrder.orderNumber, 
          invoiceNumber: recentOrder.invoiceNumber, 
          total: recentOrder.total, 
          savedOrder: recentOrder,
          isDuplicate: true // Flag to skip notifications
        };
      }

      const customer = await tx.customer.findUnique({
        where: { userId },
        include: { cartItems: { include: { customer: true } } },
      });

      if (!customer) throw new Error("Customer not found");
      if (!customer.cartItems || customer.cartItems.length === 0) throw new Error("Cart is empty");

      let address;
      
      // Handle special case for profile address
      if (deliveryAddressId === "profile-address") {
        // Fetch user profile data
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || !user.address || !user.city || !user.state || !user.zipCode || !user.country) {
          throw new Error("Profile address is incomplete. Please add a complete address.");
        }
        
        // Create address object from user profile
        address = {
          id: "profile-address",
          customerId: customer.id,
          name: user.name,
          phone: user.phoneNumber || "",
          alternatePhone: "",
          addressLine1: user.address,
          addressLine2: "",
          landmark: "",
          city: user.city,
          state: user.state,
          pincode: user.zipCode,
          country: user.country,
          addressType: "home",
          isDefault: false,
        };
      } else {
        // Regular saved address
        address = await tx.customerAddress.findUnique({ where: { id: deliveryAddressId } });
        if (!address || address.customerId !== customer.id) throw new Error("Invalid delivery address");
      }

      // Check delivery serviceability
      const { serviceable, zone } = await isPincodeServiceable(address.pincode, address.country, address.city, address.state);
      if (!serviceable) {
        throw new Error(`Delivery is not available for the selected location (${address.pincode}). Please choose a different address.`);
      }

      const cartItemsWithDetails = [];
      for (const cartItem of customer.cartItems) {
        const product = await tx.onlineProduct.findUnique({ where: { id: cartItem.productId } });
        if (!product) throw new Error(`Product ${cartItem.productId} not found`);

        const variant = product.variants[cartItem.variantIndex];
        if (!variant) throw new Error(`Variant not found`);
        
        // 🔧 UOM-aware stock validation
        // If variant has UOM (e.g., 500g per unit), convert stock from base UOM to variant UOM
        let availableUnits = variant.variantStockQuantity;
        
        if (variant.variantUom && variant.variantUomValue && variant.variantUomValue > 0) {
          // Stock is in base UOM (e.g., 0.8 kg), need to convert to variant UOM (e.g., g)
          let stockInVariantUom = variant.variantStockQuantity;
          
          // Convert base UOM to variant UOM if needed
          if (variant.variantUom === 'g' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // kg → g
          } else if (variant.variantUom === 'ml' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // L → ml
          }
          
          // Calculate how many units can be made from available stock
          availableUnits = Math.floor(stockInVariantUom / variant.variantUomValue);
        }
        
        if (availableUnits < cartItem.quantity) {
          throw new Error(`Insufficient stock for ${product.shortDescription}. Available: ${availableUnits} units`);
        }

        if (!product.isCODAvailable) {
          throw new Error(`Cash on Delivery is not available for "${product.shortDescription}". Please use online payment.`);
        }

        cartItemsWithDetails.push({ ...cartItem, product, variant, gstPercentage: product.gstPercentage });
      }

      let couponDiscount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (coupon) {
          const now = new Date();
          if (coupon.isActive && now >= coupon.validFrom && now <= coupon.validUntil) {
            const subtotal = cartItemsWithDetails.reduce((sum, item) => sum + item.variantSellingPrice * item.quantity, 0);

            if (coupon.discountType === "percentage") {
              couponDiscount = (subtotal * coupon.discountValue) / 100;
              if (coupon.maxDiscountAmount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
            } else {
              couponDiscount = coupon.discountValue;
            }
            appliedCoupon = coupon;
          }
        }
      }

      // ✅ Calculate shipping charge using active DeliveryCharge rules from DB
      const subtotal = cartItemsWithDetails.reduce((sum, item) => sum + item.variantSellingPrice * item.quantity, 0);
      const finalShippingCharge = await resolveShippingCharge(subtotal, cartItemsWithDetails, tx);

      const orderDataForGST = {
        items: cartItemsWithDetails.map((item) => ({
          id: item.id,
          productId: item.productId,
          inventoryProductId: item.inventoryProductId,
          productName: item.shortDescription,
          variantName: item.variant.variantName || item.variantName,
          displayName: item.variant.displayName || item.variant.variantName || item.variantName,
          brand: item.brand,
          productImage: item.variantImage || item.product.thumbnail,
          selectedCuttingStyle: item.selectedCuttingStyle,
          unitPrice: item.variantSellingPrice,
          mrp: item.variantMRP,
          quantity: item.quantity,
          gstPercentage: item.gstPercentage || 0,
          barcodes: item.variant.variantBarcode ? [item.variant.variantBarcode] : [],
          // 🆕 UOM fields for stock deduction
          variantUom: item.variant.variantUom || null,
          variantUomValue: item.variant.variantUomValue || null,
          variantIndex: item.variantIndex,
          // 🆕 Combo fields for stock expansion
          isComboProduct: item.product.type === 'combo',
          comboItems: item.product.comboItems || [],
        })),
        deliveryAddress: {
          name: address.name,
          phone: address.phone,
          alternatePhone: address.alternatePhone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country,
          addressType: address.addressType,
        },
        discount: 0,
        couponDiscount: couponDiscount,
        shippingCharge: finalShippingCharge,
      };

      const totals = await calculateGSTTotals(orderDataForGST);
      const orderNumber = generateOrderNumber();
      const invoiceResult = await generateInvoiceNumber(tx);
      if (!invoiceResult) throw new Error("Invoice settings not configured");
      const { invoiceNumber } = invoiceResult;

      // Get financial period for the order
      const { financialYear, accountingPeriod } = await getFinancialPeriod(new Date());

      const savedOrder = await tx.onlineOrder.create({
        data: {
          orderNumber,
          invoiceNumber,
          orderType: orderType || "online",
          scheduledDate,
          scheduledSlot,
          isScheduled: !!isScheduled,
          customerId: customer.id,
          userId: customer.userId,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phoneNumber || address.phone,
          deliveryAddress: {
            name: address.name,
            phone: address.phone,
            alternatePhone: address.alternatePhone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country,
            addressType: address.addressType,
          },
          items: totals.items,
          subtotal: totals.subtotal,
          tax: totals.tax,
          taxRate: totals.taxRate,
          gstType: totals.gstType,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          totalGstAmount: totals.totalGstAmount,
          adminState: totals.adminState,
          customerState: totals.customerState,
          discount: totals.discount,
          couponCode: couponCode || null,
          couponDiscount: couponDiscount,
          shippingCharge: totals.shippingCharge,
          total: totals.total,
          paymentMethod: "cod",
          paymentStatus: "pending",
          orderStatus: "pending",
          saleDate: new Date(),
          accountingPeriod,
          financialYear,
        },
      });

      console.log(`💾 Order saved: ${savedOrder.orderNumber}`);

      for (const item of cartItemsWithDetails) {
        const updatedVariants = [...item.product.variants];
        updatedVariants[item.variantIndex].variantStockQuantity -= item.quantity;

        await tx.onlineProduct.update({
          where: { id: item.product.id },
          data: {
            variants: updatedVariants,
          },
        });
      }

      if (appliedCoupon) {
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: { currentUsageCount: { increment: 1 } },
        });

        await tx.couponUsage.create({
          data: {
            couponId: appliedCoupon.id,
            couponCode: appliedCoupon.code,
            userId,
            orderId: orderNumber,
            discountAmount: couponDiscount,
            orderValue: totals.subtotal,
          },
        });
      }

      await tx.cart.deleteMany({ where: { customerId: customer.id } });

      return { orderNumber, invoiceNumber, total: totals.total, savedOrder };
    });

    
    // Skip notifications if this was a duplicate order request
    if (result.isDuplicate) {
      console.log(`ℹ️ Skipping notifications for duplicate order ${result.orderNumber}`);
      return res.status(200).json({
        success: true,
        requiresPayment: false,
        data: {
          orderNumber: result.orderNumber,
          invoiceNumber: result.invoiceNumber,
          total: result.total,
          paymentMethod: "cod",
          paymentStatus: "pending",
          orderStatus: "pending",
          isDuplicate: true
        },
        message: "Order placed successfully (Existing)",
      });
    }

    // Create transaction record (outside transaction to avoid blocking)
    try {
      await createOnlineTransaction(result.savedOrder);
    } catch (transactionError) {
      console.error(`⚠️ Failed to create transaction:`, transactionError.message);
      // Order is still created, transaction creation failure is logged
    }

    // Update inventory stock after successful order creation
    try {
      const stockUpdateResults = await updateStockAfterOrder(result.savedOrder, "ONLINE_ORDER");
      const successCount = stockUpdateResults.filter((r) => r.success).length;
      console.log(`📦 Stock updated for ${successCount}/${stockUpdateResults.length} items`);
    } catch (stockError) {
      console.error(`⚠️ Failed to update stock:`, stockError.message);
      // Order is still created, stock update failure is logged
    }

    // Update customer analytics
    try {
      await updateCustomerAnalytics(result.savedOrder.customerId, result.savedOrder.total, result.savedOrder.createdAt);
      console.log(`📊 Customer analytics updated for ${result.savedOrder.customerName}`);
    } catch (analyticsError) {
      console.error(`⚠️ Failed to update customer analytics:`, analyticsError.message);
      // Order is still created, analytics update failure is logged
    }

    // Send order placed notification to user
    try {
      await sendOrderPlacedNotification(result.savedOrder.userId, result.savedOrder.orderNumber, result.savedOrder.total);
      console.log(`📱 Order placed notification sent to user`);
    } catch (notifError) {
      console.error(`⚠️ Failed to send order notification:`, notifError.message);
    }

    // Send new order notification to all admins
    try {
      const { sendToAllAdmins } = require('../../utils/notification/sendNotification');
      
      const adminNotification = {
        title: '🛒 [Admin] New Order Received!',
        body: `New order from ${result.savedOrder.customerName}\n\n📦 Order #${result.savedOrder.orderNumber}\n💰 Amount: ₹${result.savedOrder.total.toFixed(2)}\n💳 Payment: COD`,
      };

      const adminData = {
        type: 'NEW_ORDER',
        orderNumber: result.savedOrder.orderNumber,
        orderNumberRaw: result.savedOrder.orderNumber.replace(/[^a-zA-Z0-9]/g, '-'), // ✅ Add stable identifier for tag
        orderId: result.savedOrder.id,
        customerName: result.savedOrder.customerName,
        total: result.savedOrder.total.toString(),
        paymentMethod: 'cod',
        link: `/dashboard/orders/online`, // Corrected link to list page as per folder structure
        urgency: 'high',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        color: '#4CAF50',
        backgroundColor: '#E8F5E9',
        actions: [
          {
            action: 'view',
            title: '👁️ View Order',
          },
          {
            action: 'dismiss',
            title: '✖️ Close',
          },
        ],
      };

      await sendToAllAdmins(adminNotification, adminData);
      await sendToEmployeesByPermission('online_orders', adminNotification, adminData);
      console.log(`📱 New order notification sent to all admins + employees`);
    } catch (adminNotifError) {
      console.error(`⚠️ Failed to send admin notification:`, adminNotifError.message);
    }

    console.log(`✅ COD order created: ${result.orderNumber}`);

    // Real-time push to admin dashboard
    sendToAdmin("new_order", { orderNumber: result.orderNumber, type: "online", paymentMethod: "cod" });

    return res.status(201).json({
      success: true,
      requiresPayment: false,
      data: {
        orderNumber: result.orderNumber,
        invoiceNumber: result.invoiceNumber,
        total: result.total,
        paymentMethod: "cod",
        paymentStatus: "pending",
        orderStatus: "pending",
      },
      message: "Order placed successfully",
    });
  } catch (error) {
    console.error("Error creating COD order:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create order" });
  } finally {
    // Release lock
    processingOrders.delete(`${userId}_cod_order`);
  }
};

/**
 * Confirm order after payment verification
 * POST /api/online/orders/confirm
 */
const confirmOrder = async (req, res) => {
  try {
    const { userId, deliveryAddressId, paymentMethod, couponCode, orderNumber, paymentId, orderType, scheduledDate, scheduledSlot, isScheduled } = req.body;

    if (!orderNumber || !paymentId) {
      return res.status(400).json({ success: false, error: "Order number and payment ID are required" });
    }

    const existingOrder = await prisma.onlineOrder.findUnique({
      where: { orderNumber },
    });

    if (existingOrder) {
      console.log(`📦 Order ${orderNumber} already exists, updating payment info`);

      if (existingOrder.paymentStatus !== "completed" || !existingOrder.paymentId) {
        await prisma.onlineOrder.update({
          where: { orderNumber },
          data: {
            paymentStatus: "completed",
            paymentId,
            confirmedAt: existingOrder.confirmedAt || new Date(),
          },
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          orderNumber: existingOrder.orderNumber,
          invoiceNumber: existingOrder.invoiceNumber,
          total: existingOrder.total,
          paymentMethod: existingOrder.paymentMethod,
          paymentStatus: "completed",
          orderStatus: existingOrder.orderStatus,
        },
        message: "Order placed successfully",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { userId },
        include: { cartItems: { include: { customer: true } } },
      });

      if (!customer) throw new Error("Customer not found");
      if (!customer.cartItems || customer.cartItems.length === 0) throw new Error("Cart is empty");

      let address;
      
      // Handle special case for profile address
      if (deliveryAddressId === "profile-address") {
        // Fetch user profile data
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || !user.address || !user.city || !user.state || !user.zipCode || !user.country) {
          throw new Error("Profile address is incomplete. Please add a complete address.");
        }
        
        // Create address object from user profile
        address = {
          id: "profile-address",
          customerId: customer.id,
          name: user.name,
          phone: user.phoneNumber || "",
          alternatePhone: "",
          addressLine1: user.address,
          addressLine2: "",
          landmark: "",
          city: user.city,
          state: user.state,
          pincode: user.zipCode,
          country: user.country,
          addressType: "home",
          isDefault: false,
        };
      } else {
        // Regular saved address
        address = await tx.customerAddress.findUnique({ where: { id: deliveryAddressId } });
        if (!address || address.customerId !== customer.id) throw new Error("Invalid delivery address");
      }

      // Check delivery serviceability
      const { serviceable, zone } = await isPincodeServiceable(address.pincode, address.country, address.city, address.state);
      if (!serviceable) {
        throw new Error(`Delivery is not available for the selected location (${address.pincode}). Please choose a different address.`);
      }

      const cartItemsWithDetails = [];
      for (const cartItem of customer.cartItems) {
        const product = await tx.onlineProduct.findUnique({ where: { id: cartItem.productId } });
        if (!product) throw new Error(`Product not found`);

        const variant = product.variants[cartItem.variantIndex];
        if (!variant) throw new Error(`Variant not found`);
        
        // 🔧 UOM-aware stock validation
        // If variant has UOM (e.g., 500g per unit), convert stock from base UOM to variant UOM
        let availableUnits = variant.variantStockQuantity;
        
        if (variant.variantUom && variant.variantUomValue && variant.variantUomValue > 0) {
          // Stock is in base UOM (e.g., 0.8 kg), need to convert to variant UOM (e.g., g)
          let stockInVariantUom = variant.variantStockQuantity;
          
          // Convert base UOM to variant UOM if needed
          if (variant.variantUom === 'g' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // kg → g
          } else if (variant.variantUom === 'ml' && variant.variantStockQuantity < 10) {
            stockInVariantUom = variant.variantStockQuantity * 1000; // L → ml
          }
          
          // Calculate how many units can be made from available stock
          availableUnits = Math.floor(stockInVariantUom / variant.variantUomValue);
        }
        
        if (availableUnits < cartItem.quantity) {
          throw new Error(`Insufficient stock. Available: ${availableUnits} units`);
        }

        cartItemsWithDetails.push({ ...cartItem, product, variant, gstPercentage: product.gstPercentage });
      }

      let couponDiscount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (coupon) {
          const now = new Date();
          if (coupon.isActive && now >= coupon.validFrom && now <= coupon.validUntil) {
            const subtotal = cartItemsWithDetails.reduce((sum, item) => sum + item.variantSellingPrice * item.quantity, 0);

            if (coupon.discountType === "percentage") {
              couponDiscount = (subtotal * coupon.discountValue) / 100;
              if (coupon.maxDiscountAmount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
            } else {
              couponDiscount = coupon.discountValue;
            }
            appliedCoupon = coupon;
          }
        }
      }

      // ✅ Calculate shipping charge using active DeliveryCharge rules from DB
      const subtotal = cartItemsWithDetails.reduce((sum, item) => sum + item.variantSellingPrice * item.quantity, 0);
      const finalShippingCharge = await resolveShippingCharge(subtotal, cartItemsWithDetails, tx);

      const orderDataForGST = {
        items: cartItemsWithDetails.map((item) => ({
          productId: item.productId,
          inventoryProductId: item.inventoryProductId,
          productName: item.shortDescription,
          variantName: item.variant.variantName || item.variantName,
          displayName: item.variant.displayName || item.variant.variantName || item.variantName,
          brand: item.brand,
          productImage: item.variantImage || item.product.thumbnail,
          selectedCuttingStyle: item.selectedCuttingStyle,
          unitPrice: item.variantSellingPrice,
          mrp: item.variantMRP,
          quantity: item.quantity,
          gstPercentage: item.gstPercentage || 0,
          barcodes: item.variant.variantBarcode ? [item.variant.variantBarcode] : [],
          // 🆕 UOM fields for stock deduction
          variantUom: item.variant.variantUom || null,
          variantUomValue: item.variant.variantUomValue || null,
          variantIndex: item.variantIndex,
          // 🆕 Combo metadata for stock deduction
          isComboProduct: item.product.type === "combo",
          comboItems: item.product.type === "combo" ? item.product.comboItems : undefined,
        })),
        deliveryAddress: {
          name: address.name,
          phone: address.phone,
          alternatePhone: address.alternatePhone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country,
          addressType: address.addressType,
        },
        discount: 0,
        couponDiscount: couponDiscount,
        shippingCharge: finalShippingCharge,
      };

      const totals = await calculateGSTTotals(orderDataForGST);
      const invoiceResult = await generateInvoiceNumber(tx);
      if (!invoiceResult) throw new Error("Invoice settings not configured");
      const { invoiceNumber } = invoiceResult;

      // Get financial period for the order
      const { financialYear, accountingPeriod } = await getFinancialPeriod(new Date());

      const savedOrder = await tx.onlineOrder.create({
        data: {
          orderNumber,
          invoiceNumber,
          orderType: orderType || "online",
          scheduledDate,
          scheduledSlot,
          isScheduled: !!isScheduled,
          customerId: customer.id,
          userId: customer.userId,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phoneNumber || address.phone,
          deliveryAddress: {
            name: address.name,
            phone: address.phone,
            alternatePhone: address.alternatePhone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country,
            addressType: address.addressType,
          },
          items: totals.items,
          subtotal: totals.subtotal,
          tax: totals.tax,
          taxRate: totals.taxRate,
          gstType: totals.gstType,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          totalGstAmount: totals.totalGstAmount,
          adminState: totals.adminState,
          customerState: totals.customerState,
          discount: totals.discount,
          couponCode: couponCode || null,
          couponDiscount: couponDiscount,
          shippingCharge: totals.shippingCharge,
          total: totals.total,
          paymentMethod,
          paymentStatus: "completed",
          paymentId,
          orderStatus: "pending",
          saleDate: new Date(),
          accountingPeriod,
          financialYear,
        },
      });

      for (const item of cartItemsWithDetails) {
        const updatedVariants = [...item.product.variants];
        updatedVariants[item.variantIndex].variantStockQuantity -= item.quantity;

        await tx.onlineProduct.update({
          where: { id: item.product.id },
          data: {
            variants: updatedVariants,
          },
        });
      }

      if (appliedCoupon) {
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: { currentUsageCount: { increment: 1 } },
        });

        await tx.couponUsage.create({
          data: {
            couponId: appliedCoupon.id,
            couponCode: appliedCoupon.code,
            userId,
            orderId: orderNumber,
            discountAmount: couponDiscount,
            orderValue: totals.subtotal,
          },
        });
      }

      await tx.cart.deleteMany({ where: { customerId: customer.id } });

      return { orderNumber: savedOrder.orderNumber, invoiceNumber: savedOrder.invoiceNumber, total: savedOrder.total, savedOrder };
    });

    // Create transaction record (outside transaction to avoid blocking)
    try {
      await createOnlineTransaction(result.savedOrder);
    } catch (transactionError) {
      console.error(`⚠️ Failed to create transaction:`, transactionError.message);
      // Order is still created, transaction creation failure is logged
    }

    // Update inventory stock after successful order creation
    try {
      const stockUpdateResults = await updateStockAfterOrder(result.savedOrder, "ONLINE_ORDER");
      const successCount = stockUpdateResults.filter((r) => r.success).length;
      console.log(`📦 Stock updated for ${successCount}/${stockUpdateResults.length} items`);
    } catch (stockError) {
      console.error(`⚠️ Failed to update stock:`, stockError.message);
      // Order is still created, stock update failure is logged
    }

    // Update customer analytics
    try {
      await updateCustomerAnalytics(result.savedOrder.customerId, result.savedOrder.total, result.savedOrder.createdAt);
      console.log(`📊 Customer analytics updated for ${result.savedOrder.customerName}`);
    } catch (analyticsError) {
      console.error(`⚠️ Failed to update customer analytics:`, analyticsError.message);
      // Order is still created, analytics update failure is logged
    }

    // Send order placed notification to user
    try {
      await sendOrderPlacedNotification(result.savedOrder.userId, result.savedOrder.orderNumber, result.savedOrder.total);
      console.log(`📱 Order placed notification sent to user`);
    } catch (notifError) {
      console.error(`⚠️ Failed to send order notification:`, notifError.message);
    }

    // Send new order notification to all admins
    try {
      const { sendToAllAdmins } = require('../../utils/notification/sendNotification');
      
      const adminNotification = {
        title: '🛒 New Order Received!',
        body: `New order from ${result.savedOrder.customerName}\n\n📦 Order #${result.savedOrder.orderNumber}\n💰 Amount: ₹${result.savedOrder.total.toFixed(2)}\n💳 Payment: ${paymentMethod.toUpperCase()}`,
      };

      const adminData = {
        type: 'NEW_ORDER',
        orderNumber: result.savedOrder.orderNumber,
        orderNumberRaw: result.savedOrder.orderNumber.replace(/[^a-zA-Z0-9]/g, '-'), // ✅ Add stable identifier for tag
        orderId: result.savedOrder.id,
        customerName: result.savedOrder.customerName,
        total: result.savedOrder.total.toString(),
        paymentMethod: paymentMethod,
        link: `/dashboard/order-management/online-orders/${result.savedOrder.id}`,
        urgency: 'high',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        color: '#4CAF50',
        backgroundColor: '#E8F5E9',
      };

      await sendToAllAdmins(adminNotification, adminData);
      await sendToEmployeesByPermission('online_orders', adminNotification, adminData);
      console.log(`📱 New order notification sent to all admins + employees`);
    } catch (adminNotifError) {
      console.error(`⚠️ Failed to send admin notification:`, adminNotifError.message);
    }

    console.log(`✅ Online order confirmed: ${result.orderNumber}`);

    // Real-time push to admin dashboard
    sendToAdmin("new_order", { orderNumber: result.orderNumber, type: "online", paymentMethod });

    res.status(201).json({
      success: true,
      data: {
        orderNumber: result.orderNumber,
        invoiceNumber: result.invoiceNumber,
        total: result.total,
        paymentMethod,
        paymentStatus: "completed",
        orderStatus: "pending",
      },
      message: "Order placed successfully",
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to confirm order" });
  }
};

module.exports = {
  createOrder,
  confirmOrder,
};

