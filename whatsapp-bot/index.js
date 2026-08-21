// Bot mínimo de WhatsApp: se vincula escaneando un QR (sin Meta, sin costo por
// mensaje) y expone POST /send para que Django le pida enviar mensajes.
// Uso: npm install && node index.js — escanear el QR la primera vez, la sesión
// queda guardada en ./auth/ y no hace falta volver a escanear.
require("dotenv").config();
const express = require("express");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || "";

let sock;

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "close") {
      const debeReconectar =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
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

conectar();
app.listen(PORT, () => console.log(`whatsapp-bot escuchando en :${PORT}`));
