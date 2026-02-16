// Atlantis — demo bookstore (integrada con Genesys Cloud Web Messenger)

// ================= ENDPOINTS =================
const API_BASE = "https://tpipaxfpf1.execute-api.eu-north-1.amazonaws.com";

const ENDPOINT_GET_CLIENT = `${API_BASE}/getClientDetails`;
const ENDPOINT_GET_BOOKS = `${API_BASE}/getBooks`;
const ENDPOINT_GET_ORDERS = `${API_BASE}/getOrdersbyClient`;

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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================= LOGIN =================
async function login(customerId, password) {
  const url = `${ENDPOINT_GET_CLIENT}?id=${encodeURIComponent(customerId)}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) throw new Error("Error login");

  const customer = data?.customer;
  if (!customer) throw new Error("Cliente no encontrado");

  if (String(customer.password) !== String(password)) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  const { password: _pw, ...safeCustomer } = customer;

  setSession({
    customer: safeCustomer,
    loginId: String(customerId),
    loggedInAt: Date.now(),
  });

  return safeCustomer;
}

// ================= BOOKS =================
let bookPriceMap = null;
let bookTitleMap = null;

async function loadBooksAndBuildPriceMap() {
  const resp = await fetch(ENDPOINT_GET_BOOKS);
  const data = await resp.json();

  if (!Array.isArray(data.books)) return;

  bookPriceMap = {};
  bookTitleMap = {};

  data.books.forEach((b) => {
    const idKey = String(b.id ?? b.idarticulo ?? "");
    const price = Number(b.precio ?? 0);
    const title = String(b.titulo ?? "").trim();

    if (idKey) {
      bookPriceMap[idKey] = Number.isFinite(price) ? price : null;
      bookTitleMap[idKey] = title || null;
    }
  });
}

function getFormattedPriceForArticle(idart) {
  if (!idart || !bookPriceMap) return null;
  const price = bookPriceMap[String(idart)];
  if (price == null) return null;
  return `${Number(price).toFixed(2)} €`;
}

function getTitleForArticle(idart) {
  if (!idart || !bookTitleMap) return null;
  return bookTitleMap[String(idart)] || null;
}

// ================= NORMALIZADOR ORDERS =================
function normalizeOrderRow(raw) {
  return {
    idPedido: raw?.ordernumber ?? "—",
    fecha: raw?.fechadecompra ?? "—",
    estado: raw?.estado ?? "—",
    idarticulo: raw?.idarticulo ?? null,
    importe: null
  };
}

// ================= ORDERS =================
async function fetchOrdersByClient(idcliente) {
  const url = `${ENDPOINT_GET_ORDERS}?idcliente=${encodeURIComponent(idcliente)}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (!Array.isArray(data.orders)) return [];
  return data.orders;
}

async function loadOrdersAndRender() {
  const ordersTbody = document.getElementById("ordersTbody");
  const session = getSession();

  if (!session?.customer?.id) return;
  if (!ordersTbody) return;

  ordersTbody.innerHTML = "";

  if (!bookPriceMap || !bookTitleMap) {
    await loadBooksAndBuildPriceMap();
  }

  const ordersArr = await fetchOrdersByClient(session.customer.id);

  if (!ordersArr.length) {
    ordersTbody.innerHTML =
      `<tr><td colspan="5">No hay pedidos para este cliente.</td></tr>`;
    return;
  }

  // Ordenar por fecha descendente
  const parseDate = (s) => {
    if (!s) return 0;
    const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return 0;
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return new Date(year, month, day).getTime();
  };

  ordersArr.sort((a, b) =>
    parseDate(b.fechadecompra) - parseDate(a.fechadecompra)
  );

  ordersArr.forEach((raw) => {
    const o = normalizeOrderRow(raw);

    const title = getTitleForArticle(o.idarticulo) || "—";
    const importe = getFormattedPriceForArticle(o.idarticulo) || "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(o.idPedido))}</td>
      <td>${escapeHtml(String(o.fecha))}</td>
      <td>${escapeHtml(String(o.estado))}</td>
      <td>${escapeHtml(String(title))}</td>
      <td>${escapeHtml(String(importe))}</td>
    `;

    ordersTbody.appendChild(tr);
  });
}
