/**
 * Intelligent Variable FIRE - UI App Module (v5.0 DRIP & Tax Edition)
 */

let assetChartInst = null;
let incomeChartInst = null;
let accelChartInst = null;
let taxBarChartInst = null;
let divGaugeChartInst = null;

const formatKrw = (val) => new Intl.NumberFormat('ko-KR').format(val);
const formatKrwSmall = (val) => {
    let num = Math.round(val);
    if(num >= 10000) return (num/10000).toFixed(1) + '억';
    if(num <= -10000) return (num/10000).toFixed(1) + '억';
    return num + '만';
};

// State
let lifeEvents = [];
let currentTheme = 'dark'; // default theme

const bindInputs = (selectors) => {
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', triggerSimulation);
            el.addEventListener('change', triggerSimulation);
        }
    });
};

document.getElementById('addEventBtn').addEventListener('click', () => {
    const age = parseInt(document.getElementById('eventAge').value);
    const amt = parseInt(document.getElementById('eventAmount').value);
    if (!age || !amt) return;
    lifeEvents.push({ age, amount: amt });
    lifeEvents.sort((a,b) => a.age - b.age);
    renderEventList();
    triggerSimulation();
});

function removeEvent(idx) {
    lifeEvents.splice(idx, 1);
    renderEventList();
    triggerSimulation();
}

