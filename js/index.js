/* ==========================================================================
   NEXUS CORE - GATEWAY (LOGIN & SIGNUP ENGINE)
   Path: js/index.js
   Description: Handles Email Auth, Google Auth, Password Resets, 
                and User Profile Generation in Firebase Realtime DB.
========================================================================== */

// ==========================================================
// 1. FIREBASE IMPORTS
// ==========================================================
// Yahan hum apna universal config import kar rahe hain. 
// Kyunki index.js aur firebase-config.js dono 'js' folder me hain, path './' hoga.
import {
    auth,
    db,
    googleProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    ref,
    set,
    get,
    push,
    update,
    runTransaction,
    serverTimestamp
} from "./firebase-config.js";

console.log("[SYSTEM] Nexus Core Auth Engine Initialized.");

// ==========================================================
// 2. DOM ELEMENTS SELECTION
// ==========================================================

// Tabs
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

// Login Inputs
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");

// Signup Inputs
const signupName = document.getElementById("signupName");
const signupUsername = document.getElementById("signupUsername");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");
const signupBtn = document.getElementById("signupBtn");

// Extra Buttons & Options
const googleLogin = document.getElementById("googleLogin");
const forgotPassword = document.getElementById("forgotPassword");
const rememberMe = document.getElementById("rememberMe");

// Password Eye Toggles
const loginEye = document.getElementById("loginEye");
const signupEye = document.getElementById("signupEye");
const confirmEye = document.getElementById("confirmEye");

// UI State Elements
const loadingScreen = document.getElementById("loadingScreen");
const toastBox = document.getElementById("toastBox");

// Global State Variables
let loginRunning = false;
let signupRunning = false;
let currentUser = null;


// ==========================================================
// 3. UI UTILITY FUNCTIONS (Loaders & Toasts)
// ==========================================================

function showLoading() {
    if(loadingScreen) loadingScreen.classList.add("active");
}

function hideLoading() {
    if(loadingScreen) loadingScreen.classList.remove("active");
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Add specific icon based on type
    let icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    if (type === "warning") icon = "fa-triangle-exclamation";
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    toastBox.appendChild(toast);
    
    // Auto remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Button loading state manager
function buttonLoading(button, state, text = "Please Wait...") {
    if (state) {
        button.disabled = true;
        button.dataset.html = button.innerHTML; // Save original HTML
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${text}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.html) {
            button.innerHTML = button.dataset.html; // Restore original HTML
        }
    }
}


// ==========================================================
// 4. VALIDATION FUNCTIONS
// ==========================================================

function isEmpty(value) {
    return value.trim() === "";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return password.length >= 6;
}


// ==========================================================
// 4.5. REFERRAL PARAMETER
// ==========================================================
const refParam = new URLSearchParams(window.location.search).get('ref') || null;
console.log("[REF] Referral param:", refParam);

// ==========================================================
// 5. TAB SWITCHING LOGIC (Login <-> Signup)
// ==========================================================

if(loginTab && signupTab) {
    loginTab.onclick = () => {
        loginTab.classList.add("active");
        signupTab.classList.remove("active");
        loginForm.classList.add("active");
        signupForm.classList.remove("active");
    };

    signupTab.onclick = () => {
        signupTab.classList.add("active");
        loginTab.classList.remove("active");
        signupForm.classList.add("active");
        loginForm.classList.remove("active");
    };

    // Check URL param for ?tab=register
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register') {
        signupTab.click();
    }
}


// ==========================================================
// 6. PASSWORD VISIBILITY TOGGLE (Eye Icon)
// ==========================================================

function setupPasswordToggle(button, inputField) {
    if(!button || !inputField) return;
    
    button.onclick = () => {
        if (inputField.type === "password") {
            inputField.type = "text";
            button.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
            inputField.type = "password";
            button.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
    };
}

setupPasswordToggle(loginEye, loginPassword);
setupPasswordToggle(signupEye, signupPassword);
setupPasswordToggle(confirmEye, signupConfirm);


// ==========================================================
// 7. REMEMBER ME (Local Storage)
// ==========================================================

const savedEmail = localStorage.getItem("nexusRememberEmail");
if (savedEmail && loginEmail && rememberMe) {
    loginEmail.value = savedEmail;
    rememberMe.checked = true;
}

function handleRememberMe() {
    if (rememberMe && rememberMe.checked) {
        localStorage.setItem("nexusRememberEmail", loginEmail.value.trim());
    } else {
        localStorage.removeItem("nexusRememberEmail");
    }
}


// ==========================================================
// 8. AUTO-LOGIN CHECK (Bina Login Home Page Prevent)
// ==========================================================
// Agar user pehle se logged in hai, toh turant home.html par bhej do
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("[AUTH] Active session found. Redirecting to Dashboard...");
        window.location.href = "home.html";
    } else {
        // Agar user nahi hai, tabhi loading screen hatao taaki wo login form dekh sake
        hideLoading();
    }
});


