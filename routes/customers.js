const express = require("express");
const router = express.Router();

const { verifyFirebaseToken } = require("../middleware/firebaseAuth");
const { registerCustomer } = require("../controllers/customerController");

router.post("/register", verifyFirebaseToken, registerCustomer);

module.exports = router;
