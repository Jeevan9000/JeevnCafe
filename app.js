
/* 
   SECTION 1: AUTH MODULE
   Handles register, login, logout, sessions.
   Users are stored as JSON in localStorage.
   Passwords are encoded (not plain text).
    */

const Auth = (() => {


  const USERS_KEY = 'brewnara_users';
  const SESSION_KEY = 'brewnara_session';

  // Read all registered users from storage
  function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  }

  // Save updated users array back to storage
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // Simple password encoding using btoa (base64) + a salt
  // In production this would be bcrypt on a server — but this
  // demonstrates why we never store plain text passwords
  function encodePassword(pw) {
    return btoa(pw + '__brewnara2026__');
  }

  // Register a new user
  function register(name, email, password) {
    const users = getUsers();


    const alreadyExists = users.find(u => u.email === email);
    if (alreadyExists) {
      return { success: false, message: 'This email is already registered.' };
    }


    const newUser = {
      id: Date.now(),           // unique ID using timestamp
      name: name,
      email: email,
      password: encodePassword(password),
      joinedAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true, user: { id: newUser.id, name, email } };
  }

  // Login with email + password
  function login(email, password) {
    const users = getUsers();

    // Find matching user
    const match = users.find(
      u => u.email === email && u.password === encodePassword(password)
    );

    if (!match) {
      return { success: false, message: 'Incorrect email or password.' };
    }

    // Save session (we only store non-sensitive info)
    const session = { id: match.id, name: match.name, email: match.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return { success: true, user: session };
  }

  // Logout — clear session and cart
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    Cart.clear();
    updateNavUI();
    showToast('Logged out. See you soon! ☕');
  }

  // Get the current logged-in user (or null)
  function getSession() {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  }

  // Quick check if someone is logged in
  function isLoggedIn() {
    return !!getSession();
  }

  return { register, login, logout, getSession, isLoggedIn };

})();


/* 
   SECTION 2: CART MODULE
   Stores cart items in localStorage.
   Each item: { id, name, price, qty, image }
    */

const Cart = (() => {

  const CART_KEY = 'brewnara_cart';

  function getItems() {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  }

  function saveItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  // Add item — if already in cart, open the cart drawer instead of adding again
  function addItem(id, name, price, image) {
    const items = getItems();
    const existing = items.find(i => i.id === id);

    if (existing) {
      // Item already in cart — just open the drawer so user can manage it
      toggleCart();
      return;
    }

    items.push({ id, name, price, qty: 1, image: image || '' });
    saveItems(items);
    renderCart();
    updateAddButtons();
    showToast(name + ' added to cart!');
  }

  // Remove an item completely
  function removeItem(id) {
    const updated = getItems().filter(i => i.id !== id);
    saveItems(updated);
    renderCart();
    updateAddButtons();
  }

  // Increase or decrease quantity by delta (+1 or -1)
  function updateQty(id, delta) {
    const items = getItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
      removeItem(id);
      return;
    }

    saveItems(items);
    renderCart();
  }

  // Wipe the entire cart
  function clear() {
    localStorage.removeItem(CART_KEY);
    renderCart();
    updateAddButtons();
  }

  // Sum of all prices × quantities
  function getTotal() {
    return getItems().reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  // Total number of individual items
  function getCount() {
    return getItems().reduce((sum, i) => sum + i.qty, 0);
  }

  return { addItem, removeItem, updateQty, clear, getItems, getTotal, getCount };

})();


/* 
   SECTION 3: WEATHER MODULE
   Modern location picker.
  
    */

