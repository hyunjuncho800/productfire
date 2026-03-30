/**
 * Intelligent Variable FIRE - UI App Module (v7.0 Wealth)
 */

let assetChartInst = null;
let incomeChartInst = null;
let accelChartInst = null;

const formatKrw = (val) => new Intl.NumberFormat('ko-KR').format(val);
const formatKrwSmall = (val) => {
    let num = Math.round(val);
    if(num >= 10000) return (num/10000).toFixed(1) + '억';
    if(num <= -10000) return (num/10000).toFixed(1) + '억';
    return num + '만';
};

// State
let lifeEvents = [];
let currentTheme = 'light'; 

const IDS = [
    'age', 'targetAge', 'salary', 'inflationRate', 
    'cash', 'stock', 'realestate', 'expense',
    'stockReturn', 'stockRatio', 'realestateReturn',
    'divYield', 'divGrowth', 'peakAge', 'incomeDecayRate'
];

let renderFrame = null;
function triggerSimulationThrottled() {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
        triggerSimulation();
    });
}

/**
 * SPA Page Navigation Logic
 */
function initNavigation() {
    const btnRun = document.getElementById('btnRunSimulation');
    const btnBack = document.getElementById('btnBackToInputs');
    const pageInputs = document.getElementById('page-inputs');
    const pageResults = document.getElementById('page-results');

    if (btnRun) {
        btnRun.addEventListener('click', () => {
            // Switch Page
            pageInputs.classList.remove('active');
            pageResults.classList.add('active');
            
            // Trigger Calc & Render
            triggerSimulation();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            pageResults.classList.remove('active');
            pageInputs.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function bindResponsiveInputs() {
    IDS.forEach(id => {
        const rangeEl = document.getElementById(id);
        const numEl = document.getElementById(id + '_num');
        if (rangeEl && numEl) {
            // Two-way binding
            rangeEl.addEventListener('input', (e) => {
                numEl.value = e.target.value;
                // We don't trigger simulation on every slide in Page 1 to save resources,
                // results are shown on Page 2 via 'Run' button.
            });
            numEl.addEventListener('input', (e) => {
                rangeEl.value = e.target.value;
            });
        }
    });

    // Option toggles
    const reinvestDiv = document.getElementById('reinvestDiv');
    const stressTest = document.getElementById('stressTest');
    
    // We can still allow background updates if Page 2 is active
    const checkAndUpdate = () => {
        if (document.getElementById('page-results').classList.contains('active')) {
            triggerSimulationThrottled();
        }
    };

    if (reinvestDiv) reinvestDiv.addEventListener('change', checkAndUpdate);
    if (stressTest) stressTest.addEventListener('change', checkAndUpdate);

    document.querySelectorAll('input[name="accountType"]').forEach(r => {
        r.addEventListener('change', checkAndUpdate);
    });
}

function initThemeToggle() {
    const sw = document.getElementById('themeSwitch');
    const icon = document.getElementById('themeIcon');
    
    const applyTheme = (isDark) => {
        if(isDark) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            icon.innerText = 'dark_mode';
            currentTheme = 'dark';
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            icon.innerText = 'light_mode';
            currentTheme = 'light';
        }
        // Force chart update only if result page is active
        if (document.getElementById('page-results').classList.contains('active')) {
            triggerSimulationThrottled();
        }
    };
    
    // Check local storage or OS preference
    const savedTheme = localStorage.getItem('fire-theme');
    let isDarkInitial = false;
    
    if (savedTheme) {
        isDarkInitial = savedTheme === 'dark';
    } else {
        isDarkInitial = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    sw.checked = isDarkInitial;
    applyTheme(isDarkInitial);
    
    sw.addEventListener('change', (e) => {
        const isDark = e.target.checked;
        applyTheme(isDark);
        localStorage.setItem('fire-theme', isDark ? 'dark' : 'light');
    });
}

function init() {
    bindResponsiveInputs();
    initThemeToggle();
    initNavigation();
}

function getBaseInputs() {
    return {
        age: parseInt(document.getElementById('age').value || 30),
        targetAge: parseInt(document.getElementById('targetAge').value || 45),
        salary: parseInt(document.getElementById('salary').value || 400),
        inflationRate: parseFloat(document.getElementById('inflationRate').value || 2.5),
        cash: parseInt(document.getElementById('cash').value || 0),
        stock: parseInt(document.getElementById('stock').value || 0),
        realestate: parseInt(document.getElementById('realestate').value || 0),
        expense: parseInt(document.getElementById('expense').value || 300),
        stockReturn: parseFloat(document.getElementById('stockReturn').value || 0),
        realestateReturn: parseFloat(document.getElementById('realestateReturn').value || 0),
        stockRatio: parseInt(document.getElementById('stockRatio').value || 0),
        lifeEvents: [...lifeEvents],
        
        divYield: parseFloat(document.getElementById('divYield').value || 0),
        divGrowth: parseFloat(document.getElementById('divGrowth').value || 0),
        accountType: document.querySelector('input[name="accountType"]:checked').value,
        reinvestDiv: document.getElementById('reinvestDiv').checked,
        
        peakAge: parseInt(document.getElementById('peakAge').value || 50),
        incomeDecayRate: parseFloat(document.getElementById('incomeDecayRate').value || 15)
    };
}

function triggerSimulation() {
    const isStressActive = document.getElementById('stressTest').checked;
    let baseInputs = getBaseInputs();
    baseInputs.isStressTest = false;
    
    let userResult = runSimulation(baseInputs);
    
    let stressResult = null;
    if (isStressActive) {
        let stressInputs = getBaseInputs();
        stressInputs.isStressTest = true;
        stressResult = runSimulation(stressInputs);
    }
    
    let inputsNoDiv = getBaseInputs(); inputsNoDiv.divYield = 0; inputsNoDiv.reinvestDiv = false;
    let resNoDiv = runSimulation(inputsNoDiv);

    let inputsDivNoReinvest = getBaseInputs(); inputsDivNoReinvest.reinvestDiv = false;
    let resDivNoRe = runSimulation(inputsDivNoReinvest);

    let inputsDivReinvest = getBaseInputs(); inputsDivReinvest.reinvestDiv = true;
    let resDivRe = runSimulation(inputsDivReinvest);

    updateMetrics(userResult, Object.assign({}, baseInputs));
    updateBigMacIndex(baseInputs.inflationRate, baseInputs.age, baseInputs.targetAge);
    
    updateBanner(resNoDiv.fireAge, resDivRe.fireAge);

    renderMainCharts(userResult.history, stressResult?.history, userResult.fireAge, baseInputs.targetAge);
    renderAccelChart(resNoDiv.history, resDivNoRe.history, resDivRe.history);
}

function updateBanner(fireAgeNoDiv, fireAgeReinvest) {
    const banner = document.getElementById('accelerationBanner');
    const textEl = document.getElementById('accelText');
    
    if (fireAgeNoDiv && fireAgeReinvest) {
        let diff = (fireAgeNoDiv - fireAgeReinvest).toFixed(1);
        if (diff > 0) {
            banner.classList.remove('hidden');
            textEl.innerText = `가속 로직 발동! 절세 및 스노우볼 재투자로 조기 은퇴가 ${diff}년 앞당겨졌습니다!`;
        } else {
            banner.classList.add('hidden');
        }
    } else {
        banner.classList.add('hidden');
    }
}

function updateMetrics(baseRes, inputs) {
    let elAge = document.getElementById('resAge');
    let elDelay = document.getElementById('resAgeDelay');
    
    if(baseRes.fireAge) {
        elAge.innerText = baseRes.fireAge + "세";
        elDelay.innerText = "파이어 조건 통과 (안정권)";
        elDelay.className = 'metric-sub';
    } else {
        elAge.innerText = "달성 불가";
        elDelay.innerText = "-";
        elDelay.className = 'metric-sub text-error';
    }
    
    let elTargetAsset = document.getElementById('resTargetGapAsset');
    if (baseRes.requiredAssetAtTargetAge) {
        elTargetAsset.innerText = (baseRes.requiredAssetAtTargetAge / 10000).toFixed(1) + "억 원";
    } else {
        elTargetAsset.innerText = "-";
    }
    
    let elGap = document.getElementById('resGapAmount');
    let elGapLabel = document.getElementById('resGapLabel');
    if (baseRes.assetAtTargetAge !== null && baseRes.requiredAssetAtTargetAge !== null) {
        let gap = baseRes.assetAtTargetAge - baseRes.requiredAssetAtTargetAge;
        if (gap >= 0) {
            elGap.innerText = "+" + formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value text-success font-hero";
            elGapLabel.innerText = `${inputs.targetAge}세 자금 확보 완료`;
        } else {
            elGap.innerText = formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value text-error font-hero";
            elGapLabel.innerText = `목표 도달을 위해 부족한 금액`;
        }
    }
}

function updateBigMacIndex(inflationRate, currentAge, targetAge) {
    const BIG_MAC_PRICE = 5500; 
    let elMacFuture = document.getElementById('macFuture');
    document.getElementById('lblInf').innerText = inflationRate;
    let yearsDelta = Math.max(0, targetAge - currentAge);
    let futurePrice = BIG_MAC_PRICE * Math.pow(1 + inflationRate/100, yearsDelta);
    elMacFuture.innerText = formatKrw(Math.round(futurePrice));
}

// Chart 1 & 2: Assets & Income
function renderMainCharts(history, stressHistory, fireAge, targetAge) {
    if(!history || history.length === 0) return;
    
    const xCategories = history.map(h => h.age + '세');
    const cashData = history.map(h => h.cash);
    const stockData = history.map(h => h.stock);
    const realData = history.map(h => h.realestate);
    const targetData = history.map(h => h.target);
    const incomeData = history.map(h => h.income);
    const expenseData = history.map(h => h.expense);

    let annotations = { xaxis: [] };
    
    if (targetAge) {
        annotations.xaxis.push({
            x: targetAge + '세', strokeDashArray: 5, borderColor: '#1d4ed8',
            label: { borderColor: '#1d4ed8', style: { color: '#fff', background: '#1d4ed8' }, text: '희망 은퇴' }
        });
    }

    if(fireAge) {
        annotations.xaxis.push({
            x: fireAge + '세', strokeDashArray: 0, borderColor: '#10b981',
            label: { borderColor: '#10b981', style: { color: '#fff', background: '#10b981' }, text: '목표 달성 지점' }
        });
    }

    let assetSeries = [
        { name: "부동산", data: realData }, { name: "주식/펀드", data: stockData }, 
        { name: "현금", data: cashData }, { name: "안전마진 목표선", type: 'line', data: targetData }
    ];
    let colors = ['#f59e0b', '#1d4ed8', '#64748b', '#10b981'];
    if(currentTheme === 'dark') { colors[0] = '#fbbf24'; colors[1] = '#3b82f6'; colors[2] = '#94a3b8'; colors[3] = '#34d399'; }

    let strokeConf = { width: [2, 2, 2, 4], curve: 'smooth', dashArray: [0,0,0,8] };
    
    if(stressHistory) {
        let stressData = stressHistory.map(h => h.total);
        assetSeries.push({ name: "스트레스 위기자산", type: 'line', data: stressData });
        colors.push(currentTheme === 'dark' ? '#fca5a5' : '#ef4444'); strokeConf.width.push(2); strokeConf.dashArray.push(5);
    }

    let cTheme = currentTheme;
    let fontF = 'Noto Sans KR, Roboto, sans-serif';

    if(assetChartInst) {
        assetChartInst.updateOptions({ theme: { mode: cTheme }, annotations, stroke: strokeConf, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(document.querySelector("#assetChart"), {
            series: assetSeries, theme: { mode: cTheme },
            chart: { background: 'transparent', type: 'area', height: 420, stacked: false, fontFamily: fontF, toolbar: { show: false }, animations: { enabled: true } },
            stroke: strokeConf, colors: colors,
            fill: { type: ['gradient','gradient','gradient','solid','solid'], opacity: [0.2, 0.3, 0.4, 1, 1] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top', fontWeight: 600 }, annotations: annotations
        });
        assetChartInst.render();
    }

    let incomeColors = currentTheme === 'dark' ? ['#3b82f6', '#fca5a5'] : ['#1d4ed8', '#ef4444'];
    if(incomeChartInst) {
        incomeChartInst.updateOptions({ theme: { mode: cTheme }, colors: incomeColors });
        incomeChartInst.updateSeries([ { name: "근로 월 소득", data: incomeData }, { name: "필수 월 지출 (건보료 포함)", data: expenseData } ]);
    } else {
        incomeChartInst = new ApexCharts(document.querySelector("#incomeChart"), {
            series: [{ name: "근로 월 소득", data: incomeData }, { name: "필수 월 지출 (건보료 포함)", data: expenseData }],
            theme: { mode: cTheme }, chart: { background: 'transparent', type: 'line', height: 320, fontFamily: fontF, toolbar: { show: false }, animations: { enabled: true } },
            colors: incomeColors, stroke: { width: 4, curve: 'smooth', dashArray: [0, 8] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top', fontWeight: 600 }
        });
        incomeChartInst.render();
    }
}

// Chart 3: Acceleration 3-Lines
function renderAccelChart(hNoDiv, hNoRe, hRe) {
    if(!hNoDiv || hNoDiv.length === 0) return;
    const xCategories = hNoDiv.map(h => h.age + '세');
    
    let series = [
        { name: "1. 배당금 재투자 안함 (기본 시세차익)", data: hNoDiv.map(h => h.total) },
        { name: "2. 배당금을 단순 소비하는 경우", data: hNoRe.map(h => h.total) },
        { name: "3. 배당금 전액 무한 스노우볼 재투자", data: hRe.map(h => h.total) }
    ];
    let colors = currentTheme === 'dark' ? ['#94a3b8', '#fca5a5', '#3b82f6'] : ['#64748b', '#ef4444', '#1d4ed8'];

    if(accelChartInst) {
        accelChartInst.updateOptions({ theme: { mode: currentTheme }, colors });
        accelChartInst.updateSeries(series);
    } else {
        accelChartInst = new ApexCharts(document.querySelector("#accelChart"), {
            series: series, theme: { mode: currentTheme },
            chart: { type: 'line', height: 350, fontFamily: 'Noto Sans KR', toolbar: { show: false }, background: 'transparent', animations: { enabled: true } },
            colors: colors, stroke: { width: [3, 3, 5], curve: 'smooth' },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top', fontWeight: 600 }
        });
        accelChartInst.render();
    }
}

document.addEventListener('DOMContentLoaded', init);
