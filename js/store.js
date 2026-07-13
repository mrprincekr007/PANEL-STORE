import { auth, db, ref, onValue, get, set, push, runTransaction, onAuthStateChanged } from "./firebase-config.js";

let allPanels = [];
let currentFilter = 'All';
let currentUser = null;
let userBalance = 0;
let currentCheckout = null;
let appliedCoupon = null;

const productsGrid = document.getElementById('storeProductsGrid');
const chipsContainer = document.getElementById('categoryChipsContainer');
const searchInput = document.getElementById('searchInput');
const loader = document.getElementById('storeLoader');


document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initBgFollowLight();
    authCheck();
});

function authCheck() {
    const unsubscribe = onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            onValue(ref(db, `users/${user.uid}/balance`), snap => { userBalance = snap.val() || 0; });
            loadPanels();
        } else {
            currentUser = null;
            userBalance = 0;
            loadPanels();
        }
    });
    if (auth.currentUser) {
        currentUser = auth.currentUser;
        onValue(ref(db, `users/${auth.currentUser.uid}/balance`), snap => { userBalance = snap.val() || 0; });
        loadPanels();
        unsubscribe();
    }
}

function loadPanels() {
    if (!productsGrid) return;
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
    const catMap = {};
    allPanels.forEach(p => { if (p.category) catMap[p.category] = (catMap[p.category] || 0) + 1; });
    const total = allPanels.length;
    let html = `<button class="category-chip active" onclick="filterStore('All')"><i class="fas fa-layer-group"></i> All<span class="chip-count">${total}</span></button>`;
    Object.keys(catMap).sort().forEach((c, i) => {
        html += `<button class="category-chip" style="animation-delay:${(i * 0.04).toFixed(2)}s" onclick="filterStore('${c.replace(/'/g, "\\'")}')"><i class="fas fa-tag"></i> ${c}<span class="chip-count">${catMap[c]}</span></button>`;
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
    if (!e.target.closest('.plan-popup') && !e.target.closest('.btn-buy')) {
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
        const descHtml = (p.description || 'Premium tool').split('\n').filter(f => f.trim()).map(f =>
            `<div class="card-feature"><i class="fas fa-bolt"></i> ${f.trim()}</div>`
        ).join('');

        const hasPlans = p.plans && Object.keys(p.plans).length > 0;
        const sortedPlans = hasPlans ? Object.entries(p.plans).sort((a, b) => a[1].price - b[1].price) : [];

        let popupItems = '';
        if (hasPlans) {
            sortedPlans.forEach(([key, plan]) => {
                const planEncoded = encodeURIComponent(JSON.stringify({key, label: plan.label, price: plan.price}));
                popupItems += `<div class="popup-item" onclick="selectPlan('${p.id}', '${planEncoded}', '${(p.name || '').replace(/'/g, "\\'")}', '${(p.link || '').replace(/'/g, "\\'")}')">
                    <span class="popup-label"><i class="fas fa-crown"></i> ${plan.label}</span>
                    <span class="popup-price">₹${plan.price}</span>
                </div>`;
            });
        } else {
            popupItems = `<div class="popup-item disabled"><span>No plans available</span></div>`;
        }

        const videoHtml = ytId
            ? `<div class="card-media"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&iv_load_policy=3&mute=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
            : `<div class="card-media"><div class="card-media-fallback"><i class="fas fa-video-slash"></i><span>No Preview</span></div></div>`;

        productsGrid.innerHTML += `
            <div class="product-card" style="animation-delay:${(idx * 0.06).toFixed(2)}s" data-tilt>
                <div class="product-card-inner">
                    ${videoHtml}
                    <div class="card-content">
                        <div class="card-header">
                            <h3 class="card-title">${p.name || 'Panel'}</h3>
                            <span class="card-badge">${p.category || 'General'}</span>
                        </div>
                        <div class="card-features">${descHtml}</div>
                        <div class="card-trust">
                            <span><i class="fas fa-shield-alt"></i> Safe</span>
                            <span><i class="fas fa-medal"></i> Verified</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn-sm" onclick="window.open('${p.link || '#'}', '_blank')"><i class="fas fa-download"></i> UPDATE</button>
                            ${p.feedback ? `<button class="btn-sm btn-sm-fb" onclick="window.open('${p.feedback}', '_blank')"><i class="fas fa-star"></i> FEEDBACK</button>` : ''}
                        </div>
                        <button class="btn-buy" onclick="togglePlanPopup('${p.id}')">
                            <i class="fas fa-shopping-cart"></i> PURCHASE KEY
                        </button>
                        <div class="plan-popup" id="popup-${p.id}">${popupItems}</div>
                    </div>
                </div>
            </div>`;
    });

    if (count === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ghost"></i>
                <h3>No Panels Found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>`;
    }

    // activate tilt after render
    requestAnimationFrame(() => requestAnimationFrame(initTilt));
}

/* ── 3D TILT ── */
function initTilt() {
    document.querySelectorAll('[data-tilt]').forEach(card => {
        const inner = card.querySelector('.product-card-inner');
        if (!inner) return;
        let ticking = false;
        card.addEventListener('mousemove', (e) => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => {
                    const rect = card.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    inner.style.transform = `perspective(800px) rotateX(${(y - 0.5) * -12}deg) rotateY(${(x - 0.5) * 12}deg) translateZ(10px)`;
                    inner.style.setProperty('--mx', `${x * 100}%`);
                    inner.style.setProperty('--my', `${y * 100}%`);
                    ticking = false;
                });
            }
        });
        card.addEventListener('mouseleave', () => {
            inner.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
            inner.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)';
            inner.style.removeProperty('--mx');
            inner.style.removeProperty('--my');
            setTimeout(() => { inner.style.transition = ''; }, 500);
        });
    });
}

