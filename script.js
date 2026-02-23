// --- 1. DATA INITIALIZATION ---
let contracts = JSON.parse(localStorage.getItem('cate_pro_v9_clean')) || [];

contracts.forEach(c => {
    if (!c.assets) c.assets = [];
    if (!c.inventory) c.inventory = []; 
    
    if (c.history && c.history.length > 0) {
        const uniqueDates = new Set(c.history.map(h => h.date));
        c.visitsDone = uniqueDates.size;
    } else {
        c.visitsDone = 0;
    }
});

// Global Variables
let statusChart = null;
let forecastChart = null;
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let currentWAContract = null;
let currentAssetContractId = null;
let currentMaintenancePlan = [];
let currentCompressorMode = 'used'; 
let editingAssetIndex = null; 
let currentReportAssetIndex = null;

// --- AUTOCOMPLETE TEXT TEMPLATES ---
const MAINT_TEMPLATES = {
    '2000': `صيانة 2000 ساعة:\n1- تم تغيير فلتر هواء`,
    '4000': `صيانة 4000 ساعة:\n1- تم تغيير فلتر هواء\n2- تم تغيير فاصل الزيت\n3- تم تغيير الزيت`,
    '8000-GA': `عمرة 8000 ساعة (GA):\n1- تم تغيير فلتر هواء\n2- تم تغيير فاصل الزيت\n3- تم تغيير الزيت\n4- تم تغيير (Thermostatic valve)\n5- تم تغيير (Minimum pressure valve kit)\n6- تم تغيير (Un loader valve kit)\n7- تم تغيير (Check valve kit)\n8- تم تغيير (Automatic drain kit)`,
    '8000-VSD': `عمرة 8000 ساعة (GA VSD):\n1- تم تغيير فلتر هواء\n2- تم تغيير فاصل الزيت\n3- تم تغيير الزيت\n4- تم تغيير (Automatic drain kit)\n5- تم تغيير (Thermostatic valve)\n6- تم تغيير (Minimum pressure valve kit)`,
    'DRYER-DRAIN': `1- تم تغيير (Automatic drain kit)`
};

// DOM Elements
const modal = document.getElementById('contractModal');
const form = document.getElementById('contractForm');

// --- 2. ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('visitDate').valueAsDate = new Date();
    document.getElementById('main-search-bar').style.visibility = 'hidden';
    renderAll();
    
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('notif-dropdown');
        const btn = document.getElementById('notif-btn');
        if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('lightbox').style.display === 'flex') {
            if (e.key === 'ArrowRight') prevLBImage();
            if (e.key === 'ArrowLeft') nextLBImage();
            if (e.key === 'Escape') closeLightbox();
        }
    });
});

function updateVisitsCount(cIdx) {
    const c = contracts[cIdx];
    if (!c.history || c.history.length === 0) {
        c.visitsDone = 0;
    } else {
        const uniqueDates = new Set(c.history.map(h => h.date));
        c.visitsDone = uniqueDates.size;
    }
}

// --- 3. NAVIGATION LOGIC ---
function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    const target = document.getElementById('tab-' + id);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
    
    if (id === 'dashboard') {
        document.getElementById('nav-dashboard').classList.add('active');
        renderDashboard(); 
    } else if (id === 'contracts' || id === 'company-assets') {
        document.getElementById('nav-contracts').classList.add('active');
        if(id === 'contracts') {
            renderTable(contracts);
            const headerTitle = document.querySelector('#tab-contracts h2');
            if(headerTitle) headerTitle.innerText = 'إدارة العقود';
            toggleEmptyStates();
        }
    } else if (id === 'reports') {
        document.getElementById('nav-reports').classList.add('active');
    }

    const sb = document.getElementById('main-search-bar');
    if (id === 'dashboard') {
        sb.style.visibility = 'hidden';
        sb.style.opacity = '0';
    } else {
        sb.style.visibility = 'visible';
        sb.style.opacity = '1';
    }
}

// --- 4. DASHBOARD FILTER & LOGIC ---
function filterDashboard(type) {
    switchTab('contracts');
    const filteredData = contracts.filter(c => getStatus(c).type === type);
    renderTable(filteredData);
    
    const titles = {
        'active': 'العقود السارية فقط',
        'soon': 'تنبيهات اقتراب الموعد',
        'due': 'العقود والصيانات المستحقة',
        'hold': 'العقود المعلقة (Hold)'
    };
    
    const headerTitle = document.querySelector('#tab-contracts h2');
    if(headerTitle) headerTitle.innerText = `إدارة العقود (${titles[type]})`;
    
    const noMsg = document.getElementById('no-contracts-msg');
    const tableEl = document.getElementById('main-table');
    
    if (filteredData.length === 0) {
        tableEl.style.display = 'none';
        noMsg.style.display = 'block';
        noMsg.innerText = "لا توجد عقود في هذه القائمة حالياً.";
    } else {
        tableEl.style.display = 'table';
        noMsg.style.display = 'none';
    }
}

function calculateDate(startStr, daily, off, targetHours) {
    if (!daily || daily <= 0) {
        return { due: new Date(2100, 0, 1), reminder: new Date(2100, 0, 1), str: 'غير محدد' };
    }

    let currentDate = new Date(startStr);
    currentDate.setHours(0, 0, 0, 0); 
    
    let remainingHours = targetHours;
    let maxIterations = 50000; 
    let iterations = 0;

    while (remainingHours > 0 && iterations < maxIterations) {
        iterations++;
        
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth();
        let daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let effectiveDaily = (Math.max(0, daysInMonth - off) / daysInMonth) * daily;
        
        remainingHours -= effectiveDaily;
        
        if (remainingHours > 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    const due = new Date(currentDate);
    const reminder = new Date(due);
    reminder.setDate(due.getDate() - 14); 

    const yyyy = due.getFullYear();
    const mm = String(due.getMonth() + 1).padStart(2, '0');
    const dd = String(due.getDate()).padStart(2, '0');

    return { due, reminder, str: `${yyyy}-${mm}-${dd}` };
}

function getStatus(c) {
    if (c.isHold) return { type: 'hold', label: 'معلق (Hold)', color: 'var(--secondary)' };
    
    const today = new Date();
    if (c.endDate) {
        const end = new Date(c.endDate);
        const diffTime = end - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { type: 'due', label: 'عقد منتهي', color: 'var(--danger)' };
        if (diffDays <= 30) return { type: 'soon', label: 'تجديد العقد', color: 'var(--purple)' }; 
    }
    
    let hasDueMachine = false;
    let hasSoonMachine = false;

    if(c.assets && c.assets.length > 0) {
        c.assets.forEach(a => {
            if(a.type === 'compressor' && a.maintenancePlan && a.maintenancePlan.length > 0) {
                let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                let nextIdx = a.nextMaintenanceIndex || 0;

                if (nextIdx < a.maintenancePlan.length) {
                    const target = base + 2000;
                    if (a.currentHours >= target) {
                        hasDueMachine = true;
                    } else if ((target - a.currentHours) <= 200) {
                        hasSoonMachine = true;
                    }
                }
            }
        });
    }

    if (hasDueMachine) return { type: 'due', label: 'صيانة مستحقة', color: 'var(--danger)' };
    if (hasSoonMachine) return { type: 'soon', label: 'صيانة قريبة', color: 'var(--warning)' };

    return { type: 'active', label: 'سارية', color: 'var(--success)' };
}

// --- 5. RENDER FUNCTIONS ---
function renderAll() {
    renderDashboard();
    renderTable(contracts);
    renderReportsGrid(contracts);
    toggleEmptyStates();
    updateNotifications();
}

function toggleEmptyStates() {
    const hasData = contracts.length > 0;
    document.getElementById('no-contracts-msg').style.display = hasData ? 'none' : 'block';
    document.getElementById('main-table').style.display = hasData ? 'table' : 'none';
    document.getElementById('no-reports-msg').style.display = hasData ? 'none' : 'block';
    document.getElementById('no-machines-msg').style.display = hasData ? 'none' : 'block';
}

function renderDashboard() {
    let stats = { active: 0, soon: 0, due: 0, hold: 0, total: contracts.length };
    
    contracts.forEach(c => {
        const status = getStatus(c);
        if (status.type === 'active') stats.active++;
        else if (status.type === 'soon') stats.soon++;
        else if (status.type === 'hold') stats.hold++;
        else stats.due++;
    });

    renderUrgentAlerts();

    animateValue(document.getElementById('stat-active'), 0, stats.active, 1000);
    animateValue(document.getElementById('stat-soon'), 0, stats.soon, 1000);
    animateValue(document.getElementById('stat-due'), 0, stats.due, 1000);
    animateValue(document.getElementById('stat-hold'), 0, stats.hold, 1000);

    renderStatusChart(stats);
    renderForecastChart(); 
    renderTopMachines();   
    renderActivityFeed();  
}

function renderUrgentAlerts() {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    let alertCount = 0;

    contracts.forEach(c => {
        if(c.isHold) return;

        const today = new Date();
        if(c.endDate) {
            const daysLeft = Math.ceil((new Date(c.endDate) - today) / (1000 * 60 * 60 * 24));
            if(daysLeft <= 0) {
                addAlertItem(container, c.company, 'انتهاء مدة العقد', 'due');
                alertCount++;
            } else if(daysLeft <= 30) {
                addAlertItem(container, c.company, `ينتهي العقد خلال ${daysLeft} يوم`, 'soon');
                alertCount++;
            }
        }

        if(c.assets) {
            c.assets.forEach(a => {
                if(a.type === 'compressor' && a.maintenancePlan) {
                    let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                    let nextIdx = a.nextMaintenanceIndex || 0;

                    if (nextIdx < a.maintenancePlan.length) {
                        const target = base + 2000;
                        const remaining = target - a.currentHours;
                        if(remaining <= 0) {
                            addAlertItem(container, c.company, `صيانة مستحقة: ${a.name} (تجاوزت الموعد)`, 'due');
                            alertCount++;
                        } else if (remaining <= 200) {
                            addAlertItem(container, c.company, `اقتراب صيانة: ${a.name} (باقي ${remaining} ساعة)`, 'soon');
                            alertCount++;
                        }
                    }
                }
            });
        }
    });

    const noMsg = document.getElementById('no-alerts-msg');
    const badge = document.getElementById('alert-count-badge');
    
    if(alertCount > 0) {
        noMsg.style.display = 'none';
        badge.innerText = alertCount;
        badge.style.display = 'inline-flex';
    } else {
        noMsg.style.display = 'block';
        badge.style.display = 'none';
    }
}

function addAlertItem(container, title, msg, type) {
    const bg = type === 'due' ? '#fee2e2' : '#ffedd5';
    const col = type === 'due' ? '#ef4444' : '#f97316';
    const icon = type === 'due' ? 'fa-triangle-exclamation' : 'fa-clock';
    
    container.innerHTML += `
        <div class="list-card-item">
            <div class="item-info">
                <div class="item-icon" style="background:${bg}; color:${col}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="item-details">
                    <h4>${title}</h4>
                    <span style="color:${col}; font-weight:bold;">${msg}</span>
                </div>
            </div>
        </div>`;
}

function renderActivityFeed() {
    const container = document.getElementById('activity-feed');
    container.innerHTML = '';
    
    let allActivities = [];
    contracts.forEach(c => {
        if(c.history && c.history.length > 0) {
            c.history.forEach(h => {
                allActivities.push({
                    company: c.company,
                    date: h.date,
                    notes: h.notes,
                    assetName: (h.assetIndex !== undefined && h.assetIndex !== null && c.assets[h.assetIndex]) ? c.assets[h.assetIndex].name : 'غير محدد'
                });
            });
        }
    });

    allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = allActivities.slice(0, 6);

    if(recent.length === 0) {
        container.innerHTML = '<li style="text-align:center; color:#ccc; padding:20px;">لا توجد تحركات حديثة</li>';
        return;
    }

    recent.forEach(act => {
        container.innerHTML += `
            <li class="activity-item">
                <div class="act-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
                <div class="act-content">
                    <h5>${act.company} <small style="color:#aaa; font-weight:normal">(${act.date})</small></h5>
                    <p><strong>${act.assetName}:</strong> ${act.notes}</p>
                </div>
            </li>
        `;
    });
}

function renderForecastChart() {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const months = [];
    const dataCounts = [0, 0, 0, 0, 0, 0];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) { 
        months.push(new Date(today.getFullYear(), today.getMonth() + i, 1).toLocaleDateString('ar-EG', { month: 'short' })); 
    }

    contracts.forEach(c => {
        if(!c.isHold && c.assets) {
            c.assets.forEach(a => {
                if(a.type === 'compressor' && a.dailyHours > 0 && a.maintenancePlan) {
                    let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                    let nextIdx = a.nextMaintenanceIndex || 0;

                    if (nextIdx < a.maintenancePlan.length) {
                        const target = base + 2000; 
                        if(a.currentHours < target) {
                            const remaining = target - a.currentHours;
                            
                            let calcBaseDate = today;
                            if (a.currentHours === 0 && a.startDate) {
                                calcBaseDate = new Date(a.startDate);
                            }

                            const calc = calculateDate(calcBaseDate, a.dailyHours, a.daysOff || 0, remaining);
                            const diffMonths = (calc.due.getFullYear() - today.getFullYear()) * 12 + (calc.due.getMonth() - today.getMonth());
                            
                            if (diffMonths >= 0 && diffMonths < 6) {
                                dataCounts[diffMonths]++;
                            }
                        } else {
                            dataCounts[0]++;
                        }
                    }
                }
            });
        }
    });

    if (forecastChart) forecastChart.destroy();
    forecastChart = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: months, 
            datasets: [{ 
                label: 'عدد الماكينات المستحقة للصيانة', 
                data: dataCounts, 
                backgroundColor: '#006F8F', 
                borderRadius: 4, 
                barThickness: 30 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { display: true, color: 'rgba(0,0,0,0.05)' } }, 
                x: { grid: { display: false } } 
            }, 
            plugins: { legend: { display: false } } 
        } 
    });
}

