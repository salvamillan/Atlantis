// Atlantis — demo bookstore (GitHub Pages)
// Endpoints (ajusta si tu ruta real difiere)
const API_BASE = "https://tpipaxfpf1.execute-api.eu-north-1.amazonaws.com";
const ENDPOINT_GET_CLIENT = `${API_BASE}/getClientDetails`; // GET ?id=
const ENDPOINT_GET_BOOKS = `${API_BASE}/getBooks`;          // GET
const ENDPOINT_GET_ORDERS = `${API_BASE}/getordersbyclient`; // GET ?idcliente=

// UI refs
const loginCard = document.getElementById("loginCard");
const storeCard = document.getElementById("storeCard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const endpointLabel = document.getElementById("endpointLabel");

const userStatus = document.getElementById("userStatus");
const userPill = document.getElementById("userPill");
const logoutBtn = document.getElementById("logoutBtn");

const booksGrid = document.getElementById("booksGrid");
const booksError = document.getElementById("booksError");
const booksCount = document.getElementById("booksCount");
const refreshBtn = document.getElementById("refreshBtn");

const searchInput = document.getElementById("searchInput");
const genreSelect = document.getElementById("genreSelect");
const inStockOnly = document.getElementById("inStockOnly");

// Stats
const statBooks = document.getElementById("statBooks");
const statInStock = document.getElementById("statInStock");
const statGenres = document.getElementById("statGenres");

// Nav + Orders UI
const navCatalogBtn = document.getElementById("navCatalogBtn");
const navOrdersBtn = document.getElementById("navOrdersBtn");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const ordersView = document.getElementById("ordersView");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const ordersTbody = document.getElementById("ordersTbody");
const ordersError = document.getElementById("ordersError");

endpointLabel.textContent = `${ENDPOINT_GET_CLIENT}?id=1111`;

const SESSION_KEY = "atlantis_session_v1";

function setSession(session){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function getSession(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function showError(el, msg){ el.textContent = msg; el.hidden = false; }
function hideError(el){ el.textContent = ""; el.hidden = true; }

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

/* -------------------- AUTH -------------------- */
async function login(customerId, password){
  const url = `${ENDPOINT_GET_CLIENT}?id=${encodeURIComponent(customerId)}`;
  const resp = await fetch(url, { method: "GET" });
  const data = await resp.json().catch(() => ({}));

  if(!resp.ok){
    throw new Error(data?.message || `Error HTTP ${resp.status}`);
  }

  const customer = data?.customer;
  if(!customer) throw new Error("Respuesta inválida: falta customer");

  // Demo: compara password en frontend (ideal: token)
  if(String(customer.password) !== String(password)){
    throw new Error("Usuario o contraseña incorrectos");
  }

  const { password: _pw, ...safeCustomer } = customer;
  setSession({ customer: safeCustomer, loginId: String(customerId), loggedInAt: Date.now() });
  return safeCustomer;
}

function setAuthedUI(customer){
  loginCard.hidden = true;
  storeCard.hidden = false;

  userStatus.textContent = `${customer.Nombre} ${customer.Apellido} • ${customer.VIP ? "VIP" : "Cliente"}`;
  userPill.classList.add("authed");
  logoutBtn.hidden = false;
}

function setLoggedOutUI(){
  loginCard.hidden = false;
  storeCard.hidden = true;

  userStatus.textContent = "No autenticado";
  userPill.classList.remove("authed");
  logoutBtn.hidden = true;
}

/* -------------------- NAV -------------------- */
function setPage(mode){
  const isOrders = mode === "orders";

  if(isOrders){
    pageTitle.textContent = "Mis pedidos";
    pageSubtitle.textContent = "Histórico de pedidos asociados a tu cuenta.";
  }else{
    pageTitle.textContent = "Catálogo";
    pageSubtitle.textContent = "Elige, filtra y compra. (Simulación)";
  }

  ordersView.hidden = !isOrders;
  booksGrid.hidden = isOrders;

  // Desactivar filtros en vista pedidos
  searchInput.disabled = isOrders;
  genreSelect.disabled = isOrders;
  inStockOnly.disabled = isOrders;
  refreshBtn.disabled = isOrders;
}

function getAuthedClientId(){
  const s = getSession();
  const c = s?.customer || {};
  return String(c.idcliente ?? s?.loginId ?? "");
}

/* -------------------- BOOKS -------------------- */
let lastBooksPayload = null;

async function fetchBooks(){
  const resp = await fetch(ENDPOINT_GET_BOOKS, { method: "GET" });
  const data = await resp.json().catch(() => ({}));
  if(!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);
  if(!Array.isArray(data?.books)) throw new Error("Respuesta inválida: falta books[]");
  return data;
}

function renderGenres(books){
  const genres = Array.from(new Set(books.map(b => b.genero).filter(Boolean))).sort();
  genreSelect.innerHTML = `<option value="">Todos los géneros</option>`
    + genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

function computeStats(books){
  const total = books.length;
  const inStock = books.filter(b => Number(b.stock || 0) > 0).length;
  const genres = new Set(books.map(b => b.genero).filter(Boolean)).size;
  statBooks.textContent = total;
  statInStock.textContent = inStock;
  statGenres.textContent = genres;
}

function applyFilters(books){
  const q = (searchInput.value || "").trim().toLowerCase();
  const genre = genreSelect.value || "";
  const stockOnly = inStockOnly.checked;

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
  booksGrid.innerHTML = "";
  booksCount.textContent = `Mostrando ${books.length} de ${total}`;

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

  // Comprar (sin carrito): por ahora solo selecciona el libro
  booksGrid.querySelectorAll(".buyBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-bookid");
      const book = lastBooksPayload?.books?.find(x => String(x.id) === String(id));
      if(!book) return;
      alert(`Libro seleccionado:\n\n${book.titulo}\n${book.autor}\n\n(Checkout sin carrito pendiente)`);
    });
  });
}

