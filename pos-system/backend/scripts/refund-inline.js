"use strict";
require("dotenv/config");

const BASE_URL = "http://localhost:" + (process.env.PORT || 5656) + "/api";

async function asJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

async function login() {
  const url = BASE_URL + "/auth/login";
  console.log(" POST " + url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const data = await asJson(res);
  if (!res.ok) throw new Error("Login failed: " + res.status + " " + res.statusText + " :: " + JSON.stringify(data).slice(0, 400));
  const token = data.token || data.accessToken || data.access_token || (data.data ? data.data.token : null);
  if (!token) throw new Error("No token in login response");
  console.log(" Logged in");
  return token;
}

function headersWithAuth(token) {
  return { "Content-Type": "application/json", Authorization: "Bearer " + token };
}

async function createProduct(token) {
  const url = BASE_URL + "/products";
  const body = {
    code: "TEST-" + Date.now(),
    name: "Producto Prueba Reembolso",
    category: "Otros",
    material: "Acero",
    purchasePrice: 10,
    salePrice: 15,
    stock: 100,
    minStock: 1,
  };
  console.log(" POST " + url);
  const res = await fetch(url, { method: "POST", headers: headersWithAuth(token), body: JSON.stringify(body) });
  const data = await asJson(res);
  if (!res.ok) throw new Error("Create product failed: " + res.status + " " + res.statusText + " :: " + JSON.stringify(data).slice(0, 400));
  const product = data.data || data.product || data;
  const productId = (product && product.id) || (product && product.data && product.data.id);
  if (!productId) throw new Error("No product id in response: " + JSON.stringify(data).slice(0, 400));
  console.log(" Product created: " + productId);
  return { productId: productId, product: product };
}

async function createSale(token, productId, unitPrice) {
  const url = BASE_URL + "/sales";
  const body = { items: [{ productId: productId, quantity: 1, unitPrice: unitPrice || 15 }], paymentMethod: "cash" };
  console.log(" POST " + url);
  const res = await fetch(url, { method: "POST", headers: headersWithAuth(token), body: JSON.stringify(body) });
  const data = await asJson(res);
  if (!res.ok) throw new Error("Create sale failed: " + res.status + " " + res.statusText + " :: " + JSON.stringify(data).slice(0, 400));
  const sale = data.data || data.sale || data;
  const saleId = (sale && sale.id) || (sale && sale.data && sale.data.id);
  if (!saleId) throw new Error("No sale id in response: " + JSON.stringify(data).slice(0, 400));
  console.log(" Sale created: " + saleId);
  return { saleId: saleId, sale: sale };
}

async function refundSale(token, saleId) {
  const url = BASE_URL + "/sales/" + saleId + "/refund";
  console.log(" POST " + url);
  const res = await fetch(url, { method: "POST", headers: headersWithAuth(token) });
  const data = await asJson(res);
  if (!res.ok) throw new Error("Refund failed: " + res.status + " " + res.statusText + " :: " + JSON.stringify(data).slice(0, 400));
  console.log(" Refund success: " + JSON.stringify(data).slice(0, 400));
  return data;
}

(async function () {
  try {
    console.log(" Iniciando flujo de prueba de reembolso (inline)");
    const token = await login();
    const createdProduct = await createProduct(token);
    const productId = createdProduct.productId;
    const product = createdProduct.product;
    const createdSale = await createSale(token, productId, (product && product.salePrice) || 15);
    const saleId = createdSale.saleId;
    await refundSale(token, saleId);
    console.log(" Flujo de reembolso completado");
  } catch (err) {
    console.error(" Error en flujo de reembolso:", (err && err.message) || err);
    process.exitCode = 1;
  }
})();