function renderTopMachines() {
    const container = document.getElementById('top-machines-container');
    container.innerHTML = '';
    
    let allMachines = [];
    contracts.forEach(c => {
        if(!c.isHold && c.assets) {
            c.assets.forEach(a => {
                if(a.type === 'compressor') {
                    allMachines.push({
                        name: a.name,
                        company: c.company,
                        daily: a.dailyHours || 0
                    });
                }
            });
        }
    });

    allMachines.sort((a, b) => b.daily - a.daily);
    const top5 = allMachines.slice(0, 5);

    if (top5.length === 0) { 
        document.getElementById('no-machines-msg').style.display = 'block'; 
        return; 
    } 
    
    document.getElementById('no-machines-msg').style.display = 'none';
    const maxHours = Math.max(...top5.map(m => m.daily), 1);

    top5.forEach(m => {
        let percent = (m.daily / maxHours) * 100;
        let colorClass = m.daily >= 20 ? '#ef4444' : (m.daily >= 12 ? '#f59e0b' : '#10b981');
        
        container.innerHTML += `
            <div class="list-card-item">
                <div class="item-info">
                    <div class="item-icon" style="background:#f1f5f9; color:#64748b">
                        <i class="fa-solid fa-industry"></i>
                    </div>
                    <div class="item-details">
                        <h4>${m.name} <small>(${m.company})</small></h4>
                        <div class="machine-bar-bg">
                            <div class="machine-bar-fill" style="width:${percent}%; background:${colorClass}"></div>
                        </div>
                    </div>
                </div>
                <div style="text-align:left">
                    <span style="display:block; font-weight:bold; color:${colorClass}">${m.daily}</span>
                    <span style="font-size:0.65rem; color:#94a3b8">ساعة/يوم</span>
                </div>
            </div>`;
    });
}

function renderStatusChart(stats) {
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    const data = (stats.total === 0) ? [1] : [stats.active, stats.soon, stats.due, stats.hold];
    const colors = (stats.total === 0) ? ['#e2e8f0'] : ['#10b981', '#f59e0b', '#ef4444', '#64748b'];
    statusChart = new Chart(ctx, { type: 'doughnut', data: { labels: stats.total === 0 ? ['لا يوجد بيانات'] : ['سارية', 'تنبيه', 'مستحقة', 'معلقة'], datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } } });
}

