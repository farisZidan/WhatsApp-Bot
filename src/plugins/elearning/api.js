// src/plugins/elearning/api.js
const MOODLE_API_URL = "https://elearning.usm.ac.id/webservice/rest/server.php";

// 🛡️ PENYAMARAN DALVIK & POSTMAN
// Menggunakan UA non-browser agar tidak terbentur JA3 TLS Fingerprint Cloudflare
const HEADERS = { 
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
};

/**
 * Request Universal Moodle dengan Logging Detail untuk Debugging
 */
async function callMoodleApi(wsfunction, token, extraParams = {}) {
    const params = new URLSearchParams({
        wstoken: token,
        wsfunction: wsfunction,
        moodlewsrestformat: 'json',
        ...extraParams
    });

    const targetUrl = `${MOODLE_API_URL}?${params.toString()}`;

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: HEADERS
        });

        const responseText = await response.text();

        // Jika status HTTP bukan 200 OK (misal 403 Forbidden / 503)
        if (!response.ok) {
            console.error(`\n[ELEARNING API DEBUG] ❌ HTTP ${response.status} Error:`);
            console.error(`[ELEARNING API DEBUG] Response Snippet:`, responseText.slice(0, 300));
            throw new Error(`HTTP_${response.status}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error(`\n[ELEARNING API DEBUG] ❌ Server mengirim HTML (Bukan JSON):`);
            console.error(responseText.slice(0, 300));
            throw new Error('INVALID_JSON');
        }

        // Moodle exception handler
        if (data?.exception) {
            console.error(`\n[ELEARNING API DEBUG] ⚠️ Moodle Exception:`, data);
            throw new Error('TOKEN_INVALID');
        }

        return data;

    } catch (error) {
        console.error(`[ELEARNING API ERROR]: ${error.message}`);
        throw error;
    }
}

/**
 * Mengambil informasi profil (termasuk User ID) dari Moodle
 */
async function getSiteInfo(token) {
    return await callMoodleApi('core_webservice_get_site_info', token);
}

/**
 * Mengambil daftar mata kuliah berdasarkan User ID
 */
async function getCourses(token, userid) {
    return await callMoodleApi('core_enrol_get_users_courses', token, { userid });
}

module.exports = { getSiteInfo, getCourses };
