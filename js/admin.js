// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.isLoggedIn = false;
        this.products = [];
        this.orders = [];
        this.categories = [];
        this.currentFilter = 'all';
        this.editingProduct = null;
        this.salesChart = null;
        // Store uploaded images in IndexedDB (prevents localStorage quota errors).
        this.imageDbPromise = this.openImageDb();
        this.imageMigrationPromise = null;
        this.pendingImageUploadPromise = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.loadData();
        // If existing products contain Base64 images in localStorage, migrate them once
        // to IndexedDB so further uploads don't immediately hit quota limits.
        this.imageMigrationPromise = this.migrateLocalImagesToIndexedDB();
        this.loadCategories();
        this.setupEventListeners();
        if (this.isLoggedIn) {
            this.showDashboard();
        }
    }

    // ===================== IndexedDB image storage =====================
    openImageDb() {
        const dbName = 'janu-fashion-jewelry-images';
        const storeName = 'productImages';
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    putImageBlob(imageId, blob) {
        return this.imageDbPromise.then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(['productImages'], 'readwrite');
            tx.objectStore('productImages').put({ id: imageId, blob });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    getImageBlob(imageId) {
        return this.imageDbPromise.then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(['productImages'], 'readonly');
            const req = tx.objectStore('productImages').get(imageId);
            req.onsuccess = () => resolve(req.result ? req.result.blob : null);
            req.onerror = () => reject(req.error);
        }));
    }

    deleteImageBlob(imageId) {
        return this.imageDbPromise.then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(['productImages'], 'readwrite');
            tx.objectStore('productImages').delete(imageId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    isIdbImageValue(value) {
        return typeof value === 'string' && value.startsWith('idb:');
    }

    idbImageIdFromValue(value) {
        return value.replace(/^idb:/, '');
    }

    isDataImageUrl(value) {
        return typeof value === 'string' && value.startsWith('data:image/');
    }

    dataUrlToBlob(dataUrl) {
        // Convert a Base64 data URL into a Blob so we can store it in IndexedDB.
        const [metaPart, base64Part] = dataUrl.split(',');
        const mimeMatch = metaPart.match(/data:(.*?);base64/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const binary = atob(base64Part);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    async migrateLocalImagesToIndexedDB() {
        try {
            if (!this.products || this.products.length === 0) return;

            // Detect if we have any Base64 images stored in localStorage.
            let needsMigration = false;
            for (const product of this.products) {
                if (product?.images?.some(img => this.isDataImageUrl(img))) {
                    needsMigration = true;
                    break;
                }
            }
            if (!needsMigration) return;

            console.log('[ImageMigration] Starting migration of Base64 images to IndexedDB...');

            let convertedCount = 0;
            for (const product of this.products) {
                if (!Array.isArray(product.images)) continue;
                for (let i = 0; i < product.images.length; i++) {
                    const img = product.images[i];
                    if (!this.isDataImageUrl(img)) continue;
                    const imageId = `img_${product.id}_${i}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                    const blob = this.dataUrlToBlob(img);
                    await this.putImageBlob(imageId, blob);
                    product.images[i] = `idb:${imageId}`;
                    convertedCount++;
                }
            }

            console.log(`[ImageMigration] Converted ${convertedCount} images. Saving smaller product data...`);
            localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
            console.log('[ImageMigration] Migration complete.');
        } catch (err) {
            console.warn('[ImageMigration] Migration failed:', err);
            // If migration fails, the admin will still work for small uploads; quota errors may persist.
        }
    }

    async setHeaderBackgroundImage(file) {
        // Backwards-compat helper (older uploads saved to `jewelryHeaderBg`).
        // New functionality uses `setHeroBackgroundImages`.
        if (!file) return;
        try {
            const imageId = 'headerBg';
            await this.putImageBlob(imageId, file);
            localStorage.setItem('jewelryHeaderBg', `idb:${imageId}`);
        } catch (err) {
            console.error('Failed to store header background image:', err);
        }
    }

    async setHeroBackgroundImages(files) {
        const fileArr = Array.from(files || []);
        if (fileArr.length === 0) {
            alert('Please select at least 1 image.');
            return;
        }

        const imagesOnly = fileArr.filter(f => f && f.type && f.type.startsWith('image/'));
        if (imagesOnly.length === 0) {
            alert('Please select valid image files.');
            return;
        }

        try {
            // Delete previous hero images to avoid IDB growth.
            const old = localStorage.getItem('jewelryHeroBackgrounds');
            if (old) {
                const oldList = JSON.parse(old);
                if (Array.isArray(oldList)) {
                    await Promise.all(oldList.map(async (value) => {
                        if (this.isIdbImageValue(value)) {
                            const imageId = this.idbImageIdFromValue(value);
                            try { await this.deleteImageBlob(imageId); } catch (e) {}
                        }
                    }));
                }
            }

            const newList = [];
            for (let i = 0; i < imagesOnly.length; i++) {
                const imageId = `heroBg_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`;
                await this.putImageBlob(imageId, imagesOnly[i]);
                newList.push(`idb:${imageId}`);
            }

            localStorage.setItem('jewelryHeroBackgrounds', JSON.stringify(newList));
            // Keep old single-key empty-ish so frontend won't mistakenly use header image.
            alert('Hero background images updated successfully.');
        } catch (err) {
            console.error('Failed to update hero background images:', err);
            alert('Failed to update hero background images.');
        }
    }

    checkAuth() {
        const auth = localStorage.getItem('adminAuth');
        if (auth === 'true') {
            this.isLoggedIn = true;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
        }
    }

    loadData() {
        this.products = JSON.parse(localStorage.getItem('jewelryProducts') || '[]');
        this.orders = JSON.parse(localStorage.getItem('jewelryOrders') || '[]');
        this.newsText = localStorage.getItem('jewelryNews') || 'Welcome to Janu Fashion Jewelry - Your destination for exquisite jewelry!';
        
        // Debug: Log products to console
        console.log('Loaded products:', this.products);
        
        // If no products exist, initialize sample products
        if (this.products.length === 0) {
            console.log('No products found, initializing sample products...');
            this.initializeSampleProducts();
        }
    }

    initializeSampleProducts() {
        this.products = [
            // Necklaces
            {
                id: 1234567,
                name: "Royal Gold Necklace",
                category: "necklaces",
                price: 2999,
                stock: 15,
                description: "Exquisite gold necklace with intricate traditional design, perfect for weddings and special occasions.",
                images: ["https://picsum.photos/seed/necklace1/400/400.jpg", "https://picsum.photos/seed/necklace1-2/400/400.jpg", "https://picsum.photos/seed/necklace1-3/400/400.jpg"]
            },
            {
                id: 7890123,
                name: "Emerald Necklace",
                category: "necklaces",
                price: 3299,
                stock: 5,
                description: "Luxurious emerald necklace with gold chain, a statement piece for special occasions.",
                images: ["https://picsum.photos/seed/necklace2/400/400.jpg", "https://picsum.photos/seed/necklace2-2/400/400.jpg", "https://picsum.photos/seed/necklace2-3/400/400.jpg", "https://picsum.photos/seed/necklace2-4/400/400.jpg"]
            },
            {
                id: 1000001,
                name: "Pearl Choker",
                category: "necklaces",
                price: 1599,
                stock: 12,
                description: "Elegant pearl choker with gold clasp, perfect for formal occasions.",
                images: ["https://picsum.photos/seed/pearlchoker/400/400.jpg", "https://picsum.photos/seed/pearlchoker2/400/400.jpg"]
            },
            
            // Earrings
            {
                id: 2345678,
                name: "Diamond Stud Earrings",
                category: "earrings",
                price: 1899,
                stock: 8,
                description: "Elegant diamond stud earrings crafted with precision, adding sparkle to any outfit.",
                images: ["https://picsum.photos/seed/earrings1/400/400.jpg", "https://picsum.photos/seed/earrings1-2/400/400.jpg", "https://picsum.photos/seed/earrings1-3/400/400.jpg"]
            },
            {
                id: 9012345,
                name: "Gold Hoop Earrings",
                category: "earrings",
                price: 1299,
                stock: 18,
                description: "Classic gold hoop earrings, versatile and elegant for any occasion.",
                images: ["https://picsum.photos/seed/earrings2/400/400.jpg", "https://picsum.photos/seed/earrings2-2/400/400.jpg", "https://picsum.photos/seed/earrings2-3/400/400.jpg"]
            },
            {
                id: 1000002,
                name: "Drop Earrings",
                category: "earrings",
                price: 799,
                stock: 20,
                description: "Delicate drop earrings with gold finish, perfect for daily wear.",
                images: ["https://picsum.photos/seed/drop1/400/400.jpg", "https://picsum.photos/seed/drop2/400/400.jpg"]
            },
            
            // Bangles
            {
                id: 3456789,
                name: "Traditional Gold Bangles",
                category: "bangles",
                price: 2499,
                stock: 12,
                description: "Beautiful gold bangles with traditional patterns, perfect for festive occasions.",
                images: ["https://picsum.photos/seed/bangles1/400/400.jpg", "https://picsum.photos/seed/bangles1-2/400/400.jpg", "https://picsum.photos/seed/bangles1-3/400/400.jpg", "https://picsum.photos/seed/bangles1-4/400/400.jpg"]
            },
            {
                id: 1123456,
                name: "Kundan Bracelet",
                category: "bangles",
                price: 2199,
                stock: 10,
                description: "Traditional Kundan bracelet with colorful stones, perfect for festive wear.",
                images: ["https://picsum.photos/seed/bracelet1/400/400.jpg", "https://picsum.photos/seed/bracelet1-2/400/400.jpg", "https://picsum.photos/seed/bracelet1-3/400/400.jpg"]
            },
            {
                id: 1000004,
                name: "Glass Bangles",
                category: "bangles",
                price: 599,
                stock: 25,
                description: "Colorful glass bangles set with gold trimmings.",
                images: ["https://picsum.photos/seed/glass1/400/400.jpg", "https://picsum.photos/seed/glass2/400/400.jpg"]
            },
            
            // Rings
            {
                id: 4567890,
                name: "Ruby Ring",
                category: "rings",
                price: 1599,
                stock: 6,
                description: "Stunning ruby ring with gold setting, a symbol of elegance and passion.",
                images: ["https://picsum.photos/seed/ring1/400/400.jpg", "https://picsum.photos/seed/ring1-2/400/400.jpg", "https://picsum.photos/seed/ring1-3/400/400.jpg"]
            },
            {
                id: 2234567,
                name: "Sapphire Ring",
                category: "rings",
                price: 2799,
                stock: 4,
                description: "Elegant sapphire ring with diamond accents, a timeless piece of luxury.",
                images: ["https://picsum.photos/seed/ring2/400/400.jpg", "https://picsum.photos/seed/ring2-2/400/400.jpg", "https://picsum.photos/seed/ring2-3/400/400.jpg", "https://picsum.photos/seed/ring2-4/400/400.jpg"]
            },
            {
                id: 1000006,
                name: "Silver Band",
                category: "rings",
                price: 799,
                stock: 18,
                description: "Simple silver band with modern design.",
                images: ["https://picsum.photos/seed/silver1/400/400.jpg", "https://picsum.photos/seed/silver2/400/400.jpg"]
            },
            
            // Anklets
            {
                id: 5678901,
                name: "Pearl Anklet",
                category: "anklets",
                price: 899,
                stock: 20,
                description: "Delicate pearl anklet with gold accents, perfect for traditional and modern looks.",
                images: ["https://picsum.photos/seed/anklet1/400/400.jpg", "https://picsum.photos/seed/anklet1-2/400/400.jpg", "https://picsum.photos/seed/anklet1-3/400/400.jpg"]
            },
            {
                id: 3345678,
                name: "Silver Anklet",
                category: "anklets",
                price: 699,
                stock: 22,
                description: "Elegant silver anklet with delicate bells, perfect for daily wear.",
                images: ["https://picsum.photos/seed/anklet2/400/400.jpg", "https://picsum.photos/seed/anklet2-2/400/400.jpg", "https://picsum.photos/seed/anklet2-3/400/400.jpg"]
            },
            {
                id: 1000008,
                name: "Gold Payal",
                category: "anklets",
                price: 1299,
                stock: 12,
                description: "Traditional gold payal with small bells.",
                images: ["https://picsum.photos/seed/payal1/400/400.jpg", "https://picsum.photos/seed/payal2/400/400.jpg"]
            },
            
            // Nose Rings
            {
                id: 6789012,
                name: "Nose Ring Set",
                category: "nose-rings",
                price: 599,
                stock: 25,
                description: "Traditional nose ring set with various sizes, crafted with pure gold.",
                images: ["https://picsum.photos/seed/nose1/400/400.jpg", "https://picsum.photos/seed/nose1-2/400/400.jpg", "https://picsum.photos/seed/nose1-3/400/400.jpg"]
            },
            {
                id: 1000010,
                name: "Nath",
                category: "nose-rings",
                price: 899,
                stock: 15,
                description: "Traditional Maharashtrian nath with pearl drops.",
                images: ["https://picsum.photos/seed/nath1/400/400.jpg", "https://picsum.photos/seed/nath2/400/400.jpg"]
            },
            {
                id: 1000011,
                name: "Stud Nose Pin",
                category: "nose-rings",
                price: 399,
                stock: 20,
                description: "Simple gold stud nose pin for daily wear.",
                images: ["https://picsum.photos/seed/stud1/400/400.jpg", "https://picsum.photos/seed/stud2/400/400.jpg"]
            }
        ];
        
        // Save to localStorage
        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
        console.log('Sample products initialized and saved:', this.products.length);
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        // Product form
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', async (e) => {
                console.log('Product form submitted');
                e.preventDefault();
                await this.saveProduct();
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.getAttribute('data-filter');
                this.filterOrders(filter);
            });
        });

        // Image upload
        const imageUpload = document.getElementById('imageUpload');
        if (imageUpload) {
            console.log('Image upload element found');
            imageUpload.addEventListener('change', (e) => {
                console.log('Image upload triggered', e.target.files);
                this.previewImages(e.target.files);
            });
        } else {
            console.error('Image upload element not found!');
        }

        // Hero background upload (admin news section)
        const heroBgUpload = document.getElementById('heroBgUpload');
        if (heroBgUpload) {
            heroBgUpload.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                // Quick preview (thumbnails)
                const preview = document.getElementById('heroBgPreview');
                if (preview) {
                    preview.innerHTML = '';
                    const previewUrls = [];
                    const fileArr = Array.from(files);
                    const slice = fileArr.slice(0, 5); // keep preview compact
                    slice.forEach((file) => {
                        if (!file || !file.type || !file.type.startsWith('image/')) return;
                        const url = URL.createObjectURL(file);
                        previewUrls.push(url);
                        const img = document.createElement('img');
                        img.src = url;
                        img.alt = 'Hero background preview';
                        img.style.cssText = 'width: 120px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(212,175,55,0.3); margin: 4px;';
                        preview.appendChild(img);
                    });
                    setTimeout(() => previewUrls.forEach(u => URL.revokeObjectURL(u)), 5000);
                }

                await this.setHeroBackgroundImages(files);
            });
        }

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Category form
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('categoryName').value.trim();
                const slug = document.getElementById('categorySlug').value.trim().toLowerCase().replace(/\s+/g, '-');
                
                if (this.addCategory(name, slug)) {
                    this.closeCategoryModal();
                    alert('Category added successfully!');
                }
            });
        }

        // Auto-generate slug from category name
        const categoryNameInput = document.getElementById('categoryName');
        const categorySlugInput = document.getElementById('categorySlug');
        if (categoryNameInput && categorySlugInput) {
            categoryNameInput.addEventListener('input', (e) => {
                const slug = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                categorySlugInput.value = slug;
            });
        }
    }

    logout() {
        this.isLoggedIn = false;
        localStorage.removeItem('adminAuth');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    }

    showSection(sectionName) {
        console.log('Switching to section:', sectionName);
        
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            console.log('Section activated:', sectionName);
            
            // Load news data when news section is opened
            if (sectionName === 'news') {
                this.loadNewsData();
            }
        } else {
            console.error('Section not found:', sectionName);
        }
        
        // Add active class to clicked nav button
        const targetBtn = document.querySelector(`[data-section="${sectionName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        
        // Load data for specific sections
        if (sectionName === 'products') {
            this.showProducts();
        } else if (sectionName === 'orders') {
            this.showOrders();
        } else if (sectionName === 'sales') {
            this.generateReport();
        } else if (sectionName === 'dashboard') {
            this.showDashboard();
        }
    }

    login() {
        const password = document.getElementById('password').value;
        if (password === 'Janu@0724') {
            this.isLoggedIn = true;
            localStorage.setItem('adminAuth', 'true');
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            this.showDashboard();
        } else {
            alert('Invalid password!');
        }
    }

    showDashboard() {
        // Update stats
        document.getElementById('totalProducts').textContent = this.products.length;
        document.getElementById('totalOrders').textContent = this.orders.length;
        
        const totalRevenue = this.orders.reduce((sum, order) => sum + order.total, 0);
        document.getElementById('totalRevenue').textContent = totalRevenue;

        const lowStock = this.products.filter(p => p.stock <= 5).length;
        document.getElementById('lowStock').textContent = lowStock;
    }

    showProducts() {
        const productsTable = document.getElementById('productsTable');
        if (!productsTable) return;

        if (this.products.length === 0) {
            productsTable.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">No products found. Please add some products.</td></tr>';
            return;
        }

        productsTable.innerHTML = this.products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${this.formatCategory(product.category)}</td>
                <td>
                    ₹${product.price}
                    ${product.offerPrice ? `<br><span style="color: #e74c3c; font-weight: bold;">₹${product.offerPrice}</span>` : ''}
                </td>
                <td>
                    <span class="product-stock ${this.getStockClass(product.stock)}">
                        ${product.stock}
                    </span>
                </td>
                <td>${product.stock > 0 ? 'Active' : 'Out of Stock'}</td>
                <td>
                    <button class="action-btn" onclick="admin.editProduct(${product.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn danger" onclick="admin.deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    showOrders() {
        const ordersContainer = document.getElementById('ordersContainer');
        if (!ordersContainer) return;

        if (this.orders.length === 0) {
            ordersContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">No orders found.</div>';
            return;
        }

        const filteredOrders = this.currentFilter === 'all' 
            ? this.orders 
            : this.orders.filter(order => order.status === this.currentFilter);

        ordersContainer.innerHTML = filteredOrders.map(order => `
            <div class="order-box">
                <div class="order-header">
                    <div class="order-number">Order #${order.orderNumber}</div>
                    <div class="order-status status-${order.status}">${this.formatStatus(order.status)}</div>
                </div>
                <div class="order-details">
                    <div class="order-detail-item">
                        <strong>Invoice:</strong>
                        ${order.invoiceNumber || 'N/A'}
                    </div>
                    <div class="order-detail-item">
                        <strong>Customer:</strong>
                        ${order.customer.name}<br>
                        ${order.customer.mobile}
                    </div>
                    <div class="order-detail-item">
                        <strong>Products:</strong>
                        ${order.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                    </div>
                    <div class="order-detail-item">
                        <strong>Subtotal:</strong>
                        ₹${order.subtotal || 0}
                    </div>
                    <div class="order-detail-item">
                        <strong>GST:</strong>
                        ₹${order.gst || 0}
                    </div>
                    <div class="order-detail-item">
                        <strong>Total:</strong>
                        ₹${order.total || order.subtotal || 0}
                    </div>
                    <div class="order-detail-item">
                        <strong>Date:</strong>
                        ${new Date(order.date).toLocaleDateString()}
                    </div>
                    <div class="order-detail-item">
                        <strong>Order Age:</strong>
                        ${this.getOrderAgeDisplay(order.date)}
                    </div>
                    <div class="order-detail-item">
                        <strong>Tracking Number:</strong>
                        <div class="tracking-container">
                            ${order.trackingNumber ? 
                                `<span class="tracking-number">${order.trackingNumber}</span>` : 
                                '<span class="no-tracking">Not assigned</span>'
                            }
                            ${order.status === 'processing' ? 
                                `<div class="tracking-input-container">
                                    <input type="text" 
                                           id="tracking-${order.orderNumber}" 
                                           class="tracking-input" 
                                           placeholder="Enter tracking number" 
                                           value="${order.trackingNumber || ''}">
                                    <button class="action-btn tracking-save-btn" onclick="saveTrackingNumber('${order.orderNumber}')">
                                        <i class="fas fa-truck"></i> Save Tracking
                                    </button>
                                </div>` : ''
                            }
                        </div>
                    </div>
                </div>
                <div class="order-actions">
                    ${this.getOrderActionButtons(order)}
                    <button class="action-btn" onclick="printInvoice('${order.orderNumber}')">
                        <i class="fas fa-print"></i> Print Invoice
                    </button>
                </div>
            </div>
        `).join('');
    }

    getOrderAge(orderDate) {
        const orderDateTime = new Date(orderDate);
        const currentDateTime = new Date();
        const diffTime = Math.abs(currentDateTime - orderDateTime);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    getOrderAgeDisplay(orderDate) {
        const daysOld = this.getOrderAge(orderDate);
        
        if (daysOld === 0) {
            return `<span style="color: #4CAF50; font-weight: bold;">Today</span>`;
        } else if (daysOld === 1) {
            return `<span style="color: #8BC34A; font-weight: bold;">1 day old</span>`;
        } else if (daysOld <= 3) {
            return `<span style="color: #FFC107; font-weight: bold;">${daysOld} days old</span>`;
        } else if (daysOld <= 7) {
            return `<span style="color: #FF9800; font-weight: bold;">${daysOld} days old</span>`;
        } else {
            return `<span style="color: #F44336; font-weight: bold;">${daysOld} days old</span>`;
        }
    }

    getOrderActionButtons(order) {
        let buttons = '';
        
        if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'processing') {
            buttons += `
                <button class="action-btn cancel-btn" onclick="cancelOrder('${order.orderNumber}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            `;
        }
        
        if (order.status === 'pending') {
            buttons += `
                <button class="action-btn" onclick="updateOrderStatus('${order.orderNumber}', 'confirmed')">
                    <i class="fas fa-check"></i> Confirm
                </button>
            `;
        } else if (order.status === 'confirmed') {
            buttons += `
                <button class="action-btn" onclick="updateOrderStatus('${order.orderNumber}', 'processing')">
                    <i class="fas fa-cog"></i> Process
                </button>
            `;
        } else if (order.status === 'processing') {
            buttons += `
                <button class="action-btn" onclick="updateOrderStatus('${order.orderNumber}', 'shipped')">
                    <i class="fas fa-truck"></i> Ship
                </button>
            `;
        } else if (order.status === 'shipped') {
            buttons += `
                <button class="action-btn" onclick="updateOrderStatus('${order.orderNumber}', 'delivered')">
                    <i class="fas fa-check-circle"></i> Deliver
                </button>
            `;
        }
        
        return buttons;
    }

    saveTrackingNumber(orderNumber) {
        const trackingInput = document.getElementById(`tracking-${orderNumber}`);
        if (!trackingInput) return;
        
        const trackingNumber = trackingInput.value.trim();
        const orderIndex = this.orders.findIndex(o => o.orderNumber == orderNumber);
        
        if (orderIndex !== -1) {
            this.orders[orderIndex].trackingNumber = trackingNumber;
            localStorage.setItem('jewelryOrders', JSON.stringify(this.orders));
            
            // Show success message
            const saveBtn = trackingInput.nextElementSibling;
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            saveBtn.style.backgroundColor = '#4CAF50';
            
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.backgroundColor = '';
            }, 2000);
            
            // Refresh the orders display
            this.showOrders();
        }
    }

    refreshOrders() {
        this.loadData();
        this.showOrders();
        this.showDashboard();
    }

    filterOrders(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.showOrders();
    }

    cancelOrder(orderNumber) {
        console.log('cancelOrder called with:', orderNumber, typeof orderNumber);
        console.log('Current orders:', this.orders);
        console.log('Order numbers in system:', this.orders.map(o => o.orderNumber), this.orders.map(o => typeof o.orderNumber));
        
        if (confirm('Are you sure you want to cancel this order?')) {
            // Convert orderNumber to number for comparison
            const orderNum = parseInt(orderNumber);
            const order = this.orders.find(o => parseInt(o.orderNumber) === orderNum);
            if (order) {
                console.log('Order found for cancellation:', order);
                order.status = 'cancelled';
                localStorage.setItem('jewelryOrders', JSON.stringify(this.orders));
                this.showOrders();
                this.showDashboard();
                alert(`Order #${orderNumber} has been cancelled.`);
            } else {
                console.error('Order not found for cancellation:', orderNumber);
                alert('Order not found!');
            }
        }
    }

    updateOrderStatus(orderNumber, newStatus) {
        console.log('updateOrderStatus called with:', orderNumber, typeof orderNumber, newStatus);
        console.log('Current orders:', this.orders);
        console.log('Order numbers in system:', this.orders.map(o => o.orderNumber), this.orders.map(o => typeof o.orderNumber));
        
        // Convert orderNumber to number for comparison
        const orderNum = parseInt(orderNumber);
        const orderIndex = this.orders.findIndex(o => parseInt(o.orderNumber) === orderNum);
        
        if (orderIndex !== -1) {
            console.log('Order found at index:', orderIndex, this.orders[orderIndex]);
            // Preserve all existing order properties and only update status
            this.orders[orderIndex] = {
                ...this.orders[orderIndex],
                status: newStatus
            };
            localStorage.setItem('jewelryOrders', JSON.stringify(this.orders));
            this.showOrders();
            this.showDashboard();
            alert(`Order #${orderNumber} status updated to ${this.formatStatus(newStatus)}`);
        } else {
            console.error('Order not found:', orderNumber);
            alert('Order not found!');
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

    printInvoice(orderNumber) {
        const order = this.orders.find(o => o.orderNumber == orderNumber);
        if (!order) return;

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
                <title>Invoice ${order.invoiceNumber || 'N/A'}</title>
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
                            <p><strong>Invoice Number:</strong> ${order.invoiceNumber || 'N/A'}</p>
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
                    <p><strong>Subtotal:</strong> ₹${order.subtotal || 0}</p>
                    <p><strong>GST (3%):</strong> ₹${order.gst || 0}</p>
                    <p><strong>Total Amount:</strong> ₹${order.total || order.subtotal || 0}</p>
                </div>
                
                <div class="footer">
                    <p><strong>Payment Method:</strong> ${order.paymentMethod || 'UPI'}</p>
                    <p><strong>UPI ID:</strong> ${order.upiId || 'sumathi2514@sbi'}</p>
                    <p>Thank you for your business!</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        printWindow.print();
    }

    generateInvoiceHTML(order) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice #${order.invoiceNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .company-info { margin-bottom: 20px; }
                    .invoice-details { margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f4f4f4; }
                    .total { font-weight: bold; }
                    .footer { margin-top: 30px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Janu Fashion Jewelry</h1>
                    <h2>TAX INVOICE</h2>
                </div>
                
                <div class="company-info">
                    <p><strong>GSTIN:</strong> 29HRKPS6192F1ZY</p>
                    <p><strong>Phone:</strong> +91-7090590315</p>
                    <p><strong>Email:</strong> janufashionjewelry@zohomail.in</p>
                </div>
                
                <div class="invoice-details">
                    <p><strong>Invoice Number:</strong> ${order.invoiceNumber}</p>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p>
                </div>
                
                <div class="customer-details">
                    <h3>Bill To:</h3>
                    <p><strong>Name:</strong> ${order.customer.name}</p>
                    <p><strong>Mobile:</strong> ${order.customer.mobile}</p>
                    <p><strong>Email:</strong> ${order.customer.email}</p>
                    <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.pincode}</p>
                </div>
                
                <h3>Order Details</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>₹${item.price}</td>
                                <td>₹${item.price * item.quantity}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="3">Subtotal (3% GST included)</td>
                            <td>₹${order.total}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>This is a computer-generated invoice.</p>
                </div>
            </body>
            </html>
        `;
    }

    generateReport() {
        console.log('generateReport called');
        this.showSalesReports();
    }

    showSalesReports() {
        this.generateSalesChart();
        this.updateReportSummary();
    }

    generateSalesChart() {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        const salesData = this.getSalesData();
        
        if (this.salesChart) {
            this.salesChart.destroy();
        }

        this.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: salesData.labels,
                datasets: [{
                    label: 'Sales (₹)',
                    data: salesData.data,
                    borderColor: '#d4af37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }

    getSalesData() {
        const period = document.getElementById('reportPeriod')?.value || 'monthly';
        const orders = this.orders.filter(order => order.status !== 'cancelled');
        
        const salesByPeriod = {};
        
        orders.forEach(order => {
            const date = new Date(order.date);
            let key;
            
            switch(period) {
                case 'weekly':
                    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
                    key = weekStart.toLocaleDateString();
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'yearly':
                    key = date.getFullYear().toString();
                    break;
                case '3years':
                    key = date.getFullYear().toString();
                    break;
                default:
                    key = date.toLocaleDateString();
            }
            
            salesByPeriod[key] = (salesByPeriod[key] || 0) + order.total;
        });
        
        const sortedKeys = Object.keys(salesByPeriod).sort();
        
        return {
            labels: sortedKeys,
            data: sortedKeys.map(key => salesByPeriod[key])
        };
    }

    updateReportSummary() {
        const reportSummaryContent = document.getElementById('reportSummaryContent');
        if (!reportSummaryContent) return;

        const totalOrders = this.orders.length;
        const completedOrders = this.orders.filter(o => o.status === 'completed').length;
        const totalRevenue = this.orders.reduce((sum, order) => sum + order.total, 0);
        const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        reportSummaryContent.innerHTML = `
            <div class="summary-item">
                <strong>Total Orders:</strong> ${totalOrders}
            </div>
            <div class="summary-item">
                <strong>Completed Orders:</strong> ${completedOrders}
            </div>
            <div class="summary-item">
                <strong>Total Revenue:</strong> ₹${totalRevenue}
            </div>
            <div class="summary-item">
                <strong>Average Order Value:</strong> ₹${averageOrderValue}
            </div>
        `;
    }

    downloadSalesReport() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const reportType = document.getElementById('reportType').value;

        let filteredOrders = this.orders;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filteredOrders = this.orders.filter(order => {
                const orderDate = new Date(order.date);
                return orderDate >= start && orderDate <= end;
            });
        }

        // Create CSV content
        const csvHeaders = ['Order Number', 'Invoice Number', 'Date', 'Customer Name', 'Mobile', 'Email', 'Items', 'Subtotal', 'GST', 'Total', 'Status', 'Payment Method'];
        const csvRows = filteredOrders.map(order => [
            order.orderNumber,
            order.invoiceNumber,
            new Date(order.date).toLocaleDateString('en-IN'),
            order.customer.name,
            order.customer.mobile,
            order.customer.email,
            order.items.map(item => `${item.name}(${item.quantity})`).join('; '),
            order.subtotal || 0,
            order.gst || 0,
            order.total || 0,
            order.status,
            order.paymentMethod || 'UPI'
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const filename = `sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Product Management
    openProductModal() {
        this.editingProduct = null;
        document.getElementById('modalTitle').textContent = 'Add Product';
        document.getElementById('productForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('productModal').style.display = 'block';
    }

    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.editingProduct = { ...product };
            document.getElementById('modalTitle').textContent = 'Edit Product';
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productOfferPrice').value = product.offerPrice || '';
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productDescription').value = product.description;
            
            // Show existing images
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.innerHTML = '';
            
            if (product.images && product.images.length > 0) {
                product.images.forEach((imageSrc, index) => {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.cssText = 'position: relative; display: inline-block; margin: 5px;';
                    // Store the raw value that should be saved back into the product.
                    // This can be a normal URL/data URL, or an IndexedDB reference like `idb:<imageId>`.
                    imgContainer.dataset.imageValue = imageSrc;
                    
                    const img = document.createElement('img');
                    let objectUrl = null;
                    if (this.isIdbImageValue(imageSrc)) {
                        img.src = '';
                        const imageId = this.idbImageIdFromValue(imageSrc);
                        this.getImageBlob(imageId).then(blob => {
                            if (!blob) return;
                            objectUrl = URL.createObjectURL(blob);
                            img.src = objectUrl;
                        }).catch(() => {
                            img.src = 'https://picsum.photos/seed/fallback/400/400.jpg';
                        });
                    } else {
                        img.src = imageSrc;
                    }
                    img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px;';
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '×';
                    removeBtn.style.cssText = `
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `;
                    removeBtn.onclick = () => {
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        imgContainer.remove();
                    };
                    
                    imgContainer.appendChild(img);
                    imgContainer.appendChild(removeBtn);
                    imagePreview.appendChild(imgContainer);
                });
            }
            
            document.getElementById('productModal').style.display = 'block';
        }
    }

    replaceSingleImage(oldImageUrl, container) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = container.querySelector('img');
                    img.src = e.target.result;
                    
                    // Update the product image array
                    const index = this.editingProduct.images.indexOf(oldImageUrl);
                    if (index > -1) {
                        this.editingProduct.images[index] = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
        this.editingProduct = null;
    }

    previewImages(files) {
        console.log('previewImages called with files:', files);
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) {
            console.error('Image preview element not found!');
            return;
        }

        console.log('Clearing existing preview');
        imagePreview.innerHTML = '';

        const storePromises = [];

        Array.from(files).forEach((file, index) => {
            console.log(`Processing file ${index}:`, file.name, file.type);
            if (!file.type.startsWith('image/')) {
                console.warn(`File ${index} is not an image:`, file.type);
                return;
            }

            // Generate an ID for IndexedDB storage.
            const imageId = `img_upload_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`;
            const imageValue = `idb:${imageId}`;

            // Preview using an object URL (does not reduce quality).
            const previewUrl = URL.createObjectURL(file);

            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'position: relative; display: inline-block; margin: 5px;';
            imgContainer.dataset.imageValue = imageValue; // Store the value used for saving the product

            const img = document.createElement('img');
            img.src = previewUrl;
            img.style.cssText = 'width: 150px; height: 150px; object-fit: cover; border-radius: 8px;';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            removeBtn.onclick = async () => {
                try {
                    // Best-effort cleanup; even if it fails, it won't affect product saving.
                    await this.deleteImageBlob(imageId);
                } catch (e) {
                    // Ignore cleanup errors
                } finally {
                    URL.revokeObjectURL(previewUrl);
                    imgContainer.remove();
                }
            };

            imgContainer.appendChild(img);
            imgContainer.appendChild(removeBtn);
            imagePreview.appendChild(imgContainer);

            // Persist the original file blob in IndexedDB (no Base64, no localStorage quota hit).
            const p = this.putImageBlob(imageId, file);
            storePromises.push(p);
        });

        // Allow saveProduct to wait for uploads to finish before reading image values.
        this.pendingImageUploadPromise = Promise.all(storePromises);
    }

    compressImageForStorage(src, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize to max 1200x1200 for high quality but smaller storage
            const maxSize = 1200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Use high quality (0.85) for good balance of quality and size
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = src;
    }

    async saveProduct() {
        console.log('=== saveProduct called ===');
        // Ensure any pending Base64->IndexedDB migration completed,
        // otherwise localStorage may still be near/quota-exceeded.
        if (this.imageMigrationPromise) {
            await this.imageMigrationPromise;
        }

        const name = document.getElementById('productName').value.trim();
        const category = document.getElementById('productCategory').value;
        const price = parseInt(document.getElementById('productPrice').value);
        const offerPriceInput = document.getElementById('productOfferPrice').value;
        const offerPrice = offerPriceInput ? parseInt(offerPriceInput) : null;
        const stock = parseInt(document.getElementById('productStock').value);
        const description = document.getElementById('productDescription').value.trim();

        console.log('Form data:', { name, category, price, offerPrice, stock, description });

        if (!name || !category || !price || !stock || !description) {
            alert('Please fill all required fields!');
            return;
        }

        // Validate offer price is less than regular price
        if (offerPrice && offerPrice >= price) {
            alert('Offer price must be less than regular price!');
            return;
        }

        // Get uploaded images
        if (this.pendingImageUploadPromise) {
            await this.pendingImageUploadPromise;
            this.pendingImageUploadPromise = null;
        }
        const uploadedImages = this.getUploadedImages();
        console.log('Uploaded images count:', uploadedImages.length);
        console.log('Uploaded images:', uploadedImages);
        
        if (uploadedImages.length === 0) {
            console.log('No images uploaded, using fallback');
        }
        
        if (this.editingProduct) {
            // Update existing product
            console.log('Updating existing product:', this.editingProduct.id);
            this.editingProduct.name = name;
            this.editingProduct.category = category;
            this.editingProduct.price = price;
            this.editingProduct.offerPrice = offerPrice;
            this.editingProduct.stock = stock;
            this.editingProduct.description = description;
            
            // Update images if new ones are uploaded
            if (uploadedImages.length > 0) {
                this.editingProduct.images = uploadedImages;
                console.log('Updated product images:', uploadedImages.length);
            }
            
            // Update the product in the array
            const index = this.products.findIndex(p => p.id === this.editingProduct.id);
            if (index !== -1) {
                this.products[index] = this.editingProduct;
            }
        } else {
            // Add new product
            console.log('Adding new product');
            const newProduct = {
                id: Math.floor(1000000 + Math.random() * 9000000),
                name,
                category,
                price,
                offerPrice,
                stock,
                description,
                images: uploadedImages.length > 0 ? uploadedImages : [`https://picsum.photos/seed/product-${Date.now()}/400/400.jpg`]
            };
            console.log('New product images:', newProduct.images.length);
            console.log('New product object:', newProduct);
            this.products.push(newProduct);
        }

        // Save product metadata to localStorage.
        // Images are stored in IndexedDB, so this avoids the localStorage "quota exceeded" issue.
        console.log('Saving to localStorage...');
        try {
            const productsJson = JSON.stringify(this.products);
            console.log('Products JSON size:', productsJson.length, 'characters');
            
            localStorage.setItem('jewelryProducts', productsJson);
            console.log('Products saved to localStorage successfully');
        } catch (error) {
            console.error('Storage error:', error);
            if (error.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please use fewer images or delete some existing products to free up space.');
            } else {
                alert('Error saving products: ' + error.message);
            }
            return;
        }
        
        // Refresh the displays
        this.showProducts();
        this.showDashboard();
        
        // Close modal and reset
        this.closeProductModal();
        
        // Show success message
        alert(this.editingProduct ? 'Product updated successfully!' : 'Product added successfully!');
    }

    getUploadedImages() {
        console.log('=== getUploadedImages called ===');
        const imagePreview = document.getElementById('imagePreview');
        if (!imagePreview) {
            console.log('No image preview element found');
            return [];
        }
        
        const images = [];
        const imgContainers = imagePreview.querySelectorAll('div[data-image-value]');
        
        console.log('Found image containers in preview:', imgContainers.length);
        
        imgContainers.forEach((container, index) => {
            const imageValue = container.dataset.imageValue;
            images.push(imageValue);
        });
        
        console.log('Returning original images array:', images.length, 'images');
        console.log('Total size estimate:', images.reduce((sum, img) => sum + (img?.length || 0), 0), 'characters');
        return images;
    }

    deleteProduct(productId) {
        if (confirm('Are you sure you want to delete this product?')) {
            this.products = this.products.filter(p => p.id !== productId);
            localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
            this.showProducts();
            this.showDashboard();
            alert('Product deleted successfully!');
        }
    }

    // Utility Functions
    formatCategory(category) {
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatStatus(status) {
        return status.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getStockClass(stock) {
        if (stock === 0) return 'out-of-stock';
        if (stock <= 5) return 'low-stock';
        return 'in-stock';
    }

    // Category Management
    loadCategories() {
        const storedCategories = localStorage.getItem('jewelryCategories');
        if (storedCategories) {
            this.categories = JSON.parse(storedCategories);
        } else {
            // Initialize with default categories
            this.categories = [
                { name: 'Rings', slug: 'rings' },
                { name: 'Necklaces', slug: 'necklaces' },
                { name: 'Earrings', slug: 'earrings' },
                { name: 'Bracelets', slug: 'bracelets' },
                { name: 'Anklets', slug: 'anklets' },
                { name: 'Nose Rings', slug: 'nose-rings' }
            ];
            this.saveCategories();
        }
        this.updateCategorySelect();
    }

    saveCategories() {
        localStorage.setItem('jewelryCategories', JSON.stringify(this.categories));
        // Also update the main app categories
        localStorage.setItem('jewelryAppCategories', JSON.stringify(this.categories));
    }

    updateCategorySelect() {
        const select = document.getElementById('productCategory');
        if (select) {
            select.innerHTML = '<option value="">Select Category</option>';
            this.categories.forEach(category => {
                select.innerHTML += `<option value="${category.slug}">${category.name}</option>`;
            });
        }
    }

    openCategoryModal() {
        document.getElementById('categoryModal').style.display = 'block';
        document.getElementById('categoryForm').reset();
    }

    closeCategoryModal() {
        document.getElementById('categoryModal').style.display = 'none';
    }

    addCategory(name, slug) {
        // Check if category already exists
        if (this.categories.find(cat => cat.slug === slug)) {
            alert('Category with this slug already exists!');
            return false;
        }

        this.categories.push({ name, slug });
        this.saveCategories();
        this.updateCategorySelect();
        return true;
    }

    // News Management
    loadNewsData() {
        const newsText = document.getElementById('newsText');
        const newsPreview = document.getElementById('newsPreview');
        
        if (newsText) {
            newsText.value = this.newsText;
        }
        
        if (newsPreview) {
            newsPreview.textContent = this.newsText;
        }
    }

    updateNews() {
        const newsText = document.getElementById('newsText');
        if (!newsText) return;
        
        const newNewsText = newsText.value.trim();
        
        if (!newNewsText) {
            alert('Please enter news text!');
            return;
        }
        
        this.newsText = newNewsText;
        localStorage.setItem('jewelryNews', this.newsText);
        
        // Update preview
        const newsPreview = document.getElementById('newsPreview');
        if (newsPreview) {
            newsPreview.textContent = this.newsText;
        }
        
        alert('News updated successfully! It will appear on the homepage.');
    }

    updateNewsPreview() {
        const newsText = document.getElementById('newsText');
        const newsPreview = document.getElementById('newsPreview');
        
        if (newsText && newsPreview) {
            newsPreview.textContent = newsText.value || 'Preview will appear here...';
        }
    }
}

// Global functions
let admin;

// Initialize admin immediately
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel DOM loaded, initializing...');
    
    // Check if we're on the admin page
    if (window.location.pathname.includes('admin.html') || window.location.href.includes('admin.html')) {
        console.log('Admin page detected, creating admin instance...');
        admin = new AdminPanel();
        
        // Make global functions available immediately
        window.admin = admin;
        window.logout = () => {
            console.log('Logout called');
            return admin.logout();
        };
        window.openProductModal = () => {
            console.log('Open product modal called');
            return admin.openProductModal();
        };
        window.closeProductModal = () => {
            console.log('Close product modal called');
            return admin.closeProductModal();
        };
        window.editProduct = (id) => {
            console.log('Edit product called with id:', id);
            return admin.editProduct(id);
        };
        window.deleteProduct = (id) => {
            console.log('Delete product called with id:', id);
            return admin.deleteProduct(id);
        };
        window.updateOrderStatus = (orderNumber, status) => {
            console.log('Update order status called:', orderNumber, status);
            return admin.updateOrderStatus(orderNumber, status);
        };
        window.cancelOrder = (orderNumber) => {
            console.log('Cancel order called:', orderNumber);
            return admin.cancelOrder(orderNumber);
        };
        window.printInvoice = (orderNumber) => {
            console.log('Print invoice called:', orderNumber);
            return admin.printInvoice(orderNumber);
        };
        window.refreshOrders = () => {
            console.log('Refresh orders called');
            return admin.refreshOrders();
        };
        window.saveTrackingNumber = (orderNumber) => {
            console.log('Save tracking number called:', orderNumber);
            return admin.saveTrackingNumber(orderNumber);
        };
        window.generateReport = () => {
            console.log('Generate report called');
            return admin.generateReport();
        };
        window.downloadSalesReport = () => {
            console.log('Download sales report called');
            return admin.downloadSalesReport();
        };
        window.showSection = (section) => {
            console.log('Show section called:', section);
            return admin.showSection(section);
        };
        window.openCategoryModal = () => {
            console.log('Open category modal called');
            return admin.openCategoryModal();
        };
        window.closeCategoryModal = () => {
            console.log('Close category modal called');
            return admin.closeCategoryModal();
        };
        window.previewImages = (files) => {
            console.log('Global previewImages called with files:', files);
            return admin.previewImages(files);
        };
        window.updateNews = () => {
            console.log('Update news called');
            return admin.updateNews();
        };
        window.updateNewsPreview = () => {
            console.log('Update news preview called');
            return admin.updateNewsPreview();
        };
        
        console.log('Admin panel initialized successfully');
        console.log('Available global functions:', Object.keys(window).filter(key => typeof window[key] === 'function' && key !== 'logout'));
    } else {
        console.log('Not on admin page, skipping admin initialization');
    }
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        admin.closeProductModal();
    }
});