function renderTable(data) {
    const tbody = document.getElementById('contracts-body');
    tbody.innerHTML = '';
    data.forEach(c => {
        const status = getStatus(c);
        const progress = c.totalVisits > 0 ? Math.min(100, Math.round((c.visitsDone / c.totalVisits) * 100)) : 0;
        
        let badgeClass = '';
        if (status.type === 'hold') badgeClass = 'badge-grey'; 
        else if (status.type === 'due') badgeClass = 'badge-red'; 
        else if (status.type === 'soon') badgeClass = 'badge-orange';
        else badgeClass = 'badge-green';
        
        const hasPDF = c.contractPDF && c.contractPDF.length > 5;
        const pdfButtonDisplay = hasPDF ? 
            `<button onclick="openContractPDF(${c.id})" class="action-btn btn-icon-pdf" title="عرض العقد"><i class="fa-solid fa-file-pdf"></i></button>` : 
            `<button class="action-btn" style="background:#f1f5f9; color:#cbd5e1; cursor:not-allowed;" title="لا يوجد عقد"><i class="fa-solid fa-file-slash"></i></button>`;
        
        let holdBtn = '';
        if (c.isHold) {
            holdBtn = `<button onclick="openUnholdModal(${c.id})" class="action-btn" style="background: #4f46e5; color: white; border:none;" title="إعادة تفعيل"><i class="fa-solid fa-play"></i></button>`;
        } else if (status.type === 'due') {
            holdBtn = `<button onclick="holdContract(${c.id})" class="action-btn" style="background: #f97316; color: white; border:none;" title="تعليق"><i class="fa-solid fa-pause"></i></button>`;
        }

        tbody.innerHTML += `<tr>
            <td style="text-align: right;">
                <div class="company-link" onclick="openCompanyAssets(${c.id})">${c.company}</div>
                <div style="font-size:0.8rem;color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-user"></i> ${c.client}</div>
                <span class="badge ${badgeClass}" style="font-size:0.7rem; background:${status.color}; color:white;">${status.label}</span>
            </td>
            <td><div style="font-weight:bold;">${c.startDate}</div></td>
            <td><div style="font-weight:bold;">${c.endDate}</div></td>
            <td><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size:0.9rem;">${c.visitsDone} / ${c.totalVisits}</span><div class="progress-track" style="width:100%; margin:0;"><div class="progress-fill" style="width:${progress}%"></div></div></div></td>
            <td>
                <div class="actions-grid">
                    <button onclick="openWAModal(${c.id})" class="action-btn btn-icon-wa"><i class="fa-brands fa-whatsapp"></i></button>
                    ${holdBtn}
                    <button onclick="goToReports(${c.id})" class="action-btn btn-icon-rep"><i class="fa-solid fa-clipboard-list"></i></button>
                    <button onclick="editContract(${c.id})" class="action-btn btn-icon-edit"><i class="fa-solid fa-pen"></i></button>
                    ${pdfButtonDisplay}
                    <button onclick="deleteContract(${c.id})" class="action-btn btn-icon-del" style="grid-column:span 2; width:100%;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

function holdContract(id) {
    if(confirm('العقد منتهي، هل تريد تعليقه في الأرشيف (Hold)؟')) {
        const idx = contracts.findIndex(x => x.id === id);
        if(idx !== -1) {
            contracts[idx].isHold = true;
            saveData();
            renderAll();
            showToast('تم تعليق العقد بنجاح');
        }
    }
}

function openUnholdModal(id) {
    document.getElementById('unholdContractId').value = id;
    document.getElementById('unholdForm').reset();
    document.getElementById('unholdModal').style.display = 'flex';
}

function closeUnholdModal() {
    document.getElementById('unholdModal').style.display = 'none';
}

document.getElementById('unholdForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('unholdContractId').value);
    const newStart = document.getElementById('unholdStartDate').value;
    const newEnd = document.getElementById('unholdEndDate').value;

    const idx = contracts.findIndex(x => x.id === id);
    if(idx !== -1) {
        contracts[idx].startDate = newStart;
        contracts[idx].endDate = newEnd;
        contracts[idx].isHold = false;
        saveData();
        closeUnholdModal();
        renderAll();
        showToast('تم إعادة تفعيل العقد بنجاح');
    }
});

function openCompanyAssets(id) {
    currentAssetContractId = id;
    const c = contracts.find(x => x.id === id);
    if (!c) return;
    document.getElementById('asset-company-title').innerText = c.company;
    renderAssetsGrid(c.assets || []);
    switchTab('company-assets');
}

function renderAssetsGrid(assets) {
    const container = document.getElementById('assets-grid-container');
    container.innerHTML = '';
    
    if (!assets || assets.length === 0) { 
        document.getElementById('no-assets-msg').style.display = 'block'; 
        return; 
    } else { 
        document.getElementById('no-assets-msg').style.display = 'none'; 
    }

    assets.forEach((asset, index) => {
        let iconClass = asset.type === 'dryer' ? 'fa-temperature-arrow-down' : (asset.type === 'vacuum' ? 'fa-fan' : 'fa-wind');
        let bgClass = asset.type === 'dryer' ? 'asset-dryer' : (asset.type === 'vacuum' ? 'asset-vacuum' : 'asset-compressor');
        let details = '';

        let clickAction = asset.type === 'compressor' ? `onclick="openMachineDetails(${index})"` : '';
        let cursorStyle = asset.type === 'compressor' ? 'cursor:pointer;' : '';

        if (asset.type === 'dryer') {
            details = `
                <div style="font-size:0.95rem; font-weight:bold;">${asset.name}</div>
                <div style="font-size:0.8rem; color:var(--text-light);">Serial: ${asset.serial}</div>
                <div style="font-size:0.75rem; color:var(--text-light); margin-top:5px;">
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${asset.year}</span> 
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${asset.freon}</span>
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${asset.capacity || 'N/A'}</span>
                </div>`;
        } else if (asset.type === 'vacuum') {
            details = `
                <div style="font-size:0.95rem; font-weight:bold;">${asset.name} <small style="font-weight:normal; color:var(--text-light)">(Vacuum Pump)</small></div>
                <div style="font-size:0.8rem; color:var(--text-light);">Serial: ${asset.serial}</div>
                <div style="font-size:0.75rem; color:var(--text-light); margin-top:5px;">
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${asset.year}</span> 
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${asset.bar} Bar</span>
                </div>`;
        } else {
            let nextMaintText = "تم الانتهاء من الخطة";
            let nextColor = "#cbd5e1";
            
            if (asset.maintenancePlan && asset.maintenancePlan.length > (asset.nextMaintenanceIndex || 0)) {
                const nextStepChar = asset.maintenancePlan[asset.nextMaintenanceIndex || 0];
                nextMaintText = `القادمة: ${getMaintenanceLabel(nextStepChar)}`;
                nextColor = getMaintenanceColor(nextStepChar);
            }
            
            details = `
                <div style="font-size:0.95rem; font-weight:bold;">${asset.name} <small style="font-weight:normal; color:var(--text-light)">(${asset.subType})</small></div>
                <div style="font-size:0.8rem; color:var(--text-light);">Serial: ${asset.serial}</div>
                <div style="font-size:0.8rem; color:var(--text-light); margin-top:2px;">بدء التشغيل: <span style="font-weight:bold; color:var(--info);">${asset.startDate || 'غير محدد'}</span></div>
                <div style="margin-top:8px; border-top:1px solid #eee; padding-top:5px;">
                    <div style="font-size:0.8rem; font-weight:bold; color:${nextColor}">${nextMaintText}</div>
                </div>`;
        }

        container.innerHTML += `
            <div class="asset-card" ${clickAction} style="${cursorStyle}">
                <div class="asset-actions-overlay">
                    <button class="asset-btn asset-btn-edit" onclick="event.stopPropagation(); editAsset(${index})" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                    <button class="asset-btn asset-btn-del" onclick="event.stopPropagation(); deleteAsset(${index})" title="حذف"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="asset-icon ${bgClass}"><i class="fa-solid ${iconClass}"></i></div>
                <div style="flex:1">${details}</div>
                ${asset.type === 'compressor' ? '<i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.8rem;"></i>' : ''}
            </div>`;
    });
}

// --- NEW: INVENTORY LOGIC (MODERNIZED & CREATIVE) ---
function openInventoryModal() {
    if(!currentAssetContractId) return;
    renderInventoryTables();
    document.getElementById('inventoryModal').style.display = 'flex';
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').style.display = 'none';
}

function renderInventoryTables() {
    const container = document.getElementById('inventory-container');
    container.innerHTML = '';
    
    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    if(idx === -1) return;
    const contract = contracts[idx];

    if(!contract.assets || contract.assets.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;"><i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; margin-bottom:15px; color:#cbd5e1;"></i><br>لا توجد ماكينات مسجلة في هذا العقد.<br>يرجى إضافة (Compressor / Dryer / Vacuum) أولاً.</div>';
        return;
    }

    contract.assets.forEach((asset, assetIdx) => {
        const assetParts = (contract.inventory || []).filter(p => p.model === asset.name);
        
        let rows = '';
        assetParts.forEach((p, i) => {
            rows += `<tr>
                <td style="color:var(--text-light);">${i + 1}</td>
                <td style="text-align:left; font-weight:700;">${p.name}</td>
                <td style="font-family:monospace; color:var(--primary);">${p.partNo || '-'}</td>
                <td style="color:${p.qty > 0 ? '#16a34a' : '#ef4444'}; font-size:1.1rem;">${p.qty}</td>
                <td style="color:var(--text-light);">${p.notes || '-'}</td>
                <td><button class="btn-delete-inv" onclick="deleteInvItem('${p.id}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });

        const tableHtml = assetParts.length > 0 ? `
            <table class="inv-table">
                <thead>
                    <tr>
                        <th style="width:5%;">#</th>
                        <th style="width:30%; text-align:left;">اسم القطعة (Spare parts)</th>
                        <th style="width:20%;">Part no</th>
                        <th style="width:10%;">QYT</th>
                        <th style="width:30%;">ملاحظات</th>
                        <th style="width:5%;"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        ` : `<div class="empty-asset-parts"><i class="fa-solid fa-box-open" style="font-size:1.5rem; margin-bottom:10px; color:#94a3b8;"></i><br>لا توجد قطع غيار مضافة لهذه الماكينة حتى الآن.</div>`;

        let icon = asset.type === 'compressor' ? 'fa-wind' : (asset.type === 'dryer' ? 'fa-temperature-arrow-down' : 'fa-fan');
        let subTypeLabel = asset.type === 'compressor' ? `(${asset.subType})` : '';

        container.innerHTML += `
            <div class="asset-inv-card">
                <div class="asset-inv-header">
                    <div class="asset-inv-header-info">
                        <i class="fa-solid ${icon}"></i>
                        <span>${asset.name} <small style="font-weight:normal; opacity:0.8;">${subTypeLabel}</small></span>
                    </div>
                    <div style="font-size:0.85rem; font-weight:normal; opacity:0.9;">Serial: ${asset.serial || 'N/A'}</div>
                </div>
                
                <form class="asset-inv-form" onsubmit="addPartToAsset(event, ${assetIdx})">
                    <div>
                        <label style="font-size:0.75rem; font-weight:bold; color:var(--text-light);">اسم القطعة (Spare parts)</label>
                        <input type="text" id="invName_${assetIdx}" class="form-control" style="background:white; padding:8px 12px;" required>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:bold; color:var(--text-light);">Part no</label>
                        <input type="text" id="invPartNo_${assetIdx}" class="form-control" style="background:white; padding:8px 12px;">
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:bold; color:var(--text-light);">الكمية (QYT)</label>
                        <input type="number" id="invQty_${assetIdx}" class="form-control" style="background:white; padding:8px 12px;" min="1" value="1" required>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; font-weight:bold; color:var(--text-light);">ملاحظات (Notes)</label>
                        <input type="text" id="invNotes_${assetIdx}" class="form-control" style="background:white; padding:8px 12px;">
                    </div>
                    <div>
                        <button type="submit" class="btn btn-primary" style="padding: 8px 15px; height: 100%;"><i class="fa-solid fa-plus"></i> إضافة</button>
                    </div>
                </form>
                
                <div class="asset-inv-body">
                    ${tableHtml}
                </div>
            </div>
        `;
    });
}

