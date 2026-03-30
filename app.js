/**
 * Intelligent Variable FIRE - UI App Module (v6.0 MD3 & Smart KR-FIRE)
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

function bindResponsiveInputs() {
    IDS.forEach(id => {
        const rangeEl = document.getElementById(id);
        const numEl = document.getElementById(id + '_num');
        if (rangeEl && numEl) {
            // Two-way binding
            rangeEl.addEventListener('input', (e) => {
                numEl.value = e.target.value;
                triggerSimulationThrottled();
            });
            numEl.addEventListener('input', (e) => {
                rangeEl.value = e.target.value;
                triggerSimulationThrottled();
            });
        }
    });

    const reinvestDiv = document.getElementById('reinvestDiv');
    const stressTest = document.getElementById('stressTest');
    if (reinvestDiv) reinvestDiv.addEventListener('change', triggerSimulationThrottled);
    if (stressTest) stressTest.addEventListener('change', triggerSimulationThrottled);

    document.querySelectorAll('input[name="accountType"]').forEach(r => {
        r.addEventListener('change', triggerSimulationThrottled);
    });
}

document.getElementById('addEventBtn')?.addEventListener('click', () => {
    const age = parseInt(document.getElementById('eventAge').value);
    const amt = parseInt(document.getElementById('eventAmount').value);
    if (!age || !amt) return;
    lifeEvents.push({ age, amount: amt });
    lifeEvents.sort((a,b) => a.age - b.age);
    renderEventList();
    triggerSimulationThrottled();
});

function removeEvent(idx) {
    lifeEvents.splice(idx, 1);
    renderEventList();
    triggerSimulationThrottled();
}

function renderEventList() {
    const ul = document.getElementById('eventList');
    if(!ul) return;
    ul.innerHTML = '';
    lifeEvents.forEach((e, idx) => {
        const li = document.createElement('li');
        li.className = 'event-item';
        let cls = e.amount > 0 ? 'text-success' : 'text-error';
        let sign = e.amount > 0 ? '+' : '';
        li.innerHTML = `
            <span>${e.age}세</span>
            <span class="${cls}" style="font-weight:600;">${sign}${formatKrw(e.amount)}만 원</span>
            <button class="event-del material-symbols-outlined" onclick="removeEvent(${idx})">close</button>
        `;
        ul.appendChild(li);
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
        triggerSimulationThrottled();
    };
    
    // Auto detect OS preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    sw.checked = prefersDark;
    applyTheme(prefersDark);
    
    sw.addEventListener('change', (e) => applyTheme(e.target.checked));
}

function init() {
    bindResponsiveInputs();
    initThemeToggle();
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

    let inputsGeneralAcc = getBaseInputs(); inputsGeneralAcc.accountType = 'general'; inputsGeneralAcc.reinvestDiv = true;
    let resTaxGeneral = runSimulation(inputsGeneralAcc);
    
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
            elGap.className = "metric-value text-success";
            elGapLabel.innerText = `${inputs.targetAge}세 자금 확보 완료`;
        } else {
            elGap.innerText = formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value text-error";
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

// Chart 1 & 2: Assets & Income (With MD3 Colors)
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
            x: targetAge + '세', strokeDashArray: 5, borderColor: '#1A73E8',
            label: { borderColor: '#1A73E8', style: { color: '#fff', background: '#1A73E8' }, text: '희망 은퇴' }
        });
    }

    if(fireAge) {
        annotations.xaxis.push({
            x: fireAge + '세', strokeDashArray: 0, borderColor: '#188038',
            label: { borderColor: '#188038', style: { color: '#fff', background: '#188038' }, text: '목표 달성 지점' }
        });
    }

    let assetSeries = [
        { name: "부동산", data: realData }, { name: "주식/펀드", data: stockData }, 
        { name: "현금", data: cashData }, { name: "안전마진 목표선", type: 'line', data: targetData }
    ];
    let colors = ['#F29900', '#1A73E8', '#9AA0A6', '#188038'];
    if(currentTheme === 'dark') { colors[0] = '#FCD663'; colors[1] = '#8AB4F8'; colors[2] = '#5F6368'; colors[3] = '#81C995'; }

    let strokeConf = { width: [2, 2, 2, 3], curve: 'smooth', dashArray: [0,0,0,4] };
    
    if(stressHistory) {
        let stressData = stressHistory.map(h => h.total);
        assetSeries.push({ name: "스트레스 위기자산", type: 'line', data: stressData });
        colors.push(currentTheme === 'dark' ? '#F28B82' : '#D93025'); strokeConf.width.push(2); strokeConf.dashArray.push(5);
    }

    let cTheme = currentTheme;
    let fontF = 'Google Sans, Roboto, sans-serif';

    if(assetChartInst) {
        assetChartInst.updateOptions({ theme: { mode: cTheme }, annotations, stroke: strokeConf, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(document.querySelector("#assetChart"), {
            series: assetSeries, theme: { mode: cTheme },
            chart: { background: 'transparent', type: 'area', height: 420, stacked: false, fontFamily: fontF, toolbar: { show: false }, animations: { enabled: false } },
            stroke: strokeConf, colors: colors,
            fill: { type: ['gradient','gradient','gradient','solid','solid'], opacity: [0.3, 0.4, 0.6, 1, 1] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }, annotations: annotations
        });
        assetChartInst.render();
    }

    let incomeColors = currentTheme === 'dark' ? ['#8AB4F8', '#F28B82'] : ['#1A73E8', '#D93025'];
    if(incomeChartInst) {
        incomeChartInst.updateOptions({ theme: { mode: cTheme }, colors: incomeColors });
        incomeChartInst.updateSeries([ { name: "근로 월 소득", data: incomeData }, { name: "필수 월 지출 (건보료 포함)", data: expenseData } ]);
    } else {
        incomeChartInst = new ApexCharts(document.querySelector("#incomeChart"), {
            series: [{ name: "근로 월 소득", data: incomeData }, { name: "필수 월 지출 (건보료 포함)", data: expenseData }],
            theme: { mode: cTheme }, chart: { background: 'transparent', type: 'line', height: 320, fontFamily: fontF, toolbar: { show: false }, animations: { enabled: false } },
            colors: incomeColors, stroke: { width: 3, curve: 'smooth', dashArray: [0, 5] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }
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
    let colors = currentTheme === 'dark' ? ['#5F6368', '#F28B82', '#8AB4F8'] : ['#9AA0A6', '#D93025', '#1A73E8'];

    if(accelChartInst) {
        accelChartInst.updateOptions({ theme: { mode: currentTheme }, colors });
        accelChartInst.updateSeries(series);
    } else {
        accelChartInst = new ApexCharts(document.querySelector("#accelChart"), {
            series: series, theme: { mode: currentTheme },
            chart: { type: 'line', height: 350, fontFamily: 'Google Sans', toolbar: { show: false }, background: 'transparent', animations: { enabled: false } },
            colors: colors, stroke: { width: [3, 3, 4], curve: 'smooth' },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }
        });
        accelChartInst.render();
    }
}


document.addEventListener('DOMContentLoaded', init);
