/**
 * Intelligent Variable FIRE - UI App Module (v4.0 Cybernetic)
 */

let assetChartInst = null;
let incomeChartInst = null;

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

const bindNumberInput = (id) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', triggerSimulation);
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
        triggerSimulation(); // Re-render charts with correct theme
    };
    
    // Default checked (Dark)
    applyTheme(sw.checked);
    sw.addEventListener('change', (e) => applyTheme(e.target.checked));
}

function init() {
    [
        'age', 'targetAge', 'salary', 'inflationRate', 
        'cash', 'stock', 'realestate', 'expense',
        'stockReturn', 'stockRatio', 'realestateReturn'
    ].forEach(bindNumberInput);
    
    document.getElementById('stressTest').addEventListener('change', triggerSimulation);
    initThemeToggle();
}

function getBaseInputs() {
    let cash = parseInt(document.getElementById('cash').value || 0);
    let stock = parseInt(document.getElementById('stock').value || 0);
    let realestate = parseInt(document.getElementById('realestate').value || 0);

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
        lifeEvents: [...lifeEvents]
    };
}

function triggerSimulation() {
    const isStressActive = document.getElementById('stressTest').checked;
    
    let baseInputs = getBaseInputs();
    baseInputs.isStressTest = false;
    let baseResult = runSimulation(baseInputs);
    
    let stressResult = null;
    if (isStressActive) {
        let stressInputs = getBaseInputs();
        stressInputs.isStressTest = true;
        stressResult = runSimulation(stressInputs);
    }
    
    updateMetrics(baseResult, stressResult, baseInputs.targetAge);
    updateBigMacIndex(baseInputs.inflationRate, baseInputs.age, baseInputs.targetAge);
    
    renderVisuals(baseResult.history, stressResult?.history, baseResult.fireAge, baseInputs.targetAge);
}

function updateMetrics(baseRes, stressRes, targetAge) {
    // 1st Metric: Pure Fire Age
    let elAge = document.getElementById('resAge');
    let elDelay = document.getElementById('resAgeDelay');
    
    if(baseRes.fireAge) {
        elAge.innerText = baseRes.fireAge + "세";
        if(stressRes) {
            if(stressRes.fireAge) {
                let diff = stressRes.fireAge - baseRes.fireAge;
                elDelay.innerText = diff > 0 ? `위기 시 ${diff}년 지연됨 (+)` : '지연 없음';
                elDelay.className = 'metric-sub red-text';
            } else {
                elDelay.innerText = '위기 시 달성 불가';
                elDelay.className = 'metric-sub red-text';
            }
        } else {
            elDelay.innerText = "파이어 조건 통과 (안정적)";
            elDelay.className = 'metric-sub';
        }
    } else {
        elAge.innerText = "달성 불가";
        elDelay.innerText = "-";
        elDelay.className = 'metric-sub';
    }
    
    // 2nd Metric: Target Asset at Target Age
    let elTargetAsset = document.getElementById('resTargetGapAsset');
    if (baseRes.requiredAssetAtTargetAge) {
        let tgtEok = (baseRes.requiredAssetAtTargetAge / 10000).toFixed(1);
        elTargetAsset.innerText = tgtEok + "억 원";
    } else {
        elTargetAsset.innerText = "측정 불가";
    }
    
    // 3rd Metric: GAP Analysis
    let elGap = document.getElementById('resGapAmount');
    let elGapLabel = document.getElementById('resGapLabel');
    if (baseRes.assetAtTargetAge !== null && baseRes.requiredAssetAtTargetAge !== null) {
        let gap = baseRes.assetAtTargetAge - baseRes.requiredAssetAtTargetAge;
        if (gap >= 0) {
            elGap.innerText = "+" + formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value green-text";
            elGapLabel.innerText = `${targetAge}세에 자금이 넘칩니다 (파이어 성공)`;
        } else {
            elGap.innerText = formatKrw(Math.round(gap)) + "만 원";
            elGap.className = "metric-value red-text";
            elGapLabel.innerText = `${targetAge}세까지 극복해야 할 부족 금액`;
        }
    } else {
        elGap.innerText = "에러";
        elGapLabel.innerText = "나이 범위 초과 또는 설정 오류";
        elGap.className = "metric-value";
    }
}

// ------------------------------------
// Big Mac (Inflation) Single Burger Pricing
// ------------------------------------
function updateBigMacIndex(inflationRate, currentAge, targetAge) {
    const BIG_MAC_PRICE = 5500; // 원
    
    let elMacFuture = document.getElementById('macFuture');
    let elInf = document.getElementById('lblInf');
    
    elInf.innerText = inflationRate;
    
    let yearsDelta = Math.max(0, targetAge - currentAge);
    
    // Price = 5500 * (1 + inflation)^N
    let futurePrice = BIG_MAC_PRICE * Math.pow(1 + inflationRate/100, yearsDelta);
    elMacFuture.innerText = formatKrw(Math.round(futurePrice));
}

