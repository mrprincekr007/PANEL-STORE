import { auth, db, ref, onValue, get, set, push, update, runTransaction, onAuthStateChanged, serverTimestamp } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let userBalance = 0;
    let allPanels = [];
    let currentFilter = 'All';
    let currentCheckout = {};
    let appliedCoupon = null;

    const productsGrid = document.getElementById('storeProductsGrid');
    const loader = document.getElementById('storeLoader');
    const productCounter = document.getElementById('productCounter');
    const searchInput = document.getElementById('searchInput');
    const chipsContainer = document.getElementById('categoryChipsContainer');

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            onValue(ref(db, `users/${user.uid}`), (snap) => {
                if (snap.exists()) userBalance = parseFloat(snap.val().balance || 0);
            });
        }
        initPanels();
        updateHeaderBalance();
    });

    function updateHeaderBalance() {
        const hdr = document.getElementById('header-container');
        if (hdr) {
            const obs = new MutationObserver(() => {
                const el = document.getElementById('nav-balance');
                if (el) { obs.disconnect(); onValue(ref(db, `users/${currentUser.uid}`), (s) => { if (s.exists()) el.innerText = parseFloat(s.val().balance || 0).toFixed(2); }); }
            });
            obs.observe(hdr, { childList: true, subtree: true });
        }
    }

    function initPanels() {
        onValue(ref(db, 'panels'), (snap) => {
            allPanels = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const p = { id: child.key, ...child.val() };
                    if (p.status === 'active' || p.status === true || p.status === "active") allPanels.push(p);
                });
            }
            if (loader) loader.style.display = 'none';
            buildCategoryChips();
            renderPanels();
        });
    }

    function buildCategoryChips() {
        if (!chipsContainer) return;
        const cats = new Set();
        allPanels.forEach(p => { if (p.category) cats.add(p.category); });
        let html = `<button class="category-chip active" onclick="filterStore('All')"><i class="fas fa-layer-group mr-1.5"></i> All Items</button>`;
        cats.forEach(c => {
            html += `<button class="category-chip" onclick="filterStore('${c.replace(/'/g, "\\'")}')"><i class="fas fa-tag mr-1.5"></i> ${c}</button>`;
        });
        chipsContainer.innerHTML = html;
    }

    window.filterStore = function(categoryName) {
        currentFilter = categoryName;
        document.querySelectorAll('.category-chip').forEach(btn => {
            btn.classList.remove('active');
            const txt = btn.innerText.replace(/\([^)]*\)/g, '').trim();
            if (categoryName === 'All' && txt.includes('All')) btn.classList.add('active');
            else if (txt === categoryName) btn.classList.add('active');
        });
        renderPanels();
        if (navigator.vibrate) navigator.vibrate(10);
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => renderPanels());
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.plan-popup') && !e.target.closest('.store-btn-buy')) {
            document.querySelectorAll('.plan-popup.show').forEach(el => el.classList.remove('show'));
        }
    });

    function renderPanels() {
        if (!productsGrid) return;
        productsGrid.innerHTML = '';
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let count = 0;

        allPanels.forEach((p, idx) => {
            const matchCat = currentFilter === 'All' || (p.category && p.category.toLowerCase() === currentFilter.toLowerCase());
            const matchSearch = !query || (p.name || '').toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query);
            if (!matchCat || !matchSearch) return;
            count++;

            const ytId = extractYTId(p.youtube);
            const descHtml = (p.description || 'Premium tool').split('\n').filter(f => f.trim()).map(f => `<div class="feature-chip"><i class="fas fa-bolt"></i> ${f.trim()}</div>`).join('');

            const hasPlans = p.plans && Object.keys(p.plans).length > 0;
            const sortedPlans = hasPlans ? Object.entries(p.plans).sort((a, b) => a[1].price - b[1].price) : [];

            let popupItems = '';
            if (hasPlans) {
                sortedPlans.forEach(([key, plan]) => {
                    const planEncoded = encodeURIComponent(JSON.stringify({key, label: plan.label, price: plan.price}));
                    popupItems += `<div class="popup-item" onclick="selectPlan('${p.id}', '${planEncoded}', '${(p.name || '').replace(/'/g, "\\'")}', '${(p.link || '').replace(/'/g, "\\'")}')">
                        <span class="popup-label">${plan.label}</span>
                        <span class="popup-price">₹${plan.price}</span>
                    </div>`;
                });
            } else {
                popupItems = `<div class="popup-item disabled"><span>No plans available</span></div>`;
            }

            const videoHtml = ytId
                ? `<div class="card-video"><iframe src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&mute=1" allowfullscreen loading="lazy"></iframe></div>`
                : `<div class="card-video"><div class="card-video-placeholder"><i class="fas fa-video-slash"></i><span>No Video</span></div></div>`;

            const animDelay = (idx * 0.08) + 's';

            const card = document.createElement('div');
            card.className = 'premium-product-card';
            card.style.animationDelay = animDelay;
            card.innerHTML = `
                ${videoHtml}
                <div class="card-body">
                    <div class="card-title-row">
                        <h3>${p.name || 'Panel'}</h3>
                        <span class="card-status-badge">${p.category || 'General'}</span>
                    </div>
                    <div class="features-list">${descHtml}</div>
                    <div class="trust-badges">
                        <span><i class="fas fa-shield-alt"></i> Safe</span>
                        <span><i class="fas fa-medal"></i> Verified</span>
                    </div>
                    <div class="btn-grid">
                        <button class="store-btn-sm" onclick="window.open('${p.link || '#'}', '_blank')"><i class="fas fa-download"></i> UPDATE</button>
                        ${p.feedback ? `<button class="store-btn-sm fb-btn" onclick="window.open('${p.feedback}', '_blank')"><i class="fas fa-star"></i> FEEDBACK</button>` : ''}
                    </div>
                    <button class="store-btn-buy" onclick="togglePlanPopup('${p.id}')">
                        <i class="fas fa-shopping-cart"></i> PURCHASE KEY
                    </button>
                    <div class="plan-popup" id="popup-${p.id}">${popupItems}</div>
                </div>
            `;
            productsGrid.appendChild(card);
        });

        if (productCounter) productCounter.innerText = count;

        if (count === 0) {
            productsGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-20 opacity-60">
                    <i class="fas fa-ghost text-5xl text-gray-700 mb-5"></i>
                    <h3 class="text-white font-black uppercase tracking-widest text-sm">No Panels Found</h3>
                    <p class="text-[10px] font-mono text-gray-500 mt-2">Try a different search or category.</p>
                </div>`;
        }
    }

    window.togglePlanPopup = (panelId) => {
        if (!currentUser) {
            showLoginPrompt();
            return;
        }
        const popup = document.getElementById(`popup-${panelId}`);
        if (!popup) return;
        const wasOpen = popup.classList.contains('show');
        document.querySelectorAll('.plan-popup.show').forEach(el => el.classList.remove('show'));
        if (!wasOpen) popup.classList.add('show');
    };

    window.selectPlan = (panelId, encodedPlanData, panelName, link) => {
        if (!currentUser) { showLoginPrompt(); return; }
        const planData = JSON.parse(decodeURIComponent(encodedPlanData));
        currentCheckout = {
            panelId, panelName, link,
            planKey: planData.key, label: planData.label,
            originalPrice: parseFloat(planData.price),
            finalPrice: parseFloat(planData.price)
        };
        appliedCoupon = null;
        document.getElementById('chkPanelName').innerText = panelName;
        document.getElementById('chkPlanLabel').innerText = planData.label;
        document.getElementById('chkPrice').innerText = planData.price;
        document.getElementById('chkFinalPrice').innerText = planData.price;
        document.getElementById('couponInput').value = '';
        document.getElementById('chkStrike').classList.add('hidden');
        document.getElementById('chkBadge').classList.add('hidden');
        document.querySelectorAll('.plan-popup.show').forEach(el => el.classList.remove('show'));
        document.getElementById('modalCheckout').classList.remove('hidden');
    };

    function showLoginPrompt() {
        const overlay = document.createElement('div');
        overlay.className = 'store-modal-overlay';
        overlay.style.zIndex = '10000';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
            <div class="store-modal" style="text-align:center;max-width:360px;">
                <i class="fas fa-lock" style="font-size:40px;color:#e11d48;margin-bottom:15px;filter:drop-shadow(0 0 15px rgba(225,29,72,0.5));"></i>
                <h3 style="color:#fff;font-weight:800;margin-bottom:8px;text-transform:uppercase;font-size:16px;">Login Required</h3>
                <p style="color:#888;font-size:12px;margin-bottom:20px;">Please login to purchase panels and access your keys.</p>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button class="store-btn store-btn-primary" onclick="window.location.href='index.html?tab=login'" style="padding:10px 24px;font-size:10px;">LOGIN NOW</button>
                    <button class="store-btn store-btn-outline" onclick="this.closest('.store-modal-overlay').remove()" style="padding:10px 24px;font-size:10px;">BROWSE</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }

    function extractYTId(url) {
        if (!url) return null;
        url = String(url).trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
        const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        return (m && m[2].length === 11) ? m[2] : null;
    }

    window.closeCheckoutModal = () => document.getElementById('modalCheckout').classList.add('hidden');
    window.closeModalSuccess = () => document.getElementById('modalSuccess').classList.add('hidden');

    document.getElementById('btnApplyCoupon').addEventListener('click', async () => {
        const code = document.getElementById('couponInput').value.trim().toUpperCase();
        if (!code) return showToast("Enter a coupon code", "warning");
        const btn = document.getElementById('btnApplyCoupon');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
        try {
            const snap = await get(ref(db, 'coupons'));
            let couponObj = null;
            if (snap.exists()) {
                snap.forEach(child => {
                    if (child.val().code === code) couponObj = { id: child.key, ...child.val() };
                });
            }
            if (!couponObj || couponObj.status !== true) {
                showToast("Invalid or expired coupon", "error");
            } else if (couponObj.maxUse && couponObj.used >= couponObj.maxUse) {
                showToast("Coupon limit reached", "error");
            } else {
                const price = currentCheckout.originalPrice;
                const discount = (price * couponObj.discount) / 100;
                const final = Math.max(0, price - discount);
                appliedCoupon = couponObj;
                currentCheckout.finalPrice = final;
                document.getElementById('chkFinalPrice').innerText = final.toFixed(2);
                document.getElementById('chkStrike').innerText = '₹' + price.toFixed(2);
                document.getElementById('chkStrike').classList.remove('hidden');
                document.getElementById('chkBadge').innerText = couponObj.discount + '% OFF';
                document.getElementById('chkBadge').classList.remove('hidden');
                showToast(`Coupon applied! ${couponObj.discount}% OFF`, "success");
            }
        } catch (e) { showToast("Error validating coupon", "error"); }
        finally { btn.innerHTML = 'APPLY'; btn.disabled = false; }
    });

    window.executePurchase = async () => {
        if (!currentUser) { showLoginPrompt(); return; }
        const checkout = currentCheckout;
        const priceToPay = checkout.finalPrice;
        const btn = document.getElementById('btnConfirmPay');
        if (userBalance < priceToPay) return showToast(`Insufficient balance. Need ₹${priceToPay.toFixed(2)}`, "error");
        showLoader();
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        try {
            const result = await runTransaction(ref(db, `users/${currentUser.uid}/balance`), (bal) => {
                if (bal === null) return 0;
                if (bal >= priceToPay) return bal - priceToPay;
                return undefined;
            });
            if (result.committed) {
                const newKey = generateKey(8);
                const txId = "PUR" + Date.now();
                const pushRef = push(ref(db, `purchases/${currentUser.uid}`));
                await set(pushRef, {
                    panelId: checkout.panelId, panelName: checkout.panelName,
                    plan: checkout.planKey, label: checkout.label,
                    price: priceToPay, key: newKey, link: checkout.link,
                    date: new Date().toISOString()
                });
                await set(ref(db, `transactions/${currentUser.uid}/${txId}`), {
                    id: txId, type: "purchase", amount: priceToPay, status: "success",
                    desc: `Purchased ${checkout.panelName}`, date: new Date().toISOString()
                });
                if (appliedCoupon && appliedCoupon.id) {
                    await runTransaction(ref(db, `coupons/${appliedCoupon.id}/used`), (c) => (c || 0) + 1);
                }
                closeCheckoutModal();
                document.getElementById('successKey').innerText = newKey;
                document.getElementById('btnAccessTool').onclick = () => window.open(checkout.link || "https://t.me/", '_blank');
                document.getElementById('modalSuccess').classList.remove('hidden');
            } else {
                showToast("Transaction failed. Insufficient funds.", "error");
            }
        } catch (e) { showToast("System Error. Try again.", "error"); }
        finally { hideLoader(); btn.disabled = false; btn.innerHTML = 'CONFIRM PAY'; }
    };

    function generateKey(len = 12) {
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let r = '';
        for (let i = 0; i < len; i++) r += c.charAt(Math.floor(Math.random() * c.length));
        return r;
    }

    function showToast(msg, type = "success") {
        const c = document.getElementById('toast-container');
        if (!c) return;
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-exclamation-triangle";
        t.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.animation = 'slideOutRight 0.3s forwards'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    function showLoader() { const l = document.getElementById('storeLoaderOverlay'); if (l) l.classList.remove('hidden'); }
    function hideLoader() { const l = document.getElementById('storeLoaderOverlay'); if (l) l.classList.add('hidden'); }

    // CSS animations for toasts
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
});