function renderEventList() {
    const ul = document.getElementById('eventList');
    ul.innerHTML = '';
    lifeEvents.forEach((e, idx) => {
        const li = document.createElement('li');
        li.className = 'event-item';
        let cls = e.amount > 0 ? 'amount-plus' : 'amount-minus';
        let sign = e.amount > 0 ? '+' : '';
        li.innerHTML = `
            <span>${e.age}세</span>
            <span class="${cls}">${sign}${formatKrw(e.amount)}만 원</span>
            <button class="event-del" onclick="removeEvent(${idx})">&times;</button>
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
        triggerSimulation();
    };
    
    applyTheme(sw.checked);
    sw.addEventListener('change', (e) => applyTheme(e.target.checked));
}

function init() {
    bindInputs([
        'age', 'targetAge', 'salary', 'inflationRate', 
        'cash', 'stock', 'realestate', 'expense',
        'stockReturn', 'stockRatio', 'realestateReturn',
        'divYield', 'divGrowth', 'reinvestDiv'
    ]);
    
    let radios = document.querySelectorAll('input[name="accountType"]');
    radios.forEach(r => r.addEventListener('change', triggerSimulation));

    document.getElementById('stressTest').addEventListener('change', triggerSimulation);
    initThemeToggle();
}

function getBaseInputs() {
    let cash = parseInt(document.getElementById('cash').value || 0);
    let stock = parseInt(document.getElementById('stock').value || 0);
    let realestate = parseInt(document.getElementById('realestate').value || 0);
    
    let accountType = document.querySelector('input[name="accountType"]:checked').value;

    return {
        age: parseInt(document.getElementById('age').value || 30),
        targetAge: parseInt(document.getElementById('targetAge').value || 45),
        salary: parseInt(document.getElementById('salary').value || 400),
        inflationRate: parseFloat(document.getElementById('inflationRate').value || 2.5),
        cash: cash,
        stock: stock,
        realestate: realestate,
        expense: parseInt(document.getElementById('expense').value || 300),
        stockReturn: parseFloat(document.getElementById('stockReturn').value || 0),
        realestateReturn: parseFloat(document.getElementById('realestateReturn').value || 0),
        stockRatio: parseInt(document.getElementById('stockRatio').value || 0),
        lifeEvents: [...lifeEvents],
        
        // DRIP fields
        divYield: parseFloat(document.getElementById('divYield').value || 0),
        divGrowth: parseFloat(document.getElementById('divGrowth').value || 0),
        accountType: accountType,
        reinvestDiv: document.getElementById('reinvestDiv').checked
    };
}

function triggerSimulation() {
    const isStressActive = document.getElementById('stressTest').checked;
    let baseInputs = getBaseInputs();
    baseInputs.isStressTest = false;
    
    // User Selected Simulation
    let userResult = runSimulation(baseInputs);
    
    let stressResult = null;
    if (isStressActive) {
        let stressInputs = getBaseInputs();
        stressInputs.isStressTest = true;
        stressResult = runSimulation(stressInputs);
    }
    
    // -------------------------------------------------------------------
    // Pedagogical Scenarios for "Acceleration & DRIP comparisons"
    // -------------------------------------------------------------------
    let inputsNoDiv = getBaseInputs(); inputsNoDiv.divYield = 0; inputsNoDiv.reinvestDiv = false;
    let resNoDiv = runSimulation(inputsNoDiv);

    let inputsDivNoReinvest = getBaseInputs(); inputsDivNoReinvest.reinvestDiv = false;
    let resDivNoRe = runSimulation(inputsDivNoReinvest);

    let inputsDivReinvest = getBaseInputs(); inputsDivReinvest.reinvestDiv = true;
    let resDivRe = runSimulation(inputsDivReinvest);

    // Tax Comparison (General vs Current Selected)
    let inputsGeneralAcc = getBaseInputs(); inputsGeneralAcc.accountType = 'general'; inputsGeneralAcc.reinvestDiv = true;
    let resTaxGeneral = runSimulation(inputsGeneralAcc);
    
    updateMetrics(userResult, Object.assign({}, baseInputs));
    updateBigMacIndex(baseInputs.inflationRate, baseInputs.age, baseInputs.targetAge);
    
    // Banner update (Time Saved)
    updateBanner(resNoDiv.fireAge, resDivRe.fireAge);

    // Render 5 Charts
    renderMainCharts(userResult.history, stressResult?.history, userResult.fireAge, baseInputs.targetAge);
    renderAccelChart(resNoDiv.history, resDivNoRe.history, resDivRe.history);
    renderTaxBar(resTaxGeneral.cumulativeTaxPaid, userResult.cumulativeTaxPaid, baseInputs.accountType);
    
    // Gauge using the last valid history point (Target age or end of sim)
    let finalGaugeVal = 0;
    if (userResult.history && userResult.history.length > 0) {
        let targetIdx = userResult.history.findIndex(h => h.age === baseInputs.targetAge);
        if (targetIdx === -1) targetIdx = userResult.history.length - 1; 
        finalGaugeVal = userResult.history[targetIdx].divCoverage;
    }
    renderGaugeChart(finalGaugeVal);
}

function updateBanner(fireAgeNoDiv, fireAgeReinvest) {
    const banner = document.getElementById('accelerationBanner');
    const textEl = document.getElementById('accelText');
    
    if (fireAgeNoDiv && fireAgeReinvest) {
        let diff = (fireAgeNoDiv - fireAgeReinvest).toFixed(1);
        if (diff > 0) {
            banner.classList.remove('hidden');
            textEl.innerText = `스노우볼 엔진 작동! 절세 및 배당 재투자로 은퇴가 ${diff}년 앞당겨졌습니다!`;
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
        elDelay.className = 'metric-sub red-text';
    }
    
    let elTargetAsset = document.getElementById('resTargetGapAsset');
    if (baseRes.requiredAssetAtTargetAge) {
        let tgtEok = (baseRes.requiredAssetAtTargetAge / 10000).toFixed(1);
        elTargetAsset.innerText = tgtEok + "억 원";
    } else {
        elTargetAsset.innerText = "측정 불가";
    }
    
    let elGap = document.getElementById('resGapAmount');
    let elGapLabel = document.getElementById('resGapLabel');
    if (baseRes.assetAtTargetAge !== null && baseRes.requiredAssetAtTargetAge !== null) {
        let gap = baseRes.assetAtTargetAge - baseRes.requiredAssetAtTargetAge;
        if (gap >= 0) {
            elGap.innerText = "+" + formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value green-text";
            elGapLabel.innerText = `${inputs.targetAge}세 자금 확보 완료`;
        } else {
            elGap.innerText = formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value red-text";
            elGapLabel.innerText = `${inputs.targetAge}세 부족 금액`;
        }
    } else {
        elGap.innerText = "-";
        elGapLabel.innerText = "범위 오류";
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

// ------------------------------------
// Chart 1 & 2: Main Assets & Income
// ------------------------------------
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
            x: targetAge + '세', strokeDashArray: 5, borderColor: '#c084fc',
            label: { borderColor: '#c084fc', style: { color: '#fff', background: '#c084fc' }, text: '희망 은퇴' }
        });
    }

    if(fireAge) {
        annotations.xaxis.push({
            x: fireAge + '세', strokeDashArray: 0, borderColor: '#10b981',
            label: { borderColor: '#10b981', style: { color: '#fff', background: '#10b981' }, text: '지상낙원 입성' }
        });
    }

    let assetSeries = [
        { name: "부동산", data: realData }, { name: "주식/펀드", data: stockData }, 
        { name: "현금", data: cashData }, { name: "인플레이션 반영 목표치", type: 'line', data: targetData }
    ];
    let colors = ['#f59e0b', '#0284c7', '#94a3b8', '#10b981'];
    if(currentTheme === 'dark') { colors[1] = '#38bdf8'; colors[2] = '#334155'; }

    let strokeConf = { width: [2, 2, 2, 3], curve: 'smooth', dashArray: [0,0,0,4] };
    
    if(stressHistory) {
        let stressData = stressHistory.map(h => h.total);
        assetSeries.push({ name: "스트레스 위기자산", type: 'line', data: stressData });
        colors.push('#ef4444'); strokeConf.width.push(2); strokeConf.dashArray.push(5);
    }

    let chartTheme = currentTheme === 'dark' ? 'dark' : 'light';
    let bgChart = 'transparent';

    if(assetChartInst) {
        assetChartInst.updateOptions({ theme: { mode: chartTheme }, chart: { background: bgChart }, annotations, stroke: strokeConf, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(document.querySelector("#assetChart"), {
            series: assetSeries, theme: { mode: chartTheme },
            chart: { background: bgChart, type: 'area', height: 420, stacked: false, fontFamily: 'Rajdhani', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 150 } },
            stroke: strokeConf, colors: colors,
            fill: { type: ['gradient','gradient','gradient','solid','solid'], opacity: [0.3, 0.4, 0.6, 1, 1] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }, annotations: annotations
        });
        assetChartInst.render();
    }

    let incomeColors = currentTheme === 'dark' ? ['#38bdf8', '#c084fc'] : ['#0284c7', '#9333ea'];
    if(incomeChartInst) {
        incomeChartInst.updateOptions({ theme: { mode: chartTheme }, chart: { background: bgChart }, colors: incomeColors });
        incomeChartInst.updateSeries([ { name: "명목 월 소득", data: incomeData }, { name: "목표 생활비 한도", data: expenseData } ]);
    } else {
        incomeChartInst = new ApexCharts(document.querySelector("#incomeChart"), {
            series: [{ name: "명목 월 소득", data: incomeData }, { name: "목표 생활비 한도", data: expenseData }],
            theme: { mode: chartTheme }, chart: { background: bgChart, type: 'line', height: 300, fontFamily: 'Rajdhani', toolbar: { show: false } },
            colors: incomeColors, stroke: { width: 3, curve: 'smooth', dashArray: [0, 5] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }
        });
        incomeChartInst.render();
    }
}

// ------------------------------------
// Chart 3: Acceleration 3-Lines
// ------------------------------------
function renderAccelChart(hNoDiv, hNoRe, hRe) {
    if(!hNoDiv || hNoDiv.length === 0) return;
    const xCategories = hNoDiv.map(h => h.age + '세');
    
    let cTheme = currentTheme === 'dark' ? 'dark' : 'light';
    let series = [
        { name: "1. 일반 주식 (배당 없음)", data: hNoDiv.map(h => h.total) },
        { name: "2. 배당금 은행저축/소비 (재투자 안함)", data: hNoRe.map(h => h.total) },
        { name: "3. 배당금 스노우볼 재투자시 (제트엔진)", data: hRe.map(h => h.total) }
    ];
    let colors = currentTheme === 'dark' ? ['#64748b', '#f472b6', '#38bdf8'] : ['#94a3b8', '#db2777', '#0284c7'];

    if(accelChartInst) {
        accelChartInst.updateOptions({ theme: { mode: cTheme }, colors });
        accelChartInst.updateSeries(series);
    } else {
        accelChartInst = new ApexCharts(document.querySelector("#accelChart"), {
            series: series, theme: { mode: cTheme },
            chart: { type: 'line', height: 350, fontFamily: 'Rajdhani', toolbar: { show: false }, background: 'transparent' },
            colors: colors,
            stroke: { width: [3, 3, 4], curve: 'smooth' },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false }, legend: { position: 'top' }
        });
        accelChartInst.render();
    }
}

// ------------------------------------
// Chart 4: Tax Comparison Bar
// ------------------------------------
function renderTaxBar(taxGen, taxCurrent, accType) {
    let cTheme = currentTheme === 'dark' ? 'dark' : 'light';
    let labelAcc = accType === 'isa' ? 'ISA 혜택 적용' : (accType === 'pension' ? '연금저축/IRP 적용' : '일반 계좌(현재)');
    
    let series = [{ name: "생애 누적 납부 세금", data: [taxGen, taxCurrent] }];
    let categories = ["일반 계좌일 시", labelAcc];
    
    let colors = currentTheme === 'dark' ? ['#ef4444', '#10b981'] : ['#dc2626', '#059669'];

    if(taxBarChartInst) {
        taxBarChartInst.updateOptions({ theme: { mode: cTheme }, xaxis: { categories }, colors });
        taxBarChartInst.updateSeries(series);
    } else {
        taxBarChartInst = new ApexCharts(document.querySelector("#taxBarChart"), {
            series: series, theme: { mode: cTheme },
            chart: { type: 'bar', height: 260, fontFamily: 'Rajdhani', toolbar: { show: false }, background: 'transparent' },
            colors: colors,
            plotOptions: { bar: { distributed: true, borderRadius: 4, horizontal: true } },
            dataLabels: { enabled: true, formatter: val => formatKrwSmall(val) },
            xaxis: { categories: categories, labels: { formatter: formatKrwSmall } },
            legend: { show: false }
        });
        taxBarChartInst.render();
    }
}

// ------------------------------------
// Chart 5: Dividend Coverage Gauge
// ------------------------------------
function renderGaugeChart(coverageRatio) {
    let cTheme = currentTheme === 'dark' ? 'dark' : 'light';
    let val = Math.min(coverageRatio || 0, 100).toFixed(1);
    let color = currentTheme === 'dark' ? '#38bdf8' : '#0284c7';
    if(val >= 100) color = '#10b981';

    if(divGaugeChartInst) {
        divGaugeChartInst.updateOptions({ theme: { mode: cTheme }, colors: [color] });
        divGaugeChartInst.updateSeries([val]);
    } else {
        divGaugeChartInst = new ApexCharts(document.querySelector("#divGaugeChart"), {
            series: [val], theme: { mode: cTheme },
            chart: { type: 'radialBar', height: 280, fontFamily: 'Rajdhani', background: 'transparent' },
            colors: [color],
            plotOptions: {
                radialBar: {
                    hollow: { size: '65%' },
                    dataLabels: { name: { show: true, fontSize: '14px', color: 'var(--text-med)', offsetY: -10 }, value: { show: true, fontSize: '36px', fontWeight: 700, color: 'var(--text-high)', formatter: val => val + "%" } }
                }
            },
            labels: ['생활비 충당률']
        });
        divGaugeChartInst.render();
    }
}

document.addEventListener('DOMContentLoaded', init);
