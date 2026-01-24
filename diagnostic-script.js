// ============================================
// DIAGNOSTIC SCRIPT - Run in Browser Console
// ============================================
// This script helps diagnose the evaluation data issue
// Copy and paste this entire script into the browser console (F12)
// ============================================

console.log('🔍 DIAGNOSTIC SCRIPT - Evaluation Data Check');
console.log('='.repeat(60));

// 1. Check mockDB structure
const mockDB = JSON.parse(localStorage.getItem('mockDB'));
console.log('\n📦 MockDB Structure:');
console.log('- Evaluations:', mockDB?.evaluations?.length || 0);
console.log('- Evaluation Items:', mockDB?.evaluation_items?.length || 0);

// 2. Check latest evaluation
if (mockDB?.evaluations?.length > 0) {
    const latestEval = mockDB.evaluations[mockDB.evaluations.length - 1];
    console.log('\n📋 Latest Evaluation:');
    console.log('- ID:', latestEval.id);
    console.log('- Ticket:', latestEval.ticket_id);
    console.log('- Score:', latestEval.final_score);

    // 3. Check items for this evaluation
    const evalItems = mockDB.evaluation_items.filter(item => item.evaluation_id === latestEval.id);
    console.log('\n📝 Evaluation Items (' + evalItems.length + ' total):');

    // Group by criterion_key to see the pattern
    const itemsByKey = {};
    evalItems.forEach(item => {
        if (!itemsByKey[item.criterion_key]) {
            itemsByKey[item.criterion_key] = [];
        }
        itemsByKey[item.criterion_key].push(item.value);
    });

    console.log('Items by criterion_key:');
    Object.keys(itemsByKey).sort().forEach(key => {
        console.log(`  ${key}: ${itemsByKey[key].join(', ')}`);
    });

    // 4. Check if IDs are uppercase or lowercase
    const hasUppercase = evalItems.some(item => item.criterion_key === item.criterion_key.toUpperCase());
    const hasLowercase = evalItems.some(item => item.criterion_key === item.criterion_key.toLowerCase() && item.criterion_key !== item.criterion_key.toUpperCase());

    console.log('\n🔤 Case Analysis:');
    console.log('- Has UPPERCASE IDs:', hasUppercase);
    console.log('- Has lowercase IDs:', hasLowercase);

    // 5. Sample items
    console.log('\n📄 Sample Items (first 5):');
    evalItems.slice(0, 5).forEach(item => {
        console.log(`  ${item.criterion_key} = ${item.value} (${item.notes || 'no notes'})`);
    });
}

// 6. Check FRAMEWORK (if available globally)
if (window.FRAMEWORK) {
    console.log('\n🏗️ FRAMEWORK IDs:');
    Object.keys(window.FRAMEWORK).forEach(pillar => {
        const ids = window.FRAMEWORK[pillar].items.map(item => item.id);
        console.log(`  ${pillar}: ${ids.join(', ')}`);
    });
} else {
    console.log('\n⚠️ FRAMEWORK not available globally');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Diagnostic complete! Check the output above.');
console.log('📋 Copy this output and share with the developer.');