// ==========================================================
// 9. STANDARD EMAIL LOGIN
// ==========================================================

if(loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (loginRunning) return;

        let emailVal = loginEmail.value.trim();
        const passVal = loginPassword.value;

        if (isEmpty(emailVal)) return showToast("Enter Email or Username", "warning");
        if (isEmpty(passVal)) return showToast("Enter Password", "warning");

        // Check if input is a username (not email)
        if (!emailVal.includes('@')) {
            try {
                const usersSnap = await get(ref(db, 'users'));
                let foundEmail = null;
                if (usersSnap.exists()) {
                    usersSnap.forEach(child => {
                        const data = child.val();
                        if (data.username && data.username.toLowerCase() === emailVal.toLowerCase()) {
                            foundEmail = data.email;
                        }
                    });
                }
                if (!foundEmail) return showToast("Username not found", "error");
                emailVal = foundEmail;
            } catch (e) {
                return showToast("Login error. Try again.", "error");
            }
        }

        try {
            loginRunning = true;
            showLoading();
            buttonLoading(loginBtn, true, "Signing In...");

            // Apply Auto Login persistence
            const autoLogin = localStorage.getItem('nexus_autoLogin');
            await setPersistence(auth, autoLogin === 'true' ? browserLocalPersistence : browserSessionPersistence);

            // Firebase Login
            const result = await signInWithEmailAndPassword(auth, emailVal, passVal);
            currentUser = result.user;
            
            handleRememberMe();
            showToast("Secure Login Successful!", "success");

            // Redirect to home
            setTimeout(() => {
                window.location.href = "home.html";
            }, 1000);

        } catch (error) {
            console.error("Login Error:", error);
            showToast(error.message.replace("Firebase: ", ""), "error");
            hideLoading();
        } finally {
            loginRunning = false;
            buttonLoading(loginBtn, false);
        }
    });
}


// ==========================================================
// 10. NEW ACCOUNT REGISTRATION (SIGNUP)
// ==========================================================

    if(signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (signupRunning) return;

        const nameVal = signupName.value.trim();
        const usernameVal = signupUsername ? signupUsername.value.trim() : '';
        const emailVal = signupEmail.value.trim();
        const passVal = signupPassword.value;
        const confirmVal = signupConfirm.value;
        const termsCheck = document.getElementById("agreeTerms");

        if (isEmpty(nameVal)) return showToast("Enter Full Name", "warning");
        if (!usernameVal || usernameVal.length < 3) return showToast("Username must be at least 3 characters", "warning");
        if (!/^[a-zA-Z0-9_-]+$/.test(usernameVal)) return showToast("Username: letters, numbers, - and _ only", "warning");
        if (!isValidEmail(emailVal)) return showToast("Invalid Email Format", "warning");
        if (!isValidPassword(passVal)) return showToast("Password minimum 6 characters", "warning");
        if (passVal !== confirmVal) return showToast("Passwords do not match", "warning");
        if (!termsCheck.checked) return showToast("Accept Terms & Conditions to proceed", "warning");

        try {
            // Check if username already taken (case-insensitive)
            const usersSnap = await get(ref(db, 'users'));
            if (usersSnap.exists()) {
                let taken = false;
                const usernameLower = usernameVal.toLowerCase();
                usersSnap.forEach(child => {
                    if (child.val().username && child.val().username.toLowerCase() === usernameLower) taken = true;
                });
                if (taken) return showToast("Username already taken", "warning");
            }

            signupRunning = true;
            showLoading();
            buttonLoading(signupBtn, true, "Creating...");

            // Create user in Firebase Auth
            const result = await createUserWithEmailAndPassword(auth, emailVal, passVal);
            const user = result.user;

            // Save User Profile to Realtime Database (Matches Admin Panel Path)
            const userData = {
                uid: user.uid,
                name: nameVal,
                username: usernameVal,
                email: emailVal,
                photo: "",
                balance: 0,
                role: "user",
                status: "active",
                createdAt: serverTimestamp()
            };

            // Check referral
            if (refParam) {
                try {
                    const usersSnap = await get(ref(db, 'users'));
                    if (usersSnap.exists()) {
                        let referrerUid = null;
                        usersSnap.forEach(child => {
                            const data = child.val();
                            if (data.username && data.username.toLowerCase() === refParam.toLowerCase() && child.key !== user.uid) {
                                referrerUid = child.key;
                            }
                        });
                        if (referrerUid) {
                            userData.referredBy = referrerUid;
                            const refData = {
                                email: emailVal,
                                date: Date.now(),
                                deposited: 0,
                                commission: 0,
                                signupReward: 0
                            };
                            await set(ref(db, `referrals/${referrerUid}/${user.uid}`), refData);
                            // ₹5 referral bonus credited immediately to referrer's claimable balance
                            try {
                                const REF_BONUS = 5;
                                await runTransaction(ref(db, `users/${referrerUid}/referralClaimable`), (bal) => (bal || 0) + REF_BONUS);
                                await update(ref(db, `referrals/${referrerUid}/${user.uid}`), { signupReward: REF_BONUS });
                            } catch (e) { console.error("[REF] Bonus credit failed:", e); }
                        }
                    }
                } catch (e) { console.error("[REF] Error processing referral:", e); }
            }

            await set(ref(db, "users/" + user.uid), userData);

            // Welcome notification (localStorage, no Firebase write)
            try { localStorage.setItem('nexus_welcome_' + user.uid, '1'); } catch (_) {}

            showToast("Account Created Successfully!", "success");

            setTimeout(() => {
                window.location.href = "home.html";
            }, 1000);

        } catch (error) {
            console.error("Signup Error:", error);
            showToast(error.message.replace("Firebase: ", ""), "error");
            hideLoading();
        } finally {
            signupRunning = false;
            buttonLoading(signupBtn, false);
        }
    });
}


