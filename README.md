# Janu Fashion Jewelry - Luxury E-commerce Website

A complete luxury e-commerce website for Janu Fashion Jewelry with admin panel, order management, and payment integration.

## 🎯 Features

### Customer Experience
- **Luxury Design**: Elegant dark theme with gold/purple accents
- **Product Catalog**: Browse jewelry by categories (Necklaces, Bangles, Rings, Earrings, Anklets, Nose Rings)
- **Image Galleries**: Multiple product images with carousel view
- **Shopping Cart**: Real-time cart management with stock validation
- **Secure Checkout**: Mandatory customer fields and payment integration
- **Order Tracking**: Thank you page with order numbers

### Admin Panel
- **Secure Login**: Password-protected admin access (Password: `Janu@0724`)
- **Product Management**: Full CRUD operations for products
- **Image Management**: Upload/replace product images with visual preview
- **Order Management**: Status tracking and invoice printing
- **Sales Dashboard**: Comprehensive reports with charts
- **Stock Management**: Real-time inventory tracking with low-stock warnings

### Payment & Billing
- **UPI Integration**: QR code payment with UPI ID `sumathi2514@sbi`
- **GST Included**: 3% GST included in pricing (no extra calculation)
- **Invoice Generation**: Professional GST invoices with company details
- **Order Numbers**: Sequential order numbers (427001, 427002...)
- **Invoice Numbers**: 6-digit unique invoice numbers

## 🛠 Technical Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage for data persistence
- **Charts**: Chart.js for sales analytics
- **Responsive**: Mobile-first design
- **Images**: Base64 encoding for uploaded images
- **Icons**: Font Awesome 6.4.0

## 📁 Project Structure

```
janu-fashion-jewelry/
├── index.html              # Main store page
├── admin.html              # Admin panel
├── checkout.html           # Checkout process
├── css/
│   ├── style.css          # Main website styles
│   └── admin.css          # Admin panel styles
├── js/
│   ├── app.js             # Main application logic
│   ├── admin.js           # Admin panel functionality
│   └── checkout.js        # Checkout process
├── images/
│   ├── logo.png           # Store logo
│   ├── qr-code.png        # Payment QR code
│   └── *.jpg              # Product images
└── README.md              # This file
```

## 🚀 Quick Start

### Local Development
1. Clone or download the project files
2. Open `index.html` in your web browser
3. Access admin panel at `admin.html`

### Admin Login
- **URL**: `admin.html`
- **Password**: `Janu@0724`

## 📱 Usage Guide

### For Customers
1. Browse products by category or use the search
2. Click on any product to view details and multiple images
3. Add items to cart (stock validation prevents overselling)
4. Proceed to checkout with mandatory customer information
5. Complete payment via UPI QR code
6. Receive order confirmation with tracking number

### For Admins
1. Login to admin panel with password
2. **Dashboard**: View sales overview and statistics
3. **Products**: Add/edit/delete products with image management
4. **Orders**: Track order status and print invoices
5. **Reports**: Generate sales reports with date ranges

## 🎨 Customization

### Branding
- Update logo: Replace `images/logo.png`
- Change colors: Modify CSS variables in `css/style.css`
- Update contact info: Edit footer in HTML files

### Products
- Sample products are pre-loaded with placeholder images
- Use admin panel to add your own products
- Upload custom images via product management
- Categories: Necklaces, Bangles, Rings, Earrings, Anklets, Nose Rings

### Payment
- Update UPI ID in `checkout.html` and `js/checkout.js`
- Replace QR code image in `images/qr-code.png`
- Payment integration ready for Razorpay or other gateways

## 📊 Admin Features

### Product Management
- **Add Products**: Create new jewelry items with multiple images
- **Edit Products**: Update details, pricing, and images
- **Image Upload**: Drag & drop or click to upload images
- **Image Replacement**: Click camera icon to replace individual images
- **Stock Management**: Real-time inventory tracking

### Order Management
- **Status Tracking**: 
  - Payment Confirmed → Order In Progress → Order Delivered → Completed
- **Order Actions**: Cancel, confirm, process, and deliver orders
- **Invoice Printing**: Print professional GST invoices
- **Customer Details**: View complete order information

### Sales Reports
- **Time Periods**: Weekly, Monthly, Yearly, 3-Year reports
- **Date Range**: Custom date range selection
- **Download Reports**: Export data as JSON
- **Visual Charts**: Interactive sales trend charts

## 🔧 Configuration

### Company Information
Update these details in the HTML files:
- **Company Name**: "Janu Fashion Jewelry"
- **Phone**: +91-7090590315
- **Email**: janufashionjewelry@zohomail.in
- **GSTIN**: 29HRKPS6192F1ZY

### Payment Settings
- **UPI ID**: sumathi2514@sbi
- **Payment Method**: UPI QR Code
- **GST Rate**: 3% (included in prices)

## 🌐 Deployment

### Static Hosting (Recommended)
1. **Netlify**:
   - Drag and drop the project folder
   - Auto-deploys with custom domain support
   
2. **Vercel**:
   - Import project from GitHub
   - Zero-config deployment
   
3. **GitHub Pages**:
   - Push to GitHub repository
   - Enable Pages in repository settings

### Server Requirements
- Static file hosting (no server-side processing required)
- HTTPS recommended for payment security
- CDN support for faster image loading

## 📱 Mobile Responsiveness

- **Mobile-First Design**: Optimized for all screen sizes
- **Touch-Friendly**: Large buttons and touch targets
- **Responsive Images**: Optimized for different devices
- **Fast Loading**: Minimal JavaScript and optimized CSS

## 🔒 Security Features

- **Admin Protection**: Password-protected admin panel
- **Data Validation**: Form validation on all inputs
- **Secure Storage**: LocalStorage for data persistence
- **Payment Security**: UPI-based secure payments

## 🐛 Troubleshooting

### Common Issues
1. **Images Not Loading**: Check file paths and ensure images exist
2. **Admin Login**: Verify password is `Janu@0724`
3. **Cart Issues**: Clear browser cache and LocalStorage
4. **Payment QR Code**: Ensure QR code image is present

### Data Reset
To reset all data:
```javascript
// Clear all LocalStorage data
localStorage.clear();
// Reload the page
location.reload();
```

## 📞 Support

For support and inquiries:
- **Phone**: +91-7090590315
- **Email**: janufashionjewelry@zohomail.in

## 📄 License

This project is proprietary to Janu Fashion Jewelry. All rights reserved.

## 🔄 Updates

### Version 1.0.0
- Complete e-commerce functionality
- Admin panel with image management
- Order management system
- Sales reporting dashboard
- Mobile responsive design
- Payment integration ready

---

**Janu Fashion Jewelry** - Exquisite Jewelry Collection Since 2024
