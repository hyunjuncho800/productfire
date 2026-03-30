/**
 * Intelligent Variable FIRE - UI App Module (v7.1 Wealth - Hotfix)
 */

let assetChartInst = null;
let incomeChartInst = null;
let accelChartInst = null;

const formatKrw = (val) => {
    if (isNaN(val)) return "0";
    return new Intl.NumberFormat('ko-KR').format(val);
};

const formatKrwSmall = (val) => {
    if (isNaN(val)) return "0";
    let num = Math.round(val);
    if(num >= 10000 || num <= -10000) return (num/10000).toFixed(1) + '억';
    return num + '만';
};

// State
let lifeEvents = [];
let currentTheme = 'light'; 

const IDS = [
    'age', 'targetAge', 'salary', 'inflationRate', 
    'cash', 'stock', 'divStock', 'realestate', 'expense',
    'stockReturn', 'stockRatio', 'realestateReturn',
    'divYield', 'divGrowth', 'peakAge', 'incomeDecayRate'
];

let renderFrame = null;
function triggerSimulationThrottled() {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
        try {
            triggerSimulation();
        } catch (e) {
            console.error("Simulation failed:", e);
        }
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
    const btnShare = document.getElementById('btnShareImage');

    if (btnShare) {
        btnShare.addEventListener('click', shareReportAsImage);
    }

    if (btnRun && pageInputs && pageResults) {
        btnRun.addEventListener('click', () => {
            console.log("Run simulation clicked");
            // Switch Page
            pageInputs.classList.remove('active');
            pageResults.classList.add('active');
            
            // Trigger Calc & Render
            triggerSimulation();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'instant' });
        });
    }

    if (btnBack && pageInputs && pageResults) {
        btnBack.addEventListener('click', () => {
            pageResults.classList.remove('active');
            pageInputs.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'instant' });
        });
    }
}

function bindResponsiveInputs() {
    IDS.forEach(id => {
        const rangeEl = document.getElementById(id);
        const numEl = document.getElementById(id + '_num');
        if (rangeEl && numEl) {
            rangeEl.addEventListener('input', (e) => {
                numEl.value = e.target.value;
            });
            numEl.addEventListener('input', (e) => {
                rangeEl.value = e.target.value;
            });
        }
    });

    const reinvestDiv = document.getElementById('reinvestDiv');
    const stressTest = document.getElementById('stressTest');
    
    const checkAndUpdate = () => {
        const resPage = document.getElementById('page-results');
        if (resPage && resPage.classList.contains('active')) {
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
            if (icon) icon.innerText = 'dark_mode';
            currentTheme = 'dark';
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            if (icon) icon.innerText = 'light_mode';
            currentTheme = 'light';
        }
        
        const resPage = document.getElementById('page-results');
        if (resPage && resPage.classList.contains('active')) {
            triggerSimulationThrottled();
        }
    };
    
    const savedTheme = localStorage.getItem('fire-theme');
    let isDarkInitial = false;
    
    if (savedTheme) {
        isDarkInitial = savedTheme === 'dark';
    } else {
        isDarkInitial = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (sw) {
        sw.checked = isDarkInitial;
        sw.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            applyTheme(isDark);
            localStorage.setItem('fire-theme', isDark ? 'dark' : 'light');
        });
    }
    
    applyTheme(isDarkInitial);
}

function init() {
    bindResponsiveInputs();
    initThemeToggle();
    initNavigation();
}

function getSafeValue(id, def) {
    const el = document.getElementById(id);
    if (!el) return def;
    return parseFloat(el.value);
}

