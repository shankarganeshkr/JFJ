// Main Application JavaScript
class JewelryApp {
    constructor() {
        this.products = [];
        this.cart = [];
        this.categories = ['All', 'Necklace', 'Earrings', 'Rings', 'Bracelets', 'Anklets', 'Mangalsutra', 'Jhumka', 'Bangles', 'Nose Rings', 'Diamond Rings'];
        this.currentFilter = 'All';
        this.imageRotationIntervals = {};
        this.heroBackgroundIndex = 0;
        this.init();
    }

    async init() {
        await this.loadProducts();
        await this.loadHeroBackgroundImages();
        this.loadCategories();
        this.loadNews();
        this.renderProducts();
        this.startImageRotation();
        this.startHeroBackgroundRotation();
        this.startModelRotation();
        this.setupEventListeners();
    }

    // ===================== IndexedDB image support =====================
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

    isIdbImageValue(value) {
        return typeof value === 'string' && value.startsWith('idb:');
    }

    idbImageIdFromValue(value) {
        return value.replace(/^idb:/, '');
    }

    getImageBlob(imageId) {
        // Cache db open per instance.
        if (!this.imageDbPromise) {
            this.imageDbPromise = this.openImageDb();
        }
        return this.imageDbPromise.then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(['productImages'], 'readonly');
            const req = tx.objectStore('productImages').get(imageId);
            req.onsuccess = () => resolve(req.result ? req.result.blob : null);
            req.onerror = () => reject(req.error);
        }));
    }

    async resolveIdbImageValues(products) {
        const idSet = new Set();
        for (const product of products) {
            if (!Array.isArray(product.images)) continue;
            for (const imgValue of product.images) {
                if (this.isIdbImageValue(imgValue)) {
                    idSet.add(this.idbImageIdFromValue(imgValue));
                }
            }
        }

        if (idSet.size === 0) return products;

        const idToUrl = new Map();
        await Promise.all(Array.from(idSet).map(async (imageId) => {
            try {
                const blob = await this.getImageBlob(imageId);
                if (blob) idToUrl.set(imageId, URL.createObjectURL(blob));
            } catch (e) {
                // Ignore failures for individual images.
            }
        }));

        for (const product of products) {
            if (!Array.isArray(product.images)) continue;
            product.images = product.images.map(imgValue => {
                if (!this.isIdbImageValue(imgValue)) return imgValue;
                const imageId = this.idbImageIdFromValue(imgValue);
                return idToUrl.get(imageId) || 'https://picsum.photos/seed/fallback/400/400.jpg';
            });
        }

        return products;
    }

    async loadHeroBackgroundImages() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        // Release any previous background object URLs.
        if (this.heroBgObjectUrls && Array.isArray(this.heroBgObjectUrls)) {
            try { this.heroBgObjectUrls.forEach(u => URL.revokeObjectURL(u)); } catch (e) {}
        }
        this.heroBgObjectUrls = [];

        // Preferred key: multiple hero images.
        const storedListJson = localStorage.getItem('jewelryHeroBackgrounds');
        if (storedListJson) {
            try {
                const storedList = JSON.parse(storedListJson);
                if (Array.isArray(storedList) && storedList.length > 0) {
                    await Promise.all(storedList.map(async (value) => {
                        if (!value) return;
                        if (this.isIdbImageValue(value)) {
                            const imageId = this.idbImageIdFromValue(value);
                            const blob = await this.getImageBlob(imageId);
                            if (blob) this.heroBgObjectUrls.push(URL.createObjectURL(blob));
                        } else if (typeof value === 'string') {
                            // Allow fallback if someone stored a normal URL/data URL by mistake.
                            this.heroBgObjectUrls.push(value);
                        }
                    }));
                }
            } catch (e) {}
        }

        // Backwards-compat: if user only uploaded a single image via old "Header Background Image",
        // stored under jewelryHeaderBg / idb:headerBg, we use it as a single hero background.
        if (this.heroBgObjectUrls.length === 0) {
            const single = localStorage.getItem('jewelryHeaderBg');
            if (single && this.isIdbImageValue(single)) {
                try {
                    const imageId = this.idbImageIdFromValue(single);
                    const blob = await this.getImageBlob(imageId);
                    if (blob) this.heroBgObjectUrls.push(URL.createObjectURL(blob));
                } catch (e) {}
            }
        }

        // Set an initial hero background immediately for faster perceived update.
        if (this.heroBgObjectUrls.length > 0) {
            const url = this.heroBgObjectUrls[0];
            hero.style.backgroundImage = `url('${url}')`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
            hero.style.backgroundRepeat = 'no-repeat';
        }
    }

    async loadProducts() {
        const storedProducts = localStorage.getItem('jewelryProducts');
        if (storedProducts) {
            this.products = JSON.parse(storedProducts);
            console.log('Loaded products from storage:', this.products.length);
            await this.resolveIdbImageValues(this.products);
        } else {
            console.log('No products found, initializing sample products...');
            this.initializeSampleProducts();
        }
        
        // Categories/news are loaded separately in init().
    }

    loadCategories() {
        const storedCategories = localStorage.getItem('jewelryAppCategories');
        if (storedCategories) {
            this.categories = JSON.parse(storedCategories);
            console.log('Loaded categories from admin:', this.categories);
        } else {
            // Default categories
            this.categories = [
                { name: 'Rings', slug: 'rings' },
                { name: 'Necklaces', slug: 'necklaces' },
                { name: 'Earrings', slug: 'earrings' },
                { name: 'Bracelets', slug: 'bracelets' },
                { name: 'Anklets', slug: 'anklets' },
                { name: 'Nose Rings', slug: 'nose-rings' }
            ];
        }
    }

    loadNews() {
        const newsText = localStorage.getItem('jewelryNews');
        if (newsText) {
            const newsScroll = document.getElementById('newsScroll');
            if (newsScroll) {
                newsScroll.innerHTML = `<span class="news-item">${newsText}</span>`;
            }
        }
    }

    saveProducts() {
        localStorage.setItem('jewelryProducts', JSON.stringify(this.products));
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
                id: 8901234,
                name: "Temple Jewelry Set",
                category: "necklaces",
                price: 4599,
                stock: 3,
                description: "Traditional temple jewelry set with intricate god motifs, perfect for religious ceremonies.",
                images: ["https://picsum.photos/seed/temple1/400/400.jpg", "https://picsum.photos/seed/temple1-2/400/400.jpg", "https://picsum.photos/seed/temple1-3/400/400.jpg"]
            },
            {
                id: 4456789,
                name: "Mangalsutra",
                category: "necklaces",
                price: 3899,
                stock: 7,
                description: "Traditional mangalsutra with black beads and gold pendant, symbol of marriage.",
                images: ["https://picsum.photos/seed/mangalsutra1/400/400.jpg", "https://picsum.photos/seed/mangalsutra1-2/400/400.jpg", "https://picsum.photos/seed/mangalsutra1-3/400/400.jpg"]
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
            {
                id: 1000013,
                name: "Diamond Pendant",
                category: "necklaces",
                price: 2299,
                stock: 8,
                description: "Delicate diamond pendant with platinum chain.",
                images: ["https://picsum.photos/seed/diamond1/400/400.jpg", "https://picsum.photos/seed/diamond2/400/400.jpg"]
            },
            {
                id: 1000014,
                name: "Gold Chain",
                category: "necklaces",
                price: 1899,
                stock: 20,
                description: "Classic gold chain suitable for daily wear.",
                images: ["https://picsum.photos/seed/chain1/400/400.jpg", "https://picsum.photos/seed/chain2/400/400.jpg"]
            },
            {
                id: 1000015,
                name: "Kundan Necklace",
                category: "necklaces",
                price: 3599,
                stock: 6,
                description: "Traditional kundan necklace with colorful stones.",
                images: ["https://picsum.photos/seed/kundan1/400/400.jpg", "https://picsum.photos/seed/kundan2/400/400.jpg"]
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
                id: 5567890,
                name: "Jhumka Earrings",
                category: "earrings",
                price: 999,
                stock: 16,
                description: "Traditional jhumka earrings with intricate designs, perfect for ethnic wear.",
                images: ["https://picsum.photos/seed/jhumka1/400/400.jpg", "https://picsum.photos/seed/jhumka1-2/400/400.jpg", "https://picsum.photos/seed/jhumka1-3/400/400.jpg"]
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
            {
                id: 1000003,
                name: "Chandbali Earrings",
                category: "earrings",
                price: 1499,
                stock: 10,
                description: "Traditional chandbali earrings with intricate meenakari work.",
                images: ["https://picsum.photos/seed/chand1/400/400.jpg", "https://picsum.photos/seed/chand2/400/400.jpg"]
            },
            {
                id: 1000016,
                name: "Silver Studs",
                category: "earrings",
                price: 599,
                stock: 25,
                description: "Simple silver stud earrings for daily wear.",
                images: ["https://picsum.photos/seed/silverstud1/400/400.jpg", "https://picsum.photos/seed/silverstud2/400/400.jpg"]
            },
            {
                id: 1000017,
                name: "Pearl Earrings",
                category: "earrings",
                price: 899,
                stock: 14,
                description: "Elegant pearl drop earrings with gold hooks.",
                images: ["https://picsum.photos/seed/pearlearring1/400/400.jpg", "https://picsum.photos/seed/pearlearring2/400/400.jpg"]
            },
            {
                id: 1000018,
                name: "Tassel Earrings",
                category: "earrings",
                price: 699,
                stock: 18,
                description: "Trendy tassel earrings with colorful threads.",
                images: ["https://picsum.photos/seed/tassel1/400/400.jpg", "https://picsum.photos/seed/tassel2/400/400.jpg"]
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
            {
                id: 1000005,
                name: "Oxidized Bangles",
                category: "bangles",
                price: 899,
                stock: 15,
                description: "Trendy oxidized silver bangles with tribal designs.",
                images: ["https://picsum.photos/seed/oxi1/400/400.jpg", "https://picsum.photos/seed/oxi2/400/400.jpg"]
            },
            {
                id: 1000019,
                name: "Diamond Bangles",
                category: "bangles",
                price: 3999,
                stock: 4,
                description: "Luxurious diamond bangles with gold setting.",
                images: ["https://picsum.photos/seed/diamondbangle1/400/400.jpg", "https://picsum.photos/seed/diamondbangle2/400/400.jpg"]
            },
            {
                id: 1000020,
                name: "Silver Cuff",
                category: "bangles",
                price: 1299,
                stock: 12,
                description: "Modern silver cuff bracelet with minimalist design.",
                images: ["https://picsum.photos/seed/cuff1/400/400.jpg", "https://picsum.photos/seed/cuff2/400/400.jpg"]
            },
            {
                id: 1000021,
                name: "Beaded Bangles",
                category: "bangles",
                price: 799,
                stock: 20,
                description: "Colorful beaded bangles with elastic band.",
                images: ["https://picsum.photos/seed/beaded1/400/400.jpg", "https://picsum.photos/seed/beaded2/400/400.jpg"]
            },
            {
                id: 1000022,
                name: "Gold Kada",
                category: "bangles",
                price: 2799,
                stock: 8,
                description: "Traditional gold kada with intricate carvings.",
                images: ["https://picsum.photos/seed/kada1/400/400.jpg", "https://picsum.photos/seed/kada2/400/400.jpg"]
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
                id: 6678901,
                name: "Diamond Ring",
                category: "rings",
                price: 4999,
                stock: 2,
                description: "Luxurious diamond ring with platinum setting, the ultimate symbol of love.",
                images: ["https://picsum.photos/seed/diamond-ring1/400/400.jpg", "https://picsum.photos/seed/diamond-ring1-2/400/400.jpg", "https://picsum.photos/seed/diamond-ring1-3/400/400.jpg", "https://picsum.photos/seed/diamond-ring1-4/400/400.jpg"]
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
            {
                id: 1000007,
                name: "Gold Signet Ring",
                category: "rings",
                price: 1999,
                stock: 8,
                description: "Classic gold signet ring perfect for personalization.",
                images: ["https://picsum.photos/seed/signet1/400/400.jpg", "https://picsum.photos/seed/signet2/400/400.jpg"]
            },
            {
                id: 1000023,
                name: "Emerald Ring",
                category: "rings",
                price: 3299,
                stock: 5,
                description: "Stunning emerald ring with diamond side stones.",
                images: ["https://picsum.photos/seed/emerald1/400/400.jpg", "https://picsum.photos/seed/emerald2/400/400.jpg"]
            },
            {
                id: 1000024,
                name: "Pearl Ring",
                category: "rings",
                price: 1399,
                stock: 12,
                description: "Elegant pearl ring with gold band.",
                images: ["https://picsum.photos/seed/pearlring1/400/400.jpg", "https://picsum.photos/seed/pearlring2/400/400.jpg"]
            },
            {
                id: 1000025,
                name: "Cocktail Ring",
                category: "rings",
                price: 2299,
                stock: 7,
                description: "Statement cocktail ring with colorful stones.",
                images: ["https://picsum.photos/seed/cocktail1/400/400.jpg", "https://picsum.photos/seed/cocktail2/400/400.jpg"]
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
            {
                id: 1000009,
                name: "Beaded Anklet",
                category: "anklets",
                price: 499,
                stock: 30,
                description: "Colorful beaded anklet with adjustable chain.",
                images: ["https://picsum.photos/seed/bead1/400/400.jpg", "https://picsum.photos/seed/bead2/400/400.jpg"]
            },
            {
                id: 1000026,
                name: "Diamond Anklet",
                category: "anklets",
                price: 1899,
                stock: 6,
                description: "Delicate diamond anklet with gold chain.",
                images: ["https://picsum.photos/seed/diamondanklet1/400/400.jpg", "https://picsum.photos/seed/diamondanklet2/400/400.jpg"]
            },
            {
                id: 1000027,
                name: "Oxidized Anklet",
                category: "anklets",
                price: 599,
                stock: 18,
                description: "Trendy oxidized silver anklet with tribal design.",
                images: ["https://picsum.photos/seed/oxianklet1/400/400.jpg", "https://picsum.photos/seed/oxianklet2/400/400.jpg"]
            },
            {
                id: 1000028,
                name: "Chain Anklet",
                category: "anklets",
                price: 799,
                stock: 15,
                description: "Simple gold chain anklet with small pendant.",
                images: ["https://picsum.photos/seed/chainanklet1/400/400.jpg", "https://picsum.photos/seed/chainanklet2/400/400.jpg"]
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
            },
            {
                id: 1000012,
                name: "Hoop Nose Ring",
                category: "nose-rings",
                price: 699,
                stock: 10,
                description: "Modern hoop nose ring with gold plating.",
                images: ["https://picsum.photos/seed/hoop1/400/400.jpg", "https://picsum.photos/seed/hoop2/400/400.jpg"]
            },
            {
                id: 1000029,
                name: "Diamond Nose Pin",
                category: "nose-rings",
                price: 1299,
                stock: 8,
                description: "Elegant diamond nose pin with gold setting.",
                images: ["https://picsum.photos/seed/diamondnose1/400/400.jpg", "https://picsum.photos/seed/diamondnose2/400/400.jpg"]
            },
            {
                id: 1000030,
                name: "Silver Nose Ring",
                category: "nose-rings",
                price: 499,
                stock: 22,
                description: "Simple silver nose ring for daily wear.",
                images: ["https://picsum.photos/seed/silvernose1/400/400.jpg", "https://picsum.photos/seed/silvernose2/400/400.jpg"]
            },
            {
                id: 1000031,
                name: "Tikka Nose Pin",
                category: "nose-rings",
                price: 799,
                stock: 12,
                description: "Traditional tikka style nose pin with chain.",
                images: ["https://picsum.photos/seed/tikka1/400/400.jpg", "https://picsum.photos/seed/tikka2/400/400.jpg"]
            }
        ];
        this.saveProducts();
        console.log('Sample products initialized:', this.products.length);
    }

    // Cart Management
    loadCart() {
        const storedCart = localStorage.getItem('jewelryCart');
        if (storedCart) {
            this.cart = JSON.parse(storedCart);
        }
    }

    saveCart() {
        localStorage.setItem('jewelryCart', JSON.stringify(this.cart));
        this.updateCartUI();
    }

    addToCart(productId, quantity = 1) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (product.stock < quantity) {
            alert('Insufficient stock available!');
            return;
        }

        const existingItem = this.cart.find(item => item.productId === productId);
        
        if (existingItem) {
            if (existingItem.quantity + quantity > product.stock) {
                alert('Insufficient stock available!');
                return;
            }
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                productId: productId,
                quantity: quantity,
                name: product.name,
                price: product.offerPrice || product.price,
                originalPrice: product.price,
                image: product.images[0]
            });
        }

        this.saveCart();
        this.showNotification('Product added to cart!');
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.productId !== productId);
        this.saveCart();
    }

    updateQuantity(productId, change) {
        const item = this.cart.find(item => item.productId === productId);
        const product = this.products.find(p => p.id === productId);
        
        if (item && product) {
            const newQuantity = item.quantity + change;
            if (newQuantity > 0 && newQuantity <= product.stock) {
                item.quantity = newQuantity;
                this.saveCart();
            } else if (newQuantity <= 0) {
                this.removeFromCart(productId);
            } else {
                alert('Insufficient stock available!');
            }
        }
    }

    getCartTotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getCartCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }

    // UI Rendering
    renderProducts() {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) {
            console.log('Products grid not found');
            return;
        }

        console.log('Rendering products:', this.products.length);
        
        const filteredProducts = this.currentFilter === 'all' 
            ? this.products 
            : this.products.filter(p => p.category === this.currentFilter);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999; padding: 40px;">No products found in this category.</div>';
            return;
        }

        productsGrid.innerHTML = filteredProducts.map(product => `
            <div class="product-card">
                <div onclick="store.openProductModal(${product.id})" style="cursor: pointer;">
                    <div class="product-image-container" data-product-id="${product.id}" data-images='${JSON.stringify(product.images)}' data-current-index="0">
                        <img src="${product.images[0]}" alt="${product.name}" class="product-image" onerror="this.src='https://picsum.photos/seed/fallback/400/400.jpg'">
                        ${product.images.length > 1 ? `
                            <div class="image-indicators">
                                ${product.images.map((_, index) => `
                                    <span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <div class="price-container">
                            ${product.offerPrice ? `
                                <p class="product-offer-price">₹${product.offerPrice}</p>
                                <p class="product-original-price">₹${product.price}</p>
                                <span class="offer-badge">${Math.round(((product.price - product.offerPrice) / product.price) * 100)}% OFF</span>
                            ` : `
                                <p class="product-price">₹${product.price}</p>
                            `}
                        </div>
                        <p class="product-category">${this.formatCategory(product.category)}</p>
                        <span class="product-stock ${this.getStockClass(product.stock)}">
                            ${this.getStockText(product.stock)}
                        </span>
                    </div>
                </div>
                <button class="add-to-cart-btn-card" onclick="event.stopPropagation(); store.addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>
                    ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        `).join('');
        
        console.log('Products rendered successfully');
        
        // Start image rotation for products with multiple images
        this.startImageRotation();
    }

    startImageRotation() {
        // Clear any existing intervals
        if (this.imageRotationInterval) {
            clearInterval(this.imageRotationInterval);
        }
        
        // Set up rotation for all product containers
        const containers = document.querySelectorAll('.product-image-container[data-images]');
        
        containers.forEach(container => {
            const images = JSON.parse(container.dataset.images);
            if (images.length > 1) {
                let currentIndex = 0;
                const img = container.querySelector('.product-image');
                const indicators = container.querySelectorAll('.indicator');
                
                // Start rotation for this specific product
                const rotateInterval = setInterval(() => {
                    currentIndex = (currentIndex + 1) % images.length;
                    
                    // Update image
                    if (img) {
                        img.src = images[currentIndex];
                    }
                    
                    // Update indicators
                    indicators.forEach((indicator, index) => {
                        indicator.classList.toggle('active', index === currentIndex);
                    });
                    
                    // Update current index in dataset
                    container.dataset.currentIndex = currentIndex;
                }, 3000); // Change every 3 seconds
                
                // Store interval ID for cleanup
                container.dataset.intervalId = rotateInterval;
            }
        });
    }

    stopImageRotation() {
        // Clear all rotation intervals
        const containers = document.querySelectorAll('.product-image-container[data-interval-id]');
        containers.forEach(container => {
            const intervalId = container.dataset.intervalId;
            if (intervalId) {
                clearInterval(parseInt(intervalId));
            }
        });
    }

    updateCartUI() {
        const cartCount = document.getElementById('cartCount');
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');

        if (cartCount) cartCount.textContent = this.getCartCount();
        
        if (cartItems) {
            if (this.cart.length === 0) {
                cartItems.innerHTML = '<p style="text-align: center; color: #999;">Your cart is empty</p>';
            } else {
                cartItems.innerHTML = this.cart.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-info">
                            <span class="cart-item-name">${item.name}</span>
                            <div class="cart-item-pricing">
                                ${item.originalPrice && item.originalPrice > item.price ? 
                                    `<span class="cart-item-original-price">₹${item.originalPrice}</span>
                                     <span class="cart-item-price">₹${item.price}</span>` :
                                    `<span class="cart-item-price">₹${item.price}</span>`
                                }
                            </div>
                        </div>
                        <div class="cart-item-quantity">
                            <button class="quantity-btn" onclick="store.updateQuantity(${item.productId}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn" onclick="store.updateQuantity(${item.productId}, 1)">+</button>
                            <button class="quantity-btn" onclick="store.removeFromCart(${item.productId})" style="margin-left: 10px; color: #f44336;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }

        if (cartTotal) cartTotal.textContent = this.getCartTotal();
    }

    // Product Modal
    openProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        this.currentProduct = product;
        const modal = document.getElementById('productModal');
        const modalMainImage = document.getElementById('modalMainImage');
        const modalTitle = document.getElementById('modalTitle');
        const modalPrice = document.getElementById('modalPrice');
        const modalDescription = document.getElementById('modalDescription');
        const modalStock = document.getElementById('modalStock');
        const thumbnailContainer = document.getElementById('thumbnailContainer');

        modalMainImage.src = product.images[0];
        modalTitle.textContent = product.name;
        modalPrice.textContent = product.price;
        modalDescription.textContent = product.description;
        modalStock.innerHTML = `<span class="product-stock ${this.getStockClass(product.stock)}">${this.getStockText(product.stock)}</span>`;

        thumbnailContainer.innerHTML = product.images.map((image, index) => `
            <img src="${image}" alt="Thumbnail ${index + 1}" class="thumbnail ${index === 0 ? 'active' : ''}" 
                 onclick="store.changeModalImage('${image}', this)">
        `).join('');

        modal.style.display = 'block';
    }

    changeModalImage(imageSrc, thumbnail) {
        const modalMainImage = document.getElementById('modalMainImage');
        modalMainImage.src = imageSrc;
        
        document.querySelectorAll('.thumbnail').forEach(thumb => thumb.classList.remove('active'));
        thumbnail.classList.add('active');
    }

    addToCartFromModal() {
        if (this.currentProduct) {
            this.addToCart(this.currentProduct.id);
            this.updateCartUI();
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Category filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Stop current image rotation before filtering
                this.stopImageRotation();
                
                this.currentFilter = e.target.dataset.category;
                this.renderProducts();
            });
        });

        // Modal close
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('productModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    // Utility Functions
    formatCategory(category) {
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getStockClass(stock) {
        if (stock === 0) return 'out-of-stock';
        if (stock <= 5) return 'low-stock';
        return 'in-stock';
    }

    getStockText(stock) {
        if (stock === 0) return 'Out of Stock';
        if (stock <= 5) return `Only ${stock} left`;
        return `${stock} in stock`;
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(45deg, #d4af37, #f4e4bc);
            color: #000;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-weight: bold;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    closeModal() {
        const modal = document.getElementById('productModal');
        modal.style.display = 'none';
        this.currentProduct = null;
    }

    scrollToProducts() {
        document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    }

    toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        cartSidebar.classList.toggle('active');
    }

    proceedToCheckout() {
        if (this.cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }
        window.location.href = 'checkout.html';
    }

    // Cleanup method
    cleanup() {
        this.stopImageRotation();
        this.stopHeroBackgroundRotation();
        this.stopModelRotation();
        if (this.heroBgObjectUrls && Array.isArray(this.heroBgObjectUrls)) {
            try { this.heroBgObjectUrls.forEach(u => {
                // Only revoke blob/object URLs; don't revoke normal URLs.
                if (typeof u === 'string' && u.startsWith('blob:')) URL.revokeObjectURL(u);
            }); } catch (e) {}
            this.heroBgObjectUrls = [];
        }
    }
    
    // Model Rotation
    startModelRotation() {
        const modelImages = document.querySelectorAll('.model-image');
        const modelCaption = document.getElementById('modelCaption');
        
        if (modelImages.length > 0 && modelCaption) {
            const captions = [
                'Style for Love',
                'The Party Edit', 
                'Elegant Jewelry Collection',
                'Luxury Jewelry Styles',
                'Timeless Jewelry Pieces'
            ];
            
            let currentModelIndex = 0;
            
            // Change model every 5 seconds
            this.modelRotationInterval = setInterval(() => {
                // Remove active class from all images
                modelImages.forEach(img => img.classList.remove('active'));
                
                // Add active class to current image
                modelImages[currentModelIndex].classList.add('active');
                
                // Update caption
                modelCaption.textContent = captions[currentModelIndex];
                
                // Move to next model
                currentModelIndex = (currentModelIndex + 1) % modelImages.length;
                
                console.log('Model changed to:', captions[currentModelIndex]);
            }, 5000);
        }
    }
    
    stopModelRotation() {
        if (this.modelRotationInterval) {
            clearInterval(this.modelRotationInterval);
            this.modelRotationInterval = null;
        }
    }
    
    // Hero Background Rotation
    startHeroBackgroundRotation() {
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            // If admin uploaded hero images, rotate through them every 5 seconds.
            if (this.heroBgObjectUrls && this.heroBgObjectUrls.length > 0) {
                if (this.heroBgObjectUrls.length > 1) {
                // Change background every 5 seconds
                this.heroBackgroundIndex = 0;
                this.heroBackgroundInterval = setInterval(() => {
                    this.heroBackgroundIndex = (this.heroBackgroundIndex + 1) % this.heroBgObjectUrls.length;
                    const url = this.heroBgObjectUrls[this.heroBackgroundIndex];
                    heroSection.style.backgroundImage = `url('${url}')`;
                    heroSection.style.backgroundSize = 'cover';
                    heroSection.style.backgroundPosition = 'center';
                    heroSection.style.backgroundRepeat = 'no-repeat';
                }, 5000);
                return;
                }
                // Exactly one image: keep it static.
                return;
            }

            // Otherwise, keep existing gradient rotation fallback.
            const backgrounds = [
                'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f0f4f8 100%)',
                'linear-gradient(135deg, #fff5f5 0%, #ffe0e6 50%, #f8d7da 100%)',
                'linear-gradient(135deg, #e8f5e8 0%, #fce4ec 50%, #d1f2eb 100%)',
                'linear-gradient(135deg, #f3e7fc 0%, #e0f2fe 50%, #dbeafe 100%)',
                'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)'
            ];

            this.heroBackgroundIndex = 0;
            this.heroBackgroundInterval = setInterval(() => {
                this.heroBackgroundIndex = (this.heroBackgroundIndex + 1) % backgrounds.length;
                heroSection.style.background = backgrounds[this.heroBackgroundIndex];
            }, 5000);

            heroSection.style.background = backgrounds[0];
        }
    }
    
    stopHeroBackgroundRotation() {
        if (this.heroBackgroundInterval) {
            clearInterval(this.heroBackgroundInterval);
            this.heroBackgroundInterval = null;
        }
    }
}

// Global functions for HTML onclick handlers
let store;
window.addEventListener('DOMContentLoaded', () => {
    store = new JewelryApp();
    
    // Make global functions available
    window.toggleCart = () => store.toggleCart();
    window.scrollToProducts = () => store.scrollToProducts();
    window.openProductModal = (id) => store.openProductModal(id);
    window.changeModalImage = (src, thumb) => store.changeModalImage(src, thumb);
    window.addToCartFromModal = () => store.addToCartFromModal();
    window.closeModal = () => store.closeModal();
    window.updateQuantity = (id, change) => store.updateQuantity(id, change);
    window.removeFromCart = (id) => store.removeFromCart(id);
    window.proceedToCheckout = () => store.proceedToCheckout();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        store.cleanup();
    });
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
