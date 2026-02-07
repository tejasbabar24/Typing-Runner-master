// Initialize Firebase and export the app + analytics for other modules to import
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";

// Firebase config (copied from index.html)
const firebaseConfig = {
  apiKey: "AIzaSyCCq2nG2tzcKxKRf6qhgNNDp_c0-8h89b4",
  authDomain: "type-runner-88004.firebaseapp.com",
  projectId: "type-runner-88004",
  storageBucket: "type-runner-88004.firebasestorage.app",
  messagingSenderId: "1061909188964",
  appId: "1:1061909188964:web:7bceef494b6bf5009c2a71",
  measurementId: "G-27SKT1N55V",
};

const app = initializeApp(firebaseConfig);
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // analytics may fail in some environments (e.g., file://), ignore
}

export { app, analytics };
export default app;
