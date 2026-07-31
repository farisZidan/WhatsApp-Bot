const axios = require('axios');

async function loginSima(username, password) {
    const url = "https://sima.usm.ac.id/index.php/api/login/sia";
    const payload = { username, password };
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11)"
    };

    try {
        const response = await axios.patch(url, payload, { headers });
        return response.data;
    } catch (error) {
        console.error("[SIMA AUTH ERROR]", error.message);
        return null;
    }
}

module.exports = { loginSima };