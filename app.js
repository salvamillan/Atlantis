// Atlantis — demo bookstore (GitHub Pages)

// ================= ENDPOINTS =================
const API_BASE = "https://tpipaxfpf1.execute-api.eu-north-1.amazonaws.com";

const ENDPOINT_GET_CLIENT = `${API_BASE}/getClientDetails`;
const ENDPOINT_GET_BOOKS = `${API_BASE}/getBooks`;
const ENDPOINT_GET_ORDERS = `${API_BASE}/getordersbyclient`; // 👈 usa ?id=

// ================= UI REFS =================
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

endpointLabel.textContent = `${ENDPOINT_GET_CLIENT}?id=1111`;

const SESSION_KEY = "atlantis_session_v1";

// ================= UTIL =================
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
  loginCard.hidden = true;
  storeCard.hidden = false;
  userStatus.textContent = `${customer.Nombre} ${customer.Apellido}`;
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

// ================= NAV =================
function setPage(mode){
  const isOrders = mode === "orders";

  if(isOrders){
    pageTitle.textContent = "Mis pedidos";
    pageSubtitle.textContent = "Histórico de pedidos asociados a tu cuenta.";
  } else {
    pageTitle.textContent = "Catálogo";
    pageSubtitle.textContent = "Elige, filtra y compra.";
  }

  ordersView.hidden = !isOrders;
  booksGrid.hidden = isOrders;

  searchInput.disabled = isOrders;
  genreSelect.disabled = isOrders;
  inStockOnly.disabled = isOrders;
  refreshBtn.disabled = isOrders;
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

function renderBooks(books, total){
  booksGrid.innerHTML = "";
  booksCount.textContent = `Mostrando ${books.length} de ${total}`;

  for(const b of books){
    const stock = Number(b.stock ?? 0);
    const price = Number(b.precio ?? 0);

    const el = document.createElement("article");
    el.className = "bookCard";

    el.innerHTML = `
      <div class="cover"></div>
      <div class="cardBody">
        <div class="titleRow">${escapeHtml(b.titulo)}</div>
        <div class="meta">${escapeHtml(b.autor)}</div>
        <div class="bottomRow">
          <div>
            <div class="price">${formatEUR(price)}</div>
            <div class="stock">Stock: ${stock}</div>
          </div>
          <button class="buyBtn" ${stock > 0 ? "" : "disabled"}>
            Comprar
          </button>
        </div>
      </div>
    `;

    booksGrid.appendChild(el);
  }
}

async function loadBooksAndRender(){
  hideError(booksError);
  try{
    const payload = await fetchBooks();
    lastBooksPayload = payload;
    renderBooks(payload.books, payload.total ?? payload.books.length);
  }catch(e){
    showError(booksError, e.message);
  }
}

// ================= ORDERS =================
async function fetchOrdersByClient(id){
  // ✅ CORRECTO: usa ?id=
  const url = `${ENDPOINT_GET_ORDERS}?id=${encodeURIComponent(id)}`;
  console.log("Fetching orders:", url);

  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if(!resp.ok) throw new Error(data?.message || `Error HTTP ${resp.status}`);
  if(!Array.isArray(data?.orders)) throw new Error("Respuesta inválida");

  return data.orders;
}

function renderOrders(orders){
  ordersTbody.innerHTML = "";

  if(orders.length === 0){
    ordersTbody.innerHTML = `<tr><td colspan="4">No tienes pedidos.</td></tr>`;
    return;
  }

  const sorted = [...orders].sort((a,b) => b.ordernumber - a.ordernumber);

  for(const o of sorted){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${escapeHtml(o.ordernumber)}</td>
      <td>${escapeHtml(o.fechadecompra)}</td>
      <td>${escapeHtml(o.estado)}</td>
      <td>${escapeHtml(o.idarticulo)}</td>
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

  try{
    const orders = await fetchOrdersByClient(id);
    renderOrders(orders);
  }catch(e){
    showError(ordersError, e.message);
  }
}

// ================= EVENTS =================
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
    showError(loginError, e.message);
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  setLoggedOutUI();
});

navCatalogBtn.addEventListener("click", () => setPage("catalog"));
navOrdersBtn.addEventListener("click", async () => {
  setPage("orders");
  await loadOrdersAndRender();
});
refreshOrdersBtn.addEventListener("click", loadOrdersAndRender);

refreshBtn.addEventListener("click", loadBooksAndRender);

// ================= INIT =================
(function init(){
  const session = getSession();
  if(session?.customer){
    setAuthedUI(session.customer);
    setPage("catalog");
    loadBooksAndRender();
  } else {
    setLoggedOutUI();
  }
})();
