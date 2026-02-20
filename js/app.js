// UI State
let currentModalTarget = 'from';

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Qwen DAO DEX Loaded");
    
    // Auto-detect pool on page load (even before wallet connect)
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.BrowserProvider(window.ethereum);
        detectPool().then(() => {
            updatePoolStatusUI(POOL_EXISTS);
        });
    }
});

// ... (fungsi-fungsi lainnya tetap sama)

// Update Pool Status UI (tambah fungsi ini)
function updatePoolStatusDisplay() {
    const statusDisplay = document.getElementById('pool-status-display');
    const addressDisplay = document.getElementById('pool-address-display');
    
    if (POOL_EXISTS && DETECTED_POOL_ADDRESS) {
        statusDisplay.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-green-400"></span>
            <span class="text-sm text-green-400 font-medium">Active</span>
            <span class="text-xs text-slate-400 ml-2">@ ${getFeeTierLabel(DETECTED_FEE_TIER)}</span>
        `;
        addressDisplay.innerText = `Pool: ${DETECTED_POOL_ADDRESS.substring(0, 10)}...${DETECTED_POOL_ADDRESS.substring(38)}`;
    } else {
        statusDisplay.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-red-400"></span>
            <span class="text-sm text-red-400 font-medium">No Pool Found</span>
        `;
        addressDisplay.innerText = "Create a liquidity pool first on Uniswap";
    }
}

// Update toggleSettings function to refresh pool status
function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
    
    // Refresh pool status when opening settings
    if (!modal.classList.contains('hidden')) {
        updatePoolStatusDisplay();
    }
}

// ... (fungsi-fungsi lainnya tetap sama)