// ==========================================================
// 11. GOOGLE AUTHENTICATION (Login / Signup Combo)
// ==========================================================

if(googleLogin) {
    googleLogin.onclick = async () => {
        try {
            showLoading();
            buttonLoading(googleLogin, true, "Connecting...");

            // Trigger Google Popup
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const userRef = ref(db, "users/" + user.uid);

            // Check if user already exists in Database
            const snap = await get(userRef);

            if (!snap.exists()) {
                // Agar naya user hai, toh database me uski profile banao
                const googleUserData = {
                    uid: user.uid,
                    name: user.displayName || "Google User",
                    email: user.email,
                    photo: user.photoURL || "",
                    balance: 0,
                    role: "user",
                    status: "active",
                    createdAt: serverTimestamp()
                };
                if (refParam) {
                    try {
                        const usersSnap = await get(ref(db, 'users'));
                        if (usersSnap.exists()) {
                            usersSnap.forEach(child => {
                                const data = child.val();
                                if (data.username && data.username.toLowerCase() === refParam.toLowerCase() && child.key !== user.uid) {
                                    googleUserData.referredBy = child.key;
                                }
                            });
                            if (googleUserData.referredBy) {
                                const refData = {
                                    email: user.email,
                                    date: Date.now(),
                                    deposited: 0,
                                    commission: 0,
                                    signupReward: 0
                                };
                                await set(ref(db, `referrals/${googleUserData.referredBy}/${user.uid}`), refData);
                                try {
                                    const REF_BONUS = 5;
                                    await runTransaction(ref(db, `users/${googleUserData.referredBy}/referralClaimable`), (bal) => (bal || 0) + REF_BONUS);
                                    await update(ref(db, `referrals/${googleUserData.referredBy}/${user.uid}`), { signupReward: REF_BONUS });
                                } catch (e) { console.error("[REF] Google bonus credit failed:", e); }
                            }
                        }
                    } catch (e) { console.error("[REF] Google referral error:", e); }
                }
                await set(userRef, googleUserData);
                showToast("Google Account Registered!", "success");
            } else {
                // Agar purana user hai
                showToast("Google Login Successful!", "success");
            }

            setTimeout(() => {
                window.location.href = "home.html";
            }, 1000);

        } catch (error) {
            console.error("Google Auth Error:", error);
            showToast(error.message.replace("Firebase: ", ""), "error");
            hideLoading();
            buttonLoading(googleLogin, false);
        }
    };
}


// ==========================================================
// 12. FORGOT PASSWORD (Reset Link)
// ==========================================================

if(forgotPassword) {
    forgotPassword.onclick = async () => {
        const emailVal = loginEmail.value.trim();

        if (isEmpty(emailVal)) {
            return showToast("Enter your email address above first.", "warning");
        }

        try {
            showLoading();
            await sendPasswordResetEmail(auth, emailVal);
            showToast("Password Reset Link sent to your email!", "success");
        } catch (error) {
            console.error("Reset Error:", error);
            showToast(error.message.replace("Firebase: ", ""), "error");
        } finally {
            hideLoading();
        }
    };
}
