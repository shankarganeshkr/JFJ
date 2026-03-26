// Checkout Page JavaScript
console.log('🚀 Checkout.js loading...');

class CheckoutPage {
    constructor() {
        this.cart = [];
        this.orderNumber = 427001;
        console.log('🛒 CheckoutPage constructor called');
        this.init();
    }

    init() {
        console.log('🔧 init() method called');
        console.log('📄 DOM ready:', document.readyState);
        
        this.loadCart();
        this.loadOrderNumber();
        this.renderCartItems();
        this.updateTotals();
        this.setupEventListeners();
        
        console.log('✅ init() completed');
        console.log('🛒 Cart items:', this.cart.length);
        console.log('💰 Cart total:', this.cart.reduce((total, item) => total + (item.price * item.quantity), 0));
        
        // IMMEDIATELY force text display and hide QR elements
        console.log('🚨 FORCING immediate text display');
        this.forceTextDisplay();
        
        // Add a small delay to ensure QR code library is loaded
        setTimeout(() => {
            console.log('🔄 Regenerating QR after delay...');
            this.updateTotals();
        }, 500);
    }
    
    forceTextDisplay() {
        const amount = this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const upiId = 'sumathi2514@sbi';
        const upiUrl = `https://upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
        
        console.log('🎨 forceTextDisplay called with amount:', amount);
        
        // Hide all QR-related elements immediately
        const qrCanvas = document.getElementById('qrCanvas');
        const qrFallback = document.getElementById('qrFallback');
        const qrContainer = document.getElementById('qrCodeContainer');
        
        if (qrCanvas) qrCanvas.style.display = 'none';
        if (qrFallback) qrFallback.style.display = 'none';
        
        // Create a simple QR code using online service
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
        
        // Force display with both QR image and text
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="background: white; border: 2px solid #d4af37; border-radius: 10px; padding: 10px; text-align: center; width: 220px; height: 220px;">
                    <div style="margin-bottom: 10px;">
                        <img src="${qrCodeUrl}" alt="UPI QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 5px;" onerror="this.style.display='none'; document.getElementById('fallbackText').style.display='block';">
                    </div>
                    <div id="fallbackText" style="display: none;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                            <strong>📱 UPI Payment</strong>
                        </div>
                        <div style="font-size: 16px; color: #000; font-weight: bold; margin-bottom: 5px;">
                            ₹${amount}
                        </div>
                        <div style="font-size: 10px; color: #666; margin-bottom: 5px;">
                            Scan with any UPI app
                        </div>
                        <div style="font-size: 9px; color: #999; word-break: break-all;">
                            ${upiId}
                        </div>
                    </div>
                    <div style="margin-top: 10px; text-align: center;">
                        <a href="${upiUrl}" target="_blank" style="display: inline-block; background: #d4af37; color: #000; padding: 8px 15px; text-decoration: none; border-radius: 5px; font-size: 12px; font-weight: bold; margin: 0 auto;">
                            <i class="fas fa-link"></i> Click to Pay
                        </a>
                    </div>
                </div>
            `;
            
            console.log('✅ QR + Text + Link display FORCED successfully');
            console.log('💰 Amount showing:', amount);
            console.log('🔗 QR Code URL:', qrCodeUrl);
            console.log('🔗 Payment Link:', upiUrl);
        }
        
        // Update payment amount display
        const paymentAmountElement = document.getElementById('paymentAmount');
        if (paymentAmountElement) {
            paymentAmountElement.textContent = amount;
            console.log('💰 Payment amount element updated to:', amount);
        }
        