const Weather = (() => {

  const CACHE_KEY = 'brewnara_weather_cache';
  const CITY_KEY = 'brewnara_user_city';
  const TTL = 30 * 60 * 1000;

  function getSavedCity() {
    const city = localStorage.getItem(CITY_KEY);
    return (city && city.trim().length > 0) ? city.trim() : null;
  }

  function saveCity(city) {
    const trimmed = (city || '').trim();
    if (trimmed.length > 0) {
      localStorage.setItem(CITY_KEY, trimmed);
    }
  }

  async function fetchWeather(city) {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.city === city && (Date.now() - cached.timestamp) < TTL) {
      return cached.data;
    }
    try {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('City not found');
      const data = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ city, data, timestamp: Date.now() }));
      return data;
    } catch (err) {
      console.warn('Weather fetch failed:', err.message);
      return null;
    }
  }

  function buildWeatherHTML(data, city) {
    try {
      const current = data.current_condition[0];
      const temp = current.temp_C;
      const feels = current.FeelsLikeC;
      const desc = current.weatherDesc[0].value;
      const code = parseInt(current.weatherCode);
      let emoji = '🌡️';
      if (code === 113) emoji = '☀️';
      else if (code === 116) emoji = '⛅';
      else if ([119, 122].includes(code)) emoji = '☁️';
      else if ([143, 248, 260].includes(code)) emoji = '🌫️';
      else if (code >= 263 && code <= 314) emoji = '🌧️';
      else if ([200, 386, 389].includes(code)) emoji = '⛈️';
      else if (code >= 227) emoji = '❄️';
      return `
        <span class="weather-emoji">${emoji}</span>
        <span class="weather-temp">${temp}°C</span>
        <span class="weather-desc">${desc}</span>
        <button class="weather-change-btn" onclick="Weather.showPicker()" title="Change location">📍 ${city} ▾</button>
      `;
    } catch (e) {
      return '<span>🌐 Error</span>';
    }
  }

  async function render() {
    const el = document.getElementById('weather-widget');
    if (!el) return;

    const saved = getSavedCity();

    if (!saved) {
      el.innerHTML = '<button class="weather-set-btn" onclick="Weather.showPicker()">📍 Set location</button>';
      return;
    }

    el.innerHTML = '<span class="weather-loading">⏳</span>';
    const data = await fetchWeather(saved);
    el.innerHTML = data ? buildWeatherHTML(data, saved) : '<span>🌐 Unavailable</span>';
  }

  function showPicker() {
    // Remove existing picker if any
    const existing = document.getElementById('location-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = 'location-picker';
    picker.className = 'location-picker';
    picker.innerHTML = `
      <div class="location-picker__backdrop" onclick="Weather.closePicker()"></div>
      <div class="location-picker__panel">
        <div class="location-picker__header">
          <span class="location-picker__title">📍 Set your location</span>
          <button class="location-picker__close" onclick="Weather.closePicker()">✕</button>
        </div>

        <button class="location-picker__detect-btn" onclick="Weather.detectLocation()">
          <span class="location-picker__detect-icon">🎯</span>
          <div>
            <strong>Detect my location</strong>
            <span>Using GPS</span>
          </div>
          <span class="location-picker__arrow">›</span>
        </button>

        <div class="location-picker__divider"><span>or enter manually</span></div>

        <div class="location-picker__search-wrap">
          <input
            id="location-picker-input"
            class="location-picker__input"
            type="text"
            placeholder="Search city, e.g. Hyderabad"
            autocomplete="off"
          />
          <button class="location-picker__search-btn" onclick="Weather.submitCity()">Search</button>
        </div>

        <div class="location-picker__quick-label">Popular cities</div>
        <div class="location-picker__quick-cities">
          ${['Hyderabad', 'Bengaluru', 'Mumbai', 'Chennai', 'Delhi', 'Pune', 'Kolkata', 'Warangal'].map(c =>
      `<button class="location-picker__city-chip" onclick="Weather.setCity('${c}')">${c}</button>`
    ).join('')}
        </div>
        <p id="location-picker-error" class="location-picker__error"></p>
      </div>
    `;

    document.body.appendChild(picker);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => picker.querySelector('.location-picker__panel').classList.add('location-picker__panel--open'));
    });

    // Allow Enter key to submit
    setTimeout(() => {
      const input = document.getElementById('location-picker-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', e => { if (e.key === 'Enter') Weather.submitCity(); });
      }
    }, 300);
  }

  function closePicker() {
    const picker = document.getElementById('location-picker');
    if (!picker) return;
    const panel = picker.querySelector('.location-picker__panel');
    if (panel) panel.classList.remove('location-picker__panel--open');
    setTimeout(() => picker.remove(), 300);
  }

  async function setCity(city) {
    saveCity(city);
    localStorage.removeItem(CACHE_KEY);
    closePicker();
    const el = document.getElementById('weather-widget');
    if (el) el.innerHTML = '<span class="weather-loading">⏳ Loading…</span>';
    const data = await fetchWeather(city);
    if (el) el.innerHTML = data ? buildWeatherHTML(data, city) : '<span>🌐 Unavailable</span>';
  }

  async function submitCity() {
    const input = document.getElementById('location-picker-input');
    const errEl = document.getElementById('location-picker-error');
    if (!input || !input.value.trim()) {
      if (errEl) errEl.textContent = 'Please enter a city name.';
      return;
    }
    await setCity(input.value.trim());
  }

  function detectLocation() {
    const errEl = document.getElementById('location-picker-error');
    if (!navigator.geolocation) {
      if (errEl) errEl.textContent = 'Geolocation not supported by your browser.';
      return;
    }
    const detectBtn = document.querySelector('.location-picker__detect-btn');
    if (detectBtn) detectBtn.innerHTML = '<span>⏳</span><div><strong>Detecting…</strong><span>Please allow access</span></div>';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const json = await res.json();
          const city = json.address.city
                    || json.address.town
                    || json.address.village
                    || json.address.county
                    || json.address.state
                    || '';
          if (city && city.trim().length > 0) {
            await setCity(city.trim());
          } else {
            await setCity(`${latitude.toFixed(4)},${longitude.toFixed(4)}`);
          }
        } catch {
          await setCity(`${latitude.toFixed(4)},${longitude.toFixed(4)}`);
        }
      },
      () => {
        if (errEl) errEl.textContent = 'Could not detect location. Please enter manually.';
        if (detectBtn) detectBtn.innerHTML = `<span class="location-picker__detect-icon">🎯</span><div><strong>Detect my location</strong><span>Using GPS</span></div><span class="location-picker__arrow">›</span>`;
      }
    );
  }

  return { render, showPicker, closePicker, setCity, submitCity, detectLocation };

})();


