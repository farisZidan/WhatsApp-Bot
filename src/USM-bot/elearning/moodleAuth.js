const axios = require('axios');

async function loginMoodleApi(username, password) {
    const url = "https://elearning.usm.ac.id/login/token.php";
    
    try {
        // Menggunakan metode POST dan menyamar sebagai aplikasi Moodle Android
        const response = await axios.post(url, new URLSearchParams({
            username: username,
            password: password,
            service: 'moodle_mobile_app'
        }), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11) MoodleMobile"
            }
        });
        
        return response.data;
    } catch (error) {
        console.error("[MOODLE API ERROR]", error.message);
        
        // Menangkap pesan error spesifik dari server jika ada
        if (error.response && error.response.data) {
            console.error("[MOODLE API DETAIL]", error.response.data);
        }
        
        return null;
    }
}

module.exports = { loginMoodleApi };