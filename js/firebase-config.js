// ==========================================================
//
// FILE : js/firebase-config.js
//
// NEXUS CORE
//
// Firebase Config
//
// ==========================================================


// ==============================
// FIREBASE APP
// ==============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";


// ==============================
// FIREBASE AUTH
// ==============================

import {

getAuth,
GoogleAuthProvider,

createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signInWithPopup,
sendPasswordResetEmail,
signOut,
onAuthStateChanged

} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


// ==============================
// REALTIME DATABASE
// ==============================

import {

getDatabase,
ref,
set,
get,
update,
remove,
push,
onValue

} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";




// ==============================
// FIREBASE CONFIG
// ==============================

const firebaseConfig={

apiKey:"AIzaSyD9hHDcTFh0a-3eSsXJ-sdD4_U78bsagYA",

authDomain:"prince-hacks-test.firebaseapp.com",

databaseURL:"https://prince-hacks-test-default-rtdb.firebaseio.com",

projectId:"prince-hacks-test",

storageBucket:"prince-hacks-test.firebasestorage.app",

messagingSenderId:"1070897490445",

appId:"1:1070897490445:web:17b1cb1461fd76bb888344"

};




// ==============================
// INITIALIZE
// ==============================

const app=initializeApp(firebaseConfig);

const auth=getAuth(app);

const db=getDatabase(app);

const googleProvider=new GoogleAuthProvider();




// ==============================
// EXPORT
// ==============================

export{

app,

auth,
db,

googleProvider,

createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signInWithPopup,
sendPasswordResetEmail,
signOut,
onAuthStateChanged,

ref,
set,
get,
update,
remove,
push,
onValue

};