window.addPartToAsset = function(e, assetIdx) {
    e.preventDefault();
    if(!currentAssetContractId) return;

    const cIdx = contracts.findIndex(c => c.id === currentAssetContractId);
    if(cIdx === -1) return;
    
    const asset = contracts[cIdx].assets[assetIdx];

    const newItem = {
        id: Date.now().toString(),
        model: asset.name,
        name: document.getElementById(`invName_${assetIdx}`).value,
        partNo: document.getElementById(`invPartNo_${assetIdx}`).value,
        qty: parseInt(document.getElementById(`invQty_${assetIdx}`).value),
        notes: document.getElementById(`invNotes_${assetIdx}`).value
    };

    if(!contracts[cIdx].inventory) contracts[cIdx].inventory = [];
    contracts[cIdx].inventory.push(newItem);

    saveData();
    renderInventoryTables();
    showToast('تم إضافة القطعة للمخزن بنجاح');
};

function deleteInvItem(itemId) {
    if(!confirm('حذف هذه القطعة من الجرد؟')) return;
    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    if(idx !== -1) {
        contracts[idx].inventory = contracts[idx].inventory.filter(i => i.id !== itemId);
        saveData();
        renderInventoryTables();
    }
}

// --- NEW UI: Visit Form Inventory Deduction ---
function renderVisitInventoryDeduction(contractId, assetName = null) {
    const container = document.getElementById('visit-inventory-list');
    const box = document.getElementById('visit-inventory-deduction');
    const nameLabel = document.getElementById('inv-machine-name');
    container.innerHTML = '';
    
    if (!assetName) {
        box.classList.add('hidden');
        return;
    }

    const contract = contracts.find(c => c.id === contractId);
    const availableParts = contract.inventory ? contract.inventory.filter(p => p.qty > 0 && p.model === assetName) : [];

    if(availableParts.length === 0) {
        box.classList.add('hidden');
        return;
    }

    box.classList.remove('hidden');
    nameLabel.innerText = `(${assetName})`;
    
    let gridHtml = '<div class="visit-inv-grid">';
    
    availableParts.forEach(p => {
        gridHtml += `
            <div class="visit-inv-card" id="vic-card-${p.id}">
                <div class="vic-header">
                    <input type="checkbox" class="vic-checkbox" id="vic-chk-${p.id}" value="${p.id}" onchange="toggleVicQty('${p.id}')">
                    <div class="vic-check-indicator" onclick="document.getElementById('vic-chk-${p.id}').click()"><i class="fa-solid fa-check"></i></div>
                    <div class="vic-info" onclick="document.getElementById('vic-chk-${p.id}').click()">
                        <span class="vic-name">${p.name}</span>
                        <span class="vic-meta">متاح: <b style="color:var(--primary); font-size:0.85rem;">${p.qty}</b></span>
                    </div>
                </div>
                <div class="vic-qty-ctrl" id="vic-ctrl-${p.id}">
                    <button type="button" class="vic-btn" onclick="changeVicQty('${p.id}', -1)">-</button>
                    <input type="number" id="vic-input-${p.id}" class="vic-input" data-name="${p.name}" min="1" max="${p.qty}" value="1" readonly>
                    <button type="button" class="vic-btn" onclick="changeVicQty('${p.id}', 1, ${p.qty})">+</button>
                </div>
            </div>
        `;
    });
    
    gridHtml += '</div>';
    container.innerHTML = gridHtml;
}

window.toggleVicQty = function(id) {
    const chk = document.getElementById(`vic-chk-${id}`);
    const ctrl = document.getElementById(`vic-ctrl-${id}`);
    const card = document.getElementById(`vic-card-${id}`);
    if(chk.checked) {
        ctrl.classList.add('show');
        card.classList.add('active');
    } else {
        ctrl.classList.remove('show');
        card.classList.remove('active');
        document.getElementById(`vic-input-${id}`).value = 1;
    }
}

window.changeVicQty = function(id, delta, max) {
    const input = document.getElementById(`vic-input-${id}`);
    let val = parseInt(input.value) || 1;
    val += delta;
    if(val < 1) val = 1;
    if(max !== undefined && val > max) val = max;
    input.value = val;
}

// --- VISUAL FEEDBACK FOR MAINTENANCE BUTTONS ---
window.resetMaintButtons = function() {
    document.querySelectorAll('.maint-select-btn').forEach(btn => {
        const col = btn.getAttribute('data-color');
        if(col) {
            btn.style.background = 'white';
            btn.style.color = col;
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        }
    });
};

window.fillMaintDetails = function(type, btnElement) {
    const textArea = document.getElementById('visitNotes');
    if (MAINT_TEMPLATES[type]) {
        textArea.value = MAINT_TEMPLATES[type];
        
        resetMaintButtons();
        
        if (btnElement) {
            const col = btnElement.getAttribute('data-color');
            btnElement.style.background = col;
            btnElement.style.color = 'white';
            btnElement.style.transform = 'translateY(-2px)';
            btnElement.style.boxShadow = `0 4px 12px ${col}60`; 
        }

        const subOpts = document.getElementById('maint-8000-sub-options');
        
        if (type.startsWith('8000')) {
            const main8000 = document.getElementById('btn-8000-main');
            if(main8000) {
                main8000.style.background = '#ef4444';
                main8000.style.color = 'white';
            }
        } else if(subOpts) {
            subOpts.classList.add('hidden');
        }
    }
};

window.toggle8000Options = function(btnElement) {
    const div = document.getElementById('maint-8000-sub-options');
    if (div.classList.contains('hidden')) {
        div.classList.remove('hidden');
        if(btnElement) {
            const col = btnElement.getAttribute('data-color');
            btnElement.style.background = col;
            btnElement.style.color = 'white';
        }
    } else {
        div.classList.add('hidden');
        const textArea = document.getElementById('visitNotes');
        if (!textArea.value.includes('عمرة 8000')) {
            if(btnElement) {
                const col = btnElement.getAttribute('data-color');
                btnElement.style.background = 'white';
                btnElement.style.color = col;
            }
        }
    }
};

function openAddMachineModal() { 
    editingAssetIndex = null; 
    resetMachineModal(); 
    document.getElementById('addMachineModal').style.display = 'flex'; 
}
function closeAddMachineModal() { document.getElementById('addMachineModal').style.display = 'none'; }
function resetMachineModal() {
    document.getElementById('machine-type-selection').classList.remove('hidden');
    document.getElementById('dryer-form-section').classList.add('hidden');
    document.getElementById('compressor-choice-section').classList.add('hidden');
    document.getElementById('used-compressor-form-section').classList.add('hidden');
    document.getElementById('vacuum-form-section').classList.add('hidden');
    document.getElementById('dryerForm').reset();
    document.getElementById('usedCompressorForm').reset();
    document.getElementById('vacuumForm').reset();
}
function selectMachineType(type) {
    document.getElementById('machine-type-selection').classList.add('hidden');
    if (type === 'dryer') { 
        document.getElementById('dryer-form-section').classList.remove('hidden'); 
    } else if (type === 'vacuum') { 
        document.getElementById('vacuum-form-section').classList.remove('hidden'); 
    } else { 
        document.getElementById('compressor-choice-section').classList.remove('hidden'); 
    }
}
function showCompressorForm(mode) {
    currentCompressorMode = mode;
    document.getElementById('compressor-choice-section').classList.add('hidden');
    document.getElementById('used-compressor-form-section').classList.remove('hidden');
    
    document.getElementById('compStartDate').value = new Date().toISOString().split('T')[0];
    
    const hrsContainer = document.getElementById('hoursDataContainer');
    if (mode === 'new') { 
        hrsContainer.style.display = 'none'; 
        document.getElementById('compCurrentHours').value = 0; 
        document.getElementById('compLastMaintHours').value = 0; 
    } else { 
        hrsContainer.style.display = 'flex'; 
        document.getElementById('compCurrentHours').value = ''; 
        document.getElementById('compLastMaintHours').value = ''; 
    }
    currentMaintenancePlan = []; updatePlanPreview();
}
function backToCompChoice() {
    document.getElementById('used-compressor-form-section').classList.add('hidden');
    document.getElementById('compressor-choice-section').classList.remove('hidden');
}

function addPlanStep(type) { currentMaintenancePlan.push(type); updatePlanPreview(); }
function removePlanStep(index) { currentMaintenancePlan.splice(index, 1); updatePlanPreview(); }
function clearPlan() { currentMaintenancePlan = []; updatePlanPreview(); }
function setDefaultPlan() { currentMaintenancePlan = ['A', 'B', 'A', 'C']; updatePlanPreview(); }

function getMaintenanceLabel(char) {
    switch(char) {
        case 'A': return 'A (2000 hr)'; case 'B': return 'B (4000 hr)'; case 'C': return 'C (8000 hr)'; case 'D': return 'D (16000 hr)'; case 'E': return 'E (24000 hr)'; default: return char;
    }
}
function getMaintenanceColor(char) {
    switch(char) {
        case 'A': return '#10b981'; case 'B': return '#f59e0b'; case 'C': return '#ef4444'; case 'D': return '#8b5cf6'; case 'E': return '#be123c'; default: return '#64748b';
    }
}

