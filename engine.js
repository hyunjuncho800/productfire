/**
 * Intelligent Variable FIRE Engine v4 (Cybernetic Edition)
 * - Inflation & Big Mac Future Price Math
 * - Target Age Gap analysis
 * - Business Cycle array execution
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
        lifeEvents, isStressTest
    } = inputs;

    const cycleReturns = getAdjusted10YearCycle(stockReturn);
    
    let totalCash = cash;
    let totalStock = stock;
    let totalRealEstate = realestate;

    const MAX_AGE = 100;
    const monthlyRealReturn = realestateReturn / 100 / 12;
    const trueMonthlyInflation = Math.pow(1 + inflationRate/100, 1/12) - 1; 
    
    const history = [];
    let fireAge = null;
    let fireAsset = null;
    let targetAssetAtFire = null;
    let isBroke = false;

    // To measure the Gap at Target Age
    let assetAtTargetAge = null;
    let requiredAssetAtTargetAge = null;

    for (let m = 0; age + m/12 <= MAX_AGE; m++) {
        let currentMonthAge = age + m/12;
        let isExactYear = m % 12 === 0;
        let yearFloor = Math.floor(currentMonthAge);
        let yearIndex = Math.floor(m / 12);
        
        // Stock returns with 3yr stress drop
        let currentYearReturn = cycleReturns[yearIndex % 10]; 
        if (isStressTest && yearIndex < 3) {
            currentYearReturn = -0.10;
        }
        let currentMonthlyStockReturn = Math.pow(1 + currentYearReturn, 1/12) - 1;

        // Salary and Expense continuous inflation
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
        
        // Custom Life Events Processing
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

        // 4% Rule -> Need 25 times the annual inflated expense
        let currentTargetAsset = currentNominalExpense * 12 * 25;

        // Yearly History Snapshot
        if (isExactYear) {
            history.push({
                age: yearFloor,
                cash: Math.round(totalCash),
                stock: Math.round(totalStock),
                realestate: Math.round(totalRealEstate),
                total: Math.round(currentTotalAsset),
                income: Math.round(currentNominalSalary),
                expense: Math.round(currentNominalExpense),
                target: Math.round(currentTargetAsset)
            });
            
            // Check Target Age Snapshot for Gap analysis
            if (yearFloor === targetAge) {
                assetAtTargetAge = currentTotalAsset;
                requiredAssetAtTargetAge = currentTargetAsset;
            }
            
            // Check Pure FIRE Attainment
            if (!fireAge && currentTotalAsset >= currentTargetAsset) {
                fireAge = yearFloor;
                fireAsset = Math.round(currentTotalAsset);
                targetAssetAtFire = Math.round(currentTargetAsset);
            }
        }
        if (isBroke) break;
    }

    return { 
        fireAge, 
        targetAssetAtFire: targetAssetAtFire || 0,
        fireAsset, 
        history, 
        isBroke,
        assetAtTargetAge,
        requiredAssetAtTargetAge
    };
}
