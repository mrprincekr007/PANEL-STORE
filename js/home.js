import { auth, db, ref, onValue, get, onAuthStateChanged, serverTimestamp } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const uid = user.uid;
            const userSnap = await get(ref(db, `users/${uid}`));
            const userData = userSnap.exists() ? userSnap.val() : {};
            const balance = parseFloat(userData.balance || 0);
            const created = userData.createdAt || userData.created || null;

            const nameEl = document.getElementById('homeUserName');
            const emailEl = document.getElementById('homeUserEmail');
            const avatarEl = document.getElementById('homeAvatar');
            const email = user.email || 'client@nexus.io';
            const displayName = userData.username || userData.name || email.split('@')[0].toUpperCase();
            if (nameEl) nameEl.innerText = displayName;
            if (emailEl) emailEl.innerText = email;
            if (avatarEl) avatarEl.innerText = displayName.charAt(0).toUpperCase();

            animateCounter('homeBalance', balance, 0, 800);

            const memberEl = document.getElementById('statMemberSince');
            if (memberEl) {
                if (created) {
                    const d = new Date(created);
                    memberEl.innerText = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                } else {
                    memberEl.innerText = 'N/A';
                }
            }

            const purchasesSnap = await get(ref(db, `purchases/${uid}`));
            const purchases = purchasesSnap.exists() ? purchasesSnap.val() : {};
            const purchaseList = Object.values(purchases).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            const totalPurchases = purchaseList.length;
            const totalSpent = purchaseList.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
            const uniquePanels = new Set(purchaseList.map(p => p.panelId)).size;

            animateCounter('statPurchases', totalPurchases, 0, 600);
            animateCounter('statSpent', totalSpent, 0, 800);
            animateCounter('statKeys', uniquePanels, 0, 600);
            renderRecentPurchases(purchaseList);
        } else {
            document.getElementById('homeUserName').innerText = 'Guest';
            document.getElementById('homeUserEmail').innerText = 'Login to access your dashboard';
            document.getElementById('homeAvatar').innerText = 'G';
            document.getElementById('homeBalance').innerText = '0.00';
            document.getElementById('statPurchases').innerText = '-';
            document.getElementById('statSpent').innerText = '-';
            document.getElementById('statKeys').innerText = '-';
            document.getElementById('statMemberSince').innerText = '-';
            document.getElementById('recentPurchasesContainer').innerHTML = `
                <div class="premium-glass-card p-8 flex flex-col items-center justify-center opacity-60">
                    <div class="w-14 h-14 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-500/30 text-2xl mb-3">
                        <i class="fas fa-lock"></i>
                    </div>
                    <p class="text-[10px] font-mono tracking-widest text-gray-500">Login to see your purchases</p>
                    <button onclick="window.location.href='index.html?tab=login'" class="mt-3 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 rounded-xl font-black text-[10px] uppercase tracking-wider text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] cursor-pointer">LOGIN NOW</button>
                </div>`;
        }

        loadFeaturedPanels();
        loadPromotions();
        initScrollAnimations();
    });

    // ==========================================
    // ANIMATED COUNTER
    // ==========================================
    function animateCounter(id, target, start = 0, duration = 600) {
        const el = document.getElementById(id);
        if (!el) return;
        const isFloat = target % 1 !== 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * eased;
            el.innerText = isFloat ? current.toFixed(2) : Math.floor(current).toString();
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // ==========================================
    // RECENT PURCHASES
    // ==========================================
    function renderRecentPurchases(list) {
        const container = document.getElementById('recentPurchasesContainer');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="premium-glass-card p-8 flex flex-col items-center justify-center opacity-60">
                    <div class="w-14 h-14 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-500/30 text-2xl mb-3">
                        <i class="fas fa-box-open"></i>
                    </div>
                    <p class="text-[10px] font-mono tracking-widest text-gray-500">No purchases yet</p>
                    <a href="store.html" class="text-[10px] font-black text-rose-400 mt-2 hover:text-rose-300 transition cursor-pointer">Browse Store →</a>
                </div>`;
            return;
        }

        const recent = list.slice(0, 5);
        let html = '<div class="flex flex-col gap-3">';
        recent.forEach((p, idx) => {
            const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A';
            html += `
                <div class="purchase-row" style="animation-delay:${idx * 0.1}s">
                    <div class="purchase-left">
                        <div class="purchase-icon"><i class="fas fa-cube"></i></div>
                        <div class="purchase-info">
                            <p class="purchase-name">${p.panelName || 'Panel'}</p>
                            <p class="purchase-meta">${p.label || 'Plan'} <span class="mx-1.5 text-gray-700">|</span> ${dateStr}</p>
                        </div>
                    </div>
                    <div class="purchase-right">
                        <span class="purchase-price">₹${parseFloat(p.price || 0).toFixed(2)}</span>
                        <button class="key-copy-btn" onclick="copyKey('${(p.key || '').replace(/'/g, "\\'")}')" title="Copy Key"><i class="fas fa-copy"></i></button>
                        ${p.link ? `<button class="key-access-btn" onclick="window.open('${p.link.replace(/'/g, "\\'")}','_blank')" title="Access"><i class="fas fa-external-link-alt"></i></button>` : ''}
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    window.copyKey = (key) => {
        if (!key) return;
        navigator.clipboard.writeText(key).then(() => {
            showHomeToast("Key copied!", "success");
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = key; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            showHomeToast("Key copied!", "success");
        });
    };

    // ==========================================
    // FEATURED PANELS (from /panels)
    // ==========================================
    function loadFeaturedPanels() {
        const container = document.getElementById('featuredPanelContainer');
        if (!container) return;

        onValue(ref(db, 'panels'), (snap) => {
            container.innerHTML = '';
            if (!snap.exists()) {
                container.innerHTML = `
                    <div class="snap-center shrink-0 w-full h-36 bg-gradient-to-br from-[#0a0c12] to-[#05070a] border border-white/5 rounded-2xl flex flex-col justify-center items-center">
                        <i class="fas fa-box-open text-2xl text-gray-600 mb-2"></i>
                        <p class="text-[9px] font-mono tracking-widest text-gray-500">No panels yet</p>
                    </div>`;
                return;
            }

            let panels = [];
            snap.forEach(child => {
                const p = { id: child.key, ...child.val() };
                if (p.status === 'active' || p.status === true) panels.push(p);
            });

            if (panels.length === 0) {
                container.innerHTML = `
                    <div class="snap-center shrink-0 w-full h-36 bg-gradient-to-br from-[#0a0c12] to-[#05070a] border border-white/5 rounded-2xl flex flex-col justify-center items-center">
                        <i class="fas fa-box-open text-2xl text-gray-600 mb-2"></i>
                        <p class="text-[9px] font-mono tracking-widest text-gray-500">No panels available</p>
                    </div>`;
                return;
            }

            panels = panels.slice(0, 8);
            panels.forEach((p, idx) => {
                const plans = p.plans ? Object.values(p.plans) : [];
                const minPrice = plans.length > 0 ? Math.min(...plans.map(x => parseFloat(x.price || 0))) : 0;
                const maxPrice = plans.length > 0 ? Math.max(...plans.map(x => parseFloat(x.price || 0))) : 0;
                const priceLabel = minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`;
                const logoHtml = p.logo ? `<img src="${p.logo}" class="fp-logo">` : `<div class="fp-logo-placeholder"><i class="fas fa-cube"></i></div>`;

                container.innerHTML += `
                    <div class="snap-center shrink-0 w-[75%] md:w-[30%] featured-panel-card" onclick="window.location.href='store.html'" style="animation-delay:${idx * 0.08}s">
                        <div class="fp-bg-glow"></div>
                        <div class="fp-top">
                            ${logoHtml}
                            <div class="fp-info">
                                <p class="fp-name">${p.name || 'Panel'}</p>
                                <p class="fp-category">${p.category || 'General'}</p>
                            </div>
                            <span class="fp-badge">${plans.length} Plans</span>
                        </div>
                        <div class="fp-bottom">
                            <span class="fp-price-label">Starting from</span>
                            <span class="fp-price">${priceLabel}</span>
                        </div>
                    </div>`;
            });

            // Auto scroll
            let scrollInterval = setInterval(() => {
                if (!container.isConnected) { clearInterval(scrollInterval); return; }
                if (container.scrollWidth > container.clientWidth) {
                    if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 10) {
                        container.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        const cardW = container.querySelector('.featured-panel-card')?.offsetWidth || 200;
                        container.scrollBy({ left: cardW + 16, behavior: 'smooth' });
                    }
                }
            }, 4000);
        });
    }

    // ==========================================
    // PROMOTIONS
    // ==========================================
    function loadPromotions() {
        const container = document.getElementById('promotionsContainer');
        if (!container) return;

        onValue(ref(db, 'promotions'), (snap) => {
            let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
            let hasActive = false;

            if (snap.exists()) {
                snap.forEach(child => {
                    const promo = child.val();
                    if (promo.status === true || promo.status === 'true') {
                        hasActive = true;
                        const title = promo.title || 'Promotion';
                        const desc = promo.description || '';
                        const discount = promo.discount || promo.discountPercent || 0;
                        const image = promo.image || '';
                        const link = promo.link || '#';
                        const imgBg = image ? `background-image:url('${image}');background-size:cover;background-position:center;` : '';

                        html += `
                            <div class="promo-card-v2 ${image ? '' : 'no-img'}" onclick="window.open('${link}','_blank')" style="${imgBg}animation-delay:${Math.random() * 0.3}s">
                                ${!image ? '<div class="promo-v2-icon"><i class="fas fa-tags"></i></div>' : '<div class="promo-v2-overlay"></div>'}
                                <div class="promo-v2-content">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="promo-v2-badge">${discount > 0 ? discount + '% OFF' : 'LIVE'}</span>
                                    </div>
                                    <h4 class="promo-v2-title">${title}</h4>
                                    ${desc ? `<p class="promo-v2-desc">${desc}</p>` : ''}
                                </div>
                            </div>`;
                    }
                });
            }

            html += '</div>';
            container.innerHTML = hasActive ? html : `
                <div class="premium-glass-card p-8 flex flex-col items-center justify-center opacity-60">
                    <div class="w-14 h-14 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500/30 text-2xl mb-3">
                        <i class="fas fa-tags"></i>
                    </div>
                    <p class="text-[10px] font-mono tracking-widest text-gray-500">No promotions active</p>
                </div>`;
        });
    }

    // ==========================================
    // SCROLL ANIMATIONS
    // ==========================================
    function initScrollAnimations() {
        const sections = document.querySelectorAll('.animate-on-view');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseFloat(entry.target.dataset.delay || 0);
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay * 1000);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(s => observer.observe(s));

        // Stat cards stagger
        document.querySelectorAll('.stat-card').forEach((card, i) => {
            const d = parseFloat(card.dataset.delay || 0.1);
            card.style.animationDelay = (i * 0.1 + d) + 's';
            card.classList.add('animate-fade-up');
        });
    }

    // ==========================================
    // TOAST
    // ==========================================
    function showHomeToast(msg, type = "success") {
        let c = document.getElementById('homeToastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'homeToastContainer';
            c.style.cssText = 'position:fixed;top:80px;right:15px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
            document.body.appendChild(c);
        }
        const t = document.createElement('div');
        t.className = `home-toast ${type}`;
        const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-exclamation-triangle";
        t.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; setTimeout(() => t.remove(), 300); }, 2500);
    }
});
