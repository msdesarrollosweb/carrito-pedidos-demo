const CONFIG = {
  whatsappNumber: "5491127549094", // Cambiar por el número del negocio. Formato: país + área + número, sin + ni espacios.
  csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTvNjgIQDoFmKzLO7R8t4d0iB_rGX8MS1zj0-fHR_UPUI0HRTmZAanE39l_ej48VMpG2Zix_SJYzvwK/pub?gid=0&single=true&output=csv", // Para Google Sheets: pegar URL publicada como CSV.
  openHour: 9,
  closeHour: 21,
  openDays: [1, 2, 3, 4, 5, 6], // Lunes a sábado. Domingo = 0.
  restaurantName: "Rápido & Rico"
};

const state = {
  products: [],
  filtered: [],
  cart: [],
  currentCategory: "Todos",
  search: ""
};

const $ = (selector) => document.querySelector(selector);
const productsGrid = $("#productsGrid");
const categoryBar = $("#categoryBar");
const promoStrip = $("#promoStrip");
const cartPanel = $("#cartPanel");
const overlay = $("#overlay");

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function normalize(text = "") {
  return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value = "") {
  return value.toString().replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function getCategoryId(category = "") {
  return `categoria-${normalize(category).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (current || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      }
      if (char === "\r" && next === "\n") i++;
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.filter(row => row.length === headers.length).map(row => {
    const item = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    return {
      ...item,
      id: Number(item.id),
      precio: Number(item.precio),
      destacado: item.destacado === "si",
      promo: item.promo === "si",
      combo: item.combo === "si",
      disponible: item.disponible === "si"
    };
  });
}

async function loadProducts() {
  try {
    const response = await fetch(CONFIG.csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el CSV");
    const csvText = await response.text();
    state.products = parseCSV(csvText).filter(product => product.disponible);
    state.filtered = [...state.products];
    renderCategories();
    renderPromos();
    renderProducts();
  } catch (error) {
    productsGrid.innerHTML = `<p class="empty">No pudimos cargar el menú. Revisá el archivo productos.csv o la URL de Google Sheets.</p>`;
    console.error(error);
  }
}

function renderCategories() {
  const categories = [...new Set(state.products.map(product => product.categoria))];
  categoryBar.innerHTML = `
    <label class="category-select-label" for="categorySelect">Filtrar por rubro</label>
    <select class="category-select" id="categorySelect" aria-label="Seleccionar rubro del menú">
      <option value="Todos">Todos los productos</option>
      ${categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("")}
    </select>
  `;
}

function renderPromos() {
  const promos = state.products.filter(product => product.promo).slice(0, 2);
  promoStrip.innerHTML = promos.map(product => `
    <article class="promo-card">
      <strong>🔥 ${escapeHTML(product.nombre)}</strong>
      <span>${escapeHTML(product.descripcion)} · ${formatCurrency(product.precio)}</span>
    </article>
  `).join("");
}

function applyFilters() {
  const searchTerm = normalize(state.search);
  state.filtered = state.products.filter(product => {
    return [product.nombre, product.categoria, product.descripcion].some(value => normalize(value).includes(searchTerm));
  });
  renderProducts();
}

function renderProducts() {
  if (!state.filtered.length) {
    productsGrid.innerHTML = `<p class="empty">No encontramos productos con esa búsqueda.</p>`;
    return;
  }

  const categories = [...new Set(state.filtered.map(product => product.categoria))];

  productsGrid.innerHTML = categories.map(category => {
    const products = state.filtered.filter(product => product.categoria === category);
    const categoryId = getCategoryId(category);

    return `
      <section class="category-section" id="${categoryId}" aria-labelledby="${categoryId}-title">
        <div class="category-section-head">
          <h3 id="${categoryId}-title">${escapeHTML(category)}</h3>
        </div>
        <div class="horizontal-products" tabindex="0" aria-label="Productos de ${escapeHTML(category)}">
          ${products.map(product => renderProductCard(product)).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function renderProductCard(product) {
  return `
    <article class="product-card">
      <div class="product-image">
        <img src="${escapeHTML(product.imagen)}" alt="${escapeHTML(product.nombre)}" loading="lazy" />
        <div class="badge-row">
          ${product.destacado ? `<span class="badge">Destacado</span>` : ""}
          ${product.promo ? `<span class="badge">Promo</span>` : ""}
          ${product.combo ? `<span class="badge combo">Combo</span>` : ""}
        </div>
      </div>
      <div class="product-body">
        <span class="section-kicker">${escapeHTML(product.categoria)}</span>
        <h3>${escapeHTML(product.nombre)}</h3>
        <p>${escapeHTML(product.descripcion)}</p>
        <div class="product-footer">
          <span class="price">${formatCurrency(product.precio)}</span>
          <button class="add-btn" data-id="${product.id}" type="button">Agregar</button>
        </div>
      </div>
    </article>
  `;
}

function addToCart(id) {
  const product = state.products.find(item => item.id === Number(id));
  const existing = state.cart.find(item => item.id === Number(id));
  if (existing) existing.quantity++;
  else state.cart.push({ ...product, quantity: 1 });
  updateCart();
  animateCartButton();
  showCartToast(`${product.nombre} agregado`);
  openCart();
}

function changeQuantity(id, delta) {
  const item = state.cart.find(product => product.id === Number(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter(product => product.id !== Number(id));
  updateCart();
}

function animateCartButton() {
  const button = $("#floatingCart");
  if (!button) return;
  button.classList.remove("bump");
  void button.offsetWidth;
  button.classList.add("bump");
}

function showCartToast(message = "Producto agregado al carrito") {
  const toast = $("#cartToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showCartToast.timeoutId);
  showCartToast.timeoutId = setTimeout(() => toast.classList.remove("show"), 1600);
}

function getDeliveryPrice() {
  const selected = $("#deliveryZone").selectedOptions[0];
  return Number(selected.dataset.price || 0);
}

function updateCart() {
  const cartItems = $("#cartItems");
  const subtotal = state.cart.reduce((sum, item) => sum + item.precio * item.quantity, 0);
  const delivery = getDeliveryPrice();
  const total = subtotal + delivery;
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  $("#cartCount").textContent = count;
  const cartButtonSubtotal = $("#cartButtonSubtotal");
  if (cartButtonSubtotal) cartButtonSubtotal.textContent = formatCurrency(subtotal);
  $("#subtotal").textContent = formatCurrency(subtotal);
  $("#deliveryCost").textContent = formatCurrency(delivery);
  $("#total").textContent = formatCurrency(total);
  const whatsappTotal = $("#whatsappTotal");
  if (whatsappTotal) whatsappTotal.textContent = formatCurrency(total);
  const sendButton = $("#sendWhatsApp");
  if (sendButton) sendButton.disabled = !state.cart.length;

  if (!state.cart.length) {
    cartItems.innerHTML = `<p class="empty">Tu carrito está vacío. Agregá productos del menú.</p>`;
    return;
  }

  cartItems.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div>
        <h4>${item.nombre}</h4>
        <small>${formatCurrency(item.precio)} c/u</small>
      </div>
      <div class="qty">
        <button type="button" data-action="minus" data-id="${item.id}">−</button>
        <strong>${item.quantity}</strong>
        <button type="button" data-action="plus" data-id="${item.id}">+</button>
      </div>
    </div>
  `).join("");
}

function openCart() {
  cartPanel.classList.add("open");
  cartPanel.setAttribute("aria-hidden", "false");
  overlay.classList.add("show");
  document.body.classList.add("body-lock");
}

function closeCart() {
  cartPanel.classList.remove("open");
  cartPanel.setAttribute("aria-hidden", "true");
  overlay.classList.remove("show");
  document.body.classList.remove("body-lock");
}

function updateStoreStatus() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isBusinessDay = CONFIG.openDays.includes(currentDay);
  const isOpen = isBusinessDay && currentHour >= CONFIG.openHour && currentHour < CONFIG.closeHour;
  const status = $("#storeStatus");

  status.textContent = isOpen ? "Ya estamos atendiendo !!!" : "Cerrado ahora";
  status.classList.toggle("open", isOpen);
  status.classList.toggle("closed", !isOpen);
}

function buildWhatsAppMessage() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.precio * item.quantity, 0);
  const delivery = getDeliveryPrice();
  const total = subtotal + delivery;
  const zone = $("#deliveryZone").selectedOptions[0].textContent;
  const address = $("#customerAddress").value.trim() || "No indicada";
  const notes = $("#customerNotes").value.trim() || "Sin notas";

  const items = state.cart.map(item => `• ${item.quantity} x ${item.nombre} - ${formatCurrency(item.precio * item.quantity)}`).join("\n");

  return `Hola ${CONFIG.restaurantName}, quiero hacer este pedido:\n\n${items}\n\nProductos: ${formatCurrency(subtotal)}\nDelivery: ${formatCurrency(delivery)}\nTotal: ${formatCurrency(total)}\n\nZona: ${zone}\nDirección: ${address}\nNotas: ${notes}`;
}

function sendOrder() {
  if (!state.cart.length) {
    alert("Agregá al menos un producto al carrito.");
    return;
  }
  const message = encodeURIComponent(buildWhatsAppMessage());
  window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${message}`, "_blank");
}

productsGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".add-btn");
  if (button) addToCart(button.dataset.id);
});

categoryBar.addEventListener("change", (event) => {
  const select = event.target.closest("#categorySelect");
  if (!select) return;

  if (select.value === "Todos") {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const section = document.getElementById(getCategoryId(select.value));
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#searchInput").addEventListener("input", (event) => {
  state.search = event.target.value;
  applyFilters();
});

$("#cartItems").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  changeQuantity(button.dataset.id, button.dataset.action === "plus" ? 1 : -1);
});

$("#deliveryZone").addEventListener("change", updateCart);
$("#floatingCart").addEventListener("click", openCart);
$("#openCartTop").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCart();
});
$("#sendWhatsApp").addEventListener("click", sendOrder);

updateStoreStatus();
setInterval(updateStoreStatus, 60000);
updateCart();
loadProducts();