function getBaseInputs() {
    const accTypeEl = document.querySelector('input[name="accountType"]:checked');
    return {
        age: getSafeValue('age', 30),
        targetAge: getSafeValue('targetAge', 45),
        salary: getSafeValue('salary', 400),
        inflationRate: getSafeValue('inflationRate', 2.5),
        cash: getSafeValue('cash', 0),
        stock: getSafeValue('stock', 0),
        realestate: getSafeValue('realestate', 0),
        expense: getSafeValue('expense', 300),
        stockReturn: getSafeValue('stockReturn', 6.5),
        realestateReturn: getSafeValue('realestateReturn', 3.0),
        stockRatio: getSafeValue('stockRatio', 80),
        lifeEvents: [...lifeEvents],
        
        divStock: getSafeValue('divStock', 2000),
        divYield: getSafeValue('divYield', 3.5),
        divGrowth: getSafeValue('divGrowth', 2.0),
        accountType: accTypeEl ? accTypeEl.value : 'general',
        reinvestDiv: document.getElementById('reinvestDiv') ? document.getElementById('reinvestDiv').checked : true,
        
        peakAge: getSafeValue('peakAge', 50),
        incomeDecayRate: getSafeValue('incomeDecayRate', 15)
    };
}

function triggerSimulation() {
    const stressEl = document.getElementById('stressTest');
    const isStressActive = stressEl ? stressEl.checked : false;
    
    let baseInputs = getBaseInputs();
    baseInputs.isStressTest = false;
    
    let userResult = runSimulation(baseInputs);
    
    let stressResult = null;
    if (isStressActive) {
        let stressInputs = getBaseInputs();
        stressInputs.isStressTest = true;
        stressResult = runSimulation(stressInputs);
    }
    
    let inputsNoDiv = getBaseInputs(); 
    inputsNoDiv.divYield = 0; inputsNoDiv.reinvestDiv = false;
    let resNoDiv = runSimulation(inputsNoDiv);

    let inputsDivReinvest = getBaseInputs(); 
    inputsDivReinvest.reinvestDiv = true;
    let resDivRe = runSimulation(inputsDivReinvest);

    updateMetrics(userResult, baseInputs);
    updateBigMacIndex(baseInputs.inflationRate, baseInputs.age, baseInputs.targetAge);
    updateBanner(resNoDiv.fireAge, resDivRe.fireAge);

    renderMainCharts(userResult.history, stressResult?.history, userResult.fireAge, baseInputs.targetAge);
    
    let inputsDivNoReinvest = getBaseInputs(); 
    inputsDivNoReinvest.reinvestDiv = false;
    let resDivNoRe = runSimulation(inputsDivNoReinvest);
    renderAccelChart(resNoDiv.history, resDivNoRe.history, resDivRe.history);
}

function updateBanner(fireAgeNoDiv, fireAgeReinvest) {
    const banner = document.getElementById('accelerationBanner');
    const textEl = document.getElementById('accelText');
    if (!banner || !textEl) return;

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
    
    if (elAge && elDelay) {
        if(baseRes.fireAge) {
            elAge.innerText = baseRes.fireAge + "세";
            elDelay.innerText = "파이어 조건 통과 (안정권)";
            elDelay.className = 'metric-sub';
        } else {
            elAge.innerText = "달성 불가";
            elDelay.innerText = "목표 자금 미달";
            elDelay.className = 'metric-sub text-error';
        }
    }
    
    let elTargetAsset = document.getElementById('resTargetGapAsset');
    if (elTargetAsset) {
        if (baseRes.requiredAssetAtTargetAge) {
            elTargetAsset.innerText = (baseRes.requiredAssetAtTargetAge / 10000).toFixed(1) + "억 원";
        } else {
            elTargetAsset.innerText = "계산 불가";
        }
    }
    
    let elGap = document.getElementById('resGapAmount');
    let elGapLabel = document.getElementById('resGapLabel');
    if (elGap && elGapLabel) {
        if (baseRes.assetAtTargetAge !== undefined && baseRes.requiredAssetAtTargetAge !== undefined) {
            let gap = baseRes.assetAtTargetAge - baseRes.requiredAssetAtTargetAge;
            if (gap >= 0) {
                elGap.innerText = "+" + formatKrw(Math.round(gap)) + "만 원";
                elGap.className = "metric-value font-hero text-success";
                elGapLabel.innerText = `${inputs.targetAge}세 자금 확보 완료`;
            } else {
                elGap.innerText = formatKrw(Math.round(gap)) + "만 원";
                elGap.className = "metric-value font-hero text-error";
                elGapLabel.innerText = `${inputs.targetAge}세 목표 대비 부족분`;
            }
        }
    }
}

