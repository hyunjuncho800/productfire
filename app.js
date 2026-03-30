/**
 * Intelligent Variable FIRE - UI App Module
 */

let assetChartInst = null;
let incomeChartInst = null;

const formatKrw = (val) => new Intl.NumberFormat('ko-KR').format(val);
const formatKrwSmall = (val) => {
    let num = Math.round(val);
    if(num >= 10000) return (num/10000).toFixed(1) + '억';
    return num + '만';
};

// State
let lifeEvents = [];
let curvePoints = [
    {age: 30, income: 400},
    {age: 35, income: 600},
    {age: 45, income: 800},
    {age: 55, income: 300},
    {age: 100, income: 50}
];

// Sliders mapping
const bindSliderLabel = (id) => {
    const el = document.getElementById(id);
    const label = document.getElementById(id + 'Label');
    if (!el || !label) return;
    label.innerText = formatKrw(el.value);
    el.addEventListener('input', () => {
        label.innerText = formatKrw(el.value);
        if (id === 'age') updateEditorAges(); // 나이축 보정
        triggerSimulation();
    });
};

// Event Timeline Logic
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

// ------------------------------------
// SVG 5-Point Editor Logic
// ------------------------------------
const svg = document.getElementById('incomeEditor');
const pElements = [1,2,3,4,5].map(i => document.getElementById(`p${i}`));
const lElements = [1,2,3,4,5].map(i => document.getElementById(`p${i}Label`));
const path = document.getElementById('curveLine');

const X_MIN = 20, X_MAX = 100;
const Y_MIN = 3000, Y_MAX = 0; // Income (Y 축은 역방향)

let activePointIndex = -1;

function getSVGMpos(evt) {
    let CTM = svg.getScreenCTM();
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function coordToVal(cx, cy) {
    let age = X_MIN + (cx / 400) * (X_MAX - X_MIN);
    let income = Y_MIN + (cy / 150) * (Y_MAX - Y_MIN);
    return { age: Math.round(age), income: Math.round(income) };
}

function valToCoord(age, income) {
    let cx = ((age - X_MIN) / (X_MAX - X_MIN)) * 400;
    let cy = ((income - Y_MIN) / (Y_MAX - Y_MIN)) * 150;
    return { cx, cy };
}

function updateEditorAges() {
    let baseAge = parseInt(document.getElementById('age').value);
    // 점이 age 밑으로 못가게 보정
    let changed = false;
    for(let i=0; i<curvePoints.length; i++) {
        if(curvePoints[i].age < baseAge) {
            curvePoints[i].age = baseAge;
            changed = true;
        }
    }
    // 5번점은 항상 100세 고정
    curvePoints[4].age = 100;
    
    // 순서 정렬
    curvePoints.sort((a,b) => a.age - b.age);
    renderEditorPoints();
    if(changed) triggerSimulation();
}

function renderEditorPoints() {
    let dPath = "";
    curvePoints.forEach((p, i) => {
        let c = valToCoord(p.age, p.income);
        const el = pElements[i];
        const lbl = lElements[i];
        
        el.setAttribute('cx', c.cx);
        el.setAttribute('cy', c.cy);
        lbl.setAttribute('x', c.cx);
        lbl.setAttribute('y', parseFloat(c.cy) + (i%2==0 ? 18 : -10)); // 번갈아가며 텍스트 배치
        lbl.textContent = `${p.age}세, ${p.income}만`;
        
        dPath += (i === 0 ? "M " : " L ") + `${c.cx} ${c.cy}`;
    });
    path.setAttribute('d', dPath);
}

// 이벤트 바인딩
pElements.forEach((el, index) => {
    const startDrag = () => { activePointIndex = index; };
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag);
});

window.addEventListener('mouseup', () => { if(activePointIndex > -1){ activePointIndex = -1; triggerSimulation(); } });
window.addEventListener('touchend', () => { if(activePointIndex > -1){ activePointIndex = -1; triggerSimulation(); } });

svg.addEventListener('mousemove', (e) => {
    if(activePointIndex === -1) return;
    e.preventDefault();
    let pos = getSVGMpos(e);
    let val = coordToVal(pos.x, pos.y);
    
    // Limits
    if(val.income < 0) val.income = 0;
    if(val.income > 3000) val.income = 3000;
    
    let baseAge = parseInt(document.getElementById('age').value);
    
    if (activePointIndex === 0) {
        val.age = baseAge; // 첫점 나이 고정
    } else if (activePointIndex === 4) {
        val.age = 100; // 끝점 나이 고정
    } else {
        // 중간 점들은 좌우 점을 넘지 못하게 Limits
        let leftLimit = curvePoints[activePointIndex - 1].age;
        let rightLimit = curvePoints[activePointIndex + 1].age;
        if(val.age <= leftLimit) val.age = leftLimit + 1;
        if(val.age >= rightLimit) val.age = rightLimit - 1;
    }
    
    curvePoints[activePointIndex] = val;
    renderEditorPoints();
    triggerSimulation();
});


// ------------------------------------
// Core Simulation & Chart Pipeline
// ------------------------------------

function init() {
    ['age','initialAsset','expense','stockReturn','stockRatio','realFixed','realestateReturn'].forEach(bindSliderLabel);
    updateEditorAges();
    triggerSimulation();
    
    document.getElementById('stressTest').addEventListener('change', triggerSimulation);
}

