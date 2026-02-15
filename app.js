// Atlantis — demo bookstore (GitHub Pages)

// ================= ENDPOINTS =================
const API_BASE = "https://tpipaxfpf1.execute-api.eu-north-1.amazonaws.com";

const ENDPOINT_GET_CLIENT = `${API_BASE}/getClientDetails`;
const ENDPOINT_GET_BOOKS = `${API_BASE}/getBooks`;
const ENDPOINT_GET_ORDERS = `${API_BASE}/getOrdersbyClient`; // usa ?id=

// ================= SAFE DOM HELPERS =================
function $(id){
  const el = document.getElementById(id);
  if(!el) console.warn(`[Atlantis] Falta elemento con id="${id}" en index.html`);
  return el;
}

// ================= UI REFS =================
const loginCard = $("loginCard");
const storeCard = $("storeCard");
const loginForm = $("loginForm");
const loginError = $("loginError");
const endpointLabel = $("endpointLabel");

const userStatus = $("userStatus");
const userPill = $("userPill");
const logoutBtn = $("logoutBtn");

const booksGrid = $("booksGrid");
const booksError = $("booksError");
const booksCount = $("booksCount");
const refreshBtn = $("refreshBtn");

const searchInput = $("searchInput");
const genreSelect = $("genreSelect");
const inStockOnly = $("inStockOnly");

const statBooks = $("statBooks");
const statInStock = $("statInStock");
const statGenres = $("statGenres");

// Nav + Orders UI (pueden no existir si el HTML no está actualizado)
const navCatalogBtn = $("navCatalogBtn");
const navOrdersBtn = $("navOrdersBtn");
const pageTitle = $("pageTitle");
const pageSubtitle = $("pageSubtitle");

const ordersView = $("ordersView");
const refreshOrdersBtn = $("refreshOrdersBtn");
const ordersTbody = $("ordersTbody");
const ordersError = $("ordersError");

// Pintar endpoint demo si existe el label
if(endpointLabel){
  endpointLabel.textContent = `${ENDPOINT_GET_CLIENT}?id=1111`;
}

const SESSION_KEY = "atlantis_session_v1";

