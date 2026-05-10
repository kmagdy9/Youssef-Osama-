// --- 1. DATA INITIALIZATION ---
let contracts = [];

// Global Variables
let statusChart = null;
let forecastChart = null;
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let currentWAContract = null;
let currentWAAssetIndex = null;
let currentAssetContractId = null;
let currentMaintenancePlan = [];
let currentCompressorMode = 'used'; 
let editingAssetIndex = null; 
let currentReportAssetIndex = null;
let currentActiveTaskType = null; 
let pendingAutoFillStep = null; 
let pendingAutoFillDate = null; 
let pendingMaintConfirm = null; 

// متغيرات مؤقتة لحفظ مؤشر الصيانات المكتملة
let tempNextIdx = 0;
let tempCompletedSteps = [];

// --- AUTOCOMPLETE CHECKBOX TASKS ---
const MAINT_TASKS = {
    '2000': { 
        title: 'صيانة 2000 ساعة:', 
        tasks: [
            'تم تغيير فلتر هواء', 
            'تم تغيير فلتر زيت', 
            'تم تغيير فاصل الزيت', 
            'تم تغيير الزيت', 
            'تم تغيير (Thermostatic valve)', 
            'تم تغيير (Minimum pressure valve kit)', 
            'تم تغيير (Un loader valve kit)', 
            'تم تغيير (Check valve kit)', 
            'تم تغيير (Automatic drain kit)'
        ] 
    },
    '4000': { 
        title: 'صيانة 4000 ساعة:', 
        tasks: [
            'تم تغيير فلتر هواء', 
            'تم تغيير فلتر زيت', 
            'تم تغيير فاصل الزيت', 
            'تم تغيير الزيت', 
            'تم تغيير (Thermostatic valve)', 
            'تم تغيير (Minimum pressure valve kit)', 
            'تم تغيير (Un loader valve kit)', 
            'تم تغيير (Check valve kit)', 
            'تم تغيير (Automatic drain kit)'
        ] 
    },
    '8000-GA': { 
        title: 'عمرة 8000 ساعة (GA):', 
        tasks: [
            'تم تغيير فلتر هواء', 
            'تم تغيير فلتر زيت', 
            'تم تغيير فاصل الزيت', 
            'تم تغيير الزيت', 
            'تم تغيير (Thermostatic valve)', 
            'تم تغيير (Minimum pressure valve kit)', 
            'تم تغيير (Un loader valve kit)', 
            'تم تغيير (Check valve kit)', 
            'تم تغيير (Automatic drain kit)'
        ] 
    },
    '8000-VSD': { 
        title: 'عمرة 8000 ساعة (GA VSD):', 
        tasks: [
            'تم تغيير فلتر هواء', 
            'تم تغيير فلتر زيت', 
            'تم تغيير فاصل الزيت', 
            'تم تغيير الزيت', 
            'تم تغيير (Thermostatic valve)', 
            'تم تغيير (Minimum pressure valve kit)', 
            'تم تغيير (Un loader valve kit)', 
            'تم تغيير (Check valve kit)', 
            'تم تغيير (Automatic drain kit)'
        ] 
    },
    'DRYER-DRAIN': { 
        title: 'صيانة المجفف:', 
        tasks: ['تم تغيير طقم تصريف (Auto Drain Kit)'] 
    },
    'VACUUM-MAINT': { 
        title: 'صيانة طلمبة التفريغ (Vacuum Pump):', 
        tasks: [
            'تم تغيير (throttle valve kit)', 
            'تم تغيير (Coupling element)', 
            'تم تغيير (Inlet valve kit)', 
            'تم تغيير (Silencer)', 
            'تم تغيير (non return valve)', 
            'تم تغيير (Dust filter)', 
            'تم تغيير (gas blast filter)', 
            'تم تغيير (Blow Off Valve)', 
            'تم تعيير (Brether valve kit)'
        ] 
    },
    'INSPECTION': { 
        title: 'زيارة فحص فني دوري:', 
        tasks: ['تم إجراء فحص ظاهري شامل للماكينة.', 'تم مراجعة وقراءة درجات الحرارة والضغوط.', 'التأكد من عمل الماكينة بكفاءة واستقرار التشغيل.', 'لا توجد أي أعطال أو حاجة لتغيير قطع غيار في الوقت الحالي.'] 
    }
};

// DOM Elements
const modal = document.getElementById('contractModal');
const form = document.getElementById('contractForm');

// --- 2. ON LOAD ---
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('visitDate').valueAsDate = new Date();
    document.getElementById('main-search-bar').style.visibility = 'hidden';

    const startDateInput = document.getElementById('compLastMaintDate');
    if(startDateInput) {
        startDateInput.addEventListener('change', updatePlanPreview);
    }

    try {
        let savedData = await localforage.getItem('cate_pro_v9_clean');
        
        if (!savedData && localStorage.getItem('cate_pro_v9_clean')) {
            savedData = JSON.parse(localStorage.getItem('cate_pro_v9_clean'));
            await localforage.setItem('cate_pro_v9_clean', savedData);
        }
        
        contracts = savedData || [];
        
        contracts.forEach(c => {
            if (!c.assets) c.assets = [];
            if (!c.inventory) c.inventory = []; 
            
            if (c.history && c.history.length > 0) {
                const uniqueDates = new Set(c.history.map(h => h.date));
                c.visitsDone = uniqueDates.size;
            } else {
                c.visitsDone = 0;
            }

            c.assets.forEach(a => {
                if (a.type === 'compressor' && a.currentHours > 0 && !a.lastUpdated) {
                    a.lastUpdated = getLocalDateString();
                }
            });
        });

        renderAll();
    } catch (err) {
        console.error('Error loading data:', err);
        contracts = [];
        renderAll();
    }
    
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

    const btnYes = document.getElementById('confirmYesBtn');
    const btnNo = document.getElementById('confirmNoBtn');
    if(btnYes) {
        btnYes.addEventListener('click', function() {
            if (modalCloseCallback) modalCloseCallback(); 
            closeConfirmModal(); 
        });
    }
    if(btnNo) {
        btnNo.addEventListener('click', function() {
            closeConfirmModal(); 
        });
    }
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
    if (!daily || daily <= 0 || targetHours <= 0) {
        let d = new Date();
        if (targetHours <= 0) {
            if (typeof startStr === 'string' && startStr.includes('-')) {
                const datePart = startStr.split('T')[0];
                const parts = datePart.split('-');
                d = new Date(parts[0], parts[1] - 1, parts[2]);
            } else if (startStr instanceof Date) {
                d = new Date(startStr);
            }
        } else {
            d = new Date(2100, 0, 1); 
        }
        return { due: d, reminder: d, str: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
    }

    let baseDate = new Date();
    if (typeof startStr === 'string' && startStr.includes('-')) {
        const datePart = startStr.split('T')[0];
        const parts = datePart.split('-');
        baseDate = new Date(parts[0], parts[1] - 1, parts[2], 8, 0, 0); 
    } else if (startStr instanceof Date) {
        baseDate = new Date(startStr);
    }

    const workingDaysNeeded = targetHours / daily;
    const calendarDaysRatio = 30 / (30 - off);
    const totalDaysToAdd = workingDaysNeeded * calendarDaysRatio;
    const timeToAddInMs = totalDaysToAdd * 24 * 60 * 60 * 1000;
    const due = new Date(baseDate.getTime() + timeToAddInMs);
    const reminder = new Date(due.getTime() - (10 * 24 * 60 * 60 * 1000));

    const yyyy = due.getFullYear();
    const mm = String(due.getMonth() + 1).padStart(2, '0');
    const dd = String(due.getDate()).padStart(2, '0');

    return { due, reminder, str: `${yyyy}-${mm}-${dd}` };
}

function calculateUsedCompressorDate(lastMaintDateStr, daily, off, targetAddedHours) {
    if (!daily || daily <= 0 || targetAddedHours <= 0) {
        let d = new Date();
        return { due: d, reminder: d, str: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
    }

    let baseDate = new Date();
    if (typeof lastMaintDateStr === 'string' && lastMaintDateStr.includes('-')) {
        const datePart = lastMaintDateStr.split('T')[0];
        const parts = datePart.split('-');
        baseDate = new Date(parts[0], parts[1] - 1, parts[2], 8, 0, 0); 
    } else if (lastMaintDateStr instanceof Date) {
        baseDate = new Date(lastMaintDateStr);
    }

    const workingDaysNeeded = targetAddedHours / daily;
    const calendarDaysRatio = 30 / (30 - off);
    const totalDaysToAdd = workingDaysNeeded * calendarDaysRatio;
    const timeToAddInMs = totalDaysToAdd * 24 * 60 * 60 * 1000;
    const due = new Date(baseDate.getTime() + timeToAddInMs);
    const reminder = new Date(due.getTime() - (10 * 24 * 60 * 60 * 1000));

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
        if (diffDays <= 30) return { type: 'soon', label: 'تجديد العقد', color: '#fef3c7', textColor: '#d97706' };    
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
                    } else if ((target - a.currentHours) <= 50) { 
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

                        let maintName = "صيانة دورية";
                        if (target > 0 && target % 24000 === 0) {
                            maintName = `صيانة الـ ${target} ساعة (عمرة كاملة)`;
                        } else if (target > 0 && target % 16000 === 0) {
                            maintName = `صيانة الـ ${target} ساعة`;
                        }

                        if(remaining <= 0) {
                            addAlertItem(container, c.company, `${maintName} مستحقة: ${a.name} (تجاوزت الموعد)`, 'due');
                            alertCount++;
                        } else if (remaining <= 50) { 
                            addAlertItem(container, c.company, `اقتراب ${maintName}: ${a.name} (باقي ${remaining} ساعة)`, 'soon');
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
                            let diffMonths;
                            if (a.subType && a.subType.includes('Used')) {
                                const targetAddedHours = target - (a.planBaseHours || 0);
                                const calc = calculateUsedCompressorDate(a.startDate, a.dailyHours, a.daysOff || 0, targetAddedHours);
                                diffMonths = (calc.due.getFullYear() - today.getFullYear()) * 12 + (calc.due.getMonth() - today.getMonth());
                            } else {
                                const remaining = target - a.currentHours;
                                let calcBaseDate = new Date();
                                if (a.lastUpdated) {
                                    calcBaseDate = new Date(a.lastUpdated);
                                } else if (a.currentHours === 0 && a.startDate) {
                                    calcBaseDate = new Date(a.startDate);
                                }
                                const calc = calculateDate(calcBaseDate, a.dailyHours, a.daysOff || 0, remaining);
                                diffMonths = (calc.due.getFullYear() - today.getFullYear()) * 12 + (calc.due.getMonth() - today.getMonth());
                            }
                            
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
            <td data-label="الشركة / العميل" style="text-align: right;">
                <div class="company-link" onclick="openCompanyAssets(${c.id})">${c.company}</div>
                <div style="font-size:0.8rem;color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-user"></i> ${c.client}</div>
                <span class="badge ${badgeClass}" style="font-size:0.7rem; background:${status.color}; color:${status.textColor || 'white'}; font-weight:bold;">${status.label}</span>
                </td>
            <td data-label="تاريخ البداية"><div style="font-weight:bold;">${c.startDate}</div></td>
            <td data-label="تاريخ النهاية"><div style="font-weight:bold;">${c.endDate}</div></td>
            <td data-label="الإنجاز"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size:0.9rem;">${c.visitsDone} / ${c.totalVisits}</span><div class="progress-track" style="width:100%; margin:0;"><div class="progress-fill" style="width:${progress}%"></div></div></div></td>
            <td data-label="إجراءات">
                <div class="actions-grid">
                    ${holdBtn}
                    <button onclick="goToReports(${c.id})" class="action-btn btn-icon-rep" title="التقارير"><i class="fa-solid fa-clipboard-list"></i></button>
                    <button onclick="editContract(${c.id})" class="action-btn btn-icon-edit" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                    ${pdfButtonDisplay}
                    <button onclick="deleteContract(${c.id})" class="action-btn btn-icon-del" style="flex-basis: 100%;" title="حذف"><i class="fa-solid fa-trash"></i></button>
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
    
    // تحديث اسم الشركة في العنوان الرئيسي
    document.getElementById('asset-company-title').innerText = c.company;
    
    // تحديث اسم الشركة داخل زرار الواتساب الجديد
    const waBtnText = document.getElementById('wa-company-name');
    if(waBtnText) waBtnText.innerText = c.company;
    
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
            
            if (asset.isPlanHold || !asset.maintenancePlan || asset.maintenancePlan.length === 0) {
                // تم إضافة span مع كلاس الحركة و display:inline-block لتفعيل تأثير الـ transform
                nextMaintText = "<span class='warning-anim' style='display: inline-block; margin-left: 5px;'>⚠️ معلق (بانتظار تحديد خطة)</span> ";
                nextColor = "#d97706";
            }
            else if (asset.maintenancePlan && asset.maintenancePlan.length > (asset.nextMaintenanceIndex || 0)) {
                const nextStepChar = asset.maintenancePlan[asset.nextMaintenanceIndex || 0];
                nextMaintText = `القادمة: ${getMaintenanceLabel(nextStepChar)}`;
                nextColor = getMaintenanceColor(nextStepChar);
            }
            
            let displaySubType = asset.subType === 'Used-Unknown' || asset.subType === 'Used-Known' ? 'Used' : asset.subType;
            
            details = `
                <div style="font-size:0.95rem; font-weight:bold;">${asset.name} <small style="font-weight:normal; color:var(--text-light)">(${displaySubType})</small></div>
                <div style="font-size:0.8rem; color:var(--text-light);">Serial: ${asset.serial}</div>
                <div style="font-size:0.8rem; color:var(--text-light); margin-top:2px;">أساس الحساب من: <span style="font-weight:bold; color:var(--info);">${asset.startDate || 'غير محدد'}</span></div>
                <div style="margin-top:8px; border-top:1px solid #eee; padding-top:5px;">
                    <div style="font-size:0.8rem; font-weight:bold; color:${nextColor}">${nextMaintText}</div>
                </div>`;
        }

        container.innerHTML += `
            <div class="asset-card" ${clickAction} style="${cursorStyle}">
                <div class="asset-actions-overlay">
                <button class="asset-btn asset-btn-pdf" onclick="event.stopPropagation(); printSingleAssetPDF(${index})" title="طباعة تقرير الماكينة (سجل الصيانة)"><i class="fa-solid fa-file-pdf"></i></button>                    <button class="asset-btn asset-btn-edit" onclick="event.stopPropagation(); editAsset(${index})" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                    <button class="asset-btn asset-btn-del" onclick="event.stopPropagation(); deleteAsset(${index})" title="حذف"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="asset-icon ${bgClass}"><i class="fa-solid ${iconClass}"></i></div>
                <div style="flex:1">${details}</div>
                ${asset.type === 'compressor' ? '<i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.8rem;"></i>' : ''}
            </div>`;
    });
}

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
        const assetParts = (contract.inventory || []).filter(p => p.model === asset.name && (!p.serial || p.serial === asset.serial));
        
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
        let displaySubType = asset.subType === 'Used-Unknown' || asset.subType === 'Used-Known' ? 'Used' : asset.subType;
        let subTypeLabel = asset.type === 'compressor' ? `(${displaySubType})` : '';

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
        serial: asset.serial, 
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