function updatePlanPreview() {
    const container = document.getElementById('planTimelineContainer');
    const currentHoursInput = document.getElementById('compCurrentHours').value;
    const lastMaintHoursInput = document.getElementById('compLastMaintHours').value; 
    const dailyHours = parseFloat(document.getElementById('compDailyHours').value) || 0;
    const daysOff = parseFloat(document.getElementById('compDaysOff').value) || 0;
    
    let currentHours = parseInt(currentHoursInput) || 0;
    let lastMaintHours = parseInt(lastMaintHoursInput) || 0; 
    if(currentCompressorMode === 'new'){
        lastMaintHours = 0;
    }

    let nextIdx = 0;
    if (editingAssetIndex !== null && currentAssetContractId) {
        const c = contracts.find(x => x.id === currentAssetContractId);
        if (c && c.assets[editingAssetIndex]) {
            nextIdx = c.assets[editingAssetIndex].nextMaintenanceIndex || 0;
        }
    }
    
    container.innerHTML = '';
    if (currentMaintenancePlan.length === 0) { container.innerHTML = '<div style="text-align:center; color:#aaa; font-size:0.85rem; padding-top:20px;">اضغط على الأزرار أعلاه لترتيب الصيانات القادمة...</div>'; return; }
    
    let baseDate = new Date(); 
    if ((currentCompressorMode === 'new' || currentHours === 0) && document.getElementById('compStartDate').value) {
        baseDate = new Date(document.getElementById('compStartDate').value);
    }

    currentMaintenancePlan.forEach((stepChar, index) => {
        let dueHours;
        let remainingHours = 0;
        let dateDisplay = '';

        if (index < nextIdx) {
            dueHours = 'تمت مسبقاً';
            dateDisplay = '<span style="color:#10b981"><i class="fa-solid fa-check"></i> منتهية</span>';
        } else {
            dueHours = lastMaintHours + ((index - nextIdx + 1) * 2000);
            remainingHours = dueHours - currentHours;

            if(remainingHours > 0) {
                 const dateCalc = calculateDate(baseDate, dailyHours, daysOff, remainingHours);
                 dateDisplay = `<i class="fa-regular fa-calendar"></i> ${dateCalc.str}`;
            } else {
                 dateDisplay = '<span style="color:red; font-weight:bold;">مستحقة فوراً</span>';
            }
        }
        
        const color = getMaintenanceColor(stepChar);
        const label = getMaintenanceLabel(stepChar);
        const html = `<div class="plan-step" style="border-right: 4px solid ${color}"><div class="step-index" style="background:${color}">${index + 1}</div><div class="step-info" style="margin-right:10px;"><div class="step-type" style="color:${color}">${label}</div><div class="step-date"><i class="fa-solid fa-clock"></i> عند ${dueHours} ${index < nextIdx ? '' : 'ساعة'} <span style="margin:0 5px; color:#cbd5e1;">|</span> ${dateDisplay}</div></div><div class="step-remove" onclick="removePlanStep(${index})"><i class="fa-solid fa-times"></i></div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function deleteAsset(index) {
    if (confirm("هل أنت متأكد من حذف هذه الماكينة؟")) {
        const cIdx = contracts.findIndex(c => c.id === currentAssetContractId);
        if (cIdx !== -1) {
            contracts[cIdx].assets.splice(index, 1);
            saveData();
            renderAssetsGrid(contracts[cIdx].assets);
            renderAll();
            showToast("تم حذف الماكينة");
        }
    }
}

function editAsset(index) {
    const cIdx = contracts.findIndex(c => c.id === currentAssetContractId);
    if (cIdx === -1) return;

    const asset = contracts[cIdx].assets[index];
    editingAssetIndex = index; 

    resetMachineModal(); 
    document.getElementById('addMachineModal').style.display = 'flex';
    document.getElementById('machine-type-selection').classList.add('hidden');

    if (asset.type === 'dryer') {
        document.getElementById('dryer-form-section').classList.remove('hidden');
        const nameRadio = document.querySelector(`input[name="dryerName"][value="${asset.name}"]`);
        if (nameRadio) nameRadio.checked = true;
        const freonRadio = document.querySelector(`input[name="dryerFreon"][value="${asset.freon}"]`);
        if (freonRadio) freonRadio.checked = true;
        
        const capRadio = document.querySelector(`input[name="dryerCapacity"][value="${asset.capacity}"]`);
        if (capRadio) capRadio.checked = true;
        else {
            const defaultCap = document.querySelector(`input[name="dryerCapacity"][value="FX350"]`);
            if(defaultCap) defaultCap.checked = true;
        }

        document.getElementById('dryerSerial').value = asset.serial;
        document.getElementById('dryerYear').value = asset.year;
    } else if (asset.type === 'vacuum') {
        document.getElementById('vacuum-form-section').classList.remove('hidden');
        document.getElementById('vacuumName').value = asset.name;
        document.getElementById('vacuumSerial').value = asset.serial;
        document.getElementById('vacuumYear').value = asset.year;
        document.getElementById('vacuumBar').value = asset.bar;
    } else {
        document.getElementById('used-compressor-form-section').classList.remove('hidden');
        document.getElementById('compressor-choice-section').classList.add('hidden');
        document.getElementById('compName').value = asset.name;
        document.getElementById('compSerial').value = asset.serial;
        document.getElementById('compYear').value = asset.year;
        document.getElementById('compStartDate').value = asset.startDate || '';
        currentCompressorMode = asset.subType === 'New' ? 'new' : 'used';
        
        const hrsContainer = document.getElementById('hoursDataContainer');
        if (currentCompressorMode === 'new') {
            hrsContainer.style.display = 'none';
            document.getElementById('compCurrentHours').value = 0;
            document.getElementById('compLastMaintHours').value = 0;
        } else {
            hrsContainer.style.display = 'flex';
            document.getElementById('compCurrentHours').value = asset.currentHours;
            document.getElementById('compLastMaintHours').value = asset.planBaseHours !== undefined ? asset.planBaseHours : asset.currentHours;
        }
        document.getElementById('compDailyHours').value = asset.dailyHours;
        document.getElementById('compDaysOff').value = asset.daysOff;
        currentMaintenancePlan = asset.maintenancePlan || [];
        updatePlanPreview();
    }
}

document.getElementById('dryerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentAssetContractId) return;

    const nameInput = document.querySelector('input[name="dryerName"]:checked');
    const freonInput = document.querySelector('input[name="dryerFreon"]:checked');
    const capacityInput = document.querySelector('input[name="dryerCapacity"]:checked');

    const dryerData = { 
        type: 'dryer', 
        name: nameInput ? nameInput.value : "FD dryer", 
        capacity: capacityInput ? capacityInput.value : "FX350", 
        serial: document.getElementById('dryerSerial').value, 
        year: document.getElementById('dryerYear').value, 
        freon: freonInput ? freonInput.value : "R410" 
    };

    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    if (idx !== -1) {
        if (!contracts[idx].assets) contracts[idx].assets = [];
        if (editingAssetIndex !== null) {
            const oldData = contracts[idx].assets[editingAssetIndex];
            contracts[idx].assets[editingAssetIndex] = {...oldData, ...dryerData};
            showToast("تم تعديل بيانات المجفف");
        } else {
            contracts[idx].assets.push(dryerData);
            showToast("تم إضافة المجفف");
        }
        saveData();
        renderAssetsGrid(contracts[idx].assets);
        closeAddMachineModal();
        editingAssetIndex = null;
    }
});

document.getElementById('vacuumForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentAssetContractId) return;

    const vacuumData = { 
        type: 'vacuum', 
        name: document.getElementById('vacuumName').value, 
        serial: document.getElementById('vacuumSerial').value, 
        year: document.getElementById('vacuumYear').value, 
        bar: document.getElementById('vacuumBar').value 
    };

    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    if (idx !== -1) {
        if (!contracts[idx].assets) contracts[idx].assets = [];
        if (editingAssetIndex !== null) {
            const oldData = contracts[idx].assets[editingAssetIndex];
            contracts[idx].assets[editingAssetIndex] = {...oldData, ...vacuumData};
            showToast("تم تعديل بيانات الـ Vacuum Pump");
        } else {
            contracts[idx].assets.push(vacuumData);
            showToast("تم إضافة الـ Vacuum Pump");
        }
        saveData();
        renderAssetsGrid(contracts[idx].assets);
        closeAddMachineModal();
        editingAssetIndex = null;
    }
});

document.getElementById('usedCompressorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentAssetContractId) return;
    if (currentMaintenancePlan.length === 0) { alert("من فضلك اختر خطة صيانة واحدة على الأقل"); return; }
    
    const subType = currentCompressorMode === 'new' ? 'New' : 'Used';
    const daily = parseFloat(document.getElementById('compDailyHours').value);
    const off = parseFloat(document.getElementById('compDaysOff').value);
    const currentHrsVal = parseInt(document.getElementById('compCurrentHours').value) || 0;
    
    const lastMaintVal = currentCompressorMode === 'new' ? 0 : (parseInt(document.getElementById('compLastMaintHours').value) || 0);

    const compData = {
        type: 'compressor', 
        subType: subType,
        name: document.getElementById('compName').value, 
        serial: document.getElementById('compSerial').value, 
        year: document.getElementById('compYear').value,
        startDate: document.getElementById('compStartDate').value,
        currentHours: currentHrsVal,
        planBaseHours: lastMaintVal, 
        dailyHours: daily, 
        daysOff: off,
        maintenancePlan: currentMaintenancePlan, 
        nextMaintenanceIndex: (editingAssetIndex !== null && contracts.find(c => c.id === currentAssetContractId).assets[editingAssetIndex].nextMaintenanceIndex) || 0,
        completedStepsHours: (editingAssetIndex !== null && contracts.find(c => c.id === currentAssetContractId).assets[editingAssetIndex].completedStepsHours) || []
    };

    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    if (idx !== -1) {
        if (!contracts[idx].assets) contracts[idx].assets = [];
        if (editingAssetIndex !== null) {
            contracts[idx].assets[editingAssetIndex] = compData;
            showToast("تم تعديل بيانات الكومبريسور");
        } else {
            contracts[idx].assets.push(compData);
            showToast("تم إضافة الكومبريسور");
        }
        contracts[idx].dailyHours = daily;
        contracts[idx].daysOff = off;
        saveData();
        renderAssetsGrid(contracts[idx].assets);
        closeAddMachineModal();
        renderAll();
        editingAssetIndex = null;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button'); const originalText = btn.innerHTML; btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;
    const id = document.getElementById('editId').value;
    const pdfInput = document.getElementById('contractFile'); let pdfData = null;
    if (pdfInput.files.length > 0) { try { pdfData = await readFileAsBase64(pdfInput.files[0]); } catch (err) { showToast("خطأ", "error"); btn.innerHTML = originalText; btn.disabled = false; return; } } 
    else if (id) { const existing = contracts.find(x => x.id == id); if (existing) pdfData = existing.contractPDF; }
    if (!id && !pdfData) { showToast("PDF مطلوب", "error"); btn.innerHTML = originalText; btn.disabled = false; return; }
    const formData = {
        id: id ? parseInt(id) : Date.now(),
        company: document.getElementById('company').value, client: document.getElementById('client').value, phone: document.getElementById('phone').value,
        startDate: document.getElementById('startDate').value, endDate: document.getElementById('endDate').value, totalVisits: parseInt(document.getElementById('totalVisits').value),
        dailyHours: id ? contracts.find(x=>x.id==id).dailyHours : 0, daysOff: id ? contracts.find(x=>x.id==id).daysOff : 0, maintType: id ? contracts.find(x=>x.id==id).maintType : 2000, 
        visitsDone: id ? contracts.find(x=>x.id==id).visitsDone : 0, history: id ? contracts.find(x=>x.id==id).history : [], assets: id ? contracts.find(x=>x.id==id).assets : [],
        inventory: id ? (contracts.find(x=>x.id==id).inventory || []) : [],
        contractPDF: pdfData,
        isHold: id ? contracts.find(x=>x.id==id).isHold : false 
    };
    if(id) { contracts[contracts.findIndex(x=>x.id==id)] = formData; } else { contracts.push(formData); }
    saveData(); closeModal(); renderAll(); btn.innerHTML = originalText; btn.disabled = false; showToast('تم الحفظ');
});

// --- 14. UTILS ---
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) { window.requestAnimationFrame(step); } else { obj.innerHTML = end; }
    };
    window.requestAnimationFrame(step);
}
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    });
}
function saveData() { try { localStorage.setItem('cate_pro_v9_clean', JSON.stringify(contracts)); } catch (e) { alert('الذاكرة ممتلئة! يرجى حذف بعض البيانات القديمة.'); } }
function globalSearch(q) { const lower = q.toLowerCase(); const filtered = contracts.filter(c => c.company.toLowerCase().includes(lower) || c.client.toLowerCase().includes(lower) || c.phone.includes(lower)); renderTable(filtered); renderReportsGrid(filtered); }
function showFilePreview(input) { document.getElementById('files-preview').innerText = input.files.length > 0 ? `تم تحديد ${input.files.length} ملفات` : ''; }
function formatPhone(p) { let n = p.replace(/\D/g, ''); if(n.startsWith('01')) n = '2' + n; return n; }

// --- 15. ADDITIONAL HANDLERS ---
function openModal() { form.reset(); document.getElementById('editId').value = ''; document.getElementById('contract-file-preview').innerText = ''; modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }
function editContract(id) { 
    const c = contracts.find(x=>x.id===id); document.getElementById('editId').value = c.id; document.getElementById('company').value = c.company; document.getElementById('client').value = c.client; document.getElementById('phone').value = c.phone; document.getElementById('startDate').value = c.startDate; document.getElementById('endDate').value = c.endDate; document.getElementById('totalVisits').value = c.totalVisits; document.getElementById('contract-file-preview').innerText = (c.contractPDF) ? `يوجد ملف` : ''; modal.style.display = 'flex'; 
}
function deleteContract(id) { if(confirm('حذف؟')) { contracts = contracts.filter(x => x.id !== id); saveData(); renderAll(); } }
function openContractPDF(id) { const c = contracts.find(x => x.id === id); if (c && c.contractPDF) { const win = window.open(); win.document.write('<iframe src="' + c.contractPDF + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'); } else { showToast("لا يوجد ملف", "error"); } }
function showContractFilePreview(input) { document.getElementById('contract-file-preview').innerText = input.files[0] ? input.files[0].name : ''; }
function openWAModal(id) { currentWAContract = contracts.find(c => c.id === id); document.getElementById('waModal').style.display = 'flex'; }
function closeWAModal() { document.getElementById('waModal').style.display = 'none'; }

function sendWAMessage(type) {
    if(!currentWAContract) return;
    const c = currentWAContract;
    const phone = formatPhone(c.phone);
    let msg = "";

    if(c.dailyHours <= 0) { 
        showToast("يرجى تحديد ساعات التشغيل في العقد أولاً للحساب", "error"); 
        return; 
    }

    if (type === 'schedule') {
        const d2000 = calculateDate(c.startDate, c.dailyHours, c.daysOff, 2000).str;
        const d4000 = calculateDate(c.startDate, c.dailyHours, c.daysOff, 4000).str;
        const d8000 = calculateDate(c.startDate, c.dailyHours, c.daysOff, 8000).str;

        msg = `مرحباً، إليكم جدول الصيانة المتوقع لشركة ${c.company}:\n\n` +
              `🔧 صيانة 2000 ساعة: متوقعة بتاريخ (${d2000})\n` +
              `🛠️ صيانة 4000 ساعة: متوقعة بتاريخ (${d4000})\n` +
              `⚙️ عمرة 8000 ساعة: متوقعة بتاريخ (${d8000})\n\n` +
              `يرجى العلم أن هذه المواعيد تقديرية بناءً على معدل التشغيل (${c.dailyHours} ساعة/يوم).`;
    
    } else {
        const hours = parseInt(type);
        const dateCalc = calculateDate(c.startDate, c.dailyHours, c.daysOff, hours).str;
        
        let maintName = "صيانة";
        if(hours >= 24000) maintName = "عمرة شاملة";
        else if(hours >= 8000) maintName = "عمرة";

        msg = `تذكير هام من شركة CATE\n\n` +
              `السادة شركة ${c.company}،\n` +
              `نود تذكيركم بقرب موعد ${maintName} الـ ${hours} ساعة.\n` +
              `📅 الموعد المتوقع: ${dateCalc}\n\n` +
              `يرجى التنسيق لعمل اللازم للحفاظ على كفاءة المعدات.`;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    closeWAModal();
}
window.onclick = function(e) { 
    if (e.target == modal) closeModal(); 
    if (e.target == document.getElementById('waModal')) closeWAModal(); 
    if (e.target == document.getElementById('editVisitModal')) closeEditModal(); 
    if (e.target == document.getElementById('addMachineModal')) closeAddMachineModal(); 
    if (e.target == document.getElementById('unholdModal')) closeUnholdModal(); 
    if (e.target == document.getElementById('machineDetailsModal')) closeMachineDetailsModal(); 
    if (e.target == document.getElementById('inventoryModal')) closeInventoryModal(); 
}

function updateNotifications() {
        const notifList = document.getElementById('notif-list-body'); const badge = document.getElementById('notif-badge'); const bellBtn = document.getElementById('notif-btn'); notifList.innerHTML = ''; let count = 0;
    contracts.forEach(c => {
        const status = getStatus(c);
        if (status.type !== 'active') {
            count++;
            let iconColor = status.color;
            let icon = status.type === 'due' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-clock"></i>';
            let bgColor = status.type === 'due' ? '#fee2e2' : '#ffedd5';
            notifList.innerHTML += `<div class="notif-item" onclick="switchTab('contracts')"><div class="notif-icon-box" style="background:${bgColor}; color:${iconColor}">${icon}</div><div class="notif-content"><h5>${c.company}</h5><p>${status.label}</p></div></div>`;
        }
    });
    if (count === 0) { notifList.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">لا توجد تنبيهات جديدة 🎉</div>'; badge.style.display = 'none'; bellBtn.classList.remove('bell-active'); } else { badge.style.display = 'flex'; badge.innerText = count; bellBtn.classList.add('bell-active'); }
}

// --- 16. REPORTS & ASSET FILTER LOGIC ---
function renderReportsGrid(data) {
    const grid = document.getElementById('reports-grid'); grid.innerHTML = '';
    data.forEach(c => {
        const progress = c.totalVisits > 0 ? Math.round((c.visitsDone / c.totalVisits) * 100) : 0;
        grid.innerHTML += `<div class="card-container card-padding" style="cursor:pointer;" onclick="openCRM(${c.id})"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h4 style="margin:0;color:var(--primary)">${c.company}</h4><span class="badge badge-blue">شاملة</span></div><p style="margin:0 0 15px 0; font-size:0.9rem; color:var(--text-light)">${c.client}</p><div style="background:#e2e8f0; height:6px; border-radius:10px; overflow:hidden;"><div style="background:var(--success); width:${progress}%; height:100%"></div></div></div>`;
    });
}
function goToReports(id) { switchTab('reports'); openCRM(id); }

function openCRM(id) {
    const c = contracts.find(x => x.id === id); if(!c) return;
    document.getElementById('reports-list-view').classList.add('hidden'); 
    document.getElementById('reports-detail-view').classList.remove('hidden');
    document.getElementById('report-action-section').classList.add('hidden');
    document.getElementById('detail-company').innerText = c.company; 
    document.getElementById('detail-client').innerText = c.client;
    document.getElementById('count-total').innerText = c.totalVisits; 
    document.getElementById('count-done').innerText = c.visitsDone;
    document.getElementById('count-left').innerText = Math.max(0, c.totalVisits - c.visitsDone); 
    document.getElementById('reportContractId').value = c.id;
    renderReportAssetsSelection(c);
}

function renderReportAssetsSelection(contract) {
    const container = document.getElementById('report-assets-selection');
    const noMsg = document.getElementById('no-assets-report-msg');
    container.innerHTML = '';
    if (!contract.assets || contract.assets.length === 0) {
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';
    contract.assets.forEach((asset, index) => {
        let icon = asset.type === 'dryer' ? 'fa-temperature-arrow-down' : (asset.type === 'vacuum' ? 'fa-fan' : 'fa-wind');
        let color = asset.type === 'dryer' ? '#f97316' : (asset.type === 'vacuum' ? '#8b5cf6' : '#006F8F'); 
        container.innerHTML += `<div class="type-card asset-select-card" onclick="selectReportAsset(${index})" id="asset-card-${index}" style="padding:15px; min-height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #e2e8f0;"><i class="fa-solid ${icon}" style="font-size:1.8rem; margin-bottom:10px; color:${color}"></i><h4 style="font-size:0.95rem; margin-bottom:5px;">${asset.name}</h4><span style="font-size:0.75rem; color:#64748b;">${asset.serial}</span></div>`;
    });
}

function selectReportAsset(index) {
    if (window.resetMaintButtons) resetMaintButtons();

    currentReportAssetIndex = index;
    const cId = parseInt(document.getElementById('reportContractId').value);
    const contract = contracts.find(x => x.id === cId);
    document.querySelectorAll('.asset-select-card').forEach(el => {
        el.style.borderColor = '#e2e8f0';
        el.style.background = 'white';
    });
    const compOptions = document.getElementById('compressor-maint-options');
    const dryerOptions = document.getElementById('dryer-maint-options');
    const options8000Div = document.getElementById('maint-8000-sub-options');
    
    const radios = document.getElementsByName('oilFilterOption');
    radios.forEach(r => r.checked = false);
    const extraCbs = document.getElementsByName('extraParts');
    extraCbs.forEach(cb => cb.checked = false);

    let selectedAssetName = null; 

    if (index !== null) {
        const asset = contract.assets[index];
        selectedAssetName = asset.name; 
        const activeCard = document.getElementById(`asset-card-${index}`);
        if(activeCard) {
            activeCard.style.borderColor = 'var(--primary)';
            activeCard.style.background = '#f0f9ff';
        }
        document.getElementById('selected-asset-name').innerText = contract.assets[index].name;
        if (asset.type === 'compressor') {
            compOptions.classList.remove('hidden');
            dryerOptions.classList.add('hidden');
        } else if (asset.type === 'dryer') {
            compOptions.classList.add('hidden');
            dryerOptions.classList.remove('hidden');
        } else {
            compOptions.classList.add('hidden');
            dryerOptions.classList.add('hidden');
        }
        options8000Div.classList.add('hidden'); 
    } else {
        compOptions.classList.add('hidden');
        dryerOptions.classList.add('hidden');
    }
    
    renderVisitInventoryDeduction(cId, selectedAssetName);

    document.getElementById('report-action-section').classList.remove('hidden');
    document.getElementById('reportAssetIndex').value = index !== null ? index : '';
    document.getElementById('visitNotes').value = '';
    renderTimeline(contract.history, cId, index);
}

function toggle8000Options() {
    const div = document.getElementById('maint-8000-sub-options');
    if (div.classList.contains('hidden')) div.classList.remove('hidden'); else div.classList.add('hidden');
}

function renderTimeline(history, contractId, filterAssetIndex = null) {
    const container = document.getElementById('history-timeline'); container.innerHTML = '';
    if(!history || history.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa; border:2px dashed #eee; border-radius:12px;">لا توجد زيارات مسجلة لهذه الماكينة</div>'; return; }
    
    const filteredHistory = history.map((h, originalIndex) => ({...h, originalIndex}))
        .filter(h => {
            if (filterAssetIndex !== null) return h.assetIndex == filterAssetIndex;
            return true; 
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if(filteredHistory.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa; border:2px dashed #eee; border-radius:12px;">لا توجد زيارات مسجلة لهذه الماكينة بعد</div>'; 
        return;
    }

    filteredHistory.forEach((h) => {
        const actualIndex = h.originalIndex;
        let imagesHtml = '';
        if(h.images && h.images.length > 0) {
            imagesHtml = '<div class="visit-gallery" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">';
            h.images.forEach((fileData, i) => { 
                let isPdf = fileData.startsWith('data:application/pdf');
                if(isPdf) {
                    imagesHtml += `<a href="${fileData}" download="تقرير_${h.date}.pdf" class="badge badge-red" style="text-decoration:none; padding:10px; font-size:0.85rem;"><i class="fa-solid fa-file-pdf" style="margin-left:5px;"></i> تحميل الـ PDF</a>`;
                } else {
                    if(i > 3) return; 
                    imagesHtml += `<div class="visit-img-thumb" onclick="openLightboxForVisit(${contractId}, ${actualIndex}, ${i})"><img src="${fileData}">${(i === 3 && h.images.length > 4) ? `<div class="more-count">+${h.images.length - 4}</div>` : ''}</div>`; 
                }
            });
            imagesHtml += '</div>';
        }
        container.innerHTML += `<div class="visit-card"><div class="visit-header"><div class="visit-date"><i class="fa-regular fa-calendar"></i> ${h.date}</div><div class="visit-actions"><button class="action-btn btn-icon-edit" onclick="openEditVisit(${contractId}, ${actualIndex})"><i class="fa-solid fa-pen"></i></button><button class="action-btn btn-icon-del" onclick="deleteVisit(${contractId}, ${actualIndex})"><i class="fa-solid fa-trash"></i></button></div></div><div class="visit-body" style="white-space: pre-line;">${h.notes}</div>${imagesHtml}</div>`;
    });
}

document.getElementById('visitForm').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const btn = e.target.querySelector('button'); const originalText = btn.innerHTML; btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;
    const id = parseInt(document.getElementById('reportContractId').value); 
    const assetIdxVal = document.getElementById('reportAssetIndex').value;
    const assetIndex = assetIdxVal !== '' ? parseInt(assetIdxVal) : null;
    const idx = contracts.findIndex(x => x.id === id);
    
    if(idx !== -1) {
        const date = document.getElementById('visitDate').value; 
        let notes = document.getElementById('visitNotes').value;
        
        let deductedPartsText = "";
        
        const checkedBoxes = document.querySelectorAll('.vic-checkbox:checked');
        
        checkedBoxes.forEach(chk => {
            const partId = chk.value;
            const input = document.getElementById(`vic-input-${partId}`);
            const qtyToDeduct = parseInt(input.value) || 0;
            const partName = input.getAttribute('data-name');
            
            if (qtyToDeduct > 0) {
                const partIndex = contracts[idx].inventory.findIndex(p => p.id === partId);
                if(partIndex !== -1) {
                    contracts[idx].inventory[partIndex].qty -= qtyToDeduct;
                    deductedPartsText += `- تم سحب (${qtyToDeduct}) ${partName}\n`;
                }
            }
        });

        if (deductedPartsText !== "") {
            notes += "\n\n📦 تم سحب القطع التالية من مخزن العميل:\n" + deductedPartsText;
        }

        const oilOption = document.querySelector('input[name="oilFilterOption"]:checked');
        if (oilOption) { if (oilOption.value === '1') notes += "\n- تم تغيير فلتر زيت"; else if (oilOption.value === '2') notes += "\n- تم تغيير عدد 2 فلتر زيت"; }
        
        const extraParts = document.querySelectorAll('input[name="extraParts"]:checked');
        if (extraParts.length > 0) {
            notes += "\n\nقطع غيار إضافية تم تغييرها (خارج المخزن):\n";
            extraParts.forEach(part => {
                notes += `- ${part.value}\n`;
            });
        }

        const files = document.getElementById('visitFiles').files; 
        let imagesData = [];
        if(files.length > 0) imagesData = await processImages(files);
        
        if(!contracts[idx].history) contracts[idx].history = [];
        contracts[idx].history.push({ date, notes, images: imagesData, assetIndex: assetIndex });
        
        updateVisitsCount(idx);
        
        saveData(); 
        renderAll(); 
        
        document.getElementById('count-done').innerText = contracts[idx].visitsDone;
        document.getElementById('count-left').innerText = Math.max(0, contracts[idx].totalVisits - contracts[idx].visitsDone);
        
        document.getElementById('visitNotes').value = ''; document.getElementById('visitFiles').value = ''; document.getElementById('files-preview').innerText = ''; 
        const radios = document.getElementsByName('oilFilterOption'); radios.forEach(r => r.checked = false);
        const extraCbs = document.getElementsByName('extraParts'); extraCbs.forEach(cb => cb.checked = false);
        
        if (window.resetMaintButtons) resetMaintButtons();

        renderTimeline(contracts[idx].history, id, assetIndex);
        
        const selectedAssetName = contracts[idx].assets[assetIndex] ? contracts[idx].assets[assetIndex].name : null;
        renderVisitInventoryDeduction(id, selectedAssetName); 
        
        showToast('تم تسجيل الزيارة للماكينة بنجاح');
    }
    btn.innerHTML = originalText; btn.disabled = false;
});

function openEditVisit(cId, vIdx) {
    const c = contracts.find(x => x.id === cId); const visit = c.history[vIdx];
    document.getElementById('editVisitContractId').value = cId; document.getElementById('editVisitIndex').value = vIdx;
    document.getElementById('editVisitDate').value = visit.date; document.getElementById('editVisitNotes').value = visit.notes;
    renderEditImages(visit.images || []);
    const el = document.getElementById('edit-img-container');
    if(el.sortable) el.sortable.destroy(); 
    el.sortable = new Sortable(el, { animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', forceFallback: true, filter: '.delete-img-btn', onMove: function (evt) { return evt.related.className.indexOf('delete-img-btn') === -1; } });
    document.getElementById('editVisitModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editVisitModal').style.display = 'none'; }

function renderEditImages(images) {
    const container = document.getElementById('edit-img-container'); container.innerHTML = '';
    images.forEach((img) => {
        const div = document.createElement('div'); div.className = 'edit-img-item';
        let isPdf = img.startsWith('data:application/pdf');
        if(isPdf) {
            div.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#fee2e2; color:#ef4444; font-size:2.5rem;"><i class="fa-solid fa-file-pdf"></i></div><div class="delete-img-btn"><i class="fa-solid fa-xmark"></i></div>`;
        } else {
            div.innerHTML = `<img src="${img}"><div class="delete-img-btn"><i class="fa-solid fa-xmark"></i></div>`;
        }
        div.querySelector('.delete-img-btn').onclick = function(e) { e.stopPropagation(); div.remove(); };
        container.appendChild(div);
    });
}

