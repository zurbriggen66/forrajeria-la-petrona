// Bot mínimo de WhatsApp: se vincula escaneando un QR (sin Meta, sin costo por
// mensaje) y expone POST /send para que Django le pida enviar mensajes.
// Uso: npm install && node index.js — escanear el QR la primera vez, la sesión
// queda guardada en ./auth/ y no hace falta volver a escanear.
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const qrcodeTerminal = require("qrcode-terminal");
const qrcode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || "";

let sock;
// Estado consultado por GET /status (lo usa el panel de Config del ERP para
// mostrar el QR sin depender de mirar la terminal del bot).
let estado = { estado: "conectando", qr: null };

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcodeTerminal.generate(qr, { small: true });
      estado = { estado: "esperando_qr", qr: await qrcode.toDataURL(qr) };
    }
    if (connection === "open") {
      estado = { estado: "conectado", qr: null };
    }
    if (connection === "close") {
      const debeReconectar =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      estado = { estado: "desconectado", qr: null };
      if (debeReconectar) conectar();
    }
  });
}

// Los números se cargan en formato local argentino (ej. "3562517046"), pero
// WhatsApp necesita el prefijo de país + "9" de celular (549...). Si ya viene
// con el 54 no se toca.
// ponytail: no maneja el viejo prefijo "15" intercalado (ej. "011 15-4000-0000");
// si aparece ese caso, agregar el strip de "15" después del código de área.
function telefonoAJid(telefono) {
  let digitos = String(telefono).replace(/\D/g, "");
  digitos = digitos.replace(/^0/, "");
  if (!digitos.startsWith("54")) digitos = "549" + digitos;
  return `${digitos}@s.whatsapp.net`;
}

const app = express();
app.use(express.json());

app.get("/status", (req, res) => {
  if (API_KEY && req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json(estado);
});

app.post("/send", async (req, res) => {
  if (API_KEY && req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { telefono, mensaje } = req.body || {};
  if (!telefono || !mensaje) {
    return res.status(400).json({ error: "telefono y mensaje son requeridos" });
  }
  try {
    const jid = telefonoAJid(telefono);
    const [info] = await sock.onWhatsApp(jid);
    if (!info?.exists) {
      return res.status(422).json({ error: `${telefono} no tiene WhatsApp` });
    }
    await sock.sendMessage(info.jid, { text: mensaje });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Para cambiar de celular: cierra la sesión vinculada y borra las
// credenciales guardadas, así el bot arranca de cero y el próximo /status
// ya trae un QR nuevo para escanear desde el celular nuevo.
app.post("/disconnect", async (req, res) => {
  if (API_KEY && req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    fs.rmSync("auth", { recursive: true, force: true });
    estado = { estado: "conectando", qr: null };
    conectar();
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

conectar();
// Sólo loopback: el único que le habla es Django, desde la misma máquina
// (core/whatsapp.py). Bindear a 0.0.0.0 dejaría /send accesible desde afuera,
// y si API_KEY viene vacía la verificación de arriba se saltea entera.
app.listen(PORT, "127.0.0.1", () =>
  console.log(`whatsapp-bot escuchando en 127.0.0.1:${PORT}`)
);
