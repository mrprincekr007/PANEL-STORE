/* ==========================================================================
   NEXUS CORE - UNIVERSAL FIREBASE CONFIG ENGINE
   Path: js/firebase-config.js
   Description: Supports Complete Authentication (Email + Google) & Realtime DB.
========================================================================== */

// 1. FIREBASE APP IMPORT
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";

// 2. FIREBASE AUTH IMPORTS
import { 
    getAuth, 
    GoogleAuthProvider,
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 3. FIREBASE REALTIME DATABASE IMPORTS
import { 
    getDatabase, 
    ref, 
    onValue, 
    get,
    push, 
    set, 
    update, 
    remove, 
    runTransaction,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";


// 4. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyD9hHDcTFh0a-3eSsXJ-sdD4_U78bsagYA",
  authDomain: "prince-hacks-test.firebaseapp.com",
  databaseURL: "https://prince-hacks-test-default-rtdb.firebaseio.com",
  projectId: "prince-hacks-test",
  storageBucket: "prince-hacks-test.firebasestorage.app",
  messagingSenderId: "1070897490445",
  appId: "1:1070897490445:web:17b1cb1461fd76bb888344"
};

// 5. INITIALIZE APP, AUTH & DATABASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

console.log("[SYSTEM] Firebase Engine 10.13.2 Running Seamlessly.");

// 6. EXPORT ALL MODULES FOR USE IN OTHER JS FILES
export {
    app,
    auth,
    db,
    googleProvider,
    
    // Auth Exports
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    
    // Database Exports
    ref,
    set,
    get,
    update,
    remove,
    push,
    onValue,
    runTransaction,
    serverTimestamp
};