function getBaseInputs() {
    return {
        age: parseInt(document.getElementById('age').value),
        initialAsset: parseInt(document.getElementById('initialAsset').value),
        expense: parseInt(document.getElementById('expense').value),
        realFixed: parseInt(document.getElementById('realFixed').value),
        stockReturn: parseFloat(document.getElementById('stockReturn').value),
        realestateReturn: parseFloat(document.getElementById('realestateReturn').value),
        stockRatio: parseInt(document.getElementById('stockRatio').value),
        incomeCurvePoints: [...curvePoints],
        lifeEvents: [...lifeEvents]
    };
}

function triggerSimulation() {
    const isStressActive = document.getElementById('stressTest').checked;
    
    // 기본 모드
    let baseInputs = getBaseInputs();
    baseInputs.isStressTest = false;
    let baseResult = runSimulation(baseInputs);
    
    // 스트레스 테스트 모드 병렬계산
    let stressResult = null;
    if (isStressActive) {
        let stressInputs = getBaseInputs();
        stressInputs.isStressTest = true;
        stressResult = runSimulation(stressInputs);
    }
    
    updateMetrics(baseResult, stressResult, baseInputs.initialAsset);
    renderVisuals(baseResult.history, stressResult?.history, baseResult.fireAge, baseResult.targetAsset);
}

function updateMetrics(baseRes, stressRes, initAsset) {
    let elAge = document.getElementById('resAge');
    let elDelay = document.getElementById('resAgeDelay');
    let elTarget = document.getElementById('resTargetAsset');
    let elProgress = document.getElementById('resProgress');
    
    if(baseRes.fireAge) {
        elAge.innerText = baseRes.fireAge + "세";
        
        if(stressRes) {
            if(stressRes.fireAge) {
                let diff = stressRes.fireAge - baseRes.fireAge;
                elDelay.innerText = diff > 0 ? `하락장 시 ${diff}년 지연됨 (+)` : '지연 없음';
                elDelay.className = 'metric-sub red-text';
            } else {
                elDelay.innerText = '하락장 시 파이어 달성 불가';
                elDelay.className = 'metric-sub red-text';
            }
        } else {
            elDelay.innerText = "안정적 수익 가정";
            elDelay.className = 'metric-sub';
        }
        
    } else {
        elAge.innerText = "달성 불가";
        elDelay.innerText = "-";
        elDelay.className = 'metric-sub';
    }
    
    // Target display (억원 변환)
    let tgtEok = (baseRes.targetAsset / 10000).toFixed(1);
    elTarget.innerText = tgtEok + "억 원";
    
    // Progress
    let prog = Math.min(((initAsset / baseRes.targetAsset) * 100), 100).toFixed(1);
    elProgress.innerText = prog + "%";
}

function renderVisuals(history, stressHistory, fireAge, targetAsset) {
    if(!history || history.length === 0) return;
    
    const xCategories = history.map(h => h.age + '세');
    const cashData = history.map(h => h.cash);
    const stockData = history.map(h => h.stock);
    const realData = history.map(h => h.realestate);
    
    const incomeData = history.map(h => h.income);
    const expenseData = history.map(h => h.expense);

    // Annotations
    let annotations = { xaxis: [] };
    if(fireAge) {
        annotations.xaxis.push({
            x: fireAge + '세',
            strokeDashArray: 0,
            borderColor: '#34A853',
            label: {
                borderColor: '#34A853',
                style: { color: '#fff', background: '#34A853', fontWeight: 'bold' },
                text: '자유의 날 (파이어 데이)'
            }
        });
    }

    // Asset Chart
    let assetSeries = [
        { name: "부동산", data: realData },
        { name: "주식/펀드", data: stockData },
        { name: "현금", data: cashData }
    ];
    let colors = ['#fbbc04', '#1a73e8', '#e8eaed'];
    let strokeConf = { width: 2, curve: 'smooth' };
    
    if(stressHistory) {
        let stressData = stressHistory.map(h => h.total);
        assetSeries.push({ name: "스트레스 테스트 자산", type: 'line', data: stressData });
        colors.push('#B3261E');
        strokeConf.width = [2,2,2,3];
        strokeConf.dashArray = [0,0,0,5]; // Red line is dashed
    }

    if(assetChartInst) {
        assetChartInst.updateOptions({ annotations, stroke: strokeConf, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(document.querySelector("#assetChart"), {
            series: assetSeries,
            chart: { type: 'area', height: 420, stacked: false, fontFamily: 'Roboto, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 150 } },
            stroke: strokeConf, colors: colors,
            fill: { type: ['gradient','gradient','gradient','solid'], opacity: [0.3, 0.4, 0.6, 1] },
            xaxis: { categories: xCategories, tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            dataLabels: { enabled: false },
            legend: { position: 'top' },
            annotations: annotations
        });
        assetChartInst.render();
    }

    // Income Chart
    if(incomeChartInst) {
        incomeChartInst.updateOptions({ annotations });
        incomeChartInst.updateSeries([
            { name: "연령별 월 소득", data: incomeData },
            { name: "목표 월 생활비", data: expenseData }
        ]);
    } else {
        incomeChartInst = new ApexCharts(document.querySelector("#incomeChart"), {
            series: [{ name: "연령별 월 소득", data: incomeData }, { name: "목표 월 생활비", data: expenseData }],
            chart: { type: 'line', height: 300, fontFamily: 'Roboto, sans-serif', toolbar: { show: false }, animations: { enabled: true, speed: 150 } },
            colors: ['#1A73E8', '#EA4335'],
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