// ================= UTIL =================
function setSession(session){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function showError(el, msg){ if(el){ el.textContent = msg; el.hidden = false; } }
function hideError(el){ if(el){ el.textContent = ""; el.hidden = true; } }

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatEUR(value){
  const n = Number(value ?? 0);
  return `${n.toFixed(0)} €`;
}

// ================= AUTH =================
async function login(customerId, password){
  const url = `${ENDPOINT_GET_CLIENT}?id=${encodeURIComponent(customerId)}`;

  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if(!resp.ok){
    throw new Error(data?.message || `Error HTTP ${resp.status}`);
  }

  const customer = data?.customer;
  if(!customer) throw new Error("Respuesta inválida");

  if(String(customer.password) !== String(password)){
    throw new Error("Usuario o contraseña incorrectos");
  }

  const { password: _pw, ...safeCustomer } = customer;

  setSession({
    customer: safeCustomer,
    loginId: String(customerId),
    loggedInAt: Date.now()
  });

  return safeCustomer;
}

function setAuthedUI(customer){
  if(loginCard) loginCard.hidden = true;
  if(storeCard) storeCard.hidden = false;

  if(userStatus) userStatus.textContent = `${customer.Nombre} ${customer.Apellido}`;
  if(userPill) userPill.classList.add("authed");
  if(logoutBtn) logoutBtn.hidden = false;
}

function setLoggedOutUI(){
  if(loginCard) loginCard.hidden = false;
  if(storeCard) storeCard.hidden = true;

  if(userStatus) userStatus.textContent = "No autenticado";
  if(userPill) userPill.classList.remove("authed");
  if(logoutBtn) logoutBtn.hidden = true;
}

// ================= NAV =================
function setPage(mode){
  const isOrders = mode === "orders";

  if(pageTitle){
    pageTitle.textContent = isOrders ? "Mis pedidos" : "Catálogo";
  }
  if(pageSubtitle){
    pageSubtitle.textContent = isOrders
      ? "Histórico de pedidos asociados a tu cuenta."
      : "Elige, filtra y compra.";
  }

  if(ordersView) ordersView.hidden = !isOrders;
  if(booksGrid) booksGrid.hidden = isOrders;

  // Desactivar filtros en vista pedidos (si existen)
  if(searchInput) searchInput.disabled = isOrders;
  if(genreSelect) genreSelect.disabled = isOrders;
  if(inStockOnly) inStockOnly.disabled = isOrders;
  if(refreshBtn) refreshBtn.disabled = isOrders;
}

function getAuthedClientId(){
  const s = getSession();
  return String(s?.loginId ?? "");
}

// ================= BOOKS =================
let lastBooksPayload = null;

async function fetchBooks(){
  const resp = await fetch(ENDPOINT_GET_BOOKS);
  const data = await resp.json().catch(() => ({}));

  if(!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);
  if(!Array.isArray(data?.books)) throw new Error("Respuesta inválida");

  return data;
}

function renderGenres(books){
  if(!genreSelect) return;
  const genres = Array.from(new Set(books.map(b => b.genero).filter(Boolean))).sort();
  genreSelect.innerHTML = `<option value="">Todos los géneros</option>`
    + genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

function computeStats(books){
  if(statBooks) statBooks.textContent = books.length;
  if(statInStock) statInStock.textContent = books.filter(b => Number(b.stock || 0) > 0).length;
  if(statGenres) statGenres.textContent = new Set(books.map(b => b.genero).filter(Boolean)).size;
}

function applyFilters(books){
  const q = (searchInput?.value || "").trim().toLowerCase();
  const genre = genreSelect?.value || "";
  const stockOnly = !!inStockOnly?.checked;

  return books.filter(b => {
    const matchesQ =
      !q ||
      String(b.titulo || "").toLowerCase().includes(q) ||
      String(b.autor || "").toLowerCase().includes(q);

    const matchesGenre = !genre || String(b.genero) === genre;
    const matchesStock = !stockOnly || Number(b.stock || 0) > 0;

    return matchesQ && matchesGenre && matchesStock;
  });
}

function renderBooks(books, total){
  if(!booksGrid) return;

  booksGrid.innerHTML = "";
  if(booksCount) booksCount.textContent = `Mostrando ${books.length} de ${total}`;

  if(books.length === 0){
    booksGrid.innerHTML = `<div class="muted">No hay resultados con esos filtros.</div>`;
    return;
  }

  for(const b of books){
    const stock = Number(b.stock ?? 0);
    const price = Number(b.precio ?? 0);

    const el = document.createElement("article");
    el.className = "bookCard";

    el.innerHTML = `
      <div class="cover"></div>
      <div class="cardBody">
        <div class="badgesRow">
          <span class="chip">${escapeHtml(b.genero ?? "sin género")}</span>
          <span class="chip">${escapeHtml(b.año ?? "s/año")}</span>
          <span class="chip">${stock > 0 ? "En stock" : "Sin stock"}</span>
        </div>
        <div class="titleRow">${escapeHtml(b.titulo ?? "Sin título")}</div>
        <div class="meta">${escapeHtml(b.autor ?? "Autor desconocido")}</div>

        <div class="bottomRow">
          <div>
            <div class="price">${formatEUR(price)}</div>
            <div class="stock">Stock: ${stock}</div>
          </div>
          <button class="buyBtn" ${stock > 0 ? "" : "disabled"} data-bookid="${escapeHtml(b.id)}">
            Comprar
          </button>
        </div>
      </div>
    `;

    booksGrid.appendChild(el);
  }

  // Comprar (sin carrito)
  booksGrid.querySelectorAll(".buyBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-bookid");
      const book = lastBooksPayload?.books?.find(x => String(x.id) === String(id));
      if(!book) return;
      alert(`Libro seleccionado:\n\n${book.titulo}\n${book.autor}`);
    });
  });
}