/* 
   SECTION 4: DOM RENDERING
   These functions update the page whenever
   cart or auth state changes.
    */

// Re-draw the entire cart drawer from scratch
function renderCart() {
  const items = Cart.getItems();
  const total = Cart.getTotal();
  const count = Cart.getCount();
  const cartBody = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const badge = document.getElementById('cart-badge');

  // Update the floating badge number on the cart icon
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  if (!cartBody) return;

  // Empty state
  if (items.length === 0) {
    cartBody.innerHTML = `
      <div class="cart-empty">
        <span>☕</span>
        <p>Nothing here yet.</p>
        <a href="menu.html" class="btn btn--warm" onclick="toggleCart()">Browse Menu</a>
      </div>`;
    if (cartTotal) cartTotal.textContent = '₹0';
    return;
  }

  // Build cart item rows
  cartBody.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item__img-wrap">
        ${item.image
      ? `<img src="${item.image}" alt="${item.name}" class="cart-item__img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"/><span class="cart-item__img-fallback" style="display:none">☕</span>`
      : `<span class="cart-item__img-fallback">☕</span>`}
      </div>
      <div class="cart-item__info">
        <strong>${item.name}</strong>
        <span>₹${item.price} each</span>
      </div>
      <div class="cart-item__controls">
        <button class="cart-qty-btn" onclick="Cart.updateQty('${item.id}', -1)">−</button>
        <span class="cart-qty-num">${item.qty}</span>
        <button class="cart-qty-btn" onclick="Cart.updateQty('${item.id}', 1)">+</button>
      </div>
      <div class="cart-item__right">
        <strong class="cart-item__subtotal">₹${item.price * item.qty}</strong>
        <button class="cart-remove-btn" onclick="Cart.removeItem('${item.id}')" title="Remove">✕</button>
      </div>
    </div>
  `).join('');

  if (cartTotal) cartTotal.textContent = `₹${total}`;
}

// After cart changes, update all Add/Remove buttons on the page
function updateAddButtons() {
  const cartItems = Cart.getItems();
  const cartIds = cartItems.map(i => i.id);

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    const id = btn.dataset.itemId;
    const inCart = cartIds.includes(id);
    const wrapper = btn.closest('.menu-list-item__actions');

    if (inCart) {
      // Show "✓ Added" on the add button
      btn.textContent = '✓ Added';
      btn.classList.add('add-to-cart-btn--added');

      // Add a Remove button next to it if not already there
      if (wrapper && !wrapper.querySelector('.remove-from-cart-btn')) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn remove-from-cart-btn';
        removeBtn.textContent = '✕ Remove';
        removeBtn.dataset.itemId = id;
        removeBtn.onclick = () => {
          Cart.removeItem(id);
        };
        wrapper.appendChild(removeBtn);
      }
    } else {
      btn.textContent = '+ Add';
      btn.classList.remove('add-to-cart-btn--added');

      // Remove the Remove button if item was taken out of cart
      if (wrapper) {
        const existing = wrapper.querySelector('.remove-from-cart-btn');
        if (existing) existing.remove();
      }
    }
  });
}

// Update nav: show login button OR user name + profile dropdown
function updateNavUI() {
  const session = Auth.getSession();
  const loginBtn = document.getElementById('nav-login-btn');
  const userArea = document.getElementById('nav-user-area');
  const userName = document.getElementById('nav-user-name');
  const avatar = document.getElementById('nav-profile-avatar');

  if (!loginBtn || !userArea) return;

  if (session) {
    loginBtn.style.display = 'none';
    userArea.style.display = 'flex';
    if (userName) userName.textContent = session.name.split(' ')[0];
    if (avatar) avatar.textContent = session.name.charAt(0).toUpperCase();
  } else {
    loginBtn.style.display = 'inline-flex';
    userArea.style.display = 'none';
  }

  renderCart();
  updateAddButtons();
}


/* 
   SECTION 5: CART DRAWER TOGGLE
    */

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('cart-drawer--open');
  if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
  document.body.style.overflow = isOpen ? 'hidden' : '';
}


/* 
   SECTION 6: TOAST NOTIFICATIONS
   Shows a small popup message at the bottom
    */

function showToast(message) {
  // Remove any existing toast first
  const old = document.getElementById('brewnara-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'brewnara-toast';
  toast.className = 'cart-toast';
  toast.textContent = '✓ ' + message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('cart-toast--show'));
  });

  // Auto-hide after 2.5s
  setTimeout(() => {
    toast.classList.remove('cart-toast--show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}


/* 
   SECTION 7: AUTH MODAL
   Open, close, switch between login/register
    */

function openAuthModal(tab) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchAuthTab(tab || 'login');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('auth-tab--active', t.dataset.tab === tab);
  });
  const loginF = document.getElementById('auth-login-form');
  const regF = document.getElementById('auth-register-form');
  if (loginF) loginF.style.display = tab === 'login' ? 'block' : 'none';
  if (regF) regF.style.display = tab === 'register' ? 'block' : 'none';
  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.textContent = '';
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('auth-error');

  const result = Auth.login(email, password);

  if (!result.success) {
    errEl.textContent = result.message;
    return;
  }

  closeAuthModal();
  updateNavUI();
  showToast('Welcome back, ' + result.user.name + '! ☕');
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errEl = document.getElementById('auth-error');

  if (password !== confirm) {
    errEl.textContent = 'Passwords do not match.';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password needs to be at least 6 characters.';
    return;
  }

  const result = Auth.register(name, email, password);

  if (!result.success) {
    errEl.textContent = result.message;
    return;
  }

  // Auto login after successful registration
  Auth.login(email, password);
  closeAuthModal();
  updateNavUI();
  showToast('Welcome to Brewnara, ' + name + '! ☕');
}


/* 
   SECTION 8: PROFILE DROPDOWN
   Shows name, email, order history, logout
    */

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (!dropdown) return;
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) renderProfileDropdown();
}

function renderProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  const session = Auth.getSession();
  if (!dropdown || !session) return;

  // Get orders placed by this user
  const allOrders = JSON.parse(localStorage.getItem('brewnara_orders') || '[]');
  const myOrders = allOrders.filter(o => o.user === session.email);

  const ordersHTML = myOrders.length === 0
    ? '<p class="profile-no-orders">No orders yet. <a href="menu.html">Browse menu →</a></p>'
    : myOrders.slice(-3).reverse().map(order => {
      const date = new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const names = order.items.map(i => i.name).join(', ');
      return `
          <div class="profile-order-item">
            <div class="profile-order-top">
              <strong>₹${order.total}</strong>
              <span class="profile-order-date">${date}</span>
            </div>
            <p class="profile-order-items">${names}</p>
          </div>`;
    }).join('');

  dropdown.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${session.name.charAt(0).toUpperCase()}</div>
      <div>
        <strong>${session.name}</strong>
        <span>${session.email}</span>
      </div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title">Recent Orders</div>
      ${ordersHTML}
    </div>
    <div class="profile-actions">
      <button class="profile-action-btn" onclick="window.location.href='menu.html'">🍽️ Menu</button>
      <button class="profile-action-btn profile-action-btn--danger" onclick="Auth.logout()">🚪 Logout</button>
    </div>
  `;
}