function renderVisitInventoryDeduction(contractId, asset = null) {
    const container = document.getElementById('visit-inventory-list');
    const box = document.getElementById('visit-inventory-deduction');
    const nameLabel = document.getElementById('inv-machine-name');
    container.innerHTML = '';
    
    if (!asset) {
        box.classList.add('hidden');
        return;
    }

    const contract = contracts.find(c => c.id === contractId);
    const availableParts = contract.inventory ? contract.inventory.filter(p => p.qty > 0 && p.model === asset.name && (!p.serial || p.serial === asset.serial)) : [];

    if(availableParts.length === 0) {
        box.classList.add('hidden');
        return;
    }

    box.classList.remove('hidden');
    nameLabel.innerText = `(${asset.name})`;
    
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

    const container = document.getElementById('dynamic-tasks-container');
    if (MAINT_TASKS[type]) {
        currentActiveTaskType = type;
        container.classList.remove('hidden');
        
        let html = `<label class="form-label" style="color:var(--primary); font-weight:bold; margin-bottom:12px;"><i class="fa-solid fa-list-check"></i> ${MAINT_TASKS[type].title}</label>`;
        
        html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">`;
        
        MAINT_TASKS[type].tasks.forEach((task, idx) => {
            html += `
                <label class="custom-maint-card">
                    <input type="checkbox" class="maint-task-checkbox" value="${task}" checked onchange="updateVisitNotesFromTasks()">
                    <div class="cmc-indicator"><i class="fa-solid fa-check"></i></div>
                    <span class="cmc-text" style="font-size:0.85rem; font-weight:600;">${task}</span>
                </label>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
        
        updateVisitNotesFromTasks();
    } else {
        container.classList.add('hidden');
        container.innerHTML = '';
        currentActiveTaskType = null;
    }
};

window.updateVisitNotesFromTasks = function() {
    if (!currentActiveTaskType || !MAINT_TASKS[currentActiveTaskType]) return;
    
    const checkboxes = document.querySelectorAll('.maint-task-checkbox:checked');
    let generatedText = MAINT_TASKS[currentActiveTaskType].title + '\n';
    
    if (checkboxes.length === 0) {
        generatedText += "- لم يتم تحديد مهام.\n";
    } else {
        checkboxes.forEach((cb, index) => {
            if(currentActiveTaskType === 'INSPECTION' || currentActiveTaskType === 'DRYER-DRAIN' || currentActiveTaskType === 'VACUUM-MAINT') {
                generatedText += `- ${cb.value}\n`;
            } else {
                generatedText += `${index + 1}- ${cb.value}\n`;
            }
        });
    }
    document.getElementById('visitNotes').value = generatedText;
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
        if(btnElement) {
            const col = btnElement.getAttribute('data-color');
            btnElement.style.background = 'white';
            btnElement.style.color = col;
        }
        document.getElementById('dynamic-tasks-container').classList.add('hidden');
        document.getElementById('visitNotes').value = '';
        currentActiveTaskType = null;
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

window.toggleUsedHistoryMode = function() {
    const mode = document.querySelector('input[name="usedHistoryMode"]:checked').value;
    const knownFields = document.getElementById('known-history-fields');
    
    if (mode === 'known') {
        knownFields.style.display = 'grid';
    } else {
        knownFields.style.display = 'none';
        document.getElementById('compLastMaintHours').value = '';
        document.getElementById('compLastMaintDate').value = '';
    }
    updatePlanPreview();
};

function showCompressorForm(mode) {
    currentCompressorMode = mode;
    tempNextIdx = 0; 
    tempCompletedSteps = []; 
    document.getElementById('compressor-choice-section').classList.add('hidden');
    document.getElementById('used-compressor-form-section').classList.remove('hidden');
    
    const knownFields = document.getElementById('known-history-fields');
    const historyRadios = document.querySelectorAll('input[name="usedHistoryMode"]');

    if (mode === 'new') { 
        historyRadios.forEach(r => r.disabled = true);
        knownFields.style.display = 'none'; 
        document.getElementById('compCurrentHours').value = 0; 
        document.getElementById('compLastMaintHours').value = 0; 
        document.getElementById('compLastMaintDate').value = getLocalDateString();
    } else { 
        historyRadios.forEach(r => r.disabled = false);
        document.querySelector('input[name="usedHistoryMode"][value="known"]').checked = true;
        toggleUsedHistoryMode(); 
        document.getElementById('compCurrentHours').value = ''; 
        document.getElementById('compLastMaintHours').value = ''; 
        document.getElementById('compLastMaintDate').value = getLocalDateString();
    }
    currentMaintenancePlan = []; 
    updatePlanPreview();
}

function backToCompChoice() {
    document.getElementById('used-compressor-form-section').classList.add('hidden');
    document.getElementById('compressor-choice-section').classList.remove('hidden');
}

function addPlanStep(type) { 
    currentMaintenancePlan.push(type); 
    updatePlanPreview(); 
}

function removePlanStep(index) { 
    currentMaintenancePlan.splice(index, 1); 
    if (index < tempNextIdx) {
        tempNextIdx--;
        tempCompletedSteps.splice(index, 1);
    }
    updatePlanPreview(); 
}

function clearPlan() { 
    currentMaintenancePlan = []; 
    tempNextIdx = 0;
    tempCompletedSteps = [];
    updatePlanPreview(); 
}

function setDefaultPlan() { 
    currentMaintenancePlan = ['A', 'B', 'A', 'C']; 
    tempNextIdx = 0;
    tempCompletedSteps = [];
    updatePlanPreview(); 
}

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
    const dailyHours = parseFloat(document.getElementById('compDailyHours').value) || 0;
    const daysOff = parseFloat(document.getElementById('compDaysOff').value) || 0;
    let currentHours = parseInt(currentHoursInput) || 0;
    
    let isUnknownMode = false;
    const historyRadio = document.querySelector('input[name="usedHistoryMode"]:checked');
    if (historyRadio) {
        isUnknownMode = currentCompressorMode === 'used' && historyRadio.value === 'unknown';
    }
    
    let lastMaintHours = 0;
    let baseDateStr = getLocalDateString();

    if (currentCompressorMode === 'used') {
        if (isUnknownMode) {
            lastMaintHours = currentHours > 2000 ? currentHours - 2000 : 0; 
            baseDateStr = getLocalDateString(); 
        } else {
            lastMaintHours = parseInt(document.getElementById('compLastMaintHours').value) || 0;
            baseDateStr = document.getElementById('compLastMaintDate').value || getLocalDateString();
        }
    } else {
        baseDateStr = document.getElementById('compLastMaintDate') ? document.getElementById('compLastMaintDate').value : getLocalDateString();
        if(!baseDateStr) baseDateStr = getLocalDateString();
    }

    let nextIdx = tempNextIdx; 
    let baseDate = new Date(baseDateStr);

    if (editingAssetIndex !== null && currentAssetContractId) {
        const c = contracts.find(x => x.id === currentAssetContractId);
        if (c && c.assets[editingAssetIndex]) {
            const asset = c.assets[editingAssetIndex];
            if (currentHours === asset.currentHours && asset.lastUpdated) {
                baseDate = new Date(asset.lastUpdated);
            }
        }
    }
    
    container.innerHTML = '';
    if (currentMaintenancePlan.length === 0) { container.innerHTML = '<div style="text-align:center; color:#aaa; font-size:0.85rem; padding-top:20px;">اضغط على الأزرار أعلاه لترتيب الصيانات القادمة...</div>'; return; }

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

            if (remainingHours > 0) {
                 if (currentCompressorMode === 'used') {
                     const targetAddedHours = dueHours - lastMaintHours;
                     const dateCalc = calculateUsedCompressorDate(baseDateStr, dailyHours, daysOff, targetAddedHours);
                     dateDisplay = `<i class="fa-regular fa-calendar"></i> ${dateCalc.str}`;
                 } else {
                     const dateCalc = calculateDate(baseDate, dailyHours, daysOff, remainingHours);
                     dateDisplay = `<i class="fa-regular fa-calendar"></i> ${dateCalc.str}`;
                 }
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
        
        document.getElementById('dryerCapacity').value = asset.capacity || '';
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
        
        currentCompressorMode = asset.subType === 'New' ? 'new' : 'used';
        const historyRadios = document.querySelectorAll('input[name="usedHistoryMode"]');
        const knownFields = document.getElementById('known-history-fields');
        
        if (currentCompressorMode === 'new') {
            historyRadios.forEach(r => r.disabled = true);
            knownFields.style.display = 'none';
            document.getElementById('compCurrentHours').value = asset.currentHours;
            document.getElementById('compLastMaintDate').value = asset.startDate || '';
            document.getElementById('compLastMaintHours').value = 0;
        } else {
            historyRadios.forEach(r => r.disabled = false);
            const isUnknown = asset.subType === 'Used-Unknown';
            if (isUnknown) {
                document.querySelector('input[name="usedHistoryMode"][value="unknown"]').checked = true;
                knownFields.style.display = 'none';
            } else {
                document.querySelector('input[name="usedHistoryMode"][value="known"]').checked = true;
                knownFields.style.display = 'grid';
                document.getElementById('compLastMaintHours').value = asset.planBaseHours !== undefined ? asset.planBaseHours : asset.currentHours;
                document.getElementById('compLastMaintDate').value = asset.startDate || '';
            }
            document.getElementById('compCurrentHours').value = asset.currentHours;
        }
        
        document.getElementById('compDailyHours').value = asset.dailyHours;
        document.getElementById('compDaysOff').value = asset.daysOff;
        
        currentMaintenancePlan = asset.maintenancePlan ? [...asset.maintenancePlan] : [];
        
        tempNextIdx = asset.nextMaintenanceIndex || 0; 
        tempCompletedSteps = asset.completedStepsHours ? [...asset.completedStepsHours] : []; 

        updatePlanPreview();
    }
}

document.getElementById('dryerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentAssetContractId) return;

    const nameInput = document.querySelector('input[name="dryerName"]:checked');
    const freonInput = document.querySelector('input[name="dryerFreon"]:checked');
    const capacityValue = document.getElementById('dryerCapacity').value;

    const dryerData = { 
        type: 'dryer', 
        name: nameInput ? nameInput.value : "FD dryer", 
        capacity: capacityValue, 
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
    
    const historyRadio = document.querySelector('input[name="usedHistoryMode"]:checked');
    const isUnknownMode = historyRadio ? (historyRadio.value === 'unknown') : false;
    
    const subType = currentCompressorMode === 'new' ? 'New' : (isUnknownMode ? 'Used-Unknown' : 'Used-Known');
    const daily = parseFloat(document.getElementById('compDailyHours').value);
    const off = parseFloat(document.getElementById('compDaysOff').value);
    const currentHrsVal = parseInt(document.getElementById('compCurrentHours').value) || 0;
    
    let lastMaintVal = 0;
    let lastUpdatedDate = getLocalDateString();
    let startDateVal = getLocalDateString();

    if (currentCompressorMode === 'new') {
        lastMaintVal = 0;
        startDateVal = document.getElementById('compLastMaintDate') ? document.getElementById('compLastMaintDate').value : getLocalDateString();
        if (!startDateVal) startDateVal = getLocalDateString();
        lastUpdatedDate = startDateVal;
    } else {
        if (isUnknownMode) {
            lastMaintVal = currentHrsVal > 2000 ? currentHrsVal - 2000 : 0;
            startDateVal = getLocalDateString();
            lastUpdatedDate = startDateVal;
        } else {
            lastMaintVal = parseInt(document.getElementById('compLastMaintHours').value) || 0;
            startDateVal = document.getElementById('compLastMaintDate').value || getLocalDateString();
            lastUpdatedDate = startDateVal;
        }
    }

    const idx = contracts.findIndex(c => c.id === currentAssetContractId);
    
    if (idx !== -1) {
        let nextMaintIdx = tempNextIdx; 
        let completedSteps = tempCompletedSteps; 

        if (editingAssetIndex !== null) {
            const oldAsset = contracts[idx].assets[editingAssetIndex];
            if (oldAsset) {
                if (oldAsset.currentHours === currentHrsVal && oldAsset.lastUpdated) {
                    lastUpdatedDate = oldAsset.lastUpdated;
                }
            }
        }

        const compData = {
            type: 'compressor', 
            subType: subType,
            name: document.getElementById('compName').value, 
            serial: document.getElementById('compSerial').value, 
            year: document.getElementById('compYear').value,
            startDate: startDateVal, 
            currentHours: currentHrsVal,
            planBaseHours: lastMaintVal, 
            dailyHours: daily, 
            daysOff: off,
            maintenancePlan: [...currentMaintenancePlan], 
            nextMaintenanceIndex: nextMaintIdx,
            completedStepsHours: completedSteps,
            completedStepsDates: [], 
            lastUpdated: lastUpdatedDate,
            isPlanHold: false 
        };

        if (!contracts[idx].assets) contracts[idx].assets = [];
        
        if (editingAssetIndex !== null) {
            // Keep old dates if they exist when editing
            const existingAsset = contracts[idx].assets[editingAssetIndex];
            if (existingAsset && existingAsset.completedStepsDates) {
                compData.completedStepsDates = [...existingAsset.completedStepsDates];
            }
            contracts[idx].assets[editingAssetIndex] = {
                ...contracts[idx].assets[editingAssetIndex],
                ...compData
            };
            showToast("تم تعديل بيانات الكومبريسور وتحديث الخطة بنجاح!");
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
function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
function saveData() { 
    localforage.setItem('cate_pro_v9_clean', contracts).catch(e => {
        console.error('Error saving:', e);
        alert('حدث خطأ غير متوقع أثناء حفظ البيانات.');
    }); 
}
function globalSearch(q) { const lower = q.toLowerCase(); const filtered = contracts.filter(c => c.company.toLowerCase().includes(lower) || c.client.toLowerCase().includes(lower) || c.phone.includes(lower)); renderTable(filtered); renderReportsGrid(filtered); }
function showFilePreview(input) { document.getElementById('files-preview').innerText = input.files.length > 0 ? `تم تحديد ${input.files.length} ملفات` : ''; }
function formatPhone(p) { let n = p.replace(/\D/g, ''); if(n.startsWith('01')) n = '2' + n; return n; }

// --- 15. ADDITIONAL HANDLERS ---
function openModal() { form.reset(); document.getElementById('editId').value = ''; document.getElementById('contract-file-preview').innerText = ''; modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }
function editContract(id) {
    const c = contracts.find(x=>x.id===id);
    
    // تفريغ الفورم لضمان إزالة أي ملف قديم معلق في الـ Input
    document.getElementById('contractForm').reset(); 
    
    document.getElementById('editId').value = c.id;
    document.getElementById('company').value = c.company;
    document.getElementById('client').value = c.client;
    document.getElementById('phone').value = c.phone;
    document.getElementById('startDate').value = c.startDate;
    document.getElementById('endDate').value = c.endDate;
    document.getElementById('totalVisits').value = c.totalVisits;
    document.getElementById('contract-file-preview').innerText = (c.contractPDF) ? `يوجد ملف` : '';
    modal.style.display = 'flex';
}
function deleteContract(id) { if(confirm('حذف؟')) { contracts = contracts.filter(x => x.id !== id); saveData(); renderAll(); } }
function openContractPDF(id) {
    const c = contracts.find(x => x.id === id);
    if (c && c.contractPDF) {
        try {
            // فصل البيانات عن الهيدر الخاص بالـ Base64
            const base64Data = c.contractPDF.split(',')[1];
            
            // تحويل النص إلى بايتات
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            // إنشاء ملف حقيقي (Blob) في الذاكرة الوهمية للمتصفح
            const blob = new Blob([byteArray], {type: 'application/pdf'});
            const blobUrl = URL.createObjectURL(blob);
            
            // فتح الملف بأمان في نافذة جديدة
            window.open(blobUrl, '_blank');
        } catch (error) {
            console.error("Error opening PDF:", error);
            showToast("حدث خطأ أثناء قراءة وعرض الملف", "error");
        }
    } else {
        showToast("لا يوجد ملف", "error");
    }
}
function showContractFilePreview(input) { document.getElementById('contract-file-preview').innerText = input.files[0] ? input.files[0].name : ''; }


// --- دوال الواتساب الاحترافية المخصصة لكل ماكينة ---
window.openAssetWAModal = function(assetIndex) {
    currentWAContract = contracts.find(c => c.id === currentAssetContractId);
    if (!currentWAContract) return;
    currentWAAssetIndex = assetIndex;

    const c = currentWAContract;
    const asset = c.assets[assetIndex];
    const container = document.getElementById('wa-dynamic-content');
    if(!container) return;
    container.innerHTML = '';

    let icon = asset.type === 'compressor' ? 'fa-wind' : (asset.type === 'dryer' ? 'fa-temperature-arrow-down' : 'fa-fan');
    
    container.innerHTML += `<p style="grid-column: 1/-1; margin: 0 0 15px; font-weight:bold; color:var(--primary); font-size:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:10px;"><i class="fa-solid ${icon}"></i> خيارات إرسال التقرير لـ: ${asset.name}</p>`;

    container.innerHTML += `
        <button class="wa-btn full-width" onclick="sendProfessionalWAMessage('full_process')">
            <i class="fa-solid fa-clipboard-list"></i><span>إرسال بيانات الماكينة وجدول الصيانة المتوقع</span>
        </button>
    `;

    container.innerHTML += `<p style="grid-column: 1/-1; margin: 15px 0 5px; font-weight:bold; color:var(--text-light); font-size:0.9rem;">إرسال إشعار تذكير بصيانة محددة:</p>`;

    if (asset.type === 'compressor') {
        container.innerHTML += `
            <button class="wa-btn" onclick="sendProfessionalWAMessage('2000')"><i class="fa-solid fa-check"></i><span>صيانة دورية (2000)</span></button>
            <button class="wa-btn" onclick="sendProfessionalWAMessage('4000')"><i class="fa-solid fa-check-double"></i><span>صيانة وقائية (4000)</span></button>
            <button class="wa-btn" onclick="sendProfessionalWAMessage('8000')"><i class="fa-solid fa-triangle-exclamation"></i><span>عمرة نصفية (8000)</span></button>
            <button class="wa-btn alert-btn" onclick="sendProfessionalWAMessage('24000')"><i class="fa-solid fa-rotate"></i><span>عمرة كاملة (24000)</span></button>
        `;
    } else if (asset.type === 'dryer') {
        container.innerHTML += `
            <button class="wa-btn full-width" onclick="sendProfessionalWAMessage('dryer_maint')"><i class="fa-solid fa-wrench"></i><span>تذكير بصيانة المجفف (Auto Drain)</span></button>
        `;
    } else if (asset.type === 'vacuum') {
        container.innerHTML += `
            <button class="wa-btn full-width" onclick="sendProfessionalWAMessage('vacuum_maint')"><i class="fa-solid fa-gears"></i><span>تذكير بصيانة طلمبة التفريغ</span></button>
        `;
    }

    document.getElementById('waModal').style.display = 'flex';
}

window.sendProfessionalWAMessage = function(actionType) {
    if(!currentWAContract || currentWAAssetIndex === null) return;
    const c = currentWAContract;
    const a = c.assets[currentWAAssetIndex];
    const phone = formatPhone(c.phone);

    let msg = `السادة الكرام / شركة *${c.company}*\n`;
    msg += `عناية المهندس / *${c.client}*\n\n`;
    msg += `تحية طيبة وبعد،،،\n`;
    msg += `نتواصل معكم من قسم الصيانة والدعم الفني بشركة *CATE* (Compressed Air Technology Egypt) الموزع المعتمد لشركة أطلس كوبكو.\n\n`;

    if (actionType === 'full_process') {
        msg += `في إطار حرصنا الدائم على متابعة كفاءة واستمرارية العمل لمعداتكم، نود إفادتكم ببيانات الماكينة والجدول الزمني المتوقع للصيانات الخاصة بـ (*${a.name}*):\n\n`;

        msg += `📋 *تفاصيل الماكينة:*\n`;
        msg += `🔸 الموديل: ${a.name}\n`;
        msg += `🔸 الرقم التسلسلي (S/N): ${a.serial}\n`;
        msg += `🔸 سنة التصنيع: ${a.year}\n`;

        if (a.type === 'compressor') {
            msg += `🔸 ساعات التشغيل المسجلة لدينا: ${a.currentHours} ساعة\n`;
            msg += `🔸 معدل التشغيل التقريبي: ${a.dailyHours || c.dailyHours || 0} ساعة/يوم\n\n`;

            msg += `📅 *الجدول الزمني لخطة الصيانة:*\n`;
            if (a.maintenancePlan && a.maintenancePlan.length > 0) {
                let nextIdx = a.nextMaintenanceIndex || 0;
                let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                const currentHours = a.currentHours || 0;
                const dailyHours = a.dailyHours || 0;
                const daysOff = a.daysOff || 0;

                for(let i=0; i<a.maintenancePlan.length; i++) {
                    let stepChar = a.maintenancePlan[i];
                    let target = base + ((i - nextIdx + 1) * 2000);
                    let label = getMaintenanceLabel(stepChar);

                    if (i < nextIdx) {
                        msg += `✔️ *${label}* عند ${target} ساعة (مكتملة)\n`;
                    } else {
                        let hoursRemaining = target - currentHours;
                        let dateStr = 'غير محدد';
                        let statusEmoji = '🕒';
                        let statusText = '(مجدولة)';

                        if (hoursRemaining <= 0) {
                            statusEmoji = '🔴';
                            statusText = '(مستحقة)';
                            dateStr = 'مطلوبة فوراً';
                        } else if (dailyHours > 0) {
                            if (a.subType && a.subType.includes('Used')) {
                                const targetAddedHours = target - base;
                                const dateCalc = calculateUsedCompressorDate(a.startDate, dailyHours, daysOff, targetAddedHours);
                                dateStr = dateCalc.str;
                            } else {
                                let calcBaseDate = new Date();
                                if (a.lastUpdated) calcBaseDate = new Date(a.lastUpdated);
                                else if (a.currentHours === 0 && a.startDate) calcBaseDate = new Date(a.startDate);

                                const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                                dateStr = calc.str;
                            }
                        }

                        msg += `${statusEmoji} *${label}* عند ${target} ساعة ${statusText}\n`;
                        msg += `     التاريخ المتوقع: ${dateStr}\n`;
                    }
                }
            } else {
                msg += `لا توجد خطة صيانة مجدولة بعد.\n`;
            }
        } else if (a.type === 'dryer') {
            msg += `🔸 نوع الفريون: ${a.freon}\n`;
            msg += `🔸 القدرة: ${a.capacity || 'N/A'}\n\n`;
        } else if (a.type === 'vacuum') {
            msg += `🔸 الضغط: ${a.bar} Bar\n\n`;
        }

        msg += `\nنحن دائماً في خدمتكم لتقديم أفضل دعم فني لضمان استمرارية الإنتاج بأعلى كفاءة.`;

    } else {
        let maintName = "";
        if(actionType === '2000') maintName = "الصيانة الدورية (2000 ساعة)";
        else if(actionType === '4000') maintName = "الصيانة الوقائية (4000 ساعة)";
        else if(actionType === '8000') maintName = "العمرة النصفية (8000 ساعة)";
        else if(actionType === '24000') maintName = "العمرة الشاملة (24000 ساعة)";
        else if(actionType === 'dryer_maint') maintName = "الصيانة الدورية وتغيير طقم التصريف (Auto Drain Kit)";
        else if(actionType === 'vacuum_maint') maintName = "الصيانة الشاملة لطلمبة التفريغ";

        msg += `في إطار خطة الصيانة الوقائية للحفاظ على أداء المعدات وتجنب أي توقفات مفاجئة للإنتاج، نود تذكيركم باقتراب موعد:\n\n`;
        msg += `🔧 *${maintName}*\n`;
        msg += `للماكينة: *${a.name}*\n`;
        msg += `الرقم التسلسلي: *${a.serial}*\n\n`;

        if (a.type === 'compressor' && a.dailyHours > 0) {
            msg += `يرجى التفضل بالعلم أن الماكينة تقترب من الساعات المستحقة لإتمام هذه الصيانة بنجاح.\n\n`;
        }

        msg += `برجاء التكرم بالتنسيق مع فريق الصيانة لديكم، وتحديد موعد مناسب لزيارة المهندس المختص لإجراء الصيانة اللازمة لضمان سلامة الماكينة.\n\n`;
        msg += `يسعدنا الرد على استفساراتكم وتلبية طلباتكم في أي وقت.`;
    }

    msg += `\n\nوتفضلوا بقبول فائق الاحترام والتقدير،،،\n`;
    msg += `*قسم خدمة ما بعد البيع والصيانة*\n`;
    msg += `*CATE - Compressed Air Technology*`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    closeWAModal();
}

function closeWAModal() { document.getElementById('waModal').style.display = 'none'; }


// دالة إرسال التقرير الشامل لكل الماكينات في العقد عبر الواتساب
window.sendFullContractWAMessage = function() {
    if(!currentAssetContractId) return;
    const c = contracts.find(x => x.id === currentAssetContractId);
    
    if(!c || !c.assets || c.assets.length === 0) {
        showToast("لا توجد ماكينات مسجلة في هذا العقد لإرسال تقريرها.", "error");
        return;
    }

    const phone = formatPhone(c.phone);

    let msg = `السادة الكرام / شركة *${c.company}*\n`;
    msg += `عناية المهندس / *${c.client}*\n\n`;
    msg += `تحية طيبة وبعد،،،\n`;
    msg += `نتواصل معكم من قسم الصيانة والدعم الفني بشركة *CATE* (Compressed Air Technology Egypt) الموزع المعتمد لشركة أطلس كوبكو.\n\n`;
    msg += `مرفق لسيادتكم التقرير الشامل لبيانات الماكينات والمعدات، والجدول الزمني المتوقع للصيانات:\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    c.assets.forEach((a, index) => {
        msg += `🔹 *الماكينة (${index + 1}): ${a.name}*\n`;
        msg += `🔸 الرقم التسلسلي (S/N): ${a.serial}\n`;
        msg += `🔸 سنة التصنيع: ${a.year}\n`;

        if (a.type === 'compressor') {
            msg += `🔸 ساعات التشغيل المسجلة لدينا: ${a.currentHours} ساعة\n`;
            msg += `🔸 معدل التشغيل التقريبي: ${a.dailyHours || c.dailyHours || 0} ساعة/يوم\n\n`;

            msg += `📅 *خطة الصيانة:*\n`;
            if (a.maintenancePlan && a.maintenancePlan.length > 0) {
                let nextIdx = a.nextMaintenanceIndex || 0;
                let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                const currentHours = a.currentHours || 0;
                const dailyHours = a.dailyHours || 0;
                const daysOff = a.daysOff || 0;

                for(let i=0; i<a.maintenancePlan.length; i++) {
                    let stepChar = a.maintenancePlan[i];
                    let target = base + ((i - nextIdx + 1) * 2000);
                    let label = getMaintenanceLabel(stepChar);

                    if (i < nextIdx) {
                        msg += `✔️ *${label}* عند ${target} ساعة (مكتملة)\n`;
                    } else {
                        let hoursRemaining = target - currentHours;
                        let dateStr = 'غير محدد';
                        let statusEmoji = '🕒';
                        let statusText = '(مجدولة)';

                        if (hoursRemaining <= 0) {
                            statusEmoji = '🔴';
                            statusText = '(مستحقة)';
                            dateStr = 'مطلوبة فوراً';
                        } else if (dailyHours > 0) {
                            if (a.subType && a.subType.includes('Used')) {
                                const targetAddedHours = target - base;
                                const dateCalc = calculateUsedCompressorDate(a.startDate, dailyHours, daysOff, targetAddedHours);
                                dateStr = dateCalc.str;
                            } else {
                                let calcBaseDate = new Date();
                                if (a.lastUpdated) calcBaseDate = new Date(a.lastUpdated);
                                else if (a.currentHours === 0 && a.startDate) calcBaseDate = new Date(a.startDate);

                                const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                                dateStr = calc.str;
                            }
                        }

                        msg += `${statusEmoji} *${label}* عند ${target} ساعة ${statusText}\n`;
                        msg += `     التاريخ المتوقع: ${dateStr}\n`;
                    }
                }
            } else {
                msg += `لا توجد خطة صيانة مجدولة بعد.\n`;
            }
        } else if (a.type === 'dryer') {
            msg += `🔸 نوع الفريون: ${a.freon}\n`;
            msg += `🔸 القدرة: ${a.capacity || 'N/A'}\n`;
        } else if (a.type === 'vacuum') {
            msg += `🔸 الضغط: ${a.bar} Bar\n`;
        }
        
        msg += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    msg += `نحن دائماً في خدمتكم لتقديم أفضل دعم فني لضمان استمرارية الإنتاج بأعلى كفاءة.\n\n`;
    msg += `وتفضلوا بقبول فائق الاحترام والتقدير،،،\n`;
    msg += `*قسم خدمة ما بعد البيع والصيانة*\n`;
    msg += `*CATE - Compressed Air Technology*`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
};


function updateNotifications() {
    const notifList = document.getElementById('notif-list-body'); 
    const badge = document.getElementById('notif-badge'); 
    const bellBtn = document.getElementById('notif-btn'); 
    notifList.innerHTML = ''; 
    let count = 0;
    const today = new Date();

    contracts.forEach(c => {
        if(c.isHold) return;

        // --- 1. إشعارات انتهاء العقد ---
        if(c.endDate) {
            const end = new Date(c.endDate);
            const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            
            if(diffDays <= 30) {
                count++;
                let isDanger = diffDays <= 0;
                let msg = isDanger ? '🚨 العقد منتهي! يرجى التجديد فوراً' : `⏳ ينتهي العقد خلال ${diffDays} يوم`;
                let color = isDanger ? '#ef4444' : '#d97706';
                let bg = isDanger ? '#fee2e2' : '#fef3c7';
                let icon = isDanger ? 'fa-triangle-exclamation' : 'fa-clock';
                let priorityClass = isDanger ? 'priority-high' : 'priority-medium';
                
                notifList.innerHTML += `
                    <div class="notif-item ${priorityClass}" onclick="goToContract(${c.id})">
                        <div class="notif-icon-box" style="background:${bg}; color:${color}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="notif-content" style="flex:1;">
                            <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                            <p style="margin:0; font-size:0.85rem; color:${color}; font-weight:700;">${msg}</p>
                        </div>
                        <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                    </div>`;
            }
        }

        // --- 2. إشعارات موقف الزيارات (متبقي زيارة / ركود) ---
        if (c.totalVisits > 0) {
            // أ. متبقي زيارة واحدة
            if (c.totalVisits - c.visitsDone === 1) {
                count++;
                notifList.innerHTML += `
                    <div class="notif-item priority-medium" onclick="goToContract(${c.id})">
                        <div class="notif-icon-box" style="background:#e0f2fe; color:#0284c7">
                            <i class="fa-solid fa-clipboard-check"></i>
                        </div>
                        <div class="notif-content" style="flex:1;">
                            <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                            <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:#0284c7; font-size:0.9rem;">تجهيز للتجديد:</b> متبقي زيارة واحدة لانتهاء العقد</p>
                        </div>
                        <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                    </div>`;
            }

            // ب. ركود العقد (لم تتم أي زيارة من 3 شهور = 90 يوم)
            let lastVisitDateObj = c.startDate ? new Date(c.startDate) : today;
            if (c.history && c.history.length > 0) {
                const sortedHistory = [...c.history].sort((a,b) => new Date(b.date) - new Date(a.date));
                lastVisitDateObj = new Date(sortedHistory[0].date);
            }
            const daysSinceLastVisit = Math.floor((today - lastVisitDateObj) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLastVisit >= 90 && c.visitsDone < c.totalVisits) {
                count++;
                notifList.innerHTML += `
                    <div class="notif-item priority-medium" onclick="goToContract(${c.id})">
                        <div class="notif-icon-box" style="background:#ffedd5; color:#ea580c">
                            <i class="fa-solid fa-bed"></i>
                        </div>
                        <div class="notif-content" style="flex:1;">
                            <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                            <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:#ea580c; font-size:0.9rem;">ركود:</b> لم تتم أي زيارة منذ ${daysSinceLastVisit} يوم!</p>
                        </div>
                        <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                    </div>`;
            }
        }

        // --- 3. إشعارات نواقص المخزن (Inventory) ---
        if (c.inventory && c.inventory.length > 0) {
            c.inventory.forEach(p => {
                if (p.qty <= 1) {
                    count++;
                    let isDanger = p.qty === 0;
                    let msg = isDanger ? `🚨 نفد رصيد (${p.name}) من المخزن` : `⚠️ اقترب نفاذ رصيد (${p.name}) المتبقي: 1`;
                    let color = isDanger ? '#ef4444' : '#d97706';
                    let bg = isDanger ? '#fee2e2' : '#fef3c7';
                    let priorityClass = isDanger ? 'priority-high' : 'priority-medium';

                    notifList.innerHTML += `
                        <div class="notif-item ${priorityClass}" onclick="goToContract(${c.id})">
                            <div class="notif-icon-box" style="background:${bg}; color:${color}">
                                <i class="fa-solid fa-box-open"></i>
                            </div>
                            <div class="notif-content" style="flex:1;">
                                <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:${color}; font-size:0.9rem;">نواقص:</b> ${msg}</p>
                            </div>
                            <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                        </div>`;
                }
            });
        }

        // --- 4. إشعارات الماكينات والمعدات ---
        if(c.assets) {
            c.assets.forEach((a, aIdx) => {
                if(a.type === 'compressor') {
                    // أ. الماكينات المعلقة
                    if (a.isPlanHold || !a.maintenancePlan || a.maintenancePlan.length === 0) {
                        count++;
                        notifList.innerHTML += `
                            <div class="notif-item priority-medium" onclick="goToMachinePlanFromNotif(${c.id}, ${aIdx})">
                                <div class="notif-icon-box warning-anim" style="background:#fef3c7; color:#d97706">
                                    <i class="fa-solid fa-circle-pause"></i>
                                </div>
                                <div class="notif-content" style="flex:1;">
                                    <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                    <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:#d97706; font-size:0.9rem;">${a.name}</b>: ⚠️ معلق (بانتظار تحديد خطة)</p>
                                </div>
                                <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                            </div>`;
                    } 
                    else {
                        // ب. خطة الصيانة ومواعيد الاستحقاق
                        let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                        let nextIdx = a.nextMaintenanceIndex || 0;
                        
                        if (nextIdx < a.maintenancePlan.length) {
                            const target = base + 2000;
                            const remaining = target - a.currentHours;
                            
                            if(remaining <= 50) {
                                count++;
                                let isDanger = remaining <= 0;
                                let maintName = "الصيانة الدورية";
                                if (target > 0 && target % 24000 === 0) maintName = `صيانة الـ ${target} ساعة (عمرة كاملة)`;
                                else if (target > 0 && target % 16000 === 0) maintName = `صيانة الـ ${target} ساعة`;

                                let msg = isDanger ? `⚠️ ${maintName} مستحقة فوراً` : `باقي ${remaining} ساعة على ${maintName}`;
                                let color = isDanger ? '#ef4444' : '#059669';
                                let bg = isDanger ? '#fee2e2' : '#d1fae5';
                                let priorityClass = isDanger ? 'priority-high' : 'priority-medium';

                                notifList.innerHTML += `
                                    <div class="notif-item ${priorityClass}" onclick="goToMachinePlanFromNotif(${c.id}, ${aIdx})">
                                        <div class="notif-icon-box" style="background:${bg}; color:${color}">
                                            <i class="fa-solid fa-screwdriver-wrench"></i>
                                        </div>
                                        <div class="notif-content" style="flex:1;">
                                            <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                            <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:${color}; font-size:0.9rem;">${a.name}</b>: ${msg}</p>
                                        </div>
                                        <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                                    </div>`;
                            }
                        } 
                        // --- التعديل الجديد: إشعار عند انتهاء الخطة بالكامل ---
                        else if (nextIdx >= a.maintenancePlan.length && a.maintenancePlan.length > 0 && !a.isPlanHold) {
                            count++;
                            notifList.innerHTML += `
                                <div class="notif-item priority-high" onclick="goToMachinePlanFromNotif(${c.id}, ${aIdx})">
                                    <div class="notif-icon-box warning-anim" style="background:#fee2e2; color:#ef4444">
                                        <i class="fa-solid fa-calendar-plus"></i>
                                    </div>
                                    <div class="notif-content" style="flex:1;">
                                        <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                        <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:#ef4444; font-size:0.9rem;">${a.name}</b>: 🚨 الخطة انتهت! يرجى إضافة خطة جديدة أو تعليق الماكينة.</p>
                                    </div>
                                    <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                                </div>`;
                        }
                    }

                    // ج. إشعار تحديث قراءة العداد (Odometer Update) إذا مر 60 يوم
                    let lastUpdatedDate = a.lastUpdated ? new Date(a.lastUpdated) : (a.startDate ? new Date(a.startDate) : today);
                    const daysSinceUpdate = Math.floor((today - lastUpdatedDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysSinceUpdate >= 60) {
                        count++;
                        notifList.innerHTML += `
                            <div class="notif-item priority-medium" onclick="goToMachinePlanFromNotif(${c.id}, ${aIdx})">
                                <div class="notif-icon-box" style="background:#e0f2fe; color:#0284c7">
                                    <i class="fa-solid fa-gauge-high"></i>
                                </div>
                                <div class="notif-content" style="flex:1;">
                                    <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                    <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:#0284c7; font-size:0.9rem;">${a.name}</b>: 📞 تحديث العداد مطلوب (مر ${daysSinceUpdate} يوم)</p>
                                </div>
                                <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                            </div>`;
                    }

                } 
                else if (a.type === 'dryer' || a.type === 'vacuum') {
                    // د. إشعارات المجففات والفاكيوم (الزمنية) - تنبيه بعد 180 يوم (6 شهور) من آخر زيارة
                    let lastAssetVisitDate = c.startDate ? new Date(c.startDate) : today;
                    if (c.history && c.history.length > 0) {
                        const assetHistory = c.history.filter(h => h.assetIndex == aIdx).sort((a,b) => new Date(b.date) - new Date(a.date));
                        if (assetHistory.length > 0) {
                            lastAssetVisitDate = new Date(assetHistory[0].date);
                        }
                    }
                    const daysSinceAssetVisit = Math.floor((today - lastAssetVisitDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysSinceAssetVisit >= 180) {
                        count++;
                        let iconClass = a.type === 'dryer' ? 'fa-temperature-arrow-down' : 'fa-fan';
                        let color = a.type === 'dryer' ? '#ea580c' : '#7c3aed';
                        let bg = a.type === 'dryer' ? '#ffedd5' : '#f3e8ff';

                        notifList.innerHTML += `
                            <div class="notif-item priority-medium" onclick="goToMachinePlanFromNotif(${c.id}, ${aIdx})">
                                <div class="notif-icon-box" style="background:${bg}; color:${color}">
                                    <i class="fa-solid ${iconClass}"></i>
                                </div>
                                <div class="notif-content" style="flex:1;">
                                    <h5 style="margin:0 0 5px 0; font-size:1rem; color:var(--text-main); font-weight:800;">${c.company}</h5>
                                    <p style="margin:0; font-size:0.85rem; color:var(--text-light); font-weight:600;"><b style="color:${color}; font-size:0.9rem;">${a.name}</b>: ⏳ حان موعد الفحص الدوري (مر ${daysSinceAssetVisit} يوم)</p>
                                </div>
                                <i class="fa-solid fa-chevron-left" style="color:#cbd5e1; font-size:0.9rem;"></i>
                            </div>`;
                    }
                }
            });
        }
    });

    if (count === 0) { 
        notifList.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#94a3b8;"><i class="fa-solid fa-circle-check" style="font-size:3rem; margin-bottom:15px; color:#10b981; opacity:0.5;"></i><br><span style="font-weight:bold; font-size:1.1rem;">كل الأمور تمام!</span><br>لا توجد تنبيهات عاجلة حالياً</div>'; 
        badge.style.display = 'none'; 
        bellBtn.classList.remove('bell-active'); 
    } else { 
        badge.style.display = 'flex'; 
        badge.innerText = count; 
        bellBtn.classList.add('bell-active'); 
    }
}

window.toggleNotifications = function() {
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
};

window.goToContract = function(contractId) {
    document.getElementById('notif-dropdown').style.display = 'none';
    switchTab('contracts');
    
    const c = contracts.find(x => x.id === contractId);
    if(c) {
        const searchBar = document.querySelectorAll('.mobile-search-bar input')[0];
        if (searchBar) searchBar.value = c.company;
        globalSearch(c.company);
    }
};

window.goToMachinePlanFromNotif = function(contractId, assetIndex) {
    document.getElementById('notif-dropdown').style.display = 'none';
    openCompanyAssets(contractId);
    setTimeout(() => { openMachineDetails(assetIndex); }, 100);
};

window.triggerReportRedirect = function(cId, aIdx) {
    closeMachineDetailsModal();
    const loader = document.getElementById('redirectLoader');
    if (loader) loader.style.display = 'flex';
    setTimeout(() => {
        if (loader) loader.style.display = 'none';
        goToMachineReport(cId, aIdx);
    }, 2500); 
};

window.goToMachineReport = function(contractId, assetIndex) {
    document.getElementById('notif-dropdown').style.display = 'none';
    switchTab('reports');
    openCRM(contractId);
    setTimeout(() => {
        selectReportAsset(assetIndex);
        
        if (pendingAutoFillStep) {
            autoFillMaintenance(pendingAutoFillStep);
            pendingAutoFillStep = null; 
        }
        
        document.getElementById('report-action-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
};

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

    document.querySelectorAll('.maint-select-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    const cId = parseInt(document.getElementById('reportContractId').value);
    const contract = contracts.find(x => x.id === cId);
    document.querySelectorAll('.asset-select-card').forEach(el => {
        el.style.borderColor = '#e2e8f0';
        el.style.background = 'white';
    });
    
    const compOptions = document.getElementById('compressor-maint-options');
    const dryerOptions = document.getElementById('dryer-maint-options');
    const vacuumOptions = document.getElementById('vacuum-maint-options'); 
    const options8000Div = document.getElementById('maint-8000-sub-options');
    
    const dynamicContainer = document.getElementById('dynamic-tasks-container');
    if(dynamicContainer) {
        dynamicContainer.classList.add('hidden');
        dynamicContainer.innerHTML = '';
    }
    currentActiveTaskType = null;

    const radios = document.getElementsByName('oilFilterOption');
    radios.forEach(r => r.checked = false);
    const extraCbs = document.getElementsByName('extraParts');
    extraCbs.forEach(cb => cb.checked = false);

    let selectedAsset = null; 

    if (index !== null) {
        const asset = contract.assets[index];
        selectedAsset = asset; 
        const activeCard = document.getElementById(`asset-card-${index}`);
        if(activeCard) {
            activeCard.style.borderColor = 'var(--primary)';
            activeCard.style.background = '#f0f9ff';
        }
        document.getElementById('selected-asset-name').innerText = contract.assets[index].name;
        
        if (asset.type === 'compressor') {
            compOptions.classList.remove('hidden');
            dryerOptions.classList.add('hidden');
            vacuumOptions.classList.add('hidden');
        } else if (asset.type === 'dryer') {
            compOptions.classList.add('hidden');
            dryerOptions.classList.remove('hidden');
            vacuumOptions.classList.add('hidden');
        } else if (asset.type === 'vacuum') {
            compOptions.classList.add('hidden');
            dryerOptions.classList.add('hidden');
            vacuumOptions.classList.remove('hidden');
        } else {
            compOptions.classList.add('hidden');
            dryerOptions.classList.add('hidden');
            vacuumOptions.classList.add('hidden');
        }
        options8000Div.classList.add('hidden'); 
    } else {
        compOptions.classList.add('hidden');
        dryerOptions.classList.add('hidden');
        vacuumOptions.classList.add('hidden');
    }
    
    renderVisitInventoryDeduction(cId, selectedAsset);

    document.getElementById('report-action-section').classList.remove('hidden');
    document.getElementById('reportAssetIndex').value = index !== null ? index : '';
    document.getElementById('visitNotes').value = '';
    renderTimeline(contract.history, cId, index);
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
        
        document.getElementById('dynamic-tasks-container').classList.add('hidden');
        document.getElementById('dynamic-tasks-container').innerHTML = '';
        currentActiveTaskType = null;

        renderTimeline(contracts[idx].history, id, assetIndex);
        
        const selectedAsset = contracts[idx].assets[assetIndex] ? contracts[idx].assets[assetIndex] : null;
        renderVisitInventoryDeduction(id, selectedAsset); 
        
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
    
    let baseDisplay = asset.startDate || 'غير مسجل';
    document.getElementById('detail-machine-startdate').innerHTML = `<i class="fa-solid fa-play"></i> أساس الحساب من: ${baseDisplay}`;
    
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
    
    // التعديل هنا: إظهار الماكينة المعلقة للمستخدم وإعطائه فرصة للتجديد
    if (!asset.maintenancePlan || asset.maintenancePlan.length === 0 || asset.isPlanHold) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px 20px; background: #fffbeb; border: 1px dashed #fcd34d; border-radius: 12px;">
                <i class="fa-solid fa-circle-pause" style="font-size:3rem; color:#f59e0b; margin-bottom:15px;"></i>
                <p style="margin-bottom:15px; font-weight:bold; color:#d97706;">الماكينة معلقة ولا توجد خطة صيانة مسجلة حالياً</p>
                <button class="btn btn-primary" onclick="closeMachineDetailsModal(); openRenewPlanModal(${currentAssetContractId}, ${assetIndex})" style="box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); background: #f59e0b; border: none;">
                    <i class="fa-solid fa-plus"></i> بناء خطة جديدة الآن
                </button>
            </div>`;
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
            targetHours = completedSteps[i] || "تمت ضمناً";
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
            } else {
                statusClass = 'future';
                statusIcon = '<i class="fa-regular fa-clock"></i> مجدولة';
            }

            actionBtn = `<div style="margin-top:8px;">
                <button onclick="markMaintenanceDone(${currentAssetContractId}, ${assetIndex}, ${i})" class="btn" style="background:var(--success); color:white; padding:4px 10px; font-size:0.8rem; border:none; border-bottom:3px solid #16a34a;">
                    <i class="fa-solid fa-check-double"></i> تسجيل إتمام
                </button>
            </div>`;

            const hoursRemaining = targetHours - currentHours;
            if (hoursRemaining <= 0) {
                 dateDisplay = '<span style="color:#ef4444; font-weight:bold;">مستحقة / متأخرة</span>';
            } else if (dailyHours > 0) {
                if (asset.subType && asset.subType.includes('Used')) {
                    const targetAddedHours = targetHours - base;
                    const dateCalc = calculateUsedCompressorDate(asset.startDate, dailyHours, daysOff, targetAddedHours);
                    dateDisplay = dateCalc.str;
                } else {
                    let calcBaseDate = new Date();
                    if (asset.lastUpdated) {
                        calcBaseDate = new Date(asset.lastUpdated);
                    } else if (asset.currentHours === 0 && asset.startDate) {
                        calcBaseDate = new Date(asset.startDate);
                    }
                    const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                    dateDisplay = calc.str;
                }
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

    // --- التعديل الجديد: عرض زر الإجراء (خطة جديدة/تعليق) عند انتهاء الخطة بالكامل ---
    if (nextIdx >= asset.maintenancePlan.length && asset.maintenancePlan.length > 0 && !asset.isPlanHold) {
        container.innerHTML += `
        <div style="text-align:center; padding:20px; background: #fef2f2; border: 1px dashed #ef4444; border-radius: 12px; margin-top: 20px; animation: fadeInUp 0.5s ease forwards;">
            <i class="fa-solid fa-triangle-exclamation warning-anim" style="font-size:2.5rem; color:#ef4444; margin-bottom:10px;"></i>
            <p style="margin-bottom:15px; font-weight:bold; color:#b91c1c; font-size: 1.1rem;">تم الانتهاء من جميع صيانات هذه الخطة!</p>
            <p style="margin-bottom:15px; font-size:0.9rem; color:#ef4444;">يجب تحديد خطة صيانة جديدة لاستمرار المتابعة، أو تعليق الماكينة إذا كانت متوقفة.</p>
            <button class="btn btn-primary" onclick="closeMachineDetailsModal(); openRenewPlanModal(${currentAssetContractId}, ${assetIndex})" style="background: #ef4444; border: none; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                <i class="fa-solid fa-pen-to-square"></i> اتخاذ إجراء (خطة جديدة / تعليق مؤقت)
            </button>
        </div>`;
    }
}

// دالة عرض Modal إتمام الصيانة
window.markMaintenanceDone = function(cId, aIdx, stepIdx) {
    const cIdx_local = contracts.findIndex(c => c.id === cId);
    if(cIdx_local === -1) return;
    const asset = contracts[cIdx_local].assets[aIdx];
    let currentNextIdx = asset.nextMaintenanceIndex || 0;

    const isAdvanced = stepIdx > currentNextIdx;
    document.getElementById('maintConfirmWarning').style.display = isAdvanced ? 'block' : 'none';
    
    document.getElementById('maintConfirmHoursInput').value = asset.currentHours;
    document.getElementById('maintConfirmCurrentHoursText').innerText = asset.currentHours;
    document.getElementById('maintConfirmDateInput').value = getLocalDateString(); 

    pendingMaintConfirm = { cId, aIdx, stepIdx };
    document.getElementById('maintenanceConfirmModal').style.display = 'flex';
};

window.closeMaintenanceConfirmModal = function() {
    document.getElementById('maintenanceConfirmModal').style.display = 'none';
    pendingMaintConfirm = null;
};

// الدالة اللي بتنفذ الإتمام بعد الضغط على تأكيد في الـ Modal
window.executeMaintenanceDone = function() {
    if (!pendingMaintConfirm) return;
    
    const { cId, aIdx, stepIdx } = pendingMaintConfirm;
    const exactHoursStr = document.getElementById('maintConfirmHoursInput').value;
    const exactDateStr = document.getElementById('maintConfirmDateInput').value; 

    if (exactHoursStr === null || exactHoursStr.trim() === "") {
        showToast("الرجاء إدخال عدد الساعات", "error");
        return;
    }
    if (!exactDateStr) { 
        showToast("الرجاء إدخال تاريخ الصيانة", "error");
        return;
    }

    const hours = parseInt(exactHoursStr);
    if (isNaN(hours)) {
        showToast("الرجاء إدخال رقم صحيح", "error");
        return;
    }

    const cIdx_local = contracts.findIndex(c => c.id === cId);
    const asset = contracts[cIdx_local].assets[aIdx];
    let currentNextIdx = asset.nextMaintenanceIndex || 0;

    if (!asset.completedStepsHours) asset.completedStepsHours = [];
    if (!asset.completedStepsDates) asset.completedStepsDates = []; // NEW ARRAY

    if (stepIdx > currentNextIdx) {
        const completedStepChar = asset.maintenancePlan.splice(stepIdx, 1)[0];
        asset.maintenancePlan.splice(currentNextIdx, 0, completedStepChar);
    }
    
    asset.completedStepsHours[currentNextIdx] = hours;
    asset.completedStepsDates[currentNextIdx] = exactDateStr; // SAVE EXACT DATE
    
    asset.planBaseHours = hours; 
    asset.currentHours = Math.max(asset.currentHours, hours); 
    asset.nextMaintenanceIndex = currentNextIdx + 1; 
    asset.lastUpdated = exactDateStr; 
    pendingAutoFillStep = asset.maintenancePlan[currentNextIdx]; 
    pendingAutoFillDate = exactDateStr;

    if (asset.subType && asset.subType.includes('Used')) {
        asset.startDate = exactDateStr; 
    }

    saveData();
    renderAll(); 
    openMachineDetails(aIdx); 
    closeMaintenanceConfirmModal(); 
    showToast("تم تأكيد الإتمام وترحيل المواعيد بنجاح!");

    if (asset.nextMaintenanceIndex >= asset.maintenancePlan.length) {
        setTimeout(() => {
            closeMachineDetailsModal(); 
            openRenewPlanModal(cId, aIdx); 
        }, 600);
    } else {
        setTimeout(() => {
            triggerReportRedirect(cId, aIdx);
        }, 600);
    }
};

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
};

document.querySelectorAll('.sidebar li').forEach(li => {
    li.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });
});

// --- RENEW MAINTENANCE PLAN LOGIC ---
let renewPlanArray = [];
let renewContractId = null;
let renewAssetIndex = null;

window.openRenewPlanModal = function(cId, aIdx) {
    renewContractId = cId;
    renewAssetIndex = aIdx;
    renewPlanArray = [];
    updateRenewPlanPreview();
    document.getElementById('renewPlanModal').style.display = 'flex';
};

window.closeRenewPlanModal = function() {
    document.getElementById('renewPlanModal').style.display = 'none';
    renewContractId = null;
    renewAssetIndex = null;
};

window.addRenewPlanStep = function(type) {
    renewPlanArray.push(type);
    updateRenewPlanPreview();
};

window.removeRenewPlanStep = function(index) {
    renewPlanArray.splice(index, 1);
    updateRenewPlanPreview();
};

window.clearRenewPlan = function() {
    renewPlanArray = [];
    updateRenewPlanPreview();
};

window.setDefaultRenewPlan = function() {
    renewPlanArray = ['A', 'B', 'A', 'C'];
    updateRenewPlanPreview();
};

window.updateRenewPlanPreview = function() {
    const container = document.getElementById('renewPlanTimelineContainer');
    container.innerHTML = '';
    if (renewPlanArray.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#aaa; font-size:0.85rem; padding-top:20px;">اضغط على الأزرار أعلاه لترتيب الصيانات القادمة...</div>';
        return;
    }

    renewPlanArray.forEach((stepChar, index) => {
        const color = getMaintenanceColor(stepChar);
        const label = getMaintenanceLabel(stepChar);
        const html = `<div class="plan-step" style="border-right: 4px solid ${color}"><div class="step-index" style="background:${color}">${index + 1}</div><div class="step-info" style="margin-right:10px;"><div class="step-type" style="color:${color}">${label}</div></div><div class="step-remove" onclick="removeRenewPlanStep(${index})"><i class="fa-solid fa-times"></i></div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
};

// --- دالة تعليق الماكينة (Hold) ---
window.holdMachinePlan = function() {
    if(!confirm('هل أنت متأكد من تعليق خطة الماكينة؟ (يمكنك إضافة خطة لاحقاً)')) return;
    
    const cIdx = contracts.findIndex(c => c.id === renewContractId);
    if(cIdx === -1) return;
    const asset = contracts[cIdx].assets[renewAssetIndex];
    
    // تفريغ الخطة وتفعيل وضع التعليق
    asset.maintenancePlan = [];
    asset.nextMaintenanceIndex = 0;
    asset.completedStepsHours = [];
    asset.completedStepsDates = [];
    asset.isPlanHold = true; 
    
    saveData();
    renderAll();

    // حفظ قيم العقد والماكينة قبل إغلاق النافذة وتصفير المتغيرات العامة
    const currentContractId = renewContractId;
    const currentAssetIndex = renewAssetIndex;

    closeRenewPlanModal();
    showToast("تم تعليق الماكينة (بانتظار العميل)", "success");
    
    setTimeout(() => {
        // استخدام المتغيرات المحفوظة بدلاً من المتغيرات العامة التي أصبحت null
        triggerReportRedirect(currentContractId, currentAssetIndex);
    }, 500);
};

// --- دالة حفظ الخطة الجديدة ---
window.saveRenewedPlan = function() {
    if(renewPlanArray.length === 0) {
        alert('من فضلك قم بإضافة خطوة واحدة على الأقل للخطة.');
        return;
    }
    const cIdx = contracts.findIndex(c => c.id === renewContractId);
    if(cIdx === -1) return;
    const asset = contracts[cIdx].assets[renewAssetIndex];
    
    asset.maintenancePlan = [...renewPlanArray];
    asset.nextMaintenanceIndex = 0;
    asset.completedStepsHours = [];
    asset.completedStepsDates = [];
    asset.isPlanHold = false; // فك التعليق لو كانت معلقة
    
    if (asset.subType && asset.subType.includes('Used')) {
        asset.startDate = getLocalDateString(); 
    }
    
    saveData();
    renderAll();

    // حفظ قيم العقد والماكينة قبل إغلاق النافذة وتصفير المتغيرات العامة
    const currentContractId = renewContractId;
    const currentAssetIndex = renewAssetIndex;

    closeRenewPlanModal();
    showToast("تم تجديد خطة الصيانة بنجاح!");
    
    setTimeout(() => {
        // استخدام المتغيرات المحفوظة بدلاً من المتغيرات العامة التي أصبحت null
        triggerReportRedirect(currentContractId, currentAssetIndex);
    }, 500);
}

window.autoFillMaintenance = function(stepChar) {
    let btn2000, btn4000;
    document.querySelectorAll('.maint-select-btn').forEach(b => {
        const oc = b.getAttribute('onclick') || '';
        if(oc.includes("'2000'")) btn2000 = b;
        if(oc.includes("'4000'")) btn4000 = b;
    });
    const btn8000 = document.getElementById('btn-8000-main');

    if (typeof pendingAutoFillDate !== 'undefined' && pendingAutoFillDate) {
        document.getElementById('visitDate').value = pendingAutoFillDate;
        pendingAutoFillDate = null; 
    } else {
        document.getElementById('visitDate').valueAsDate = new Date();
    }

    if (stepChar === 'A') { 
        if(btn2000) btn2000.click();
        if(btn4000) { btn4000.disabled = true; btn4000.style.opacity = '0.4'; btn4000.style.cursor = 'not-allowed'; }
        if(btn8000) { btn8000.disabled = true; btn8000.style.opacity = '0.4'; btn8000.style.cursor = 'not-allowed'; }
    } 
    else if (stepChar === 'B') { 
        if(btn4000) btn4000.click();
        if(btn2000) { btn2000.disabled = true; btn2000.style.opacity = '0.4'; btn2000.style.cursor = 'not-allowed'; }
        if(btn8000) { btn8000.disabled = true; btn8000.style.opacity = '0.4'; btn8000.style.cursor = 'not-allowed'; }
    } 
    else if (stepChar === 'C') { 
        if(btn8000) btn8000.click();
        if(btn2000) { btn2000.disabled = true; btn2000.style.opacity = '0.4'; btn2000.style.cursor = 'not-allowed'; }
        if(btn4000) { btn4000.disabled = true; btn4000.style.opacity = '0.4'; btn4000.style.cursor = 'not-allowed'; }
    }
};

let modalCloseCallback = null;

// دالة جديدة ديناميكية للـ Pop-up تقبل أي عنوان ونص
window.showCustomConfirm = function(title, message, btnText, callback) {
    modalCloseCallback = callback;
    const modal = document.getElementById('customConfirmModal');
    // تغيير النصوص داخل الـ Modal بناءً على المدخلات
    modal.querySelector('h3').innerText = title;
    modal.querySelector('p').innerText = message;
    modal.querySelector('#confirmYesBtn').innerHTML = `<i class="fa-solid fa-check"></i> ${btnText}`;
    modal.style.display = 'flex';
};

// الدالة القديمة الخاصة بقفل النوافذ (تم ربطها بالدالة الديناميكية عشان متأثرش على شغلك القديم)
window.showCloseConfirm = function(callback) {
    window.showCustomConfirm(
        "هل أنت متأكد من الإغلاق؟",
        "لم يتم حفظ البيانات، وقد تفقدها إذا قمت بالإغلاق الآن.",
        "نعم، أغلق",
        callback
    );
};

window.closeConfirmModal = function() {
    document.getElementById('customConfirmModal').style.display = 'none';
    modalCloseCallback = null;
};
const originalOnClick = window.onclick;
window.onclick = function(e) { 
    if (typeof originalOnClick === 'function') originalOnClick(e);
    
    if (e.target == document.getElementById('addMachineModal')) {
        showCloseConfirm(closeAddMachineModal);
    } else if (e.target == modal) { 
        showCloseConfirm(closeModal);
    } else if (e.target == document.getElementById('editVisitModal')) {
        showCloseConfirm(closeEditModal);
    } 
    else if (e.target == document.getElementById('waModal')) closeWAModal(); 
    else if (e.target == document.getElementById('unholdModal')) closeUnholdModal(); 
    else if (e.target == document.getElementById('machineDetailsModal')) closeMachineDetailsModal(); 
    else if (e.target == document.getElementById('inventoryModal')) closeInventoryModal(); 
    else if (e.target == document.getElementById('renewPlanModal')) closeRenewPlanModal();
    else if (e.target == document.getElementById('maintenanceConfirmModal')) closeMaintenanceConfirmModal();
    else if (e.target == document.getElementById('customConfirmModal')) closeConfirmModal();
}

// =========================================================
// --- BACKUP & RESTORE LOGIC (إدارة النسخ الاحتياطية) ---
// =========================================================

window.exportBackup = function() {
    if (contracts.length === 0) {
        showToast("لا توجد بيانات لعمل نسخة احتياطية", "error");
        return;
    }

    const dataStr = JSON.stringify(contracts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const date = new Date();
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const fileName = `CATE_System_Backup_${dateString}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("تم تحميل النسخة الاحتياطية بنجاح!");
};

window.importBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (Array.isArray(importedData)) {
                // استخدام الـ Pop-up الاحترافي الخاص بالنظام
                window.showCustomConfirm(
                    "تحذير هام جداً", 
                    "استرجاع البيانات سيقوم بمسح كافة البيانات الحالية واستبدالها بالنسخة الاحتياطية. هل أنت متأكد من الاستمرار؟", 
                    "نعم، استرجع البيانات",
                    function() {
                        contracts = importedData;
                        saveData();
                        renderAll();
                        showToast("تم استرجاع البيانات بنجاح!");
                    }
                );
            } else {
                showToast("ملف النسخة الاحتياطية غير صالح للمنظومة", "error");
            }
        } catch (error) {
            console.error("Error parsing backup file:", error);
            showToast("حدث خطأ أثناء قراءة الملف، تأكد من أنه ملف JSON صحيح", "error");
        }
        
        // تصفير الـ input عشان لو حبيت ترفع نفس الملف تاني
        event.target.value = '';
    };
    
    reader.readAsText(file);
};
// --- PRINT PDF REPORT FUNCTION ---
window.printAssetReport = function() {
    const cIdStr = document.getElementById('reportContractId').value;
    const aIdxStr = document.getElementById('reportAssetIndex').value;
    if(!cIdStr || aIdxStr === '') {
        showToast('برجاء اختيار الماكينة أولاً', 'error');
        return;
    }
    
    const cId = parseInt(cIdStr);
    const aIdx = parseInt(aIdxStr);
    
    const contract = contracts.find(x => x.id === cId);
    if(!contract || !contract.assets || !contract.assets[aIdx]) return;
    
    const asset = contract.assets[aIdx];
    
    // إخفاء ال template أثناء ملء البيانات لمنع الوميض
    const printTemplate = document.getElementById('pdf-print-template');
    printTemplate.style.display = 'block';
    
    // Fill Data
    document.getElementById('print-comp-name').innerText = contract.company;
    document.getElementById('print-asset-model').innerText = asset.name || 'غير محدد';
    document.getElementById('print-asset-serial').innerText = asset.serial || 'غير محدد';
    document.getElementById('print-asset-year').innerText = asset.year || 'غير محدد';
    document.getElementById('print-asset-hours').innerText = (asset.currentHours || 0) + ' ساعة';
    document.getElementById('print-asset-rate').innerText = (asset.dailyHours || contract.dailyHours || 0) + ' ساعة/يوم';
    
    // Maintenance Logic
    let nextIdx = asset.nextMaintenanceIndex || 0;
    let lastCompletedStr = '<div style="color:var(--text-light); font-size:0.95rem;">لا يوجد صيانة سابقة مسجلة</div>';
    let lastCompletedStatus = '';
    let nextScheduledStr = '<div style="color:var(--text-light); font-size:0.95rem;">لا توجد صيانة مجدولة</div>';
    let nextScheduledStatus = '';
    
    if (asset.maintenancePlan && asset.maintenancePlan.length > 0) {
        // Last Completed
        if (nextIdx > 0) {
            let lastChar = asset.maintenancePlan[nextIdx - 1];
            let lastHours = asset.completedStepsHours ? asset.completedStepsHours[nextIdx - 1] : (asset.planBaseHours || 0);
            let lastDate = (asset.completedStepsDates && asset.completedStepsDates[nextIdx - 1]) ? asset.completedStepsDates[nextIdx - 1] : (asset.lastUpdated || getLocalDateString());
            let label = getMaintenanceLabel(lastChar);
            lastCompletedStr = `<div style="font-weight:bold; font-size:1.15rem; margin-bottom:5px;">الصيانة المنجزة: ${label}</div><div style="font-size:1rem; color:#475569;">عند: ${lastHours} ساعة</div>`;
            lastCompletedStatus = `<span class="status-badge status-done"><i class="fa-solid fa-check"></i> مكتملة (${lastDate})</span>`;
        } else {
            lastCompletedStr = '<div style="color:var(--text-light); font-size:0.95rem;">لم يتم إتمام أي صيانة بعد</div>';
        }
        
        // Next Scheduled
        if (nextIdx < asset.maintenancePlan.length) {
            let nextChar = asset.maintenancePlan[nextIdx];
            let base = asset.planBaseHours !== undefined ? asset.planBaseHours : (asset.subType !== 'New' ? asset.currentHours : 0);
            let targetHours = base + 2000;
            let label = getMaintenanceLabel(nextChar);
            
            let currentHours = asset.currentHours || 0;
            let dailyHours = asset.dailyHours || contract.dailyHours || 0;
            let daysOff = asset.daysOff || contract.daysOff || 0;
            
            let dateDisplay = 'غير محدد';
            let hoursRemaining = targetHours - currentHours;
            
            if (hoursRemaining <= 0) {
                 dateDisplay = 'مستحقة فوراً';
            } else if (dailyHours > 0) {
                if (asset.subType && asset.subType.includes('Used')) {
                    const targetAddedHours = targetHours - base;
                    const dateCalc = calculateUsedCompressorDate(asset.startDate, dailyHours, daysOff, targetAddedHours);
                    dateDisplay = dateCalc.str;
                } else {
                    let calcBaseDate = new Date();
                    if (asset.lastUpdated) calcBaseDate = new Date(asset.lastUpdated);
                    else if (asset.currentHours === 0 && asset.startDate) calcBaseDate = new Date(asset.startDate);
                    const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                    dateDisplay = calc.str;
                }
            }
            
            nextScheduledStr = `<div style="font-weight:bold; font-size:1.15rem; margin-bottom:5px;">الصيانة القادمة: ${label}</div><div style="font-size:1rem; color:#475569;">عند: ${targetHours} ساعة</div>`;
            nextScheduledStatus = `<span class="status-badge status-pending"><i class="fa-regular fa-clock"></i> مجدولة (${dateDisplay})</span>`;
        } else {
             nextScheduledStr = '<div style="color:var(--text-light); font-size:0.95rem;">تم الانتهاء من الخطة الحالية</div>';
        }
    }
    
    document.getElementById('print-last-maint').innerHTML = lastCompletedStr;
    document.getElementById('print-last-status').innerHTML = lastCompletedStatus;
    document.getElementById('print-next-maint').innerHTML = nextScheduledStr;
    document.getElementById('print-next-status').innerHTML = nextScheduledStatus;
    
    // --- سحب المهام وقطع الغيار الحالية للطباعة ---
    let currentNotes = document.getElementById('visitNotes').value;
    if (!currentNotes || currentNotes.trim() === '') {
        currentNotes = "تم إجراء الفحص ولم يتم تسجيل تفاصيل إضافية.";
    }

    let deductedPartsText = "";
    const checkedBoxes = document.querySelectorAll('.vic-checkbox:checked');
    checkedBoxes.forEach(chk => {
        const partId = chk.value;
        const input = document.getElementById(`vic-input-${partId}`);
        const qtyToDeduct = parseInt(input.value) || 0;
        const partName = input.getAttribute('data-name');
        if (qtyToDeduct > 0) {
            deductedPartsText += `<li style="margin-bottom: 5px; font-weight:bold; color:#0f172a;">تم سحب عدد (${qtyToDeduct}) ${partName}</li>`;
        }
    });

    let oilText = "";
    const oilOption = document.querySelector('input[name="oilFilterOption"]:checked');
    if (oilOption) { 
        if (oilOption.value === '1') oilText = "<li style='margin-bottom: 5px; font-weight:bold; color:#0f172a;'>تم تغيير فلتر زيت (1)</li>"; 
        else if (oilOption.value === '2') oilText = "<li style='margin-bottom: 5px; font-weight:bold; color:#0f172a;'>تم تغيير عدد 2 فلتر زيت</li>"; 
    }

    let extraPartsText = "";
    const extraParts = document.querySelectorAll('input[name="extraParts"]:checked');
    if (extraParts.length > 0) {
        extraParts.forEach(part => {
            extraPartsText += `<li style="margin-bottom: 5px; font-weight:bold; color:#0f172a;">${part.value}</li>`;
        });
    }

    let reportHtml = `<div style="white-space: pre-line; font-size: 1.1rem; color: #1e293b;"><strong>الأعمال المنفذة والملاحظات:</strong><br><br>${currentNotes}</div>`;
    
    if (deductedPartsText !== "" || oilText !== "" || extraPartsText !== "") {
        reportHtml += `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1;">
                        <strong style="color: #ef4444; font-size:1.1rem;"><i class="fa-solid fa-boxes-stacked"></i> قطع الغيار المستهلكة في هذه الزيارة:</strong>
                        <ul style="margin-top: 10px; padding-right: 20px; color: #334155;">
                            ${oilText}${extraPartsText}${deductedPartsText}
                        </ul>
                       </div>`;
    }

    let printCurrentVisitDiv = document.getElementById('print-current-visit');
    if(printCurrentVisitDiv) {
        printCurrentVisitDiv.innerHTML = reportHtml;
    }

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printTemplate.style.display = 'none';
        }, 500);
    }, 100);
};

// --- PRINT FULL COMPREHENSIVE PDF REPORT FUNCTION ---
window.printFullContractPDF = function() {
    if(!currentAssetContractId) {
        showToast('برجاء الدخول على شركة أولاً', 'error');
        return;
    }

    const c = contracts.find(x => x.id === currentAssetContractId);
    
    if(!c || !c.assets || c.assets.length === 0) {
        showToast("لا توجد ماكينات مسجلة في هذا العقد لطباعة التقرير.", "error");
        return;
    }

    const printTemplate = document.getElementById('pdf-comp-report-template');
    printTemplate.style.display = 'block';

    // تعبئة البيانات الأساسية (اسم الشركة والتاريخ)
    document.getElementById('print-comp-full-name').innerText = c.company;
    const today = new Date();
    document.getElementById('print-comp-date').innerText = `تاريخ استخراج التقرير: ${today.toLocaleDateString('ar-EG')}`;

    let reportHtml = '';

    // إحصائية سريعة لعدد الماكينات
    const compCount = c.assets.filter(a => a.type === 'compressor').length;
    const dryerCount = c.assets.filter(a => a.type === 'dryer').length;
    const vacCount = c.assets.filter(a => a.type === 'vacuum').length;

    reportHtml += `<div style="margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 2px solid #006F8F; border-radius: 12px; display: flex; justify-content: space-around; font-weight: bold; font-size: 1.1rem; color: #0f172a;">
        <span><i class="fa-solid fa-wind" style="color:#006F8F;"></i> كمبريسور: ${compCount}</span>
        <span><i class="fa-solid fa-temperature-arrow-down" style="color:#f97316;"></i> مجفف: ${dryerCount}</span>
        <span><i class="fa-solid fa-fan" style="color:#8b5cf6;"></i> طلمبة تفريغ: ${vacCount}</span>
    </div>`;

    // المرور على كل ماكينة وسحب بياناتها
    c.assets.forEach((a, index) => {
        let icon, typeName, titleBg, bodyBg;
        
        if (a.type === 'compressor') {
            icon = 'fa-wind'; typeName = 'Compressor'; titleBg = '#006F8F'; bodyBg = '#f0f9ff';
        } else if (a.type === 'dryer') {
            icon = 'fa-temperature-arrow-down'; typeName = 'Dryer'; titleBg = '#ea580c'; bodyBg = '#fff7ed';
        } else {
            icon = 'fa-fan'; typeName = 'Vacuum Pump'; titleBg = '#7c3aed'; bodyBg = '#f5f3ff';
        }
        reportHtml += `<div class="print-box" style="margin-bottom: 25px; border-color: ${titleBg}; page-break-inside: avoid;">
        <div class="print-box-title" style="background: ${titleBg} !important; color: white !important; justify-content: center; font-size: 1.25rem;">
            <i class="fa-solid ${icon}"></i> 
            <span>الماكينة (${index + 1})</span>
            <span style="margin: 0 10px;">-</span>
            <span dir="ltr" style="font-weight: 900; letter-spacing: 0.5px;">${a.name}</span>
            <span dir="ltr" style="opacity: 0.85; font-size: 1rem; margin-right: 8px;">(${typeName})</span>
        </div>
        <div class="print-box-content" style="background: ${bodyBg} !important; padding: 15px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.95rem;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 33%;"><strong>الرقم التسلسلي (S/N):</strong> ${a.serial || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 33%;"><strong>سنة التصنيع:</strong> ${a.year || '-'}</td>`;

        if (a.type === 'compressor') {
            reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>معدل التشغيل:</strong> ${a.dailyHours || c.dailyHours || 0} ساعة/يوم</td></tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: white;" colspan="3"><strong>ساعات التشغيل المسجلة:</strong> <span style="color:#ef4444; font-weight:bold;">${a.currentHours || 0} ساعة</span></td>
            </tr></table>`;
            
            // جدول الصيانة الخاص بالكمبريسور
            reportHtml += `<h4 style="margin: 0 0 10px 0; color: ${titleBg};"><i class="fa-solid fa-list-check"></i> جدول خطة الصيانة (Maintenance Plan):</h4>`;
            
            if (a.maintenancePlan && a.maintenancePlan.length > 0) {
                let nextIdx = a.nextMaintenanceIndex || 0;
                let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
                const currentHours = a.currentHours || 0;
                const dailyHours = a.dailyHours || 0;
                const daysOff = a.daysOff || 0;

                reportHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #e2e8f0;">
                            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">نوع الصيانة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الساعات المستهدفة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الحالة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody style="background: white;">`;

                for(let i=0; i<a.maintenancePlan.length; i++) {
                    let stepChar = a.maintenancePlan[i];
                    let target = base + ((i - nextIdx + 1) * 2000);
                    let label = getMaintenanceLabel(stepChar);

                    if (i < nextIdx) {
                        // الصيانة المنفذة
                        let actualHours = a.completedStepsHours ? a.completedStepsHours[i] : "تمت ضمناً";
                        let actualDate = (a.completedStepsDates && a.completedStepsDates[i]) ? a.completedStepsDates[i] : "منفذة مسبقاً";
                        reportHtml += `<tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${label}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">عند ${actualHours} ساعة</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">✔️ مكتملة</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">${actualDate}</td>
                        </tr>`;
                    } else {
                        // الصيانة القادمة
                        let hoursRemaining = target - currentHours;
                        let dateStr = 'غير محدد';
                        let statusColor = '#d97706';
                        let statusText = '🕒 مجدولة';

                        if (hoursRemaining <= 0) {
                            statusColor = '#ef4444';
                            statusText = '🔴 مستحقة فوراً';
                            dateStr = 'مطلوبة الآن';
                        } else if (dailyHours > 0) {
                            if (a.subType && a.subType.includes('Used')) {
                                const targetAddedHours = target - base;
                                const dateCalc = calculateUsedCompressorDate(a.startDate, dailyHours, daysOff, targetAddedHours);
                                dateStr = dateCalc.str;
                            } else {
                                let calcBaseDate = new Date();
                                if (a.lastUpdated) calcBaseDate = new Date(a.lastUpdated);
                                else if (a.currentHours === 0 && a.startDate) calcBaseDate = new Date(a.startDate);

                                const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                                dateStr = calc.str;
                            }
                        }

                        reportHtml += `<tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${label}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">عند ${target} ساعة</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${dateStr}</td>
                        </tr>`;
                    }
                }
                reportHtml += `</tbody></table>`;
            } else {
                reportHtml += `<p style="color: #ef4444; font-weight: bold; margin: 0;">⚠️ لا توجد خطة صيانة مسجلة أو الماكينة معلقة.</p>`;
            }

        } else if (a.type === 'dryer') {
            reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>نوع الفريون:</strong> ${a.freon || '-'}</td></tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: white;" colspan="3"><strong>القدرة (Capacity):</strong> <span style="font-weight:bold;">${a.capacity || '-'}</span></td>
            </tr></table>`;
            reportHtml += `<p style="color: #ea580c; font-size: 0.9rem; margin: 0;"><i class="fa-solid fa-wrench"></i> <strong>الصيانة:</strong> يتم الفحص وتغيير طقم التصريف (Auto Drain) بشكل دوري مع زيارات العقد.</p>`;
        } else if (a.type === 'vacuum') {
            reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>الضغط:</strong> ${a.bar || '-'} Bar</td></tr></table>`;
            reportHtml += `<p style="color: #7c3aed; font-size: 0.9rem; margin: 0;"><i class="fa-solid fa-gears"></i> <strong>الصيانة:</strong> يتم فحص أداء طلمبة التفريغ وعمل الصيانات اللازمة خلال الزيارات الدورية.</p>`;
        }

        reportHtml += `</div></div>`;
    });

    document.getElementById('comp-report-body').innerHTML = reportHtml;

    // استدعاء نافذة الطباعة بعد تحضير الـ HTML
    setTimeout(() => {
        window.print();
        // إخفاء القالب بعد الطباعة لمنع ظهوره في واجهة المستخدم
        setTimeout(() => {
            printTemplate.style.display = 'none';
        }, 500);
    }, 100);
};

// --- PRINT SINGLE ASSET PDF REPORT (HISTORY & PLAN) ---
window.printSingleAssetPDF = function(assetIndex) {
    if(!currentAssetContractId) return;
    const c = contracts.find(x => x.id === currentAssetContractId);
    if(!c || !c.assets || !c.assets[assetIndex]) return;
    
    const a = c.assets[assetIndex];
    const printTemplate = document.getElementById('pdf-comp-report-template');
    printTemplate.style.display = 'block';

    // تعبئة البيانات الأساسية (اسم الشركة والتاريخ)
    document.getElementById('print-comp-full-name').innerText = c.company;
    const today = new Date();
    document.getElementById('print-comp-date').innerText = `تاريخ استخراج التقرير: ${today.toLocaleDateString('ar-EG')}`;

    let icon, typeName, titleBg, bodyBg;
    if (a.type === 'compressor') { icon = 'fa-wind'; typeName = 'Compressor'; titleBg = '#006F8F'; bodyBg = '#f0f9ff'; }
    else if (a.type === 'dryer') { icon = 'fa-temperature-arrow-down'; typeName = 'Dryer'; titleBg = '#ea580c'; bodyBg = '#fff7ed'; }
    else { icon = 'fa-fan'; typeName = 'Vacuum Pump'; titleBg = '#7c3aed'; bodyBg = '#f5f3ff'; }

    let reportHtml = `
    <div style="text-align:center; margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 2px solid ${titleBg}; border-radius: 12px;">
        <h2 style="color: ${titleBg}; margin: 0 0 5px 0;">السجل الفني للماكينة: <span dir="ltr" style="font-weight: 900;">${a.name}</span></h2>
        <span dir="ltr" style="color: #64748b; font-size: 1.1rem; font-weight: bold;">(${typeName})</span>
    </div>`;

    // 1. بيانات الماكينة الأساسية
    reportHtml += `<div class="print-box" style="margin-bottom: 25px; border-color: ${titleBg}; page-break-inside: avoid;">
        <div class="print-box-title" style="background: ${titleBg} !important; color: white !important; font-size: 1.15rem;">
            <i class="fa-solid fa-microchip"></i> بيانات الماكينة الأساسية
        </div>
        <div class="print-box-content" style="background: ${bodyBg} !important; padding: 15px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 0.95rem;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 33%;"><strong>الرقم التسلسلي (S/N):</strong> ${a.serial || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 33%;"><strong>سنة التصنيع:</strong> ${a.year || '-'}</td>`;

    if (a.type === 'compressor') {
        reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>معدل التشغيل:</strong> ${a.dailyHours || c.dailyHours || 0} ساعة/يوم</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: white;" colspan="3"><strong>ساعات التشغيل المسجلة (حتى تاريخه):</strong> <span style="color:#ef4444; font-weight:bold;">${a.currentHours || 0} ساعة</span></td></tr></table></div></div>`;

        // 2. خطة الصيانة للكمبريسور
        reportHtml += `<div class="print-box" style="margin-bottom: 25px; border-color: #059669; page-break-inside: avoid;">
            <div class="print-box-title" style="background: #059669 !important; color: white !important; font-size: 1.15rem;">
                <i class="fa-solid fa-list-check"></i> الموقف الحالي لخطة الصيانة (Maintenance Plan)
            </div>
            <div class="print-box-content" style="background: #f0fdf4 !important; padding: 15px;">`;

        if (a.maintenancePlan && a.maintenancePlan.length > 0) {
            let nextIdx = a.nextMaintenanceIndex || 0;
            let base = a.planBaseHours !== undefined ? a.planBaseHours : (a.subType !== 'New' ? a.currentHours : 0);
            const currentHours = a.currentHours || 0;
            const dailyHours = a.dailyHours || 0;
            const daysOff = a.daysOff || 0;

            reportHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: #e2e8f0;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">نوع الصيانة</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الساعات المستهدفة</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الحالة</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">التاريخ المتوقع</th>
                    </tr>
                </thead><tbody style="background: white;">`;

            for(let i=0; i<a.maintenancePlan.length; i++) {
                let stepChar = a.maintenancePlan[i];
                let target = base + ((i - nextIdx + 1) * 2000);
                let label = getMaintenanceLabel(stepChar);

                if (i < nextIdx) {
                    let actualHours = a.completedStepsHours ? a.completedStepsHours[i] : "تمت ضمناً";
                    let actualDate = (a.completedStepsDates && a.completedStepsDates[i]) ? a.completedStepsDates[i] : "منفذة مسبقاً";
                    reportHtml += `<tr>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${label}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">عند ${actualHours} ساعة</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">✔️ مكتملة</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">${actualDate}</td>
                    </tr>`;
                } else {
                    let hoursRemaining = target - currentHours;
                    let dateStr = 'غير محدد';
                    let statusColor = '#d97706';
                    let statusText = '🕒 مجدولة';

                    if (hoursRemaining <= 0) {
                        statusColor = '#ef4444'; statusText = '🔴 مستحقة فوراً'; dateStr = 'مطلوبة الآن';
                    } else if (dailyHours > 0) {
                        if (a.subType && a.subType.includes('Used')) {
                            const targetAddedHours = target - base;
                            const dateCalc = calculateUsedCompressorDate(a.startDate, dailyHours, daysOff, targetAddedHours);
                            dateStr = dateCalc.str;
                        } else {
                            let calcBaseDate = new Date();
                            if (a.lastUpdated) calcBaseDate = new Date(a.lastUpdated);
                            else if (a.currentHours === 0 && a.startDate) calcBaseDate = new Date(a.startDate);
                            const calc = calculateDate(calcBaseDate, dailyHours, daysOff, hoursRemaining);
                            dateStr = calc.str;
                        }
                    }
                    reportHtml += `<tr>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${label}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">عند ${target} ساعة</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${dateStr}</td>
                    </tr>`;
                }
            }
            reportHtml += `</tbody></table></div></div>`;
        } else {
            reportHtml += `<p style="color: #ef4444; font-weight: bold; margin: 0;">⚠️ لا توجد خطة صيانة مجدولة حالياً.</p></div></div>`;
        }
    } else if (a.type === 'dryer') {
        reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>نوع الفريون:</strong> ${a.freon || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: white;" colspan="3"><strong>القدرة (Capacity):</strong> <span style="font-weight:bold;">${a.capacity || '-'}</span></td></tr></table></div></div>`;
    } else if (a.type === 'vacuum') {
        reportHtml += `<td style="padding: 8px; border: 1px solid #cbd5e1; background: white; width: 34%;"><strong>الضغط:</strong> ${a.bar || '-'} Bar</td></tr></table></div></div>`;
    }

    // 3. سجل الزيارات السابق (History Log)
    // سحب الفلترة بناءً على الـ assetIndex الخاص بالماكينة وترتيبهم من الأحدث للأقدم
    const assetHistory = (c.history || []).filter(h => h.assetIndex == assetIndex).sort((a,b) => new Date(b.date) - new Date(a.date));

    reportHtml += `<div class="print-box" style="border-color: #475569;">
        <div class="print-box-title" style="background: #475569 !important; color: white !important; font-size: 1.15rem;">
            <i class="fa-solid fa-clock-rotate-left"></i> سجل الزيارات والصيانات السابقة (History Log)
        </div>
        <div class="print-box-content" style="background: white !important; padding: 20px;">`;

    if(assetHistory.length === 0) {
        reportHtml += `<div style="text-align:center; color: #64748b; padding: 20px; font-weight: bold;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><br>لم يتم تسجيل أي زيارات سابقة لهذه الماكينة حتى الآن.</div>`;
    } else {
        assetHistory.forEach((h, i) => {
            reportHtml += `
            <div style="border-bottom: ${i === assetHistory.length - 1 ? 'none' : '2px dashed #e2e8f0'}; padding-bottom: 15px; margin-bottom: 15px; page-break-inside: avoid;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="background: #e2e8f0; color: #0f172a; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.95rem;">
                        <i class="fa-regular fa-calendar-check" style="color: #006F8F;"></i> ${h.date}
                    </span>
                </div>
                <div style="white-space: pre-wrap; font-size: 1rem; color:#334155; line-height: 1.6; padding-right: 15px; border-right: 3px solid #cbd5e1;">${h.notes}</div>
            </div>`;
        });
    }
    reportHtml += `</div></div>`;

    // تعبئة البيانات في قالب الطباعة
    document.getElementById('comp-report-body').innerHTML = reportHtml;

    // استدعاء نافذة الطباعة
    setTimeout(() => {
        window.print();
        setTimeout(() => { printTemplate.style.display = 'none'; }, 500);
    }, 100);
};

// --- دالة فتح واتساب الشركة بدون رسائل مسبقة ---
window.sendCompanyGreetingWA = function() {
    if(!currentAssetContractId) return;
    const c = contracts.find(x => x.id === currentAssetContractId);
    if(!c) return;

    const phone = formatPhone(c.phone);
    
    // فتح الواتساب باستخدام الرقم فقط بدون أي نص
    window.open(`https://wa.me/${phone}`, '_blank');
};