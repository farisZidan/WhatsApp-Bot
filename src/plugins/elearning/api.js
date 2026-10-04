// src/plugins/elearning/api.js
const MOODLE_API_URL = "https://elearning.usm.ac.id/webservice/rest/server.php";

const HEADERS = { 
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
};

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

        if (!response.ok) {
            console.error(`[ELEARNING API DEBUG] ❌ HTTP ${response.status} Error`);
            throw new Error(`HTTP_${response.status}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error('INVALID_JSON');
        }

        if (data?.exception) {
            throw new Error('TOKEN_INVALID');
        }

        return data;

    } catch (error) {
        console.error(`[ELEARNING API ERROR]: ${error.message}`);
        throw error;
    }
}

async function getSiteInfo(token) {
    return await callMoodleApi('core_webservice_get_site_info', token);
}

async function getCourses(token, userid) {
    return await callMoodleApi('core_enrol_get_users_courses', token, { userid });
}

/**
 * Mengambil daftar event/tugas dari Moodle mulai dari timestamp tertentu
 * @param {string} token 
 * @param {number} timesortfrom Unix timestamp awal (misal awal semester)
 */
async function getActionEvents(token, timesortfrom) {
    return await callMoodleApi('core_calendar_get_action_events_by_timesort', token, {
        timesortfrom: timesortfrom
    });
}

module.exports = { getSiteInfo, getCourses, getActionEvents };