        // Update QR amount display
        const qrAmountElement = document.getElementById('qrAmount');
        if (qrAmountElement) {
            qrAmountElement.textContent = amount;
            console.log('💰 QR amount element updated to:', amount);
        }
    }

    loadCart() {
        const storedCart = localStorage.getItem('jewelryCart');
        if (storedCart) {
            this.cart = JSON.parse(storedCart);
        }
    }

    loadOrderNumber() {
        const storedOrderNumber = localStorage.getItem('lastOrderNumber');
        if (storedOrderNumber) {
            this.orderNumber = parseInt(storedOrderNumber) + 1;
        }
    }

    saveOrderNumber() {
        localStorage.setItem('lastOrderNumber', this.orderNumber.toString());
    }

    renderCartItems() {
        const cartItems = document.getElementById('checkoutCartItems');
        if (!cartItems) return;

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p style="text-align: center; color: #999;">Your cart is empty</p>';
            document.getElementById('placeOrderBtn').disabled = true;
            return;
        }

        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">₹${item.price} × ${item.quantity}</span>
                </div>
                <div class="cart-item-total">
                    <strong>₹${item.price * item.quantity}</strong>
                </div>
            </div>
        `).join('');
    }

    renderOrderSummary() {
        const orderItems = document.getElementById('orderItems');
        const subtotal = document.getElementById('subtotal');
        const gst = document.getElementById('gst');
        const total = document.getElementById('total');

        if (!orderItems || !subtotal || !gst || !total) return;

        const cartTotal = this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const gstAmount = Math.round(cartTotal * 0.03 / 1.03); // Extract GST from price (price includes 3% GST)
        const baseAmount = cartTotal - gstAmount;

        orderItems.innerHTML = this.cart.map(item => {
            const itemTotal = item.price * item.quantity;
            const itemGST = Math.round(itemTotal * 0.03 / 1.03);
            const itemBase = itemTotal - itemGST;
            
            return `
                <div class="order-item">
                    <div class="order-item-info">
                        <span class="order-item-name">${item.name}</span>
                        <span class="order-item-price">₹${item.price} × ${item.quantity}</span>
                    </div>
                    <div class="order-item-gst-breakdown">
                        <small>Base: ₹${itemBase} + GST: ₹${itemGST}</small>
                    </div>
                    <span class="order-item-total">₹${itemTotal}</span>
                </div>
            `;
        }).join('');

        subtotal.textContent = `₹${baseAmount}`;
        gst.textContent = `₹${gstAmount}`;
        total.textContent = `₹${cartTotal}`;
    }

    updateTotals() {
        const cartTotal = this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const gstAmount = Math.round(cartTotal * 0.03 / 1.03); // Extract GST from price (price includes 3% GST)
        const baseAmount = cartTotal - gstAmount;
        
        const subtotalElement = document.getElementById('subtotal');
        const gstElement = document.getElementById('gst');
        const totalElement = document.getElementById('total');
        const paymentAmountElement = document.getElementById('paymentAmount');
        const qrAmountElement = document.getElementById('qrAmount');

        if (subtotalElement) subtotalElement.textContent = baseAmount;
        if (gstElement) gstElement.textContent = gstAmount;
        if (totalElement) totalElement.textContent = cartTotal;
        if (paymentAmountElement) paymentAmountElement.textContent = cartTotal;
        if (qrAmountElement) qrAmountElement.textContent = cartTotal;
        
        // Generate QR code with payment details
        this.generateQRCode(cartTotal);
    }

    generateQRCode(amount) {
        const upiId = 'sumathi2514@sbi';
        const payeeName = 'Janu Fashion Jewelry';
        const transactionNote = `Order #${this.orderNumber}`;
        
        // CRITICAL: Always use format with AMOUNT parameter
        const upiUrl = `upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
        
        console.log('=== QR CODE GENERATION ===');
        console.log('Amount to encode:', amount);
        console.log('UPI URL with amount:', upiUrl);
        console.log('URL contains amount:', upiUrl.includes(`am=${amount}`));
        console.log('QRCode library type:', typeof QRCODE);
        console.log('QRCode library type:', typeof QRCode);
        console.log('========================');
        
        // IMMEDIATELY show text fallback since libraries aren't loading
        console.log('📝 Using IMMEDIATE text-based fallback (libraries not available)');
        this.showTextBasedQR(upiUrl, amount);
        
        const qrCanvas = document.getElementById('qrCanvas');
        const qrFallback = document.getElementById('qrFallback');
        
        // Still try QR generation in background
        if (qrCanvas && qrFallback) {
            qrCanvas.style.display = 'none';
            qrFallback.style.display = 'none';
            
            // Try libraries one more time after a delay
            setTimeout(() => {
                try {
                    if (typeof QRCODE !== 'undefined') {
                        console.log('🔄 Retrying qrcode-generator library...');
                        const ctx = qrCanvas.getContext('2d');
                        ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
                        
                        new QRCODE(qrCanvas, {
                            text: upiUrl,
                            width: 200,
                            height: 200
                        });
                        
                        qrCanvas.style.display = 'block';
                        console.log('✅ QR generated with qrcode-generator library (retry)');
                    } else if (typeof QRCode !== 'undefined') {
                        console.log('🔄 Retrying qrcodejs library...');
                        const ctx = qrCanvas.getContext('2d');
                        ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
                        
                        new QRCode(qrCanvas, {
                            text: upiUrl,
                            width: 200,
                            height: 200,
                            colorDark: '#000000',
                            colorLight: '#ffffff'
                        });
                        
                        qrCanvas.style.display = 'block';
                        console.log('✅ QR generated with qrcodejs library (retry)');
                    }
                } catch (error) {
                    console.error('❌ QR generation failed (retry):', error);
                }
            }, 2000);
        }
        
        console.log('Final QR URL:', upiUrl);
        this.displayUPIOptions(upiUrl, amount);
    }
    
    showTextBasedQR(upiUrl, amount) {
        console.log('🎨 showTextBasedQR called with:', { upiUrl, amount });
        
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            console.log('🎯 QR Container found:', !!qrContainer);
            console.log('🎨 Current container HTML:', qrContainer.innerHTML);
            
            const newHTML = `
                <div style="background: white; border: 2px solid #d4af37; border-radius: 10px; padding: 20px; text-align: center; width: 200px; height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        <strong>📱 UPI Payment</strong>
                    </div>
                    <div style="font-size: 14px; color: #000; font-weight: bold; margin-bottom: 10px;">
                        ₹${amount}
                    </div>
                    <div style="font-size: 10px; color: #666; margin-bottom: 10px;">
                        Scan with any UPI app
                    </div>
                    <div style="font-size: 9px; color: #999; word-break: break-all;">
                        ${upiId}
                    </div>
                </div>
            `;
            
            console.log('🎨 Setting new HTML:', newHTML);
            qrContainer.innerHTML = newHTML;
            
            console.log('✅ Text-based QR display completed');
        } else {
            console.log('❌ QR Container NOT FOUND!');
        }
    }
    
    displayUPIOptions(currentUrl, amount) {
        // Create multiple clickable links for testing
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            // Remove existing test links if any
            const existingLinks = document.getElementById('upiTestLinks');
            if (existingLinks) {
                existingLinks.remove();
            }
            
            // Add test links container
            const testLinks = document.createElement('div');
            testLinks.id = 'upiTestLinks';
            testLinks.innerHTML = `
                <div style="margin-top: 15px; padding: 10px; background: rgba(212, 175, 55, 0.1); border-radius: 5px;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold;">
                        🧪 QR Code Testing (Current QR uses Format with AMOUNT):
                    </p>
                    <p style="margin: 5px 0; font-size: 11px; color: #888;">
                        ✅ <strong>Current QR:</strong> <a href="${currentUrl}" style="color: #d4af37; text-decoration: underline;" target="_blank">Test Current QR</a> (has amount)
                    </p>
                    <p style="margin: 5px 0; font-size: 11px; color: #888;">
                        📱 <strong>Manual Entry:</strong> UPI ID: <code>sumathi2514@sbi</code>, Amount: <strong>₹${amount}</strong>
                    </p>
                </div>
            `;
            paymentSection.appendChild(testLinks);
        }
    }
    
    showFallbackQR() {
        const qrCanvas = document.getElementById('qrCanvas');
        const qrFallback = document.getElementById('qrFallback');
        
        if (qrCanvas) qrCanvas.style.display = 'none';
        if (qrFallback) qrFallback.style.display = 'block';
    }

    setupEventListeners() {
        const form = document.getElementById('checkoutForm');
        const whatsappCheckbox = document.getElementById('whatsappCheckbox');
        const placeOrderBtn = document.querySelector('.cta-button[onclick="placeOrder()"]');

        if (form) {
            form.addEventListener('input', () => this.validateForm());
        }
        
        if (whatsappCheckbox) {
            whatsappCheckbox.addEventListener('change', () => this.validateForm());
        }

        // Initial validation
        this.validateForm();
    }

    validateForm() {
        const customerName = document.getElementById('customerName').value.trim();
        const customerMobile = document.getElementById('customerMobile').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();
        const customerAddress = document.getElementById('customerAddress').value.trim();
        const customerPincode = document.getElementById('customerPincode').value.trim();
        const whatsappCheckbox = document.getElementById('whatsappCheckbox');
        const placeOrderBtn = document.querySelector('.cta-button[onclick="placeOrder()"]');

        const isValid = 
            customerName && 
            customerMobile && 
            customerEmail && 
            customerAddress && 
            customerPincode && 
            whatsappCheckbox.checked &&
            /^[0-9]{10}$/.test(customerMobile) &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) &&
            /^[0-9]{6}$/.test(customerPincode);

        if (placeOrderBtn) {
            placeOrderBtn.disabled = !isValid;
            placeOrderBtn.style.opacity = isValid ? '1' : '0.5';
            placeOrderBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }
    }

    placeOrder() {
        if (this.cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const customerName = document.getElementById('customerName').value.trim();
        const customerMobile = document.getElementById('customerMobile').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();
        const customerAddress = document.getElementById('customerAddress').value.trim();
        const customerPincode = document.getElementById('customerPincode').value.trim();
        const whatsappCheckbox = document.getElementById('whatsappCheckbox').checked;

        // Validate mobile number
        if (!/^[0-9]{10}$/.test(customerMobile)) {
            alert('Please enter a valid 10-digit mobile number');
            return;
        }

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            alert('Please enter a valid email address');
            return;
        }

        // Validate pincode
        if (!/^[0-9]{6}$/.test(customerPincode)) {
            alert('Please enter a valid 6-digit pincode');
            return;
        }

        const cartTotal = this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const gstAmount = Math.round(cartTotal * 0.03 / 1.03); // Extract GST from price (price includes 3% GST)
        const baseAmount = cartTotal - gstAmount;

        const order = {
            orderNumber: this.orderNumber,
            invoiceNumber: this.generateInvoiceNumber(),
            customer: {
                name: customerName,
                mobile: customerMobile,
                email: customerEmail,
                address: customerAddress,
                pincode: customerPincode
            },
            items: this.cart,
            subtotal: baseAmount,
            gst: gstAmount,
            total: cartTotal,
            status: 'pending',
            date: new Date().toISOString(),
            paymentMethod: 'UPI',
            upiId: 'sumathi2514@sbi',
            paymentStatus: 'pending'
        };

        // Save order
        this.saveOrder(order);
        
        // Update stock
        this.updateStock(order);
        
        // Clear cart
        this.clearCart();
        
        // Update order number for next order
        this.saveOrderNumber();
        
        // Show success modal with order details
        this.showSuccessModal(order);
    }

    generateInvoiceNumber() {
        return 'INV' + Math.floor(100000 + Math.random() * 900000);
    }

    saveOrder(order) {
        let orders = JSON.parse(localStorage.getItem('jewelryOrders') || '[]');
        orders.push(order);
        localStorage.setItem('jewelryOrders', JSON.stringify(orders));
    }

    updateStock(order) {
        let products = JSON.parse(localStorage.getItem('jewelryProducts') || '[]');
        
        order.items.forEach(orderItem => {
            const product = products.find(p => p.id === orderItem.productId);
            if (product) {
                product.stock -= orderItem.quantity;
            }
        });

        localStorage.setItem('jewelryProducts', JSON.stringify(products));
    }

    clearCart() {
        localStorage.removeItem('jewelryCart');
        this.cart = [];
    }

    showSuccessModal(order) {
        const modal = document.getElementById('successModal');
        const orderNumber = document.getElementById('orderNumber');
        const invoiceNumber = document.getElementById('invoiceNumber');
        const printInvoiceBtn = document.getElementById('printInvoiceBtn');
        const continueShoppingBtn = document.getElementById('continueShoppingBtn');

        if (modal && orderNumber && invoiceNumber) {
            orderNumber.textContent = order.orderNumber;
            invoiceNumber.textContent = order.invoiceNumber;
            
            // Show print invoice button
            if (printInvoiceBtn) {
                printInvoiceBtn.style.display = 'inline-block';
                printInvoiceBtn.onclick = () => this.printInvoice(order);
            }
            
            // Show continue shopping button
            if (continueShoppingBtn) {
                continueShoppingBtn.style.display = 'inline-block';
                continueShoppingBtn.onclick = () => {
                    modal.style.display = 'none';
                    window.location.href = 'index.html';
                };
            }
            
            modal.style.display = 'block';
        }
    }

    generateQRCode(orderNumber) {
        // Create a proper QR Code with JFJ format
        const qrData = `JFJ-${orderNumber}`;
        const size = 21; // Standard QR Code size (21x21 for version 1)
        let qrCode = '';
        
        // Initialize empty QR Code
        const qrMatrix = Array(size).fill().map(() => Array(size).fill(false));
        
        // Add position markers (corners) - required for QR Code recognition
        const addPositionMarker = (startX, startY) => {
            const marker = [
                [1,1,1,1,1,1,1],
                [1,0,0,0,0,0,1],
                [1,0,1,1,1,0,1],
                [1,0,1,1,1,0,1],
                [1,0,1,1,1,0,1],
                [1,0,0,0,0,0,1],
                [1,1,1,1,1,1,1]
            ];
            
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < 7; j++) {
                    if (startX + i < size && startY + j < size) {
                        qrMatrix[startX + i][startY + j] = marker[i][j] === 1;
                    }
                }
            }
        };
        
        // Add three position markers (corners)
        addPositionMarker(0, 0); // Top-left
        addPositionMarker(0, size - 7); // Top-right
        addPositionMarker(size - 7, 0); // Bottom-left
        
        // Add timing patterns
        for (let i = 8; i < size - 8; i++) {
            qrMatrix[6][i] = i % 2 === 0; // Horizontal timing
            qrMatrix[i][6] = i % 2 === 0; // Vertical timing
        }
        
        // Add data based on order number (simplified encoding)
        const orderStr = orderNumber.toString();
        let dataIndex = 0;
        
        // Fill remaining space with data pattern
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                // Skip position markers and timing patterns
                if ((i < 9 && j < 9) || (i < 9 && j >= size - 8) || (i >= size - 8 && j < 9)) {
                    continue;
                }
                
                if (i === 6 || j === 6) continue; // Skip timing patterns
                
                // Create pattern based on order number
                const charCode = orderStr.charCodeAt(dataIndex % orderStr.length);
                qrMatrix[i][j] = ((i + j + charCode) % 3) !== 0;
                dataIndex++;
            }
        }
        
        // Convert to string representation
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                qrCode += qrMatrix[i][j] ? '█' : '░';
            }
            qrCode += '\n';
        }
        
        return qrCode;
    }

    printInvoice(order) {
        const printWindow = window.open('', '_blank');
        const orderDate = new Date(order.date).toLocaleDateString('en-IN');
        const itemsHtml = order.items.map(item => {
            const itemTotal = item.price * item.quantity;
            const itemGST = Math.round(itemTotal * 0.03 / 1.03);
            const itemBase = itemTotal - itemGST;
            
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>₹${itemBase}</td>
                    <td>₹${itemGST}</td>
                    <td>₹${itemTotal}</td>
                    <td>${item.quantity}</td>
                    <td>₹${itemTotal}</td>
                </tr>
            `;
        }).join('');

        const invoiceHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${order.invoiceNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .invoice-details { margin-bottom: 20px; }
                    .invoice-number-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                    .invoice-number { flex: 1; }
                    .qr-container { text-align: center; margin-left: 20px; }
                    .qr-code { 
                        font-family: monospace; 
                        font-size: 2px; 
                        line-height: 2px; 
                        letter-spacing: 0; 
                        white-space: pre; 
                        margin: 5px 0;
                        display: inline-block;
                        border: 1px solid #ccc;
                        padding: 2px;
                        background: white;
                    }
                    .qr-label { font-size: 8px; margin-top: 2px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f4f4f4; }
                    .totals { text-align: right; margin-top: 20px; }
                    .footer { margin-top: 30px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Janu Fashion Jewelry</h1>
                    <h2>TAX INVOICE</h2>
                </div>
                
                <div class="invoice-details">
                    <div class="invoice-number-row">
                        <div class="invoice-number">
                            <p><strong>Invoice Number:</strong> ${order.invoiceNumber}</p>
                            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                            <p><strong>Date:</strong> ${orderDate}</p>
                            <p><strong>GSTIN:</strong> 29HRKPS6192F1ZY</p>
                        </div>
                        <div class="qr-container">
                            <div class="qr-code">${this.generateQRCode(order.orderNumber)}</div>
                            <div class="qr-label">JFJ-${order.orderNumber}</div>
                        </div>
                    </div>
                </div>
                
                <div class="customer-info">
                    <h3>Billed To:</h3>
                    <p><strong>Name:</strong> ${order.customer.name}</p>
                    <p><strong>Mobile:</strong> ${order.customer.mobile}</p>
                    <p><strong>Email:</strong> ${order.customer.email}</p>
                    <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.pincode}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Base Amount</th>
                            <th>GST (3%)</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <p><strong>Subtotal:</strong> ₹${order.subtotal}</p>
                    <p><strong>GST (3%):</strong> ₹${order.gst}</p>
                    <p><strong>Total Amount:</strong> ₹${order.total}</p>
                </div>
                
                <div class="footer">
                    <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                    <p><strong>UPI ID:</strong> ${order.upiId}</p>
                    <p>Thank you for your business!</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        printWindow.print();
    }
}

// Global functions
let checkoutPage;
window.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOMContentLoaded event fired!');
    console.log('📄 Window object:', typeof window);
    console.log('🔧 QRCODE available:', typeof QRCODE);
    console.log('🔧 QRCode available:', typeof QRCode);
    
    checkoutPage = new CheckoutPage();
    
    // Make global functions available
    window.placeOrder = () => checkoutPage.placeOrder();
    window.goToHome = () => checkoutPage.goToHome();
    
    console.log('✅ Checkout page initialization complete');
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('successModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});
