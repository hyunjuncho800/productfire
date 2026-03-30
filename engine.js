/**
 * Intelligent Variable FIRE Engine v6 (Smart KR-FIRE / Material 3)
 * - KR Health Insurance Penalty (건강보험료 8% 징수)
 * - KR Financial Comprehensive Tax (종합소득세 26.4% 징수)
 * - Income Decay Curve (정점 이후 소득 감소 곡선)
 */

const BUSINESS_CYCLE_SHAPE = [ 1.15, 1.15, 1.10, 1.12, 1.18, 1.08, 1.05, 0.98, 0.65, 1.35 ];

function getAdjusted10YearCycle(targetAnnualReturnPercentage) {
    const targetMultiplier = Math.pow(1 + targetAnnualReturnPercentage / 100, 10);
    const targetLog = Math.log(targetMultiplier);
    
    let shapeLogSum = 0;
    for (let shape of BUSINESS_CYCLE_SHAPE) { shapeLogSum += Math.log(shape); }
    
    const delta = (targetLog - shapeLogSum) / 10;
    let adjustedCycle = [];
    for (let i = 0; i < 10; i++) {
        let adjLog = Math.log(BUSINESS_CYCLE_SHAPE[i]) + delta;
        adjustedCycle[i] = Math.exp(adjLog) - 1; 
    }
    return adjustedCycle;
}

