# Atlantis — Bookstore Demo (Modern UI)

Static website to simulate a bookstore called **Atlantis**, ready for **GitHub Pages**.

## What it does
- Login against your AWS endpoint:
  - `GET /getClientDetails?id=...`
  - Validates password on the frontend (demo)
- Loads catalog from:
  - `GET /getBooks`
- Modern UI with bookstore photos (Unsplash) and a cart drawer
- "Comprar" button per book (simulated checkout)

## Configure endpoints
Edit `app.js`:
- `API_BASE`
- `ENDPOINT_GET_CLIENT`
- `ENDPOINT_GET_BOOKS`

## Deploy on GitHub Pages
1. Push these files to a GitHub repo
2. Settings → Pages → Deploy from branch → `main` / root
3. Open your GitHub Pages URL

## Notes
- For production: do NOT return/store passwords. Use a login endpoint that returns a token.

## Orders page
- After login, user can open **Mis pedidos**.
- Loads orders from:
  - `GET /getordersbyclient?idcliente=...`