async function loadBooksAndRender(){
  hideError(booksError);
  refreshBtn.disabled = true;

  try{
    const payload = await fetchBooks();
    lastBooksPayload = payload;

    renderGenres(payload.books);
    computeStats(payload.books);

    const filtered = applyFilters(payload.books);
    renderBooks(filtered, payload.total ?? payload.books.length);

  }catch(e){
    showError(booksError, e.message || "Error cargando libros");
    booksGrid.innerHTML = "";
    booksCount.textContent = "";
  }finally{
    refreshBtn.disabled = false;
  }
}

/* -------------------- ORDERS -------------------- */
async function fetchOrdersByClient(idcliente){
  const url = `${ENDPOINT_GET_ORDERS}?idcliente=${encodeURIComponent(idcliente)}`;
  const resp = await fetch(url, { method: "GET" });
  const data = await resp.json().catch(() => ({}));
  if(!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);
  if(!Array.isArray(data?.orders)) throw new Error("Respuesta inválida: falta orders[]");
  return data.orders;
}

function findBookTitle(idarticulo){
  const b = lastBooksPayload?.books?.find(x => String(x.id) === String(idarticulo));
  return b?.titulo || `Libro ${idarticulo}`;
}

function renderOrders(orders){
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
      <td>${escapeHtml(findBookTitle(o.idarticulo ?? ""))}</td>
    `;
    ordersTbody.appendChild(tr);
  }
}

async function loadOrdersAndRender(){
  hideError(ordersError);

  const idcliente = getAuthedClientId();
  if(!idcliente){
    showError(ordersError, "No se pudo determinar el id del cliente.");
    return;
  }

  refreshOrdersBtn.disabled = true;
  try{
    // Para mostrar títulos, aseguramos catálogo cargado al menos una vez
    if(!lastBooksPayload){
      const payload = await fetchBooks();
      lastBooksPayload = payload;
    }

    const orders = await fetchOrdersByClient(idcliente);
    renderOrders(orders);
  }catch(e){
    showError(ordersError, e.message || "Error cargando pedidos");
    ordersTbody.innerHTML = "";
  }finally{
    refreshOrdersBtn.disabled = false;
  }
}

/* -------------------- EVENTS -------------------- */
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideError(loginError);

  const customerId = document.getElementById("customerId").value.trim();
  const password = document.getElementById("password").value;

  try{
    const customer = await login(customerId, password);
    setAuthedUI(customer);
    setPage("catalog");
    await loadBooksAndRender();
  }catch(e){
    showError(loginError, e.message || "Error de autenticación");
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  setLoggedOutUI();
});

// Nav
navCatalogBtn.addEventListener("click", () => setPage("catalog"));
navOrdersBtn.addEventListener("click", async () => {
  setPage("orders");
  await loadOrdersAndRender();
});
refreshOrdersBtn.addEventListener("click", loadOrdersAndRender);

// Books
refreshBtn.addEventListener("click", loadBooksAndRender);
searchInput.addEventListener("input", () => {
  if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
});
genreSelect.addEventListener("change", () => {
  if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
});
inStockOnly.addEventListener("change", () => {
  if(lastBooksPayload) renderBooks(applyFilters(lastBooksPayload.books), lastBooksPayload.total ?? lastBooksPayload.books.length);
});

/* -------------------- INIT -------------------- */
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
