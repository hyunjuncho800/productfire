/**
 * Intelligent Variable FIRE Engine v5 (Tax & Dividend Reinvestment)
 * - Inflation & Big Mac Future Price Math
 * - Target Age Gap analysis
 * - Business Cycle array execution
 * - Dividend Reinvestment & Tax Accelerated Account Logic
 */

const BUSINESS_CYCLE_SHAPE = [ 1.15, 1.15, 1.10, 1.12, 1.18, 1.08, 1.05, 0.98, 0.65, 1.35 ];

function getAdjusted10YearCycle(targetAnnualReturnPercentage) {
    const targetMultiplier = Math.pow(1 + targetAnnualReturnPercentage / 100, 10);
    const targetLog = Math.log(targetMultiplier);
    
    let shapeLogSum = 0;
    for (let shape of BUSINESS_CYCLE_SHAPE) {
        shapeLogSum += Math.log(shape);
    }
    
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
        // Dividend & Tax Simulation
        divYield, divGrowth, accountType, reinvestDiv
    } = inputs;

    const cycleReturns = getAdjusted10YearCycle(stockReturn);
    
    let totalCash = cash;
    let totalStock = stock;
    let totalRealEstate = realestate;

    let isaTaxFreeRemaining = 200; // 200만 원 Lifetime base for simplified model
    let cumulativeTaxPaid = 0;
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

        let currentNominalSalary = salary * Math.pow(1 + trueMonthlyInflation, m);
        let currentNominalExpense = expense * Math.pow(1 + trueMonthlyInflation, m);
        
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

            // Dividend & Tax execution at the start of the year (or end of previous)
            if (m > 0 && currentDivYield > 0) {
                let yearlyDividend = totalStock * currentDivYield; // Calculated based on current stock principal
                currentYearTotalDividend = yearlyDividend;
                currentMonthlyDividendCoverage = (yearlyDividend / 12) / currentNominalExpense; // Coverage Ratio

                let taxToPay = 0;
                
                if (accountType === 'general') {
                    // 15.4% flat
                    taxToPay = yearlyDividend * 0.154;
                } else if (accountType === 'isa') {
                    // Up to 200만 0%, excess 9.9%
                    let taxFreeApplied = Math.min(yearlyDividend, isaTaxFreeRemaining);
                    isaTaxFreeRemaining -= taxFreeApplied;
                    taxToPay = (yearlyDividend - taxFreeApplied) * 0.099;
                } else if (accountType === 'pension') {
                    // 0% Tax Deferred
                    taxToPay = 0; 
                }

                cumulativeTaxPaid += taxToPay;
                let netDividend = yearlyDividend - taxToPay;

                if (reinvestDiv) {
                    totalStock += netDividend;
                } else {
                    totalCash += netDividend;
                }
                
                // Dividend Growth applies to Yield
                currentDivYield = currentDivYield * (1 + ((divGrowth || 0) / 100));
            }
        }
        
        if (totalRealEstate < 0) {
            totalRealEstate = 0;
            isBroke = true;
        }
        
        if (!isBroke) {
            totalStock = (totalStock + depositToStock) * (1 + currentMonthlyStockReturn);
            totalRealEstate = totalRealEstate * (1 + monthlyRealReturn);
        }
        
        let currentTotalAsset = totalCash + totalStock + totalRealEstate;
        if(currentTotalAsset < 0) currentTotalAsset = 0;

        let currentTargetAsset = currentNominalExpense * 12 * 25;

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
                divCoverage: currentMonthlyDividendCoverage * 100 // To percentage
            });
            
            if (yearFloor === targetAge) {
                assetAtTargetAge = currentTotalAsset;
                requiredAssetAtTargetAge = currentTargetAsset;
            }
        }

        // Finer-grained fire Age (month precision)
        if (!fireAgeExact && currentTotalAsset >= currentTargetAsset && currentTargetAsset > 0) {
            fireAgeExact = currentMonthAge;
            fireAsset = Math.round(currentTotalAsset);
            targetAssetAtFire = Math.round(currentTargetAsset);
        }

        if (isBroke) break;
    }

    // fallback mapping if it never reached
    let fireAge = fireAgeExact ? Math.ceil(fireAgeExact * 10) / 10 : null;

    return { 
        fireAgeExact, 
        fireAge,
        targetAssetAtFire: targetAssetAtFire || 0,
        fireAsset, 
        history, 
        isBroke,
        assetAtTargetAge,
        requiredAssetAtTargetAge,
        cumulativeTaxPaid
    };
}