// ------------------------------------
// ApexCharts 시각화
// ------------------------------------
function renderVisuals(history, stressHistory, fireAge, targetAge) {
    if(!history || history.length === 0) return;
    
    const xCategories = history.map(h => h.age + '세');
    const cashData = history.map(h => h.cash);
    const stockData = history.map(h => h.stock);
    const realData = history.map(h => h.realestate);
    
    const targetData = history.map(h => h.target);
    const incomeData = history.map(h => h.income);
    const expenseData = history.map(h => h.expense);

    let annotations = { xaxis: [] };
    
    // Target Age vertical dotted line
    if (targetAge) {
        annotations.xaxis.push({
            x: targetAge + '세',
            strokeDashArray: 5,
            borderColor: '#ff007f', // Magenta
            label: { borderColor: '#ff007f', style: { color: '#fff', background: '#ff007f', fontSize: '11px' }, text: '희망 은퇴 나이' }
        });
    }

    // Pure FIRE Age vertical solid line
    if(fireAge) {
        annotations.xaxis.push({
            x: fireAge + '세',
            strokeDashArray: 0,
            borderColor: '#00ff00', // Cyan/Greenish
            label: { borderColor: '#00ff00', style: { color: '#000', background: '#00ff00', fontWeight: 'bold' }, text: '파이어 달성 지점' }
        });
    }

    let assetSeries = [
        { name: "부동산", data: realData },
        { name: "주식/펀드", data: stockData },
        { name: "현금", data: cashData },
        { name: "인플레이션 반영 목표치", type: 'line', data: targetData }
    ];
    let colors = ['#f59e0b', '#0284c7', '#94a3b8', '#10b981'];
    if(currentTheme === 'dark') {
        colors[1] = '#38bdf8'; // Sky blue for dark mode
        colors[2] = '#334155'; // Slate 700 for cash in dark mode
    }

    let strokeConf = { width: [2, 2, 2, 3], curve: 'smooth', dashArray: [0,0,0,4] };
    
    if(stressHistory) {
        let stressData = stressHistory.map(h => h.total);
        assetSeries.push({ name: "스트레스 테스트 위기자산", type: 'line', data: stressData });
        colors.push('#ef4444');
        strokeConf.width.push(2);
        strokeConf.dashArray.push(5);
    }

    let chartTheme = currentTheme === 'dark' ? 'dark' : 'light';
    let bgChart = 'transparent';

    if(assetChartInst) {
        assetChartInst.updateOptions({ theme: { mode: chartTheme }, chart: { background: bgChart }, annotations, stroke: strokeConf, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(document.querySelector("#assetChart"), {
            series: assetSeries,
            theme: { mode: chartTheme },
            chart: { background: bgChart, type: 'area', height: 420, stacked: false, fontFamily: 'Rajdhani, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 150 } },
            stroke: strokeConf, colors: colors,
            grid: { borderColor: 'rgba(128,128,128,0.2)' },
            fill: { type: ['gradient','gradient','gradient','solid','solid'], opacity: [0.3, 0.4, 0.6, 1, 1] },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false },
            legend: { position: 'top' },
            annotations: annotations
        });
        assetChartInst.render();
    }

    let incomeColors = currentTheme === 'dark' ? ['#38bdf8', '#c084fc'] : ['#0284c7', '#9333ea'];
    if(incomeChartInst) {
        incomeChartInst.updateOptions({ theme: { mode: chartTheme }, chart: { background: bgChart }, annotations, colors: incomeColors });
        incomeChartInst.updateSeries([
            { name: "월 소득(명목)", data: incomeData },
            { name: "의무 목표 생활비(물가반영)", data: expenseData }
        ]);
    } else {
        incomeChartInst = new ApexCharts(document.querySelector("#incomeChart"), {
            series: [{ name: "월 소득(명목)", data: incomeData }, { name: "의무 목표 생활비(물가반영)", data: expenseData }],
            theme: { mode: chartTheme },
            chart: { background: bgChart, type: 'line', height: 300, fontFamily: 'Rajdhani, sans-serif', toolbar: { show: false }, animations: { enabled: true, speed: 150 } },
            colors: incomeColors,
            grid: { borderColor: 'rgba(128,128,128,0.2)' },
            stroke: { width: 3, curve: 'smooth', dashArray: [0, 5] },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false },
            legend: { position: 'top' },
            annotations: annotations
        });
        incomeChartInst.render();
    }
}

document.addEventListener('DOMContentLoaded', init);