// Close profile dropdown when clicking outside
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('profile-dropdown');
  const userArea = document.getElementById('nav-user-area');
  if (dropdown && userArea && !userArea.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});


/* 
   SECTION 9: CHECKOUT
   Requires login. Saves order to localStorage.
   Shows confirmation modal.
    */

function handleCheckout() {
  if (!Auth.isLoggedIn()) {
    closeCartIfOpen();
    openAuthModal('login');
    showToast('Please login to place your order.');
    return;
  }

  const items = Cart.getItems();
  if (items.length === 0) {
    showToast('Your cart is empty!');
    return;
  }

  const session = Auth.getSession();
  const total = Cart.getTotal();

  // Save order record
  const orders = JSON.parse(localStorage.getItem('brewnara_orders') || '[]');
  orders.push({
    id: 'ORD' + Date.now(),
    user: session.email,
    name: session.name,
    items: items,
    total: total,
    date: new Date().toISOString(),
    status: 'Confirmed'
  });
  localStorage.setItem('brewnara_orders', JSON.stringify(orders));

  Cart.clear();
  toggleCart();
  showOrderConfirmation(session.name, total);
}

function closeCartIfOpen() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer && drawer.classList.contains('cart-drawer--open')) {
    toggleCart();
  }
}

function showOrderConfirmation(name, total) {
  const modal = document.getElementById('order-confirm-modal');
  const nameEl = document.getElementById('order-confirm-name');
  const totalEl = document.getElementById('order-confirm-total');
  if (!modal) return;
  if (nameEl) nameEl.textContent = name;
  if (totalEl) totalEl.textContent = '₹' + total;
  modal.style.display = 'flex';
}

function closeOrderConfirm() {
  const modal = document.getElementById('order-confirm-modal');
  if (modal) modal.style.display = 'none';
}


/* 
   SECTION 10: NAV SCROLL EFFECT
   Adds a class when user scrolls down so the
   nav gets a solid background
    */

function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 60);
  }, { passive: true });
}


/* 
   SECTION 11: INIT
   Runs when the page finishes loading.
   Sets up all event listeners.
    */

document.addEventListener('DOMContentLoaded', function () {

  initNavScroll();
  updateNavUI();
  Weather.render();

  // Hook up auth forms
  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-register-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (regForm) regForm.addEventListener('submit', handleRegister);

  // Close auth modal when clicking the dark overlay behind it
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.addEventListener('click', function (e) {
      if (e.target === authModal) closeAuthModal();
    });
  }

  // Close cart when clicking the overlay
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);

  // Escape key closes modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeOrderConfirm();
      const drawer = document.getElementById('cart-drawer');
      if (drawer && drawer.classList.contains('cart-drawer--open')) toggleCart();
    }
  });

});
