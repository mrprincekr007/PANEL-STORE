/* ==========================================================================
   NEXUS CORE - PROFILE JAVASCRIPT ENGINE
   Description: Independent logic for User Stats, Identity & Secure Vault
========================================================================== */

import { auth, db, ref, onValue, onAuthStateChanged, update } from "./firebase-config.js";

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast-msg ' + type;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; setTimeout(() => t.remove(), 300); }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
    
    console.log("[SYSTEM] Profile Engine Booted Successfully.");
    let currentUserUid = null;

    // ==========================================
    // 1. AUTHENTICATION & FETCH USER DETAILS
    // ==========================================
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserUid = user.uid;
            
            // Set basic info from email (fallback)
            const alias = user.email.split('@')[0];
            document.getElementById('mainAvatar').innerText = alias.charAt(0).toUpperCase();
            document.getElementById('profileName').innerText = alias;
            document.getElementById('profileEmail').innerText = user.email;
            document.getElementById('profileUid').innerText = user.uid.substring(0, 8);
            
            // Format Creation Date
            const joinDate = new Date(user.metadata.creationTime);
            const formattedDate = `${joinDate.getDate().toString().padStart(2, '0')}/${(joinDate.getMonth()+1).toString().padStart(2, '0')}/${joinDate.getFullYear()}`;
            document.getElementById('profileJoined').innerText = formattedDate;

            // Fetch user data (username, name, balance) from DB
            onValue(ref(db, `users/${user.uid}`), (snap) => {
                if(snap.exists()) {
                    const data = snap.val();
                    document.getElementById('statBalance').innerText = window.formatPriceShort ? window.formatPriceShort(parseFloat(data.balance || 0)) : '₹' + parseFloat(data.balance || 0).toFixed(2);
                    const uname = data.username || data.name || alias;
                    document.getElementById('profileName').innerText = uname;
            document.getElementById('profileUid').innerText = user.uid.substring(0, 8);
                    document.getElementById('mainAvatar').innerText = uname.charAt(0).toUpperCase();
                }
            });

            // Fetch Vault (Purchased Keys)
            fetchPurchasedKeys(user.uid);

        } else {
            console.warn("[SECURITY] Unverified Access. Redirecting.");
            window.location.href = 'index.html';
        }
    });

    // ==========================================
    // 2. FETCH PURCHASED KEYS & CALCULATE STATS
    // ==========================================
    function fetchPurchasedKeys(uid) {
        const keysContainer = document.getElementById('keysContainer');
        const purchasesRef = ref(db, `purchases/${uid}`);
        
        onValue(purchasesRef, (snapshot) => {
            keysContainer.innerHTML = ''; // Remove loader
            let totalSpent = 0;
            let totalOrders = 0;

            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Convert to Array & Sort (Newest first)
                const purchasesArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                purchasesArray.sort((a, b) => new Date(b.date) - new Date(a.date));

                totalOrders = purchasesArray.length;

                purchasesArray.forEach((item, index) => {
                    totalSpent += parseFloat(item.price || 0);
                    
                    const d = new Date(item.date);
                    const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                    
                    const planName = item.label || item.plan || 'Premium Access';
                    const link = item.link || '#';
                    const licenseKey = item.key || 'ERR-NO-KEY-FOUND';
                    const animDelay = (index * 0.1) + 's';

                    const keyHtml = `
                        <div class="key-item-card" style="animation-delay: ${animDelay}">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800/50 pb-4 mb-4">
                                <div>
                                    <h4 class="text-sm font-black text-white uppercase tracking-wide">${item.panelName || 'Nexus Module'}</h4>
                                    <p class="text-[10px] text-gray-400 font-mono tracking-widest mt-1"><i class="fas fa-tag text-purple-500 mr-1.5"></i> ${planName} <span class="mx-1 text-gray-700">|</span> ${dateStr}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="bg-purple-600/10 text-purple-400 border border-purple-500/30 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(147,51,234,0.15)]">
                                        ₹${parseFloat(item.price || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                                <div class="secure-key-box group">
                                    <div class="flex items-center space-x-3 overflow-hidden">
                                        <i class="fas fa-lock text-gray-600 group-hover:text-emerald-500 transition-colors text-sm"></i>
                                        <span class="key-string font-mono font-bold tracking-[0.2em] text-sm md:text-base truncate" id="key-${item.id}">${licenseKey}</span>
                                    </div>
                                    <button onclick="copySecureKey('key-${item.id}')" class="text-gray-500 hover:text-emerald-400 transition focus:outline-none p-2 ml-2 relative z-10" aria-label="Copy Key">
                                        <i class="fas fa-copy text-lg"></i>
                                    </button>
                                </div>
                                
                                <button onclick="window.open('${link}', '_blank')" class="btn-action-vault px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center whitespace-nowrap">
                                    <i class="fas fa-cloud-arrow-down mr-2 text-lg"></i> Download
                                </button>
                            </div>

                        </div>
                    `;
                    keysContainer.insertAdjacentHTML('beforeend', keyHtml);
                });

            } else {
                // Empty Vault State
                keysContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 opacity-60">
                        <div class="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800 mb-4 shadow-lg">
                            <i class="fas fa-folder-open text-3xl text-gray-600"></i>
                        </div>
                        <h4 class="text-white font-black uppercase tracking-widest text-sm">Vault is Empty</h4>
                        <p class="text-[10px] font-mono uppercase tracking-widest text-gray-500 mt-2 text-center max-w-xs">You haven't purchased any licenses or modules yet.</p>
                        <a href="store.html" class="mt-6 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-[0_0_15px_rgba(147,51,234,0.4)]">Browse Store</a>
                    </div>
                `;
            }

            // Update Statistics
            document.getElementById('statOrders').innerText = totalOrders;
            document.getElementById('statSpent').innerText = window.formatPriceShort ? window.formatPriceShort(totalSpent) : '₹' + totalSpent.toFixed(2);
        });
    }

    // ==========================================
    // 3. GLOBAL UTILITY: SECURE COPY
    // ==========================================
    window.copySecureKey = function(elementId) {
        const text = document.getElementById(elementId).innerText;
        navigator.clipboard.writeText(text).then(() => {
            if(navigator.vibrate) navigator.vibrate([10, 30, 10]);
            showToast('License key copied to clipboard!');
        }).catch(err => {
            console.error("Copy failed:", err);
            showToast('Copy failed. Select text manually.', 'error');
        });
    };

});