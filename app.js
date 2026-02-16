// ==========================
// CONFIG
// ==========================

const API_BASE = "https://tudominio-api.amazonaws.com/prod";

const ENDPOINT_CLIENT = `${API_BASE}/getClientDetails`;
const ENDPOINT_BOOKS = `${API_BASE}/getBooks`;
const ENDPOINT_ORDERS = `${API_BASE}/getOrdersbyClient`;

const SESSION_KEY = "atlantis_session_v1";

let currentCustomer = null;
let booksCache = [];

// ==========================
// SESSION
// ==========================

function saveSession(customer) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(customer));
}

function loadSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  return JSON.parse(data);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ==========================
// LOGIN
// ==========================

async function login() {
  const clientId = document.getElementById("clientId").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("loginError");

  errorEl.textContent = "";

  if (!clientId || !password) {
    errorEl.textContent = "Introduce cliente y contraseña.";
    return;
  }

  try {
    const res = await fetch(`${ENDPOINT_CLIENT}?clientId=${clientId}`);
    const data = await res.json();

    if (!data || !data.customer) {
      errorEl.textContent = "Cliente no encontrado.";
      return;
    }

    if (data.customer.password !== password) {
      errorEl.textContent = "Contraseña incorrecta.";
      return;
    }

    currentCustomer = data.customer;
    saveSession(currentCustomer);

    initGenesysForCustomer(currentCustomer);
    showStore();

  } catch (err) {
    console.error(err);
    errorEl.textContent = "Error conectando con el servidor.";
  }
}

function logout() {
  clearSession();
  currentCustomer = null;
  location.reload();
}

// ==========================
// GENESYS
// ==========================

function initGenesysForCustomer(customer) {
  if (!window.Genesys) return;

  Genesys("command", "Database.set", {
    messaging: {
      customAttributes: {
        customerId: customer.clientId,
        nombre: customer.nombre,
        apellido: customer.apellido,
        email: customer.email
      }
    }
  });
}

function openChat() {
  if (window.Genesys) {
    Genesys("command", "Messenger.open");
  }
}

// ==========================
// STORE VIEW
// ==========================

function showStore() {
  document.getElementById("loginCard").style.display = "none";
  document.getElementById("storeSection").style.display = "block";
  document.getElementById("userStatus").textContent =
    `Cliente: ${currentCustomer.nombre} ${currentCustomer.apellido}`;

  loadBooksAndRender();
}

// ==========================
// BOOKS
// ==========================

async function loadBooksAndRender() {
  try {
    const res = await fetch(ENDPOINT_BOOKS);
    const data = await res.json();

    booksCache = data.books || [];
    renderBooks(booksCache);

  } catch (err) {
    console.error("Error cargando libros", err);
  }
}

function renderBooks(books) {
  const container = document.getElementById("booksContainer");
  container.innerHTML = "";

  books.forEach((book) => {
    const div = document.createElement("div");
    div.className = "book-card";

    div.innerHTML = `
      <h3>${book.titulo}</h3>
      <p>${book.autor}</p>
      <strong>${book.precio} €</strong>
    `;

    container.appendChild(div);
  });
}

// ==========================
// ORDERS
// ==========================

function normalizeOrderRow(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      idPedido: "—",
      fecha: "—",
      estado: "—",
      idarticulo: null
    };
  }

  return {
    idPedido: raw.ordernumber ?? "—",
    fecha: raw.fechadecompra ?? raw.fecha ?? "—",
    estado: raw.estado ?? raw.status ?? "—",
    idarticulo: raw.idarticulo ?? raw.bookid ?? null
  };
}

async function loadOrdersAndRender() {
  try {
    const res = await fetch(
      `${ENDPOINT_ORDERS}?clientId=${currentCustomer.clientId}`
    );
    const data = await res.json();

    const ordersArr = data.orders || [];

    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";

    ordersArr.forEach((rawRow) => {
      const o = normalizeOrderRow(rawRow);

      const libro = booksCache.find(
        (b) => b.idarticulo === o.idarticulo
      );

      const titulo = libro ? libro.titulo : "Libro no encontrado";
      const importe = libro ? libro.precio ?? null : null;

      const row = document.createElement("div");
      row.className = "order-row";

      row.innerHTML = `
        <div><strong>Pedido:</strong> ${o.idPedido}</div>
        <div><strong>Fecha:</strong> ${o.fecha}</div>
        <div><strong>Estado:</strong> ${o.estado}</div>
        <div><strong>Libro:</strong> ${titulo}</div>
        <div><strong>Importe:</strong> ${
          importe ? importe + " €" : "—"
        }</div>
      `;

      container.appendChild(row);
    });

  } catch (err) {
    console.error("Error cargando pedidos", err);
  }
}

// ==========================
// INIT
// ==========================

document.addEventListener("DOMContentLoaded", () => {
  const session = loadSession();
  if (session) {
    currentCustomer = session;
    initGenesysForCustomer(currentCustomer);
    showStore();
  }

  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("chatBtn")?.addEventListener("click", openChat);
  document
    .getElementById("ordersBtn")
    ?.addEventListener("click", loadOrdersAndRender);
});