function updateBigMacIndex(inflationRate, currentAge, targetAge) {
    const BIG_MAC_PRICE = 5500; 
    let elMacFuture = document.getElementById('macFuture');
    let elLblInf = document.getElementById('lblInf');
    if (elLblInf) elLblInf.innerText = inflationRate;
    if (elMacFuture) {
        let yearsDelta = Math.max(0, targetAge - currentAge);
        let futurePrice = BIG_MAC_PRICE * Math.pow(1 + inflationRate/100, yearsDelta);
        elMacFuture.innerText = formatKrw(Math.round(futurePrice));
    }
}

function renderMainCharts(history, stressHistory, fireAge, targetAge) {
    if(!history || history.length === 0) return;
    
    const xCategories = history.map(h => h.age + '세');
    const assetSeries = [
        { name: "부동산", data: history.map(h => h.realestate) },
        { name: "일반 주식", data: history.map(h => h.stock) },
        { name: "배당 주식", data: history.map(h => h.divStock || 0) },
        { name: "현금", data: history.map(h => h.cash) },
        { name: "안전마진 목표선", type: 'line', data: history.map(h => h.target) }
    ];
    
    let annotations = { xaxis: [] };
    if (targetAge) annotations.xaxis.push({ x: targetAge + '세', strokeDashArray: 5, borderColor: '#1d4ed8', label: { style: { color: '#fff', background: '#1d4ed8' }, text: '희망 은퇴' } });
    if (fireAge) annotations.xaxis.push({ x: fireAge + '세', strokeDashArray: 0, borderColor: '#10b981', label: { style: { color: '#fff', background: '#10b981' }, text: '목표 달성' } });

    let colors = currentTheme === 'dark' ? ['#fbbf24', '#3b82f6', '#10b981', '#94a3b8', '#a78bfa'] : ['#f59e0b', '#1d4ed8', '#10b981', '#64748b', '#7c3aed'];
    if (stressHistory) {
        assetSeries.push({ name: "위기 자산", type: 'line', data: stressHistory.map(h => h.total) });
        colors.push(currentTheme === 'dark' ? '#fca5a5' : '#ef4444');
    }

    const chartEl = document.querySelector("#assetChart");
    if (!chartEl) return;

    if(assetChartInst) {
        assetChartInst.updateOptions({ theme: { mode: currentTheme }, annotations, colors });
        assetChartInst.updateSeries(assetSeries);
    } else {
        assetChartInst = new ApexCharts(chartEl, {
            series: assetSeries, theme: { mode: currentTheme },
            chart: { background: 'transparent', type: 'area', width: '100%', height: 420, fontFamily: 'Noto Sans KR', toolbar: { show: false } },
            colors: colors, stroke: { width: [2, 2, 2, 2, 4, 2], curve: 'smooth', dashArray: [0, 0, 0, 0, 8, 5] },
            xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
            tooltip: { y: { formatter: formatKrwSmall } },
            legend: { position: 'top', fontWeight: 600 },
            responsive: [{
                breakpoint: 600,
                options: {
                    xaxis: { tickAmount: 5 },
                    chart: { height: 350 },
                    legend: { position: 'bottom' }
                }
            }]
        });
        assetChartInst.render();
    }

    const incomeEl = document.querySelector("#incomeChart");
    if (incomeEl) {
        const incomeSeries = [{ name: "근로 월 소득", data: history.map(h => h.income) }, { name: "지출 (건보료 포함)", data: history.map(h => h.expense) }];
        let iColors = currentTheme === 'dark' ? ['#3b82f6', '#fca5a5'] : ['#1d4ed8', '#ef4444'];
        if(incomeChartInst) {
            incomeChartInst.updateOptions({ theme: { mode: currentTheme }, colors: iColors });
            incomeChartInst.updateSeries(incomeSeries);
        } else {
            incomeChartInst = new ApexCharts(incomeEl, {
                series: incomeSeries, theme: { mode: currentTheme },
                chart: { background: 'transparent', type: 'line', width: '100%', height: 320, fontFamily: 'Noto Sans KR', toolbar: { show: false } },
                colors: iColors, stroke: { width: 4, curve: 'smooth', dashArray: [0, 8] },
                xaxis: { categories: xCategories, tickAmount: 10 }, yaxis: { labels: { formatter: formatKrwSmall } },
                tooltip: { y: { formatter: formatKrwSmall } },
                responsive: [{
                    breakpoint: 600,
                    options: {
                        xaxis: { tickAmount: 5 },
                        chart: { height: 280 }
                    }
                }]
            });
            incomeChartInst.render();
        }
    }
}

