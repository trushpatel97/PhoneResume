// Configuration file template - Copy this to config.js and replace with your actual values
// DO NOT COMMIT config.js TO VERSION CONTROL
const config = {
    firebase: {
        apiKey: "your_firebase_api_key_here",
        authDomain: "your_firebase_auth_domain_here",
        projectId: "your_firebase_project_id_here",
        storageBucket: "your_firebase_storage_bucket_here",
        messagingSenderId: "your_messaging_sender_id_here",
        appId: "your_firebase_app_id_here",
        measurementId: "your_firebase_measurement_id_here"
    },
    googleSearch: {
        apiKey: "your_google_search_api_key_here",
        searchEngineId: "your_search_engine_id_here",
        firebaseApiKey: "your_firebase_api_key_here"  // Used in comparison check
    },
    emailJs: {
        userId: "your_email_js_user_id_here"
    }
};

// Instructions:
// 1. Copy this file to config.js
// 2. Replace all placeholder values with your actual API keys
// 3. Never commit config.js to version control 