function runSimulation(inputs) {
    let {
        age, targetAge, salary, inflationRate, expense, 
        cash, stock, realestate,
        stockReturn, realestateReturn, stockRatio,
        lifeEvents, isStressTest,
        divYield, divGrowth, accountType, reinvestDiv,
        peakAge, incomeDecayRate // V6 New Variables
    } = inputs;

    const cycleReturns = getAdjusted10YearCycle(stockReturn);
    
    let totalCash = cash;
    let totalStock = stock;
    let totalRealEstate = realestate;

    let isaTaxFreeRemaining = 200; // 200만 원
    let cumulativeTaxPaid = 0;
    let cumulativeNhiPaid = 0; // 누적 건강보험료 납부액
    let currentDivYield = (divYield || 0) / 100;
    let currentMonthlyDividendCoverage = 0; 
    let currentYearTotalDividend = 0;

    const MAX_AGE = 100;
    const monthlyRealReturn = realestateReturn / 100 / 12;
    const trueMonthlyInflation = Math.pow(1 + inflationRate/100, 1/12) - 1; 
    
    const history = [];
    let fireAgeExact = null;
    let fireAsset = null;
    let targetAssetAtFire = null;
    let isBroke = false;

    let assetAtTargetAge = null;
    let requiredAssetAtTargetAge = null;

    for (let m = 0; age + m/12 <= MAX_AGE; m++) {
        let currentMonthAge = age + m/12;
        let isExactYear = m % 12 === 0;
        let yearFloor = Math.floor(currentMonthAge);
        let yearIndex = Math.floor(m / 12);
        
        let currentYearReturn = cycleReturns[yearIndex % 10]; 
        if (isStressTest && yearIndex < 3) currentYearReturn = -0.10;
        let currentMonthlyStockReturn = Math.pow(1 + currentYearReturn, 1/12) - 1;

        // V6 Income Decay Logic
        let currentNominalSalary = salary * Math.pow(1 + trueMonthlyInflation, m);
        if (currentMonthAge > peakAge) {
            let monthsPastPeak = (currentMonthAge - peakAge) * 12;
            let decayDecimal = incomeDecayRate / 100;
            // Handle 100% drop case securely
            let monthlyDecay = decayDecimal >= 1 ? 0 : Math.pow(1 - decayDecimal, 1/12);
            currentNominalSalary = currentNominalSalary * Math.pow(monthlyDecay, monthsPastPeak);
        }

        let currentNominalExpense = expense * Math.pow(1 + trueMonthlyInflation, m);

        // V6 Health Insurance Logic (지역가입자 건보료 충격)
        let isRetired = currentNominalSalary < 100; // 월소득 100만 미만이면 실질적 은퇴자(지역가입자)로 분류
        let penaltyNhiMonthly = 0;
        if (isRetired) {
            // 기본 재산분 건보료 25만 + 인플레
            let baseNhi = 25 * Math.pow(1 + trueMonthlyInflation, m);
            // 금융소득 비례 건보료 (연 1000만 초과 배당 시 8% 추가 징수)
            let estimatedYearlyDiv = totalStock * currentDivYield; 
            let extraNhi = estimatedYearlyDiv > 1000 ? (estimatedYearlyDiv * 0.08) / 12 : 0;
            
            penaltyNhiMonthly = baseNhi + extraNhi;
            cumulativeNhiPaid += penaltyNhiMonthly;
        }

        // 지출에 건보료 강제 합산
        currentNominalExpense += penaltyNhiMonthly;
        
        // 월별 투자 및 생활비
        let monthlyInvestment = currentNominalSalary - currentNominalExpense;
        let depositToStock = 0;
        let depositToCash = 0;
        
        if (monthlyInvestment > 0) {
            depositToStock = monthlyInvestment * (stockRatio / 100);
            depositToCash = monthlyInvestment - depositToStock;
        } else {
            depositToCash = monthlyInvestment;
        }

        totalCash += depositToCash;
        if (totalCash < 0) {
            totalStock += totalCash; 
            totalCash = 0;
        }
        
        // 라이프 이벤트 
        if (isExactYear) {
            let evt = lifeEvents.find(e => e.age === yearFloor);
            if (evt) {
                let amt = evt.amount; 
                if (amt > 0) {
                    totalCash += amt;
                } else {
                    totalCash += amt; 
                    if (totalCash < 0) { totalStock += totalCash; totalCash = 0; }
                    if (totalStock < 0) { totalRealEstate += totalStock; totalStock = 0; }
                }
            }

            // V6 KR Tax Engine (금융소득종합과세 폭탄 적용)
            if (m > 0 && currentDivYield > 0) {
                let yearlyDividend = totalStock * currentDivYield; 
                currentYearTotalDividend = yearlyDividend;
                currentMonthlyDividendCoverage = (yearlyDividend / 12) / currentNominalExpense; 

                let taxToPay = 0;
                
                if (accountType === 'general') {
                    if (yearlyDividend <= 2000) {
                        taxToPay = yearlyDividend * 0.154; // 배당소득세
                    } else {
                        // 종합소득세 과세 구간: 2000초과분에 대해 가혹한 누진세(26.4%) 모델 적용
                        taxToPay = (2000 * 0.154) + ((yearlyDividend - 2000) * 0.264);
                    }
                } else if (accountType === 'isa') {
                    let taxFreeApplied = Math.min(yearlyDividend, isaTaxFreeRemaining);
                    isaTaxFreeRemaining -= taxFreeApplied;
                    taxToPay = (yearlyDividend - taxFreeApplied) * 0.099;
                } else if (accountType === 'pension') {
                    taxToPay = 0; // 전액 과세 이연
                }

                cumulativeTaxPaid += taxToPay;
                let netDividend = yearlyDividend - taxToPay;

                if (reinvestDiv) {
                    totalStock += netDividend;
                } else {
                    totalCash += netDividend;
                }
                
                currentDivYield = currentDivYield * (1 + ((divGrowth || 0) / 100)); // 배당성장률 누적
            }
        }
        
        if (totalRealEstate < 0) { totalRealEstate = 0; isBroke = true; }
        
        if (!isBroke) {
            totalStock = (totalStock + depositToStock) * (1 + currentMonthlyStockReturn);
            totalRealEstate = totalRealEstate * (1 + monthlyRealReturn);
        }
        
        let currentTotalAsset = totalCash + totalStock + totalRealEstate;
        if(currentTotalAsset < 0) currentTotalAsset = 0;

        let currentTargetAsset = currentNominalExpense * 12 * 25; // 4% Rule 기준 필요 자산

        if (isExactYear) {
            history.push({
                age: yearFloor,
                cash: Math.round(totalCash),
                stock: Math.round(totalStock),
                realestate: Math.round(totalRealEstate),
                total: Math.round(currentTotalAsset),
                income: Math.round(currentNominalSalary),
                expense: Math.round(currentNominalExpense),
                target: Math.round(currentTargetAsset),
                cumulativeTax: Math.round(cumulativeTaxPaid),
                cumulativeNhi: Math.round(cumulativeNhiPaid),
                divCoverage: currentMonthlyDividendCoverage * 100
            });
            
            if (yearFloor === targetAge) {
                assetAtTargetAge = currentTotalAsset;
                requiredAssetAtTargetAge = currentTargetAsset;
            }
        }

        // 파이어 조기 달성 역산
        if (!fireAgeExact && currentTotalAsset >= currentTargetAsset && currentTargetAsset > 0) {
            fireAgeExact = currentMonthAge;
            fireAsset = Math.round(currentTotalAsset);
            targetAssetAtFire = Math.round(currentTargetAsset);
        }

        if (isBroke) break;
    }

    let fireAge = fireAgeExact ? Math.ceil(fireAgeExact * 10) / 10 : null;

    return { 
        fireAgeExact, fireAge,
        targetAssetAtFire: targetAssetAtFire || 0,
        fireAsset, history, isBroke,
        assetAtTargetAge, requiredAssetAtTargetAge,
        cumulativeTaxPaid, cumulativeNhiPaid
    };
}
