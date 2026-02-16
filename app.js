// Atlantis — demo bookstore (integrada con Genesys Cloud Web Messenger)

// ================= ENDPOINTS =================
const API_BASE = "https://tpipaxfpf1.execute-api.eu-north-1.amazonaws.com";

const ENDPOINT_GET_CLIENT = `${API_BASE}/getClientDetails`;
const ENDPOINT_GET_BOOKS = `${API_BASE}/getBooks`;
const ENDPOINT_GET_ORDERS = `${API_BASE}/getOrdersbyClient`;

// ================= UI REFS =================
const loginCard = document.getElementById("loginCard");
const storeCard = document.getElementById("storeCard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const endpointLabel = document.getElementById("endpointLabel");

const userStatus = document.getElementById("userStatus");
const userPill = document.getElementById("userPill");
const logoutBtn = document.getElementById("logoutBtn");
const chatBtn = document.getElementById("chatBtn");

const booksGrid = document.getElementById("booksGrid");
const booksError = document.getElementById("booksError");
const booksCount = document.getElementById("booksCount");
const refreshBtn = document.getElementById("refreshBtn");

const searchInput = document.getElementById("searchInput");
const genreSelect = document.getElementById("genreSelect");
const inStockOnly = document.getElementById("inStockOnly");

const statBooks = document.getElementById("statBooks");
const statInStock = document.getElementById("statInStock");
const statGenres = document.getElementById("statGenres");

const navCatalogBtn = document.getElementById("navCatalogBtn");
const navOrdersBtn = document.getElementById("navOrdersBtn");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const ordersView = document.getElementById("ordersView");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const ordersTbody = document.getElementById("ordersTbody");
const ordersError = document.getElementById("ordersError");

// Pintar endpoint demo
if (endpointLabel) endpointLabel.textContent = `${ENDPOINT_GET_CLIENT}?id=1111`;

const SESSION_KEY = "atlantis_session_v1";

// ================= UTIL =================
function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function showError(el, msg) {
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}
function hideError(el) {
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================= API HELPERS =================
async function login(customerId, password) {
  const url = `${ENDPOINT_GET_CLIENT}?id=${encodeURIComponent(customerId)}`;

  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(data?.message || `Error HTTP ${resp.status}`);
  }

  const customer = data?.customer;
  if (!customer) throw new Error("Respuesta inválida");

  if (String(customer.password) !== String(password)) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  const { password: _pw, ...safeCustomer } = customer;

  const token =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  setSession({
    customer: safeCustomer,
    loginId: String(customerId),
    loggedInAt: Date.now(),
    token,
  });

  return safeCustomer;
}

async function fetchBooks() {
  const url = `${ENDPOINT_GET_BOOKS}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(data?.message || `Error HTTP ${resp.status}`);
  }

  if (!Array.isArray(data.books)) throw new Error("Respuesta inválida de libros");
  return data;
}

async function fetchOrdersByClient(id) {
  const url = `${ENDPOINT_GET_ORDERS}?id=${encodeURIComponent(id)}`;
  console.log("Fetching orders:", url);

  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);

  if (!Array.isArray(data.orders)) throw new Error("Respuesta inválida de pedidos");
  return data.orders;
}

// ================= GENESYS HELPER =================
function initGenesysForCustomer(customer, session) {
  if (typeof Genesys !== "function") {
    console.warn("Genesys aún no está disponible");
    return;
  }

  Genesys("command", "Database.set", {
    messaging: {
      customAttributes: {
        customerId: customer.id || "",
        nombre: customer.Nombre || "",
        apellido: customer.Apellido || "",
        email: customer.email || "",
        sessionToken: session?.token || "",
      },
    },
  });
}

// ================= UI STATE =================
function setAuthedUI(customer) {
  if (loginCard) loginCard.hidden = true;
  if (storeCard) storeCard.hidden = false;
  if (userStatus) userStatus.textContent = `${customer.Nombre} ${customer.Apellido}`;
  if (userPill) userPill.classList.add("authed");
  if (logoutBtn) logoutBtn.hidden = false;
  if (chatBtn) chatBtn.hidden = false;

  const session = getSession();
  if (session) {
    initGenesysForCustomer(customer, session);
  }
}

function setLoggedOutUI() {
  if (loginCard) loginCard.hidden = false;
  if (storeCard) storeCard.hidden = true;
  if (userStatus) userStatus.textContent = "No autenticado";
  if (userPill) userPill.classList.remove("authed");
  if (logoutBtn) logoutBtn.hidden = true;
  if (chatBtn) chatBtn.hidden = true;
}

// ================= NAV =================
function setPage(mode) {
  const isOrders = mode === "orders";

  if (pageTitle) {
    pageTitle.textContent = isOrders ? "Mis pedidos" : "Catálogo";
  }
  if (pageSubtitle) {
    pageSubtitle.textContent = isOrders
      ? "Histórico de pedidos asociados a tu cuenta."
      : "Todos los libros disponibles en tu API.";
  }

  if (ordersView) {
    ordersView.hidden = !isOrders;
  }
  if (booksGrid) {
    booksGrid.hidden = isOrders;
  }
}

// ================= RENDER HELPERS (libros) =================
let lastBooksPayload = null;

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "bookCard";

  const title = escapeHtml(book.titulo ?? book.tituloLibro ?? book.title);
  const author = escapeHtml(book.autor ?? book.autorLibro ?? book.author);
  const genre = escapeHtml(book.genero ?? book.genre ?? "—");
  const price = Number(book.precio ?? book.price ?? 0);
  const stock = Number(book.stock ?? book.stockActual ?? 0);

  card.innerHTML = `
    <div class="bookMain">
      <h3 class="bookTitle">${title}</h3>
      <p class="bookAuthor">${author}</p>
      <p class="bookGenre">${genre}</p>
    </div>
    <div class="bookMeta">
      <span class="bookPrice">${price.toFixed(2)} €</span>
      <span class="bookStock ${stock > 0 ? "in" : "out"}">
        ${stock > 0 ? "En stock" : "Sin stock"}
      </span>
    </div>
  `;

  return card;
}

function renderBooks(books, totalCount) {
  if (!booksGrid) return;

  booksGrid.innerHTML = "";
  if (!Array.isArray(books) || books.length === 0) {
    booksGrid.innerHTML = `<p class="muted">No se encontraron libros con esos filtros.</p>`;
  } else {
    const frag = document.createDocumentFragment();
    books.forEach((b) => frag.appendChild(createBookCard(b)));
    booksGrid.appendChild(frag);
  }

  if (booksCount) {
    const count = books.length;
    const total = totalCount ?? count;
    booksCount.textContent = `${count} de ${total} libros mostrados.`;
  }
}

function applyFilters(allBooks) {
  const text = (searchInput?.value ?? "").toLowerCase().trim();
  const genre = genreSelect?.value ?? "";
  const inStock = !!inStockOnly?.checked;

  return allBooks.filter((book) => {
    const title = String(book.titulo ?? book.tituloLibro ?? book.title ?? "").toLowerCase();
    const author = String(book.autor ?? book.autorLibro ?? book.author ?? "").toLowerCase();
    const genreVal = String(book.genero ?? book.genre ?? "").toLowerCase();
    const stock = Number(book.stock ?? book.stockActual ?? 0);

    const matchesText = !text || title.includes(text) || author.includes(text);
    const matchesGenre = !genre || genreVal === genre.toLowerCase();
    const matchesStock = !inStock || stock > 0;

    return matchesText && matchesGenre && matchesStock;
  });
}

function renderGenres(books) {
  if (!genreSelect) return;
  const genres = new Set();

  books.forEach((b) => {
    const g = (b.genero ?? b.genre ?? "").trim();
    if (g) genres.add(g);
  });

  const current = genreSelect.value;
  genreSelect.innerHTML = `<option value="">Todos los géneros</option>`;
  Array.from(genres)
    .sort()
    .forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      genreSelect.appendChild(opt);
    });

  if (current) genreSelect.value = current;
}

function computeStats(books) {
  if (!Array.isArray(books)) return;

  const total = books.length;
  const inStock = books.filter((b) => Number(b.stock ?? b.stockActual ?? 0) > 0).length;
  const genres = new Set();

  books.forEach((b) => {
    const g = (b.genero ?? b.genre ?? "").trim();
    if (g) genres.add(g);
  });

  if (statBooks) statBooks.textContent = String(total);
  if (statInStock) statInStock.textContent = String(inStock);
  if (statGenres) statGenres.textContent = String(genres.size);
}

// ================= LOADERS =================
async function loadBooksAndRender() {
  hideError(booksError);
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const payload = await fetchBooks();
    lastBooksPayload = payload;

    renderGenres(payload.books);
    computeStats(payload.books);

    const filtered = applyFilters(payload.books);
    renderBooks(filtered, payload.total ?? payload.books.length);
  } catch (e) {
    showError(booksError, e.message || "Error cargando libros");
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

async function loadOrdersAndRender() {
  hideError(ordersError);
  if (!ordersTbody) return;
  ordersTbody.innerHTML = "";

  try {
    const session = getSession();
    if (!session?.customer?.id) {
      throw new Error("No hay cliente autenticado");
    }

    // Asegurar catálogo (para título e importe)
    if (!bookPriceMap || !bookTitleMap) {
      await loadBooksAndBuildPriceMap();
    }

    const ordersRaw = await fetchOrdersByClient(session.customer.id);

    console.group("DEBUG: orders response");
    console.log("Raw orders payload:", ordersRaw);
    console.groupEnd();

    const extractOrdersArray = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.orders)) return payload.orders;
      if (payload.data && Array.isArray(payload.data.orders)) return payload.data.orders;
      if (payload.data && Array.isArray(payload.data)) return payload.data;
      const firstArray = Object.values(payload).find(v => Array.isArray(v));
      return firstArray || [];
    };

    let ordersArr = extractOrdersArray(ordersRaw);
    if (!Array.isArray(ordersArr) || ordersArr.length === 0) {
      ordersTbody.innerHTML = `<tr><td colspan="5" class="muted">No hay pedidos para este cliente.</td></tr>`;
      return;
    }

    // Parse fecha para ordenar (DD/MM/YYYY o D/M/YYYY)
    const parseOrderDate = (raw) => {
      if (!raw) return 0;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        const ms = String(raw).length <= 10 ? raw * 1000 : raw;
        return ms;
      }
      const s = String(raw).trim();
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]) - 1;
        let year = Number(m[3]);
        if (year < 100) year += year > 50 ? 1900 : 2000;
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      }
      const d2 = new Date(s);
      return isNaN(d2.getTime()) ? 0 : d2.getTime();
    };

    // Ordenar de más nuevo a más viejo
    ordersArr = ordersArr.slice().sort((a, b) => {
      const ta = parseOrderDate(a.fechadecompra ?? a.fechaDeCompra ?? a.fecha ?? a.date);
      const tb = parseOrderDate(b.fechadecompra ?? b.fechaDeCompra ?? b.fecha ?? b.date);
      return tb - ta;
    });

    const frag = document.createDocumentFragment();

    ordersArr.forEach((rawRow) => {
      const o = normalizeOrderRow(rawRow);

      // Resolver título y precio por idarticulo
      const title = getTitleForArticle(o.idarticulo) || "—";
      let importeToShow = o.importe;

      if ((importeToShow == null || importeToShow === "") && o.idarticulo) {
        const foundPrice = getFormattedPriceForArticle(o.idarticulo);
        importeToShow = foundPrice || "—";
        if (!foundPrice) {
          console.warn(`No se encontró precio en catálogo para idarticulo=${o.idarticulo} (order ${o.idPedido})`);
        }
      }
      if (importeToShow == null) importeToShow = "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(String(o.idPedido))}</td>
        <td>${escapeHtml(String(o.fecha))}</td>
        <td>${escapeHtml(String(o.estado))}</td>
        <td>${escapeHtml(String(title))}</td>
        <td>${escapeHtml(String(importeToShow))}</td>
      `;
      frag.appendChild(tr);
    });

    ordersTbody.appendChild(frag);
  } catch (e) {
    showError(ordersError, e.message || "Error cargando pedidos");
  }
}

