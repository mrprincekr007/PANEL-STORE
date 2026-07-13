import { auth, db, ref, onValue, get, onAuthStateChanged, serverTimestamp } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {

    // UI pehle — Firebase ke wait kiye bina boxes dikh jayenge
    initScrollAnimations();
    loadFeaturedPanels();
    loadAnnouncement();
    loadPromotions();

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
            const displayName = userData.name || userData.username || email.split('@')[0].toUpperCase();
            if (nameEl) nameEl.innerText = displayName;
            if (emailEl) emailEl.innerText = email;
            if (avatarEl) avatarEl.innerText = displayName.charAt(0).toUpperCase();

            animateCounter('homeBalance', balance, 0, 800, true);

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
            animateCounter('statSpent', totalSpent, 0, 800, true);
            animateCounter('statKeys', uniquePanels, 0, 600);
            renderRecentPurchases(purchaseList);
        } else {
            document.getElementById('homeUserName').innerText = 'Guest';
            document.getElementById('homeUserEmail').innerText = 'Login to access your dashboard';
            document.getElementById('homeAvatar').innerText = 'G';
            document.getElementById('homeBalance').innerText = window.formatPriceShort ? window.formatPriceShort(0) : '0.00';
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
                    <button onclick="window.location.href='index.html?tab=login'" class="mt-3 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 rounded-xl font-black text-[10px] uppercase tracking-wider text-white shadow-[0_0_15px rgba(225,29,72,0.4)] cursor-pointer">LOGIN NOW</button>
                </div>`;
        }
    });

    // ==========================================
    // ANIMATED COUNTER
    // ==========================================
    function animateCounter(id, target, start = 0, duration = 600, isCurrency = false) {
        const el = document.getElementById(id);
        if (!el) return;
        const isFloat = target % 1 !== 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * eased;
            el.innerText = isCurrency && window.formatPriceShort ? window.formatPriceShort(current) : (isFloat ? current.toFixed(2) : Math.floor(current).toString());
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
                        <i class="fas fa-store"></i>
                    </div>
                    <p class="text-[10px] font-mono tracking-widest text-gray-500">No purchases yet</p>
                    <a href="store.html" class="mt-4 px-6 py-3 bg-gradient-to-r from-rose-600 to-purple-600 rounded-xl text-[10px] font-black text-white uppercase tracking-wider shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] transition-all duration-300 cursor-pointer inline-flex items-center gap-2">BUY NOW <i class="fas fa-arrow-right"></i></a>
                </div>`;
            return;
        }

        const recent = list.slice(0, 1);
        let html = '<div class="flex flex-col gap-3">';
        recent.forEach((p, idx) => {
            const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A';
            const keyId = 'purchaseKey_' + idx;
            html += `
                <div class="purchase-row" style="animation-delay:${idx * 0.1}s">
                    <div class="purchase-left">
                        <div class="purchase-icon"><i class="fas fa-cube"></i></div>
                        <div class="purchase-info">
                            <p class="purchase-name">${p.panelName || 'Panel'}</p>
                            <p class="purchase-meta">${p.label || 'Plan'} <span class="mx-1.5 text-gray-700">|</span> ${dateStr}</p>
                            <div class="purchase-key-row">
                                <span class="key-blurred" id="${keyId}" onclick="revealKey('${keyId}')">${(p.key || 'N/A').replace(/'/g, "\\'")}</span>
                                <button class="key-copy-btn" onclick="copyKey('${(p.key || '').replace(/'/g, "\\'")}')" title="Copy Key"><i class="fas fa-copy"></i></button>
                                ${p.link ? `<button class="key-access-btn" onclick="window.open('${p.link.replace(/'/g, "\\'")}','_blank')" title="Access"><i class="fas fa-external-link-alt"></i></button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="purchase-right">
                        <span class="purchase-price">₹${parseFloat(p.price || 0).toFixed(2)}</span>
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    window.revealKey = (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('key-revealed');
    };

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
    // ANNOUNCEMENT BANNER
    // ==========================================
    function loadAnnouncement() {
        const container = document.getElementById('announcementContainer');
        if (!container) return;
        get(ref(db, 'settings/branding')).then(snap => {
            const data = snap.val() || {};
            if (data.announcement) {
                container.style.display = '';
                container.querySelector('#announcementText').textContent = data.announcement;
            }
        }).catch(() => {});
    }

    // ==========================================
    // PROMOTIONS
    // ==========================================
    function loadPromotions() {
        const container = document.getElementById('promotionsContainer');
        if (!container) return;

        onValue(ref(db, 'promotions'), (snap) => {
            container.innerHTML = '';
            let promos = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const p = { id: child.key, ...child.val() };
                    if (p.status === true || p.status === 'true') promos.push(p);
                });
            }
            if (promos.length === 0) {
                container.innerHTML = `
                    <div class="flex items-center justify-center h-36 bg-gradient-to-br from-[#0a0c12] to-[#05070a] border border-white/5 rounded-2xl">
                        <div class="flex flex-col items-center opacity-60">
                            <i class="fas fa-tags text-2xl text-gray-600 mb-2"></i>
                            <p class="text-[9px] font-mono tracking-widest text-gray-500">No promotions active</p>
                        </div>
                    </div>`;
                return;
            }
            promos = promos.slice(0, 8);
            let html = '<div class="flex overflow-x-auto gap-4 pb-3 no-scrollbar snap-x snap-mandatory" id="promoScrollContainer">';
            promos.forEach((p, idx) => {
                const image = (p.image || '').replace(/['"]/g, '');
                const discount = p.discount || 0;
                const link = (p.link || '#').replace(/['"]/g, '');
                const imgStyle = image ? `background-image:url('${image}');background-size:cover;background-position:center;` : '';
                html += `
                    <div class="snap-center shrink-0 w-[75%] md:w-[30%] promo-carousel-card" onclick="window.open('${link.replace(/'/g,'')}','_blank')" style="animation-delay:${idx * 0.08}s">
                        <div class="promo-carousel-bg ${image ? 'has-img' : 'no-img'}" style="${imgStyle}">
                            ${!image ? '<div class="promo-carousel-icon"><i class="fas fa-tags"></i></div>' : ''}
                            ${image ? '<div class="promo-carousel-overlay"></div>' : ''}
                        </div>
                        <div class="promo-carousel-content">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="promo-carousel-badge">${discount > 0 ? discount + '% OFF' : 'LIVE'}</span>
                            </div>
                            <h4 class="promo-carousel-title">${p.title || 'Promotion'}</h4>
                            ${p.description ? `<p class="promo-carousel-desc">${p.description}</p>` : ''}
                        </div>
                    </div>`;
            });
            html += '</div>';
            container.innerHTML = html;

            setTimeout(() => {
                const scrollContainer = document.getElementById('promoScrollContainer');
                if (!scrollContainer) return;
                let si = setInterval(() => {
                    if (!scrollContainer.isConnected) { clearInterval(si); return; }
                    if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
                        if (scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 10) {
                            scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
                        } else {
                            const cw = scrollContainer.querySelector('.promo-carousel-card')?.offsetWidth || 200;
                            scrollContainer.scrollBy({ left: cw + 16, behavior: 'smooth' });
                        }
                    }
                }, 4000);
            }, 500);
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
            card.classList.add('animate-fade-up');
            const d = parseFloat(card.dataset.delay || 0.1);
            card.style.animationDelay = (i * 0.1 + d) + 's';
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
