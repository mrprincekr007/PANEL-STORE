import { auth, db, ref, onValue, push, set, update, get, runTransaction, onAuthStateChanged, serverTimestamp } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("[SYSTEM] Wallet Engine Booted.");
    let currentUserUid = null;
    let currentUserEmail = null;
    let paymentPollInterval = null;
    window.ZAP_KEY = "";

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserUid = user.uid;
            currentUserEmail = user.email;

            const uidDisplay = document.getElementById('walletUid');
            if (uidDisplay) uidDisplay.innerText = user.uid.substring(0, 10).toUpperCase();

            const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, (snap) => {
                if (snap.exists()) {
                    const bal = parseFloat(snap.val().balance || 0).toFixed(2);
                    const mainBal = document.getElementById('mainBalance');
                    if (mainBal) mainBal.innerText = bal;
                    const statBal = document.getElementById('statBalance');
                    if (statBal) statBal.innerText = bal;
                }
            });

            fetchTransactionHistory(user.uid);
            fetchDepositStats(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    fetchDepositSettings();

    window.switchTab = function(tabName) {
        document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active-tab'));
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active-content');
            c.classList.add('hidden');
        });
        const activeTab = document.getElementById(`tab-${tabName}`);
        const activeContent = document.getElementById(`content-${tabName}`);
        if (activeTab) activeTab.classList.add('active-tab');
        if (activeContent) {
            activeContent.classList.remove('hidden');
            activeContent.classList.add('active-content');
        }
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const manualForm = document.getElementById('manualDepositForm');
    if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('manualAmount').value;
            const utr = document.getElementById('manualUtr').value.trim();
            const btn = document.getElementById('submitManualBtn');
            const originalText = btn.innerHTML;
            if (!currentUserUid) return showToast("Auth Error", "error");
            if (!amount || amount <= 0) return showToast("Enter valid amount", "error");
            if (utr.length < 12) return showToast("Enter correct 12-digit UTR", "error");
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
            btn.disabled = true;
            try {
                const txId = "MAN" + Date.now();
                await set(ref(db, `transactions/${currentUserUid}/${txId}`), {
                    id: txId, type: 'deposit_manual', amount: parseFloat(amount),
                    utr: utr, status: 'pending', date: Date.now(),
                    desc: 'Manual UPI Deposit'
                });
                await set(ref(db, `manual_deposits/${txId}`), {
                    uid: currentUserUid, email: currentUserEmail,
                    amount: parseFloat(amount), utr: utr,
                    status: 'pending', timestamp: serverTimestamp()
                });
                showToast("Deposit submitted! Admin will verify UTR.", "success");
                manualForm.reset();
            } catch (error) {
                showToast("Network Error. Try again.", "error");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    document.getElementById('payAutoBtn').addEventListener('click', async () => {
        const amt = document.getElementById('autoAmount').value;
        const phone = document.getElementById('autoPhone').value.trim();
        const btn = document.getElementById('payAutoBtn');
        if (!window.ZAP_KEY) return showToast("Gateway offline. Contact Admin.", "error");
        if (!amt || amt <= 0) return showToast("Enter a valid deposit amount", "error");
        if (!phone || phone.length < 10) return showToast("Enter a valid Phone Number", "error");
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> GENERATING...';
        btn.disabled = true;
        const orderId = "ORD" + Date.now();
        try {
            await set(ref(db, `transactions/${currentUserUid}/${orderId}`), {
                id: orderId, type: "deposit_auto", amount: parseFloat(amt),
                status: "pending", desc: "Gateway Deposit (ZapUPI)", date: new Date().toISOString()
            });
            await set(ref(db, `gateway_payments/${orderId}`), {
                uid: currentUserUid, email: currentUserEmail,
                amount: parseFloat(amt), phone: phone,
                status: "pending", timestamp: serverTimestamp()
            });
            ZapUPI.createOrder(
                { zap_key: window.ZAP_KEY, order_id: orderId, amount: amt, customer_mobile: phone, remark: currentUserUid + " | AutoDeposit" },
                {
                    onResponse: function(paymentUrl, returnedOrderId, data) {
                        btn.innerHTML = 'Pay via UPI App';
                        btn.disabled = false;
                        startPaymentWatcher(orderId);
                        ZapUPI.loadPayment(paymentUrl);
                    },
                    onError: function(err) {
                        btn.innerHTML = 'Pay via UPI App';
                        btn.disabled = false;
                        showToast("ZapUPI Error: " + err, "error");
                    }
                }
            );
        } catch (e) {
            btn.innerHTML = 'Pay via UPI App';
            btn.disabled = false;
            showToast("System Error. Try again.", "error");
        }
    });

    function startPaymentWatcher(orderId) {
        if (paymentPollInterval) clearInterval(paymentPollInterval);
        if (!localStorage.getItem("pending_zap_order")) {
            localStorage.setItem("pending_zap_order", orderId);
            localStorage.setItem("pending_zap_time", Date.now());
        }
        paymentPollInterval = setInterval(() => {
            const startTime = localStorage.getItem("pending_zap_time") || Date.now();
            const elapsed = Date.now() - parseInt(startTime);
            if (elapsed > 300000) {
                clearInterval(paymentPollInterval);
                localStorage.removeItem("pending_zap_order");
                localStorage.removeItem("pending_zap_time");
                return;
            }
            if (!window.ZAP_KEY) return;
            ZapUPI.orderStatus({ zap_key: window.ZAP_KEY, order_id: orderId }, {
                onResponse: async function(oid, data) {
                    if (data && data.data) {
                        if (data.data.status === "Success") {
                            clearInterval(paymentPollInterval);
                            localStorage.removeItem("pending_zap_order");
                            localStorage.removeItem("pending_zap_time");
                            await processSuccessfulPayment(orderId, data.data);
                        } else if (data.data.status === "Failed") {
                            clearInterval(paymentPollInterval);
                            localStorage.removeItem("pending_zap_order");
                            localStorage.removeItem("pending_zap_time");
                            await updatePaymentStatus(orderId, "failed");
                            showToast("Payment Failed. Order: " + orderId, "error");
                        }
                    }
                },
                onError: function(err) { console.log("Watcher poll error:", err); }
            });
        }, 5000);
    }

    ZapUPI.setPaymentCallbacks({
        onSuccess: async function(orderId) {
            showToast("Payment Success! Processing funds...", "success");
            if (!localStorage.getItem("pending_zap_order")) {
                startPaymentWatcher(orderId);
            }
        },
        onFailed: async function(orderId) {
            showToast("Payment Failed. Order: " + orderId, "error");
            await updatePaymentStatus(orderId, "failed");
        },
        onTimeout: async function(orderId) {
            showToast("Payment Timed Out. Order: " + orderId, "warning");
            await updatePaymentStatus(orderId, "failed");
        }
    });

    async function processReferralCommission(depositorUid, depositAmount) {
        try {
            const depositorSnap = await get(ref(db, `users/${depositorUid}/referredBy`));
            if (!depositorSnap.exists()) return;
            const referrerUid = depositorSnap.val();
            const commission = depositAmount * 0.05;
            await runTransaction(ref(db, `users/${referrerUid}/referralClaimable`), (bal) => (bal || 0) + commission);
            const depRef = ref(db, `referrals/${referrerUid}/${depositorUid}`);
            const depSnap = await get(depRef);
            const existing = depSnap.exists() ? depSnap.val() : {};
            await update(depRef, {
                deposited: (parseFloat(existing.deposited || 0) + depositAmount),
                commission: (parseFloat(existing.commission || 0) + commission)
            });
            console.log(`[REF] ₹${commission} commission credited to ${referrerUid} for deposit by ${depositorUid}`);
        } catch (e) { console.error("[REF] Commission error:", e); }
    }

    async function processSuccessfulPayment(orderId, gatewayData) {
        if (!currentUserUid) return;
        const amount = parseFloat(gatewayData.amount);
        const txRef = ref(db, `transactions/${currentUserUid}/${orderId}`);
        const result = await runTransaction(txRef, (tx) => {
            if (tx && tx.status === "pending") {
                tx.status = "success";
                tx.txn_id = gatewayData.txn_id;
                tx.utr = gatewayData.utr;
                return tx;
            }
            return undefined;
        });
        if (result.committed) {
            await runTransaction(ref(db, `users/${currentUserUid}/balance`), (bal) => (bal || 0) + amount);
            await update(ref(db, `gateway_payments/${orderId}`), { status: "approved", txn_id: gatewayData.txn_id, utr: gatewayData.utr });
            await processReferralCommission(currentUserUid, amount);
            showToast(`₹${amount} added to wallet!`, "success");
        }
    }

    async function updatePaymentStatus(orderId, newStatus) {
        try {
            await update(ref(db, `transactions/${currentUserUid}/${orderId}`), { status: newStatus });
            await update(ref(db, `gateway_payments/${orderId}`), { status: newStatus });
        } catch (e) { console.error("Status update error:", e); }
    }

    document.getElementById('cryptoPaidBtn').addEventListener('click', async () => {
        if (!currentUserUid) return showToast("Auth Error", "error");
        const txId = "CRY" + Date.now();
        showLoader();
        try {
            await set(ref(db, `transactions/${currentUserUid}/${txId}`), {
                id: txId, type: 'deposit_crypto', amount: 0,
                status: 'pending', date: Date.now(), desc: 'Crypto Deposit (Pending Verification)'
            });
            await set(ref(db, `crypto_deposits/${txId}`), {
                uid: currentUserUid, email: currentUserEmail, status: 'pending', timestamp: serverTimestamp()
            });
            showToast("Crypto deposit request sent! Admin will verify.", "success");
        } catch (e) {
            showToast("Error submitting request", "error");
        }
        hideLoader();
    });

    function fetchDepositSettings() {
        let cfg = { auto: false, manual: false, crypto: false };

        function refreshTabs() {
            const hasAny = cfg.auto || cfg.manual || cfg.crypto;
            document.getElementById('paymentTabsContainer').style.display = hasAny ? '' : 'none';
            document.getElementById('noPaymentMsg').classList.toggle('hidden', hasAny);

            ['auto', 'manual', 'crypto'].forEach(m => {
                const tab = document.getElementById(`tab-${m}`);
                const content = document.getElementById(`content-${m}`);
                if (!cfg[m]) {
                    if (tab) tab.style.display = 'none';
                    if (content) { content.classList.add('hidden'); content.classList.remove('active-content'); }
                } else {
                    if (tab) tab.style.display = '';
                }
            });

            const active = document.querySelector('.payment-tab.active-tab');
            if (!active || active.style.display === 'none') {
                const first = document.querySelector('.payment-tab:not([style*="display: none"])');
                if (first) window.switchTab(first.id.replace('tab-', ''));
            }
        }

        onValue(ref(db, 'settings/payment'), (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                cfg.auto = !!(data.zap_key);
                cfg.manual = !!(data.upiId);
                window.ZAP_KEY = data.zap_key || window.ZAP_KEY || "";
                const upiId = data.upiId || "Not Set";
                document.getElementById('manualUPIID').innerText = upiId;
                const manualQr = document.getElementById('manualQRImage');
                if (data.qrImage) {
                    manualQr.src = data.qrImage;
                } else {
                    manualQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${upiId}&pn=Store`;
                }
            }
            refreshTabs();
        });

        onValue(ref(db, 'deposit_settings'), (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                if (!cfg.auto && data.zap_key) cfg.auto = true;
                cfg.crypto = !!(data.binance_pay_id) || !!(data.usdt_address);
                window.ZAP_KEY = data.zap_key || window.ZAP_KEY || "";
                document.getElementById('cryptoRate').innerText = data.crypto_rate || "88.00";
                document.getElementById('cryptoPayID').innerText = data.binance_pay_id || "Not Set";
                document.getElementById('cryptoAddress').innerText = data.usdt_address || "Not Set";
                const cryptoQr = document.getElementById('cryptoQRImage');
                if (data.crypto_qr) {
                    cryptoQr.src = data.crypto_qr;
                }
            }
            refreshTabs();
        });
    }

    function fetchDepositStats(uid) {
        onValue(ref(db, `transactions/${uid}`), (snap) => {
            let todayTotal = 0, totalDeposit = 0, pendingTotal = 0;
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            if (snap.exists()) {
                snap.forEach(child => {
                    const tx = child.val();
                    if (tx.type && tx.type.includes('deposit')) {
                        const amt = parseFloat(tx.amount || 0);
                        if (tx.status === 'success') {
                            totalDeposit += amt;
                            const txDate = new Date(tx.date);
                            if (txDate >= todayStart) todayTotal += amt;
                        } else if (tx.status === 'pending') {
                            pendingTotal += amt;
                        }
                    }
                });
            }
            document.getElementById('statToday').innerText = todayTotal.toFixed(2);
            document.getElementById('statTotal').innerText = totalDeposit.toFixed(2);
            document.getElementById('statPending').innerText = pendingTotal.toFixed(2);
        });
    }

    function fetchTransactionHistory(uid) {
        const txList = document.getElementById('transactionList');
        if (!txList) return;
        const txRef = ref(db, `transactions/${uid}`);
        onValue(txRef, (snapshot) => {
            txList.innerHTML = '';
            if (snapshot.exists()) {
                const data = snapshot.val();
                const txArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                txArray.sort((a, b) => (b.date || 0) - (a.date || 0));
                txArray.forEach(tx => {
                    let iconClass, iconHtml, sign, amountColor, statusColor;
                    const d = new Date(tx.date);
                    const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                    if (tx.type && tx.type.includes('deposit')) {
                        iconClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                        iconHtml = '<i class="fas fa-arrow-down"></i>';
                        sign = '+'; amountColor = 'text-emerald-400';
                    } else if (tx.type === 'purchase') {
                        iconClass = 'bg-rose-500/10 border-rose-500/20 text-rose-500';
                        iconHtml = '<i class="fas fa-shopping-cart"></i>';
                        sign = '-'; amountColor = 'text-rose-500';
                    } else {
                        iconClass = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
                        iconHtml = '<i class="fas fa-circle"></i>';
                        sign = ''; amountColor = 'text-blue-400';
                    }
                    if (tx.status === 'success') statusColor = 'text-emerald-400';
                    else if (tx.status === 'pending') statusColor = 'text-yellow-400';
                    else statusColor = 'text-rose-500';
                    const txHtml = `
                        <div class="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center hover:bg-white/10 transition">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-lg flex items-center justify-center border ${iconClass}">${iconHtml}</div>
                                <div>
                                    <h4 class="text-[11px] font-black text-white uppercase tracking-tight">${tx.desc || tx.type || 'Transaction'}</h4>
                                    <p class="text-[9px] text-gray-500 font-mono tracking-widest">${dateStr} • <span class="${statusColor}">${tx.status}</span></p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="${amountColor} font-black text-sm drop-shadow-md">${sign}${tx.amount ? '₹' + parseFloat(tx.amount).toFixed(2) : ''}</span>
                            </div>
                        </div>`;
                    txList.insertAdjacentHTML('beforeend', txHtml);
                });
            } else {
                txList.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-6 opacity-40">
                        <i class="fas fa-ghost text-2xl text-gray-600 mb-2"></i>
                        <p class="text-[9px] font-mono uppercase tracking-widest text-gray-500">No transactions found</p>
                    </div>`;
            }
        });
    }

    function showLoader() { const l = document.getElementById('walletLoader'); if (l) l.classList.remove('hidden'); }
    function hideLoader() { const l = document.getElementById('walletLoader'); if (l) l.classList.add('hidden'); }

    function showToast(msg, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-exclamation-triangle";
        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