// ================= EVENTS =================
if (loginForm) {
  loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    hideError(loginError);

    const customerId = document.getElementById("customerId")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";

    try {
      const customer = await login(customerId, password);
      setAuthedUI(customer);
      setPage("catalog");
      await loadBooksAndRender();
    } catch (e) {
      showError(loginError, e.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearSession();
    setLoggedOutUI();
  });
}

if (chatBtn) {
  chatBtn.addEventListener("click", () => {
    if (typeof Genesys !== "function") {
      console.warn("Genesys no está disponible aún");
      return;
    }

    const session = getSession();
    if (session?.customer) {
      initGenesysForCustomer(session.customer, session);
    }

    Genesys("command", "Messenger.open");
  });
}

if (navCatalogBtn) {
  navCatalogBtn.addEventListener("click", () => setPage("catalog"));
}
if (navOrdersBtn) {
  navOrdersBtn.addEventListener("click", async () => {
    setPage("orders");
    await loadOrdersAndRender();
  });
}
if (refreshOrdersBtn) {
  refreshOrdersBtn.addEventListener("click", loadOrdersAndRender);
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadBooksAndRender);
}
if (searchInput) {
  searchInput.addEventListener("input", () => {
    if (lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}
if (genreSelect) {
  genreSelect.addEventListener("change", () => {
    if (lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}
if (inStockOnly) {
  inStockOnly.addEventListener("change", () => {
    if (lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}

// ================= INIT =================
(async function init() {
  const session = getSession();

  if (session?.customer) {
    setAuthedUI(session.customer);
    setPage("catalog");
  } else {
    setLoggedOutUI();
  }

  await loadBooksAndBuildPriceMap();

  await loadBooksAndRender();
})();


// ---------------------
// CACHE DE LIBROS / MAPAS (precio y título)
// ---------------------
let lastBooksPayload = null;
let bookPriceMap = null;
let bookTitleMap = null;

async function loadBooksAndBuildPriceMap() {
  try {
    const payload = await fetchBooks();
    lastBooksPayload = payload || { books: [] };

    bookPriceMap = {};
    bookTitleMap = {};

    if (Array.isArray(lastBooksPayload.books)) {
      lastBooksPayload.books.forEach(b => {
        const idKey = String(b.id ?? b.idlibro ?? b.idArticulo ?? b.idarticulo ?? "");
        const price = Number(b.precio ?? b.price ?? b.valor ?? b.amount ?? NaN);
        const title = String(b.titulo ?? b.title ?? "").trim();

        if (idKey) {
          bookPriceMap[idKey] = Number.isFinite(price) ? price : null;
          bookTitleMap[idKey] = title || null;
        }
      });
    }
    return lastBooksPayload;
  } catch (e) {
    console.warn("Error cargando libros para price/title map:", e);
    return null;
  }
}

function getFormattedPriceForArticle(idart) {
  if (!idart || !bookPriceMap) return null;
  const price = bookPriceMap[String(idart)];
  if (price == null || !Number.isFinite(Number(price))) return null;
  return `${Number(price).toFixed(2)} €`;
}
function getTitleForArticle(idart) {
  if (!idart || !bookTitleMap) return null;
  const t = bookTitleMap[String(idart)];
  return t || null;
}
