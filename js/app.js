// UI State
let currentModalTarget = 'from';

// Initialize App
document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 Qwen DAO DEX Loaded");
    
    // Initialize Reown AppKit first
    await initReownAppKit();
    
    // Auto-detect pool on page load
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.BrowserProvider(window.ethereum);
        detectPool().then(() => {
            updatePoolStatusUI(POOL_EXISTS);
        });
    }
});

// Switch Tab (Swap/Pool)
function switchTab(tab) {
    const swapView = document.getElementById('view-swap');
    const poolView = document.getElementById('view-pool');
    const btnSwap = document.getElementById('btn-swap');
    const btnPool = document.getElementById('btn-pool');

    if (tab === 'swap') {
        swapView.classList.remove('hidden');
        poolView.classList.add('hidden');
        btnSwap.classList.replace('text-slate-400', 'text-white');
        btnSwap.classList.add('bg-slate-700');
        btnPool.classList.replace('text-white', 'text-slate-400');
        btnPool.classList.remove('bg-slate-700');
    } else {
        swapView.classList.add('hidden');
        poolView.classList.remove('hidden');
        btnPool.classList.replace('text-slate-400', 'text-white');
        btnPool.classList.add('bg-slate-700');
        btnSwap.classList.replace('text-white', 'text-slate-400');
        btnSwap.classList.remove('bg-slate-700');
    }
}

// Toggle Settings Modal
function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        updatePoolStatusDisplay();
    }
}

// Close settings when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('settings-modal');
    const btn = document.querySelector('button[onclick="toggleSettings()"]');
    if (modal && btn && !modal.contains(event.target) && !btn.contains(event.target) && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
    }
});

// Toggle Switch (ON/OFF)
function toggleSwitch(id) {
    const checkbox = document.getElementById(id);
    console.log(`${id} is now ${checkbox.checked ? 'ON' : 'OFF'}`);
}

// Token Modal
function openTokenModal(target) {
    currentModalTarget = target;
    document.getElementById('token-modal').classList.remove('hidden');
    fetchBalances();
}

function closeTokenModal() {
    document.getElementById('token-modal').classList.add('hidden');
}

function selectToken(symbol) {
    const labelEl = document.getElementById(`label-${currentModalTarget}`);
    const iconEl = document.getElementById(`icon-${currentModalTarget}`);
    
    labelEl.innerText = symbol;
    
    if(symbol === 'ETH') iconEl.src = "https://cryptologos.cc/logos/ethereum-eth-logo.png";
    else if(symbol === 'QWEN') iconEl.src = "https://cdn-icons-png.flaticon.com/512/6132/6132976.png";

    closeTokenModal();
    checkInputState();
}

// Check Input & Fetch Price
function checkInputState() {
    const input = document.getElementById('input-amount');
    const btn = document.getElementById('swap-action-btn');
    const priceInfo = document.getElementById('price-info');
    
    const val = parseFloat(input.value);
    
    if(val > 0) {
        btn.innerText = "Swap";
        btn.disabled = false;
        
        clearTimeout(priceDebounceTimer);
        priceDebounceTimer = setTimeout(() => {
            priceInfo.innerText = "Fetching price...";
            priceInfo.classList.add('loading-text');
            fetchPriceFromUniswap(val);
        }, 500);
        
    } else {
        btn.innerText = "Enter an amount";
        btn.disabled = true;
        priceInfo.innerText = "?? QWEN";
        priceInfo.classList.remove('loading-text');
        document.getElementById('price-per-token').innerHTML = `<span class="text-yellow-400">●</span> Detecting pool...`;
    }
}

// Handle Swap Button
async function handleSwap() {
    if (!userAddress) {
        openConnectModal();
        return;
    }

    const btn = document.getElementById('swap-action-btn');
    const inputVal = document.getElementById('input-amount').value;

    if(isSwapping) return;
    isSwapping = true;

    const originalText = btn.innerText;
    btn.innerText = "Confirm in Wallet...";
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-wait');

    try {
        const txHash = await executeSwap(inputVal, 0);
        
        alert(`✅ Swap Successful!\n\nSent: ${inputVal} ETH\nFee Tier: ${getFeeTierLabel(DETECTED_FEE_TIER)}\n\nTx Hash: ${txHash}`);
        
        document.getElementById('input-amount').value = '';
        checkInputState();
        fetchBalances();

    } catch (error) {
        console.error("Swap failed:", error);
        alert("Swap Failed or Rejected: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-wait');
        isSwapping = false;
    }
}

// Update Pool Status Display
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

// Event Listeners
document.getElementById('input-amount').addEventListener('input', checkInputState);