document.getElementById('editVisitForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); const originalText = btn.innerHTML;
    btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;
    const cId = parseInt(document.getElementById('editVisitContractId').value); const vIdx = parseInt(document.getElementById('editVisitIndex').value);
    const date = document.getElementById('editVisitDate').value; const notes = document.getElementById('editVisitNotes').value;
    const newFiles = document.getElementById('editVisitNewFiles').files; const currentImgs = [];
    
    const cIdx = contracts.findIndex(x => x.id === cId);
    const oldVisit = contracts[cIdx].history[vIdx];
    let finalImages = oldVisit.images || []; 
    
    const remainingFiles = [];
    document.querySelectorAll('#edit-img-container .edit-img-item').forEach((item, index) => {
        if(finalImages[index]) remainingFiles.push(finalImages[index]);
    });
    
    finalImages = remainingFiles;
    if(newFiles.length > 0) finalImages = [...finalImages, ...await processImages(newFiles)];
    
    const assetIndex = oldVisit.assetIndex;
    contracts[cIdx].history[vIdx] = { date, notes, images: finalImages, assetIndex: assetIndex };
    
    updateVisitsCount(cIdx);
    
    saveData(); closeEditModal(); 
    const c = contracts[cIdx];
    renderTimeline(c.history, cId, currentReportAssetIndex);
    
    document.getElementById('count-done').innerText = c.visitsDone;
    document.getElementById('count-left').innerText = Math.max(0, c.totalVisits - c.visitsDone);
    
    btn.innerHTML = originalText; btn.disabled = false;
    showToast('تم تعديل الزيارة بنجاح');
});

