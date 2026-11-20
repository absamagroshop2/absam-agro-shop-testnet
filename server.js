
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PI_API_URL = (
  process.env.PI_API_URL || "https://api.minepi.com/v2"
).replace(/\/+$/, "");

const PI_API_KEY = process.env.PI_API_KEY;

// Vérification de la configuration
function checkConfig(res) {
  if (!PI_API_KEY) {
    res.status(503).json({
      success: false,
      error: "PI_API_KEY non configurée sur Render"
    });
    return false;
  }
  return true;
}

// Vérification de l'identité Pi
async function verifyUser(req) {
  const token = req.headers.authorization || "";

  if (!token.startsWith("Bearer ")) {
    throw new Error("Authentification Pi manquante");
  }

  const accessToken = token.slice(7);

  const response = await fetch(`${PI_API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Authentification Pi invalide");
  }

  return await response.json();
}

// Vérification de propriété du paiement
async function getPayment(paymentId) {
  const response = await fetch(
    `${PI_API_URL}/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Key ${PI_API_KEY}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Impossible de vérifier le paiement Pi");
  }

  return data;
}

// Accueil
app.get("/", (req, res) => {
  res.json({
    service: "ABSAM AGRO SHOP",
    status: "Pi payment server ready",
    network: "TESTNET"
  });
});

// Contrôle de santé
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "ABSAM AGRO SHOP TESTNET"
  });
});

// APPROBATION DU PAIEMENT
app.post("/api/payments/approve", async (req, res) => {
  if (!checkConfig(res)) return;

  try {
    const { paymentId } = req.body;

    if (
      typeof paymentId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(paymentId)
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment ID invalide"
      });
    }

    const user = await verifyUser(req);
    const payment = await getPayment(paymentId);

    if (payment.user_uid !== user.uid) {
      return res.status(403).json({
        success: false,
        error: "Ce paiement ne correspond pas à cet utilisateur"
      });
    }

    const response = await fetch(
      `${PI_API_URL}/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`
        }
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Erreur approbation:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// CONFIRMATION DU PAIEMENT
app.post("/api/payments/complete", async (req, res) => {
  if (!checkConfig(res)) return;

  try {
    const { paymentId, txid } = req.body;

    if (
      typeof paymentId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(paymentId) ||
      typeof txid !== "string" ||
      txid.length < 10 ||
      txid.length > 200
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment ID ou TXID invalide"
      });
    }

    const user = await verifyUser(req);
    const payment = await getPayment(paymentId);

    if (payment.user_uid !== user.uid) {
      return res.status(403).json({
        success: false,
        error: "Utilisateur non autorisé"
      });
    }

    const response = await fetch(
      `${PI_API_URL}/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ txid })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json({
      success: true,
      message: "Paiement Pi confirmé par le serveur",
      payment: data
    });

  } catch (error) {
    console.error("Erreur confirmation:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Démarrage du serveur
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ABSAM AGRO SHOP TESTNET actif sur le port ${PORT}`
  );
});
  