function renderAccelChart(hNoDiv, hNoRe, hRe) {
    const chartEl = document.querySelector("#accelChart");
    if (!chartEl || !hNoDiv) return;
    
    const series = [
        { name: "배당 X", data: hNoDiv.map(h => h.total) },
        { name: "배당 소비", data: hNoRe.map(h => h.total) },
        { name: "배당 재투자", data: hRe.map(h => h.total) }
    ];
    let colors = currentTheme === 'dark' ? ['#94a3b8', '#fca5a5', '#3b82f6'] : ['#64748b', '#ef4444', '#1d4ed8'];

    if(accelChartInst) {
        accelChartInst.updateOptions({ theme: { mode: currentTheme }, colors });
        accelChartInst.updateSeries(series);
    } else {
        accelChartInst = new ApexCharts(chartEl, {
            series: series, theme: { mode: currentTheme },
            chart: { type: 'line', width: '100%', height: 350, fontFamily: 'Noto Sans KR', toolbar: { show: false }, background: 'transparent' },
            colors: colors, stroke: { width: [3, 3, 5], curve: 'smooth' },
            xaxis: { categories: hNoDiv.map(h => h.age + '세'), tickAmount: 10 },
            yaxis: { labels: { formatter: formatKrwSmall } },
            tooltip: { y: { formatter: formatKrwSmall } },
            responsive: [{
                breakpoint: 600,
                options: {
                    xaxis: { tickAmount: 5 }
                }
            }]
        });
        accelChartInst.render();
    }
}


/**
 * Capture Premium Share Card and Share via Web Share API or Download
 */
async function shareReportAsImage() {
    const card = document.getElementById('premiumShareCard');
    const btn = document.getElementById('btnShareImage');
    const ageEl = document.getElementById('resAge');
    const gapEl = document.getElementById('resGapAmount');
    
    if (!card || !btn) return;
    
    // Update Share Card Data before capture
    const shareAge = document.getElementById('shareAge');
    const shareGapText = document.getElementById('shareGapText');
    
    if (shareAge && ageEl) shareAge.innerText = ageEl.innerText;
    if (shareGapText && gapEl) {
        shareGapText.innerText = gapEl.innerText;
        // Apply success/error theme based on visibility
        if (gapEl.classList.contains('text-success')) {
            shareGapText.className = 'share-gap gap-success';
        } else {
            shareGapText.className = 'share-gap gap-error';
        }
    }
    
    // UI Feedback
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinning">sync</span> 생성 중...';

    try {
        // Render hidden card to canvas
        const canvas = await html2canvas(card, {
            scale: 2, // High resolution
            backgroundColor: null,
            logging: false,
            useCORS: true
        });
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'smart-fire-report.png', { type: 'image/png' });

        // Check if Web Share API for files is supported
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Smart KR-FIRE 은퇴 리포트',
                text: '나의 조기 은퇴 시나리오를 확인해보세요!'
            });
        } else {
            // Fallback for Desktop: Download
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `Smart-FIRE-Report-${new Date().getTime()}.png`;
            link.click();
            alert('공유 기능을 지원하지 않는 환경입니다. 이미지를 다운로드합니다.');
        }
    } catch (err) {
        console.error("Capture or Share failed:", err);
        alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}


document.addEventListener('DOMContentLoaded', init);