function deleteVisit(cId, vIdx) { 
    if(!confirm('حذف؟')) return; 
    const cIdx = contracts.findIndex(x => x.id === cId);
    const c = contracts[cIdx]; 
    if(c) { 
        c.history.splice(vIdx, 1); 
        
        updateVisitsCount(cIdx);
        
        saveData(); 
        renderAll(); 
        renderTimeline(c.history, cId, currentReportAssetIndex);
        
        document.getElementById('count-done').innerText = c.visitsDone;
        document.getElementById('count-left').innerText = Math.max(0, c.totalVisits - c.visitsDone);
        
        showToast('تم الحذف'); 
    } 
}

function openLightboxForVisit(cId, vIdx, imgIdx) { const c = contracts.find(x => x.id === cId); currentLightboxImages = c.history[vIdx].images; currentLightboxIndex = imgIdx; updateLightbox(); document.getElementById('lightbox').style.display = 'flex'; }
function updateLightbox() { document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex]; }
function nextLBImage() { if(currentLightboxIndex>0) { currentLightboxIndex--; updateLightbox(); } }
function prevLBImage() { if(currentLightboxIndex<currentLightboxImages.length-1) { currentLightboxIndex++; updateLightbox(); } }
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }
function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.4s forwards'; setTimeout(() => toast.remove(), 400); }, 3000);
}
function processImages(files) { return Promise.all([...files].map(file => readFileAsBase64(file))); }
function backToReports() { document.getElementById('reports-detail-view').classList.add('hidden'); document.getElementById('reports-list-view').classList.remove('hidden'); renderReportsGrid(contracts); }