async function loadBooksAndRender(){
  hideError(booksError);
  if(refreshBtn) refreshBtn.disabled = true;

  try{
    const payload = await fetchBooks();
    lastBooksPayload = payload;

    renderGenres(payload.books);
    computeStats(payload.books);

    const filtered = applyFilters(payload.books);
    renderBooks(filtered, payload.total ?? payload.books.length);

  }catch(e){
    showError(booksError, e.message || "Error cargando libros");
    if(booksGrid) booksGrid.innerHTML = "";
    if(booksCount) booksCount.textContent = "";
  }finally{
    if(refreshBtn) refreshBtn.disabled = false;
  }
}

// ================= ORDERS =================
async function fetchOrdersByClient(id){
  // ✅ CORRECTO: tu API espera ?id=
  const url = `${ENDPOINT_GET_ORDERS}?id=${encodeURIComponent(id)}`;
  console.log("[Atlantis] Fetching orders:", url);

  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if(!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);
  if(!Array.isArray(data?.orders)) throw new Error("Respuesta inválida: falta orders[]");

  return data.orders;
}

function renderOrders(orders){
  if(!ordersTbody) return;

  ordersTbody.innerHTML = "";

  if(orders.length === 0){
    ordersTbody.innerHTML = `<tr><td colspan="4" class="muted">No tienes pedidos todavía.</td></tr>`;
    return;
  }

  const sorted = [...orders].sort((a,b) => Number(b.ordernumber||0) - Number(a.ordernumber||0));

  for(const o of sorted){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="orderPill">#${escapeHtml(o.ordernumber ?? "")}</span></td>
      <td>${escapeHtml(o.fechadecompra ?? "")}</td>
      <td>${escapeHtml(o.estado ?? "")}</td>
      <td>${escapeHtml(o.idarticulo ?? "")}</td>
    `;
    ordersTbody.appendChild(tr);
  }
}

async function loadOrdersAndRender(){
  hideError(ordersError);

  const id = getAuthedClientId();
  if(!id){
    showError(ordersError, "No se pudo determinar el id del cliente.");
    return;
  }

  if(refreshOrdersBtn) refreshOrdersBtn.disabled = true;

  try{
    const orders = await fetchOrdersByClient(id);
    renderOrders(orders);
  }catch(e){
    showError(ordersError, e.message || "Error cargando pedidos");
    if(ordersTbody) ordersTbody.innerHTML = "";
  }finally{
    if(refreshOrdersBtn) refreshOrdersBtn.disabled = false;
  }
}

// ================= EVENTS =================
if(loginForm){
  loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    hideError(loginError);

    const customerId = document.getElementById("customerId")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";

    try{
      const customer = await login(customerId, password);
      setAuthedUI(customer);
      setPage("catalog");
      await loadBooksAndRender();
    }catch(e){
      showError(loginError, e.message || "Error de autenticación");
    }
  });
}

if(logoutBtn){
  logoutBtn.addEventListener("click", () => {
    clearSession();
    setLoggedOutUI();
  });
}

if(navCatalogBtn){
  navCatalogBtn.addEventListener("click", () => setPage("catalog"));
}
if(navOrdersBtn){
  navOrdersBtn.addEventListener("click", async () => {
    setPage("orders");
    await loadOrdersAndRender();
  });
}
if(refreshOrdersBtn){
  refreshOrdersBtn.addEventListener("click", loadOrdersAndRender);
}

if(refreshBtn){
  refreshBtn.addEventListener("click", loadBooksAndRender);
}
if(searchInput){
  searchInput.addEventListener("input", () => {
    if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}
if(genreSelect){
  genreSelect.addEventListener("change", () => {
    if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}
if(inStockOnly){
  inStockOnly.addEventListener("change", () => {
    if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
  });
}

// ================= INIT =================
(function init(){
  const session = getSession();
  if(session?.customer){
    setAuthedUI(session.customer);
    setPage("catalog");
    loadBooksAndRender();
  }else{
    setLoggedOutUI();
  }
})();
