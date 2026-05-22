/**
 * ============================================================
 * KASIR UMKM — app.js
 * Complete POS Application Logic
 * Uses localStorage as database with cross-tab sync
 * ============================================================
 */

'use strict';

// ============================================================
// SECTION 1: CONSTANTS & UTILITIES
// ============================================================

const DB_PRODUCTS = 'umkm_products';
const DB_ORDERS   = 'umkm_orders';

/** IDR currency formatter */
const formatIDR = (num) => {
  const n = Number(num) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

/** Generate unique ID */
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Safely parse JSON from localStorage */
const dbGet = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

/** Write JSON to localStorage */
const dbSet = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

/** Default product images by category */
const defaultImages = {
  coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
  manis:  'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
  ringan: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=300&fit=crop',
  berat:  'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&h=300&fit=crop',
};

/** Default products (10 items) */
const DEFAULT_PRODUCTS = [
  { id: generateId(), name: 'Americano',       price: 22000, img: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&h=300&fit=crop', category: 'coffee' },
  { id: generateId(), name: 'Caffe Latte',     price: 28000, img: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=400&h=300&fit=crop', category: 'coffee' },
  { id: generateId(), name: 'Cappuccino',      price: 28000, img: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop', category: 'coffee' },
  { id: generateId(), name: 'Es Kopi Susu',    price: 24000, img: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop', category: 'coffee' },
  { id: generateId(), name: 'Matcha Latte',    price: 30000, img: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&h=300&fit=crop', category: 'manis' },
  { id: generateId(), name: 'Thai Tea',        price: 20000, img: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&h=300&fit=crop', category: 'manis' },
  { id: generateId(), name: 'Kentang Goreng',  price: 18000, img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop', category: 'ringan' },
  { id: generateId(), name: 'Roti Bakar',      price: 15000, img: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop', category: 'ringan' },
  { id: generateId(), name: 'Nasi Goreng',     price: 25000, img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop', category: 'berat' },
  { id: generateId(), name: 'Mie Goreng',      price: 23000, img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=300&fit=crop', category: 'berat' },
];

/** Initialize products if empty */
const initProducts = () => {
  const existing = dbGet(DB_PRODUCTS);
  if (!existing.length) {
    dbSet(DB_PRODUCTS, DEFAULT_PRODUCTS);
  }
};

/** Show toast notification */
const showToast = (type, title, msg) => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
};

/** Format date/time for display */
const formatTime = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};


// ============================================================
// SECTION 2: PAGE DETECTION & INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initProducts();

  // Detect which page we're on
  const isCashier = !!document.getElementById('productGrid');
  const isAdmin   = !!document.getElementById('loginScreen');

  if (isCashier) {
    CashierApp.init();
  }
  if (isAdmin) {
    AdminApp.init();
  }
});


// ============================================================
// SECTION 3: CASHIER APP (index.html)
// ============================================================

const CashierApp = (() => {
  let cart = [];           // Array of { product, qty }
  let activeCategory = 'semua';
  let searchQuery = '';

  // --- DOM references (resolved in init) ---
  let els = {};

  /** Resolve all DOM elements */
  const resolveDOM = () => {
    els = {
      productGrid:      document.getElementById('productGrid'),
      searchInput:      document.getElementById('searchInput'),
      categoryTabs:     document.getElementById('categoryTabs'),
      clockTime:        document.getElementById('clockTime'),
      clockDate:        document.getElementById('clockDate'),
      // Desktop cart
      cartItemsDesktop: document.getElementById('cartItemsDesktop'),
      cartEmptyDesktop: document.getElementById('cartEmptyDesktop'),
      cartCountBadge:   document.getElementById('cartCountBadge'),
      cartTotalDesktop: document.getElementById('cartTotalDesktop'),
      totalItems:       document.getElementById('totalItems'),
      totalTypes:       document.getElementById('totalTypes'),
      tableNumberDesktop: document.getElementById('tableNumberDesktop'),
      cartSummaryDesktop: document.getElementById('cartSummaryDesktop'),
      btnClearCart:      document.getElementById('btnClearCart'),
      btnCash:          document.getElementById('btnCash'),
      btnQris:          document.getElementById('btnQris'),
      // Mobile cart
      mobileCartToggle: document.getElementById('mobileCartToggle'),
      mobileCartCount:  document.getElementById('mobileCartCount'),
      mobileCartTotal:  document.getElementById('mobileCartTotal'),
      mobileCartBadge:  document.getElementById('mobileCartBadge'),
      mobileCartOverlay: document.getElementById('mobileCartOverlay'),
      mobileCartSlide:  document.getElementById('mobileCartSlide'),
      cartItemsMobile:  document.getElementById('cartItemsMobile'),
      cartTotalMobile:  document.getElementById('cartTotalMobile'),
      totalItemsMobile: document.getElementById('totalItemsMobile'),
      totalTypesMobile: document.getElementById('totalTypesMobile'),
      tableNumberMobile: document.getElementById('tableNumberMobile'),
      btnClearCartMobile: document.getElementById('btnClearCartMobile'),
      btnCashMobile:    document.getElementById('btnCashMobile'),
      btnQrisMobile:    document.getElementById('btnQrisMobile'),
      // Modals
      qrisModal:        document.getElementById('qrisModal'),
      qrisModalClose:   document.getElementById('qrisModalClose'),
      qrisAmount:       document.getElementById('qrisAmount'),
      qrisImage:        document.getElementById('qrisImage'),
      btnConfirmQris:   document.getElementById('btnConfirmQris'),
      successModal:     document.getElementById('successModal'),
      successOrderId:   document.getElementById('successOrderId'),
      successTable:     document.getElementById('successTable'),
      successMethod:    document.getElementById('successMethod'),
      successTotal:     document.getElementById('successTotal'),
      btnCloseSuccess:  document.getElementById('btnCloseSuccess'),
    };
  };

  // --- Clock ---
  const updateClock = () => {
    const now = new Date();
    if (els.clockTime) {
      els.clockTime.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (els.clockDate) {
      els.clockDate.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // --- Product Rendering ---
  const getFilteredProducts = () => {
    let products = dbGet(DB_PRODUCTS);
    if (activeCategory !== 'semua') {
      products = products.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(p => p.name.toLowerCase().includes(q));
    }
    return products;
  };

  const getCartQty = (productId) => {
    const entry = cart.find(c => c.product.id === productId);
    return entry ? entry.qty : 0;
  };

  const renderProducts = () => {
    const products = getFilteredProducts();
    if (!els.productGrid) return;

    if (!products.length) {
      els.productGrid.innerHTML = `
        <div class="product-grid-empty">
          <div class="empty-icon">🔍</div>
          <p>Tidak ada menu yang ditemukan</p>
        </div>
      `;
      return;
    }

    els.productGrid.innerHTML = products.map(p => {
      const inCartQty = getCartQty(p.id);
      const imgSrc = p.img || defaultImages[p.category] || defaultImages.coffee;
      return `
        <div class="product-card" data-id="${p.id}">
          <div class="product-img-wrap">
            <img src="${imgSrc}" alt="${p.name}" loading="lazy"
                 onerror="this.src='${defaultImages[p.category] || defaultImages.coffee}'" />
            ${inCartQty > 0 ? `<div class="in-cart-badge">${inCartQty}</div>` : ''}
          </div>
          <div class="product-info">
            <div>
              <div class="product-name">${p.name}</div>
              <div class="product-category">${p.category}</div>
            </div>
            <div class="product-price">${formatIDR(p.price)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events
    els.productGrid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        addToCart(id);
      });
    });
  };

  // --- Cart Logic ---
  const addToCart = (productId) => {
    const products = dbGet(DB_PRODUCTS);
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(c => c.product.id === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ product: { ...product }, qty: 1 });
    }
    renderCart();
    renderProducts(); // update in-cart badges
  };

  const removeFromCart = (productId) => {
    cart = cart.filter(c => c.product.id !== productId);
    renderCart();
    renderProducts();
  };

  const updateQty = (productId, delta) => {
    const entry = cart.find(c => c.product.id === productId);
    if (!entry) return;
    entry.qty += delta;
    if (entry.qty <= 0) {
      removeFromCart(productId);
      return;
    }
    renderCart();
    renderProducts();
  };

  const clearCart = () => {
    cart = [];
    renderCart();
    renderProducts();
  };

  const getCartTotal = () => cart.reduce((sum, c) => sum + (Number(c.product.price) || 0) * c.qty, 0);
  const getCartItemCount = () => cart.reduce((sum, c) => sum + c.qty, 0);

  const renderCartItemsHTML = () => {
    if (!cart.length) {
      return `
        <div class="cart-empty">
          <div class="empty-icon">🛒</div>
          <p>Keranjang masih kosong</p>
          <p style="font-size:0.75rem; margin-top:4px;">Klik menu untuk menambahkan</p>
        </div>
      `;
    }

    return cart.map(c => {
      const imgSrc = c.product.img || defaultImages[c.product.category] || defaultImages.coffee;
      const subtotal = (Number(c.product.price) || 0) * c.qty;
      return `
        <div class="cart-item">
          <img class="cart-item-img" src="${imgSrc}" alt="${c.product.name}"
               onerror="this.src='${defaultImages[c.product.category] || defaultImages.coffee}'" />
          <div class="cart-item-details">
            <div class="cart-item-name">${c.product.name}</div>
            <div class="cart-item-price">${formatIDR(c.product.price)}</div>
            <div class="cart-item-subtotal">${formatIDR(subtotal)}</div>
          </div>
          <div class="cart-qty-controls">
            <button class="cart-qty-btn ${c.qty <= 1 ? 'remove' : ''}" data-action="minus" data-id="${c.product.id}">${c.qty <= 1 ? '🗑' : '−'}</button>
            <span class="cart-qty-val">${c.qty}</span>
            <button class="cart-qty-btn" data-action="plus" data-id="${c.product.id}">+</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const attachCartEvents = (container) => {
    if (!container) return;
    container.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'plus') updateQty(id, 1);
        else if (action === 'minus') updateQty(id, -1);
      });
    });
  };

  const renderCart = () => {
    const total = getCartTotal();
    const itemCount = getCartItemCount();
    const typeCount = cart.length;
    const html = renderCartItemsHTML();

    // Desktop
    if (els.cartItemsDesktop) {
      els.cartItemsDesktop.innerHTML = html;
      attachCartEvents(els.cartItemsDesktop);
    }
    if (els.cartCountBadge) els.cartCountBadge.textContent = itemCount;
    if (els.cartTotalDesktop) els.cartTotalDesktop.textContent = formatIDR(total);
    if (els.totalItems) els.totalItems.textContent = itemCount;
    if (els.totalTypes) els.totalTypes.textContent = typeCount;

    // Mobile
    if (els.cartItemsMobile) {
      els.cartItemsMobile.innerHTML = html;
      attachCartEvents(els.cartItemsMobile);
    }
    if (els.mobileCartCount) els.mobileCartCount.textContent = itemCount;
    if (els.mobileCartTotal) els.mobileCartTotal.textContent = formatIDR(total);
    if (els.mobileCartBadge) els.mobileCartBadge.textContent = itemCount;
    if (els.cartTotalMobile) els.cartTotalMobile.textContent = formatIDR(total);
    if (els.totalItemsMobile) els.totalItemsMobile.textContent = itemCount;
    if (els.totalTypesMobile) els.totalTypesMobile.textContent = typeCount;
  };

  // --- Mobile Cart Slide ---
  const openMobileCart = () => {
    els.mobileCartOverlay?.classList.add('active');
    els.mobileCartSlide?.classList.add('active');
  };

  const closeMobileCart = () => {
    els.mobileCartOverlay?.classList.remove('active');
    els.mobileCartSlide?.classList.remove('active');
  };

  // --- Checkout ---
  const getTableNumber = () => {
    const desktopVal = els.tableNumberDesktop?.value;
    const mobileVal  = els.tableNumberMobile?.value;
    const val = desktopVal || mobileVal || '';
    return val.trim();
  };

  const setTableNumber = (val) => {
    if (els.tableNumberDesktop) els.tableNumberDesktop.value = val;
    if (els.tableNumberMobile)  els.tableNumberMobile.value  = val;
  };

  const createOrder = (metode, status) => {
    if (!cart.length) {
      showToast('error', 'Keranjang Kosong', 'Tambahkan menu terlebih dahulu.');
      return null;
    }
    const meja = getTableNumber();
    if (!meja) {
      showToast('error', 'Nomor Meja Kosong', 'Masukkan nomor meja sebelum checkout.');
      return null;
    }

    const now = new Date();
    const order = {
      id: generateId(),
      waktu: now.toISOString(),
      waktuMs: now.getTime(),
      meja: meja,
      items: cart.map(c => ({
        id: c.product.id,
        name: c.product.name,
        price: Number(c.product.price) || 0,
        qty: c.qty,
        subtotal: (Number(c.product.price) || 0) * c.qty,
      })),
      total: getCartTotal(),
      metode: metode,
      status: status,
    };

    const orders = dbGet(DB_ORDERS);
    orders.push(order);
    dbSet(DB_ORDERS, orders);

    return order;
  };

  const handleCashCheckout = () => {
    const order = createOrder('cash', 'menunggu_pembayaran');
    if (!order) return;
    closeMobileCart();
    showSuccessModal(order);
    resetAfterCheckout();
  };

  const handleQrisCheckout = () => {
    if (!cart.length) {
      showToast('error', 'Keranjang Kosong', 'Tambahkan menu terlebih dahulu.');
      return;
    }
    const meja = getTableNumber();
    if (!meja) {
      showToast('error', 'Nomor Meja Kosong', 'Masukkan nomor meja sebelum checkout.');
      return;
    }
    closeMobileCart();
    openQrisModal();
  };

  const openQrisModal = () => {
    const total = getCartTotal();
    if (els.qrisAmount) els.qrisAmount.textContent = formatIDR(total);
    // Generate QR code from api.qrserver.com
    const qrData = encodeURIComponent(`KASIR-UMKM|TOTAL:${total}|TIME:${Date.now()}`);
    if (els.qrisImage) {
      els.qrisImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
    }
    els.qrisModal?.classList.add('active');
  };

  const closeQrisModal = () => {
    els.qrisModal?.classList.remove('active');
  };

  const confirmQris = () => {
    const order = createOrder('qris', 'pending');
    if (!order) return;
    closeQrisModal();
    showSuccessModal(order);
    resetAfterCheckout();
  };

  const showSuccessModal = (order) => {
    if (els.successOrderId) els.successOrderId.textContent = `ID: #${order.id.toUpperCase()}`;
    if (els.successTable)   els.successTable.textContent   = `Meja: ${order.meja}`;
    if (els.successMethod)  els.successMethod.textContent  = `Pembayaran: ${order.metode === 'cash' ? 'Tunai' : 'QRIS'}`;
    if (els.successTotal)   els.successTotal.textContent   = formatIDR(order.total);
    els.successModal?.classList.add('active');
  };

  const closeSuccessModal = () => {
    els.successModal?.classList.remove('active');
  };

  const resetAfterCheckout = () => {
    cart = [];
    setTableNumber('');
    renderCart();
    renderProducts();
  };

  // --- Category Tabs ---
  const setupCategoryTabs = () => {
    els.categoryTabs?.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      els.categoryTabs.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      renderProducts();
    });
  };

  // --- Search ---
  const setupSearch = () => {
    els.searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  };

  // --- Cross-tab sync ---
  const setupStorageSync = () => {
    window.addEventListener('storage', (e) => {
      if (e.key === DB_PRODUCTS) {
        renderProducts();
      }
    });
  };

  // --- Sync table number between desktop and mobile ---
  const setupTableSync = () => {
    els.tableNumberDesktop?.addEventListener('input', () => {
      if (els.tableNumberMobile) els.tableNumberMobile.value = els.tableNumberDesktop.value;
    });
    els.tableNumberMobile?.addEventListener('input', () => {
      if (els.tableNumberDesktop) els.tableNumberDesktop.value = els.tableNumberMobile.value;
    });
  };

  // --- INIT ---
  const init = () => {
    resolveDOM();

    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Render
    renderProducts();
    renderCart();

    // Category & Search
    setupCategoryTabs();
    setupSearch();

    // Cart actions
    els.btnClearCart?.addEventListener('click', clearCart);
    els.btnClearCartMobile?.addEventListener('click', clearCart);

    // Mobile cart toggle
    els.mobileCartToggle?.addEventListener('click', openMobileCart);
    els.mobileCartOverlay?.addEventListener('click', closeMobileCart);

    // Checkout
    els.btnCash?.addEventListener('click', handleCashCheckout);
    els.btnCashMobile?.addEventListener('click', handleCashCheckout);
    els.btnQris?.addEventListener('click', handleQrisCheckout);
    els.btnQrisMobile?.addEventListener('click', handleQrisCheckout);

    // QRIS modal
    els.qrisModalClose?.addEventListener('click', closeQrisModal);
    els.btnConfirmQris?.addEventListener('click', confirmQris);

    // Success modal
    els.btnCloseSuccess?.addEventListener('click', closeSuccessModal);

    // Table number sync
    setupTableSync();

    // Cross-tab sync
    setupStorageSync();
  };

  return { init };
})();


// ============================================================
// SECTION 4: ADMIN APP (admin.html)
// ============================================================

const AdminApp = (() => {
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = 'password';
  const SESSION_KEY = 'umkm_admin_logged_in';

  let deleteTargetId = null;
  let previousOrderCount = 0;

  // --- DOM references ---
  let els = {};

  const resolveDOM = () => {
    els = {
      loginScreen:    document.getElementById('loginScreen'),
      adminDashboard: document.getElementById('adminDashboard'),
      loginForm:      document.getElementById('loginForm'),
      loginUser:      document.getElementById('loginUser'),
      loginPass:      document.getElementById('loginPass'),
      loginError:     document.getElementById('loginError'),
      btnLogout:      document.getElementById('btnLogout'),
      adminTabs:      document.getElementById('adminTabs'),
      liveOrderCount: document.getElementById('liveOrderCount'),
      kitchenBadge:   document.getElementById('kitchenBadge'),
      // Kitchen
      kitchenGrid:    document.getElementById('kitchenGrid'),
      kitchenEmpty:   document.getElementById('kitchenEmpty'),
      // Menu CRUD
      menuTableBody:  document.getElementById('menuTableBody'),
      btnAddMenu:     document.getElementById('btnAddMenu'),
      menuModal:      document.getElementById('menuModal'),
      menuModalClose: document.getElementById('menuModalClose'),
      menuModalTitle: document.getElementById('menuModalTitle'),
      menuForm:       document.getElementById('menuForm'),
      menuEditId:     document.getElementById('menuEditId'),
      menuName:       document.getElementById('menuName'),
      menuPrice:      document.getElementById('menuPrice'),
      menuCategory:   document.getElementById('menuCategory'),
      menuImg:        document.getElementById('menuImg'),
      menuFormCancel: document.getElementById('menuFormCancel'),
      // Delete modal
      deleteModal:    document.getElementById('deleteModal'),
      deleteModalClose: document.getElementById('deleteModalClose'),
      deleteMenuName: document.getElementById('deleteMenuName'),
      deleteCancelBtn: document.getElementById('deleteCancelBtn'),
      deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),
      // Report
      reportRevenue:  document.getElementById('reportRevenue'),
      reportCount:    document.getElementById('reportCount'),
      reportTableBody: document.getElementById('reportTableBody'),
    };
  };

  // --- Auth ---
  const isLoggedIn = () => sessionStorage.getItem(SESSION_KEY) === 'true';

  const login = (user, pass) => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  };

  const showLoginScreen = () => {
    if (els.loginScreen) els.loginScreen.style.display = 'flex';
    if (els.adminDashboard) els.adminDashboard.style.display = 'none';
  };

  const showDashboard = () => {
    if (els.loginScreen) els.loginScreen.style.display = 'none';
    if (els.adminDashboard) els.adminDashboard.style.display = 'flex';
    refreshAll();
  };

  // --- Tab Navigation ---
  const setupTabs = () => {
    els.adminTabs?.addEventListener('click', (e) => {
      const tab = e.target.closest('.admin-tab');
      if (!tab) return;
      const tabName = tab.dataset.tab;

      // Update active tab
      els.adminTabs.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show panel
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (panel) panel.classList.add('active');

      // Refresh content
      if (tabName === 'kitchen') renderKitchen();
      if (tabName === 'menu') renderMenuTable();
      if (tabName === 'report') renderReport();
    });
  };

  // --- Kitchen Display ---
  const getActiveOrders = () => {
    const orders = dbGet(DB_ORDERS);
    return orders.filter(o => o.status === 'menunggu_pembayaran' || o.status === 'pending')
                 .sort((a, b) => (a.waktuMs || 0) - (b.waktuMs || 0));
  };

  const renderKitchen = () => {
    const activeOrders = getActiveOrders();

    // Update live count
    if (els.liveOrderCount) els.liveOrderCount.textContent = activeOrders.length;
    if (els.kitchenBadge) {
      if (activeOrders.length > 0) {
        els.kitchenBadge.style.display = 'inline';
        els.kitchenBadge.textContent = activeOrders.length;
      } else {
        els.kitchenBadge.style.display = 'none';
      }
    }

    if (!activeOrders.length) {
      if (els.kitchenGrid) els.kitchenGrid.innerHTML = '';
      if (els.kitchenEmpty) els.kitchenEmpty.style.display = 'block';
      return;
    }

    if (els.kitchenEmpty) els.kitchenEmpty.style.display = 'none';
    if (!els.kitchenGrid) return;

    els.kitchenGrid.innerHTML = activeOrders.map(order => {
      const statusBadge = order.status === 'menunggu_pembayaran'
        ? '<span class="badge badge-warning">💵 Menunggu Bayar</span>'
        : '<span class="badge badge-info">📱 QRIS Dibayar</span>';

      const actionBtn = order.status === 'menunggu_pembayaran'
        ? `<button class="btn btn-accent btn-sm kitchen-action" data-id="${order.id}" data-action="confirm_cash">💵 Terima Uang & Konfirmasi</button>`
        : `<button class="btn btn-success btn-sm kitchen-action" data-id="${order.id}" data-action="complete">✅ Tandai Selesai & Antar</button>`;

      const itemsHTML = (order.items || []).map(item => `
        <div class="kitchen-item-row">
          <div class="kitchen-item-name">
            <span class="kitchen-item-qty">${item.qty}x</span>
            ${item.name}
          </div>
          <span class="kitchen-item-subtotal">${formatIDR(item.subtotal || (item.price * item.qty))}</span>
        </div>
      `).join('');

      return `
        <div class="kitchen-card">
          <div class="kitchen-card-header">
            <div class="table-info">
              <div class="table-icon">${order.meja}</div>
              <div>
                <div class="table-label">Meja ${order.meja}</div>
                <div class="table-time">${formatTime(order.waktu)} · #${order.id.slice(0, 6).toUpperCase()}</div>
              </div>
            </div>
            ${statusBadge}
          </div>
          <div class="kitchen-items">${itemsHTML}</div>
          <div class="kitchen-card-footer">
            <span style="font-weight:700; color:var(--accent); font-family:var(--font-heading);">${formatIDR(order.total)}</span>
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');

    // Attach kitchen action events
    els.kitchenGrid.querySelectorAll('.kitchen-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.dataset.id;
        const action  = btn.dataset.action;
        handleKitchenAction(orderId, action);
      });
    });
  };

  const handleKitchenAction = (orderId, action) => {
    const orders = dbGet(DB_ORDERS);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;

    if (action === 'confirm_cash') {
      orders[idx].status = 'pending';
      showToast('success', 'Pembayaran Diterima', `Pesanan Meja ${orders[idx].meja} dikonfirmasi.`);
    } else if (action === 'complete') {
      orders[idx].status = 'completed';
      showToast('success', 'Pesanan Selesai', `Pesanan Meja ${orders[idx].meja} siap diantar!`);
    }

    dbSet(DB_ORDERS, orders);
    renderKitchen();
    renderReport();
  };

  // --- Menu CRUD ---
  const renderMenuTable = () => {
    const products = dbGet(DB_PRODUCTS);
    if (!els.menuTableBody) return;

    if (!products.length) {
      els.menuTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:40px;">Belum ada menu</td></tr>`;
      return;
    }

    els.menuTableBody.innerHTML = products.map(p => {
      const imgSrc = p.img || defaultImages[p.category] || defaultImages.coffee;
      return `
        <tr>
          <td><img class="table-img" src="${imgSrc}" alt="${p.name}" onerror="this.src='${defaultImages[p.category] || defaultImages.coffee}'" /></td>
          <td style="font-weight:600;">${p.name}</td>
          <td><span class="badge badge-accent">${p.category}</span></td>
          <td>${formatIDR(p.price)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-outline btn-sm menu-edit-btn" data-id="${p.id}">✏️ Edit</button>
              <button class="btn btn-danger btn-sm menu-delete-btn" data-id="${p.id}" data-name="${p.name}">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Edit buttons
    els.menuTableBody.querySelectorAll('.menu-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openMenuModal(btn.dataset.id));
    });

    // Delete buttons
    els.menuTableBody.querySelectorAll('.menu-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name));
    });
  };

  const openMenuModal = (editId = null) => {
    if (editId) {
      // Editing
      const products = dbGet(DB_PRODUCTS);
      const product = products.find(p => p.id === editId);
      if (!product) return;
      if (els.menuModalTitle) els.menuModalTitle.textContent = 'Edit Menu';
      if (els.menuEditId)     els.menuEditId.value     = product.id;
      if (els.menuName)       els.menuName.value       = product.name;
      if (els.menuPrice)      els.menuPrice.value      = product.price;
      if (els.menuCategory)   els.menuCategory.value   = product.category;
      if (els.menuImg)        els.menuImg.value        = product.img || '';
    } else {
      // Adding
      if (els.menuModalTitle) els.menuModalTitle.textContent = 'Tambah Menu';
      if (els.menuEditId)     els.menuEditId.value     = '';
      els.menuForm?.reset();
    }
    els.menuModal?.classList.add('active');
  };

  const closeMenuModal = () => {
    els.menuModal?.classList.remove('active');
    els.menuForm?.reset();
  };

  const handleMenuSubmit = (e) => {
    e.preventDefault();

    const editId   = els.menuEditId?.value || '';
    const name     = els.menuName?.value?.trim() || '';
    const price    = parseInt(els.menuPrice?.value, 10);
    const category = els.menuCategory?.value || '';
    const img      = els.menuImg?.value?.trim() || '';

    if (!name || isNaN(price) || price < 0 || !category) {
      showToast('error', 'Data Tidak Valid', 'Lengkapi semua field yang diperlukan.');
      return;
    }

    const products = dbGet(DB_PRODUCTS);

    if (editId) {
      // Update existing
      const idx = products.findIndex(p => p.id === editId);
      if (idx !== -1) {
        products[idx].name     = name;
        products[idx].price    = price;
        products[idx].category = category;
        products[idx].img      = img;
        showToast('success', 'Menu Diperbarui', `"${name}" berhasil diubah.`);
      }
    } else {
      // Add new
      products.push({
        id: generateId(),
        name,
        price,
        img,
        category,
      });
      showToast('success', 'Menu Ditambahkan', `"${name}" berhasil ditambah.`);
    }

    dbSet(DB_PRODUCTS, products);
    closeMenuModal();
    renderMenuTable();
  };

  // --- Delete Modal ---
  const openDeleteModal = (id, name) => {
    deleteTargetId = id;
    if (els.deleteMenuName) els.deleteMenuName.textContent = name;
    els.deleteModal?.classList.add('active');
  };

  const closeDeleteModal = () => {
    els.deleteModal?.classList.remove('active');
    deleteTargetId = null;
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    let products = dbGet(DB_PRODUCTS);
    const target = products.find(p => p.id === deleteTargetId);
    products = products.filter(p => p.id !== deleteTargetId);
    dbSet(DB_PRODUCTS, products);
    showToast('success', 'Menu Dihapus', target ? `"${target.name}" dihapus.` : 'Menu dihapus.');
    closeDeleteModal();
    renderMenuTable();
  };

  // --- Report ---
  const renderReport = () => {
    const orders = dbGet(DB_ORDERS);
    const completed = orders.filter(o => o.status === 'completed');

    const totalRevenue = completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    if (els.reportRevenue) els.reportRevenue.textContent = formatIDR(totalRevenue);
    if (els.reportCount)   els.reportCount.textContent   = completed.length;

    if (!els.reportTableBody) return;

    if (!completed.length) {
      els.reportTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:40px;">Belum ada pesanan selesai</td></tr>`;
      return;
    }

    // Sort newest first
    const sorted = [...completed].sort((a, b) => (b.waktuMs || 0) - (a.waktuMs || 0));

    els.reportTableBody.innerHTML = sorted.map(o => `
      <tr>
        <td>${formatDateTime(o.waktu)}</td>
        <td style="font-weight:600;">#${o.id.slice(0, 8).toUpperCase()}</td>
        <td>Meja ${o.meja}</td>
        <td><span class="badge ${o.metode === 'cash' ? 'badge-warning' : 'badge-info'}">${o.metode === 'cash' ? '💵 Tunai' : '📱 QRIS'}</span></td>
        <td style="font-weight:700; color:var(--accent);">${formatIDR(o.total)}</td>
      </tr>
    `).join('');
  };

  // --- Refresh all views ---
  const refreshAll = () => {
    renderKitchen();
    renderMenuTable();
    renderReport();
  };

  // --- Cross-tab sync (detect new orders) ---
  const setupStorageSync = () => {
    window.addEventListener('storage', (e) => {
      if (e.key === DB_ORDERS) {
        const newActiveOrders = getActiveOrders();
        if (newActiveOrders.length > previousOrderCount) {
          const newest = newActiveOrders[newActiveOrders.length - 1];
          showToast('info', '🔔 Pesanan Baru!', `Meja ${newest?.meja || '?'} — ${formatIDR(newest?.total || 0)}`);
        }
        previousOrderCount = newActiveOrders.length;
        renderKitchen();
        renderReport();
      }
      if (e.key === DB_PRODUCTS) {
        renderMenuTable();
      }
    });
  };

  // --- Auto-refresh kitchen every 5 seconds ---
  const setupAutoRefresh = () => {
    setInterval(() => {
      if (isLoggedIn()) {
        renderKitchen();
      }
    }, 5000);
  };

  // --- INIT ---
  const init = () => {
    resolveDOM();

    // Check session
    if (isLoggedIn()) {
      showDashboard();
    } else {
      showLoginScreen();
    }

    // Initialize previous order count
    previousOrderCount = getActiveOrders().length;

    // Login form
    els.loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = els.loginUser?.value?.trim() || '';
      const pass = els.loginPass?.value || '';
      if (login(user, pass)) {
        els.loginError?.classList.remove('visible');
        showDashboard();
      } else {
        els.loginError?.classList.add('visible');
      }
    });

    // Logout
    els.btnLogout?.addEventListener('click', logout);

    // Tabs
    setupTabs();

    // Menu CRUD
    els.btnAddMenu?.addEventListener('click', () => openMenuModal());
    els.menuModalClose?.addEventListener('click', closeMenuModal);
    els.menuFormCancel?.addEventListener('click', closeMenuModal);
    els.menuForm?.addEventListener('submit', handleMenuSubmit);

    // Delete modal
    els.deleteModalClose?.addEventListener('click', closeDeleteModal);
    els.deleteCancelBtn?.addEventListener('click', closeDeleteModal);
    els.deleteConfirmBtn?.addEventListener('click', confirmDelete);

    // Cross-tab sync
    setupStorageSync();

    // Auto-refresh
    setupAutoRefresh();
  };

  return { init };
})();