// --- 17. MACHINE DETAILS MODAL LOGIC ---

function openMachineDetails(index) {
    const cIdx = contracts.findIndex(c => c.id === currentAssetContractId);
    if (cIdx === -1) return;
    const asset = contracts[cIdx].assets[index];
    if (asset.type !== 'compressor') return; 
    document.getElementById('detail-machine-name').innerText = asset.name;
    document.getElementById('detail-machine-serial').innerText = `Serial: ${asset.serial} | Year: ${asset.year}`;
    document.getElementById('detail-machine-startdate').innerHTML = `<i class="fa-solid fa-play"></i> تاريخ بدء التشغيل: ${asset.startDate || 'غير مسجل'}`;
    document.getElementById('detail-current-hours').innerText = asset.currentHours.toLocaleString();
    document.getElementById('detail-daily-hours').innerHTML = `${asset.dailyHours || 0} <small>ساعة/يوم</small>`;
    document.getElementById('detail-days-off').innerHTML = `${asset.daysOff || 0} <small>يوم/شهر</small>`;
    
    renderDetailedTimeline(asset, index);
    document.getElementById('machineDetailsModal').style.display = 'flex';
}

function closeMachineDetailsModal() {
    document.getElementById('machineDetailsModal').style.display = 'none';
}

function renderDetailedTimeline(asset, assetIndex) {
    const container = document.getElementById('machine-plan-timeline');
    container.innerHTML = '';
    if (!asset.maintenancePlan || asset.maintenancePlan.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">لا توجد خطة صيانة مسجلة</div>';
        return;
    }

    const currentHours = asset.currentHours || 0;
    const dailyHours = asset.dailyHours || 0;
    const daysOff = asset.daysOff || 0;
    const today = new Date();

    let nextIdx = asset.nextMaintenanceIndex || 0;
    let completedSteps = asset.completedStepsHours || [];
    let base = asset.planBaseHours !== undefined ? asset.planBaseHours : (asset.subType !== 'New' ? asset.currentHours : 0);

    asset.maintenancePlan.forEach((stepChar, i) => {
        let targetHours;
        let statusClass = '';
        let statusIcon = '';
        let dateDisplay = '';
        let actionBtn = '';

        if (i < nextIdx) {
            targetHours = completedSteps[i] || "غير محدد";
            statusClass = 'done';
            statusIcon = '<i class="fa-solid fa-check"></i> مكتملة';
            dateDisplay = 'تم التنفيذ';
        } else {
            targetHours = base + ((i - nextIdx + 1) * 2000);
            
            if (i === nextIdx) {
                if (currentHours >= targetHours) {
                    statusClass = 'next';
                    statusIcon = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444"></i> مستحقة فوراً';
                } else {
                    statusClass = 'next';
                    statusIcon = '<i class="fa-solid fa-spinner fa-spin"></i> القادمة';
                }
                
                actionBtn = `<div style="margin-top:8px;">
                    <button onclick="markMaintenanceDone(${currentAssetContractId}, ${assetIndex}, ${i})" class="btn" style="background:var(--success); color:white; padding:4px 10px; font-size:0.8rem; border:none; border-bottom:3px solid #16a34a;">
                        <i class="fa-solid fa-check-double"></i> تسجيل إتمام
                    </button>
                </div>`;
            } else {
                statusClass = 'future';
                statusIcon = '<i class="fa-regular fa-clock"></i> مجدولة';
            }

            const hoursRemaining = targetHours - currentHours;
            if (hoursRemaining <= 0) {
                 dateDisplay = '<span style="color:#ef4444; font-weight:bold;">مستحقة / متأخرة</span>';
            } else if (dailyHours > 0) {
                
                let calcBaseDate = today;
                if (currentHours === 0 && asset.startDate) {
                    calcBaseDate = new Date(asset.startDate);
                }
                
                const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                dateDisplay = calc.str;
            } else {
                dateDisplay = 'غير محدد';
            }
        }

        const label = getMaintenanceLabel(stepChar);
        const color = getMaintenanceColor(stepChar);
        container.innerHTML += `<div class="tl-item ${statusClass}">
            <div class="tl-dot"></div>
            <div class="tl-content">
                <div class="tl-info">
                    <h5 style="color:${color}">${label}</h5>
                    <p><i class="fa-solid fa-stopwatch"></i> عند: <b>${targetHours}</b> ساعة</p>
                    <p style="margin-top:5px; font-size:0.8rem; color:#64748b">${statusIcon}</p>
                    ${actionBtn}
                </div>
                <div class="tl-date">${dateDisplay}</div>
            </div>
        </div>`;
    });
}

window.markMaintenanceDone = function(cId, aIdx, stepIdx) {
    const cIdx = contracts.findIndex(c => c.id === cId);
    if(cIdx === -1) return;
    const asset = contracts[cIdx].assets[aIdx];

    const exactHours = prompt(
        `أدخل عدد ساعات الماكينة الفعلي وقت إتمام هذه الصيانة:\n(ساعات التشغيل الحالية المسجلة: ${asset.currentHours} ساعة)`, 
        asset.currentHours
    );

    if (exactHours !== null && exactHours.trim() !== "") {
        const hours = parseInt(exactHours);
        if (isNaN(hours)) {
            alert("الرجاء إدخال رقم صحيح.");
            return;
        }

        if (!asset.completedStepsHours) asset.completedStepsHours = [];
        
        asset.completedStepsHours[stepIdx] = hours;
        asset.planBaseHours = hours; 
        asset.currentHours = Math.max(asset.currentHours, hours); 
        asset.nextMaintenanceIndex = stepIdx + 1; 

        saveData();
        renderAll(); 
        openMachineDetails(aIdx); 
        showToast("تم تأكيد الإتمام وتحديث المواعيد القادمة!");
    }
};