/* ── PARTICLE BACKGROUND ── */
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.querySelector('.premium-bg-container').after(canvas);
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < 120; i++) particles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => { p.update(); p.draw(); });

        // draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(225,29,72,${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

/* ── MOUSE FOLLOW LIGHT ── */
function initBgFollowLight() {
    const el = document.getElementById('bgFollowLight');
    if (!el) return;
    let ticking = false;
    document.addEventListener('mousemove', (e) => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth) * 100;
                const y = (e.clientY / window.innerHeight) * 100;
                el.style.setProperty('--mx', x + '%');
                el.style.setProperty('--my', y + '%');
                ticking = false;
            });
        }
    });
}

window.togglePlanPopup = (panelId) => {
    const popup = document.getElementById(`popup-${panelId}`);
    if (!popup) return;
    const wasOpen = popup.classList.contains('show');
    document.querySelectorAll('.plan-popup.show').forEach(el => el.classList.remove('show'));
    if (!wasOpen) popup.classList.add('show');
};

window.selectPlan = (panelId, encodedPlanData, panelName, link) => {
    if (!currentUser) { window.location.href = 'index.html?tab=login'; return; }
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
            document.getElementById('chkFinalPrice').innerText = window.formatPrice ? window.formatPrice(final) : '₹' + final.toFixed(2);
            document.getElementById('chkStrike').innerText = window.formatPrice ? window.formatPrice(price) : '₹' + price.toFixed(2);
            document.getElementById('chkStrike').classList.remove('hidden');
            document.getElementById('chkBadge').innerText = couponObj.discount + '% OFF';
            document.getElementById('chkBadge').classList.remove('hidden');
            showToast(`Coupon applied! ${couponObj.discount}% OFF`, "success");
        }
    } catch (e) { showToast("Error validating coupon", "error"); }
    finally { btn.innerHTML = 'APPLY'; btn.disabled = false; }
});

window.executePurchase = async () => {
    if (!currentUser) { window.location.href = 'index.html?tab=login'; return; }
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
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000);
}

window.copySuccessKey = () => {
    const el = document.getElementById('successKey');
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
    const box = el.closest('.key-box');
    if (box) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
};

function showLoader() { const l = document.getElementById('storeLoaderOverlay'); if (l) l.classList.remove('hidden'); }
function hideLoader() { const l = document.getElementById('storeLoaderOverlay'); if (l) l.classList.add('hidden'); }
