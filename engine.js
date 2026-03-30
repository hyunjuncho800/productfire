/**
 * Intelligent Variable FIRE - Simulation Engine (v7.6 Unified)
 */

function getAdjusted10YearCycle(baseReturn) {
    const BUSINESS_CYCLE_SHAPE = [1.2, 0.8, 1.5, 0.5, 1.1, 0.9, 1.3, 0.7, 1.4, 0.6];
    let adjustedCycle = [];
    let avg = BUSINESS_CYCLE_SHAPE.reduce((a,b)=>a+b, 0) / 10;
    let delta = Math.log(1 + baseReturn/100) - Math.log(avg);
    
    for(let i=0; i<10; i++) {
        let adjLog = Math.log(BUSINESS_CYCLE_SHAPE[i]) + delta;
        adjustedCycle[i] = (Math.exp(adjLog) - 1) * 100; // Percent
    }
    return adjustedCycle;
}

function runSimulation(inputs) {
    let {
        age, targetAge, salary, inflationRate, expense, 
        cash, stock, divStock, realestate,
        stockReturn, realestateReturn, stockRatio,
        lifeEvents, isStressTest,
        divYield, divGrowth, accountType, reinvestDiv,
        peakAge, incomeDecayRate
    } = inputs;

    const cycleReturns = getAdjusted10YearCycle(stockReturn);
    
    let totalCash = cash || 0;
    let totalStock = stock || 0;
    let totalDivStock = divStock || 0;
    let totalRealEstate = realestate || 0;

    let isaTaxFreeRemaining = 200; // 만 원
    let cumulativeTaxPaid = 0;
    let cumulativeNhiPaid = 0;
    let currentDivYield = (divYield || 0) / 100;
    
    const MAX_AGE = 100;
    const monthlyRealReturn = realestateReturn / 100 / 12;
    const trueMonthlyInflation = Math.pow(1 + inflationRate/100, 1/12) - 1; 
    
    const history = [];
    let fireAgeExact = null;
    let fireAsset = null;
    let targetAssetAtFire = null;
    let assetAtTargetAge = null;
    let requiredAssetAtTargetAge = null;

    for (let m = 0; age + m/12 <= MAX_AGE; m++) {
        let currentMonthAge = age + m/12;
        let isExactYear = m % 12 === 0;
        let yearFloor = Math.floor(currentMonthAge);
        let yearIndex = Math.floor(m / 12);
        
        // 1. Returns & Inflation
        let currentYearAnnReturn = cycleReturns[yearIndex % 10]; 
        if (isStressTest && yearIndex < 3) currentYearAnnReturn = -12; // Crisis
        let monthlyStockReturn = Math.pow(1 + currentYearAnnReturn/100, 1/12) - 1;

        // 2. Growth
        totalStock *= (1 + monthlyStockReturn);
        totalDivStock *= (1 + monthlyStockReturn);
        totalRealEstate *= (1 + monthlyRealReturn);

        // 3. Income & Expense (Nominal)
        let currentNominalSalary = salary * Math.pow(1 + trueMonthlyInflation, m);
        if (currentMonthAge > peakAge) {
            let monthsPastPeak = (currentMonthAge - peakAge) * 12;
            let decayDecimal = incomeDecayRate / 100;
            let monthlyDecay = decayDecimal >= 1 ? 0 : Math.pow(1 - decayDecimal, 1/12);
            currentNominalSalary *= Math.pow(monthlyDecay, monthsPastPeak);
        }
        let currentNominalExpense = expense * Math.pow(1 + trueMonthlyInflation, m);

        // 4. Health Insurance (NHI)
        let isRetired = currentNominalSalary < 100;
        let penaltyNhiMonthly = 0;
        if (isRetired) {
            let baseNhi = 25 * Math.pow(1 + trueMonthlyInflation, m);
            let estimatedYearlyDiv = totalDivStock * currentDivYield; 
            let extraNhi = estimatedYearlyDiv > 1000 ? (estimatedYearlyDiv * 0.08) / 12 : 0;
            penaltyNhiMonthly = baseNhi + extraNhi;
            cumulativeNhiPaid += penaltyNhiMonthly;
        }
        currentNominalExpense += penaltyNhiMonthly;
        
        // 5. Savings
        let monthlyInvestment = currentNominalSalary - currentNominalExpense;
        if (monthlyInvestment > 0) {
            let depositToStock = monthlyInvestment * (stockRatio / 100);
            totalStock += depositToStock;
            totalCash += (monthlyInvestment - depositToStock);
        } else {
            totalCash += monthlyInvestment;
        }

        // 6. Annual Events (Dividends & LifeEvents)
        if (isExactYear && m > 0) {
            // Dividends
            let yearlyDividend = totalDivStock * currentDivYield;
            let taxToPay = 0;
            if (accountType === 'general') {
                taxToPay = yearlyDividend <= 2000 ? yearlyDividend * 0.154 : (2000 * 0.154) + ((yearlyDividend - 2000) * 0.264);
            } else if (accountType === 'isa') {
                let taxFree = Math.min(yearlyDividend, isaTaxFreeRemaining);
                isaTaxFreeRemaining -= taxFree;
                taxToPay = (yearlyDividend - taxFree) * 0.099;
            } else if (accountType === 'pension') {
                taxToPay = 0;
            }
            cumulativeTaxPaid += taxToPay;
            let netDividend = yearlyDividend - taxToPay;
            if (reinvestDiv) totalDivStock += netDividend; else totalCash += netDividend;
            
            // Dividend Growth
            currentDivYield *= (1 + (divGrowth || 0) / 100);

            // Life Events
            let evt = lifeEvents.find(e => e.age === yearFloor);
            if (evt) {
                totalCash += evt.amount;
            }
        }

        // Debt/Broke Handler
        if (totalCash < 0) { totalStock += totalCash; totalCash = 0; }
        if (totalStock < 0) { totalDivStock += totalStock; totalStock = 0; }
        if (totalDivStock < 0) { totalRealEstate += totalDivStock; totalDivStock = 0; }
        if (totalRealEstate < 0) totalRealEstate = 0;

        // 7. FIRE Detection & History
        let currentTotal = totalCash + totalStock + totalDivStock + totalRealEstate;
        let safetyMargin = (currentNominalExpense * 12) / 0.04;

        if (isExactYear) {
            if (yearFloor === targetAge) {
                assetAtTargetAge = currentTotal;
                requiredAssetAtTargetAge = safetyMargin;
            }
            if (!fireAgeExact && currentTotal >= safetyMargin && safetyMargin > 0) {
                fireAgeExact = currentMonthAge;
                fireAsset = currentTotal;
                targetAssetAtFire = safetyMargin;
            }
            history.push({
                age: yearFloor, total: Math.round(currentTotal),
                cash: Math.round(totalCash), stock: Math.round(totalStock),
                divStock: Math.round(totalDivStock), realestate: Math.round(totalRealEstate),
                target: Math.round(safetyMargin), income: Math.round(currentNominalSalary),
                expense: Math.round(currentNominalExpense)
            });
        }
    }

    return { 
        fireAge: fireAgeExact ? Math.ceil(fireAgeExact * 10) / 10 : null,
        fireAsset, targetAssetAtFire, assetAtTargetAge, requiredAssetAtTargetAge,
        cumulativeTaxPaid, cumulativeNhiPaid, history
    };
}
