/**
 * Intelligent Variable FIRE Engine
 * - 5 Point Line Interpolation
 * - Life Events Integration
 * - Stress Test Execution
 */

// 다차원 선형 보간기
function getInterpolatedValue(age, points) {
    // points 에는 { age, income } 오름차순 객체가 들어온다고 가정
    if (age <= points[0].age) return points[0].income;
    if (age >= points[points.length - 1].age) return points[points.length - 1].income;

    // 해당 구간 찾기
    for (let i = 0; i < points.length - 1; i++) {
        let p1 = points[i];
        let p2 = points[i+1];
        if (age >= p1.age && age <= p2.age) {
            // Lerp
            let ratio = (age - p1.age) / (p2.age - p1.age);
            return p1.income + ratio * (p2.income - p1.income);
        }
    }
    return 0;
}

/**
 * runSimulation
 * @param {Object} inputs
 * {
 *   age, targetExpense, initialAsset, realFixed, stockReturn, realestateReturn, stockRatio,
 *   incomeCurvePoints: [...],   // {age, income} 5개
 *   lifeEvents: [...],          // {age, amount} 
 *   isStressTest: boolean
 * }
 */
function runSimulation(inputs) {
    let {
        age, targetExpense, initialAsset, realFixed,
        stockReturn, realestateReturn, stockRatio,
        incomeCurvePoints, lifeEvents, isStressTest
    } = inputs;

    let targetAsset = targetExpense * 12 * 25; // 4% Rule
    
    // 초기 자산 배분: 
    // realFixed(부동산) 을 시작 자산에서 뺌. (단 초기 자산을 초과할 순 없음)
    let actualReal = Math.min(realFixed, initialAsset);
    let remainingLiquid = initialAsset - actualReal;
    
    // 현금과 주식 (여유 투자금 배분에 따라 나눔)
    let totalRealEstate = actualReal;
    let totalStock = remainingLiquid * (stockRatio / 100);
    // cash는 사실상 주식 외 여유 자금. 하지만 이 시뮬에서는 단순 복리를 위해 
    // 예/적금(수익 0~1%) 개념은 생략하거나 주식/현금을 stockRate에 태우기로 했으므로
    // 나머지는 무수익 잔액(Cash)으로 둡니다.
    let totalCash = remainingLiquid - totalStock;

    const MAX_AGE = 100;
    
    const monthlyRealReturn = realestateReturn / 100 / 12;

    const history = [];
    let fireAge = null;
    let fireAsset = null;
    
    let isBroke = false;

    // 1개월 단위 루프
    for (let m = 0; age + m/12 <= MAX_AGE; m++) {
        let currentAge = age + m/12;
        let isExactYear = m % 12 === 0;
        let yearFloor = Math.floor(currentAge);
        
        // 수익률 결정 로직
        let currentStockYield = stockReturn / 100 / 12;
        
        // Stress Test: 초기 3년간 하락장 시뮬레이션
        if (isStressTest && m < 36) { 
            // 3년 동안 주식 수익률 연 -10% 고정
            currentStockYield = -10 / 100 / 12;
        }

        // 1. 소득 계산 (연령에 따른 곡선 보간 반영)
        let currentMonthlyIncome = getInterpolatedValue(currentAge, incomeCurvePoints);
        if (currentMonthlyIncome < 0) currentMonthlyIncome = 0;

        let monthlyInvestment = currentMonthlyIncome - targetExpense;
        let depositToStock = 0;
        let depositToCash = 0;
        
        if (monthlyInvestment > 0) {
            depositToStock = monthlyInvestment * (stockRatio / 100);
            depositToCash = monthlyInvestment - depositToStock;
        } else {
            // 적자 발생 시 현금(Cash)부터 차감
            depositToCash = monthlyInvestment;
        }

        totalCash += depositToCash;
        if (totalCash < 0) {
            totalStock += totalCash; // 주식 매도
            totalCash = 0;
        }
        
        // 2. 라이프 이벤트 반영 (연초에 일시불 지출)
        if (isExactYear) {
            let evt = lifeEvents.find(e => e.age === yearFloor);
            if (evt) {
                // evt.amount 단위는 만 원
                if (evt.amount > 0) {
                    // 수입은 현금으로 쌓임
                    totalCash += evt.amount;
                } else {
                    // 지출 시
                    totalCash += evt.amount; 
                    if (totalCash < 0) {
                        totalStock += totalCash; // 현금 고갈시 주식 매도
                        totalCash = 0;
                    }
                    if (totalStock < 0) {
                        totalRealEstate += totalStock; // 주식 고갈시 부동산 매각(가정)
                        totalStock = 0;
                    }
                }
            }
        }
        
        // 파산 검증
        if (totalRealEstate < 0) {
            totalRealEstate = 0;
            isBroke = true;
        }
        
        // 3. 자산 증식(복리) 적용
        if (!isBroke) {
            totalStock = (totalStock + depositToStock) * (1 + currentStockYield);
            totalRealEstate = totalRealEstate * (1 + monthlyRealReturn);
        }
        
        let currentTotalAsset = totalCash + totalStock + totalRealEstate;
        if(currentTotalAsset < 0) currentTotalAsset = 0;

        // 차트용 스냅샷 저장
        if (isExactYear) {
            history.push({
                age: yearFloor,
                cash: Math.round(totalCash),
                stock: Math.round(totalStock),
                realestate: Math.round(totalRealEstate),
                total: Math.round(currentTotalAsset),
                income: Math.round(currentMonthlyIncome),
                expense: targetExpense
            });
            
            // 파이어 조건 (총자산의 4% > 목표연간지출) 체크
            if (!fireAge && currentTotalAsset * 0.04 >= targetExpense * 12) {
                fireAge = yearFloor;
                fireAsset = Math.round(currentTotalAsset);
            }
        }
        
        if (isBroke) break;
    }

    return {
        fireAge,
        targetAsset: Math.round(targetAsset),
        fireAsset,
        history,
        isBroke
    };
}
