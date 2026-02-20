// Web3 State
let provider, signer, userAddress;
let isSwapping = false;
let isFetchingPrice = false;
let priceDebounceTimer = null;
let isPoolDetecting = false;

// ============================================
// CONNECT WALLET (DIRECT METAMASK)
// ============================================
async function connectWallet() {
    const btn = document.getElementById('connectBtn');
    
    if (typeof window.ethereum === 'undefined') {
        alert('⚠️ MetaMask tidak terinstall!\n\nSilakan install MetaMask dulu:\nhttps://metamask.io/download/');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }
    
    try {
        btn.innerText = 'Connecting...';
        btn.disabled = true;
        
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        const shortAddr = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        btn.innerText = shortAddr;
        btn.disabled = false;
        btn.classList.remove('bg-brand-primary', 'hover:bg-brand-primaryHover');
        btn.classList.add('bg-slate-700', 'hover:bg-slate-600');
        
        console.log('✅ Wallet connected:', userAddress);
        
        await detectPool();
        await fetchBalances();
        updatePoolStatusUI(POOL_EXISTS);
        
    } catch (error) {
        console.error('❌ Connection failed:', error);
        alert('Gagal connect wallet: ' + error.message);
        btn.innerText = 'Connect Wallet';
        btn.disabled = false;
    }
}

// ============================================
// AUTO-DETECT POOL
// ============================================
async function detectPool() {
    if (isPoolDetecting || !provider) return false;
    
    isPoolDetecting = true;
    console.log("🔍 Detecting pool for QWEN/WETH...");
    
    try {
        if (CONTRACTS.QWEN_WETH_POOL) {
            console.log('✅ Using known pool address:', CONTRACTS.QWEN_WETH_POOL);
            
            const pool = new ethers.Contract(CONTRACTS.QWEN_WETH_POOL, POOL_ABI, provider);
            
            try {
                const fee = await pool.fee();
                const liquidity = await pool.liquidity();
                const slot0 = await pool.slot0();
                
                DETECTED_POOL_ADDRESS = CONTRACTS.QWEN_WETH_POOL;
                DETECTED_FEE_TIER = fee;
                POOL_EXISTS = true;
                
                console.log(`✅ Pool verified!`);
                console.log(`   Address: ${DETECTED_POOL_ADDRESS}`);
                console.log(`   Fee Tier: ${getFeeTierLabel(fee)} (${fee})`);
                console.log(`   Liquidity: ${liquidity.toString()}`);
                console.log(`   Tick: ${slot0.tick}`);
                
                isPoolDetecting = false;
                return true;
                
            } catch (error) {
                console.error('❌ Pool address invalid:', error);
            }
        }
        
        console.log('🔍 Auto-detecting pool from factory...');
        const factory = new ethers.Contract(CONTRACTS.Factory, FACTORY_ABI, provider);
        
        for (const fee of FEE_TIERS) {
            try {
                const poolAddress = await factory.getPool(
                    CONTRACTS.WETH,
                    CONTRACTS.QWEN,
                    fee
                );
                
                if (poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000") {
                    DETECTED_POOL_ADDRESS = poolAddress;
                    DETECTED_FEE_TIER = fee;
                    POOL_EXISTS = true;
                    
                    console.log(`✅ Pool detected from factory!`);
                    console.log(`   Address: ${poolAddress}`);
                    console.log(`   Fee Tier: ${getFeeTierLabel(fee)} (${fee})`);
                    
                    await getPoolInfo(poolAddress);
                    
                    isPoolDetecting = false;
                    return true;
                }
            } catch (err) {
                continue;
            }
        }
        
        POOL_EXISTS = false;
        console.log("❌ No pool found for QWEN/WETH pair");
        isPoolDetecting = false;
        return false;
        
    } catch (error) {
        console.error("Error detecting pool:", error);
        isPoolDetecting = false;
        return false;
    }
}

// Get Pool Info
async function getPoolInfo(poolAddress) {
    try {
        const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
        
        const liquidity = await pool.liquidity();
        console.log(`💧 Pool Liquidity: ${liquidity.toString()}`);
        
        const slot0 = await pool.slot0();
        console.log(`📊 Current Tick: ${slot0.tick}`);
        
        updatePoolStatusUI(true);
        
    } catch (error) {
        console.error("Error getting pool info:", error);
        updatePoolStatusUI(false);
    }
}

// Update UI with pool status
function updatePoolStatusUI(poolExists) {
    const pricePerToken = document.getElementById('price-per-token');
    const poolStatusDisplay = document.getElementById('pool-status-display');
    const poolAddressDisplay = document.getElementById('pool-address-display');
    
    if (poolExists && DETECTED_FEE_TIER) {
        pricePerToken.innerHTML = `
            <span class="text-green-400">●</span> 
            1 ETH = ?? QWEN (@ ${getFeeTierLabel(DETECTED_FEE_TIER)})
        `;
        
        if (poolStatusDisplay) {
            poolStatusDisplay.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-green-400"></span>
                <span class="text-sm text-green-400 font-medium">Active</span>
                <span class="text-xs text-slate-400 ml-2">@ ${getFeeTierLabel(DETECTED_FEE_TIER)}</span>
            `;
        }
        
        if (poolAddressDisplay) {
            poolAddressDisplay.innerText = `Pool: ${DETECTED_POOL_ADDRESS.substring(0, 10)}...${DETECTED_POOL_ADDRESS.substring(38)}`;
        }
    } else {
        pricePerToken.innerHTML = `
            <span class="text-red-400">●</span> 
            No Pool Found - Create Pool First
        `;
        
        if (poolStatusDisplay) {
            poolStatusDisplay.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-red-400"></span>
                <span class="text-sm text-red-400 font-medium">No Pool Found</span>
            `;
        }
        
        if (poolAddressDisplay) {
            poolAddressDisplay.innerText = "Create a liquidity pool first on Uniswap";
        }
    }
}

// ============================================
// FETCH TOKEN BALANCES
// ============================================
async function fetchBalances() {
    if(!userAddress) return;

    const ethBalance = await provider.getBalance(userAddress);
    const ethFormatted = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);
    
    document.getElementById('balance-from').innerText = ethFormatted;
    document.getElementById('modal-bal-ETH').innerText = ethFormatted;

    try {
        const qwenContract = new ethers.Contract(CONTRACTS.QWEN, ERC20_ABI, provider);
        const qwenBalance = await qwenContract.balanceOf(userAddress);
        const qwenDecimals = await qwenContract.decimals();
        const qwenFormatted = parseFloat(ethers.formatUnits(qwenBalance, qwenDecimals)).toLocaleString();
        
        document.getElementById('balance-to').innerText = qwenFormatted;
        document.getElementById('modal-bal-QWEN').innerText = qwenFormatted;
    } catch (e) {
        console.log("Error fetching QWEN balance:", e);
    }
}

// ============================================
// FETCH REAL-TIME PRICE FROM UNISWAP
// ============================================
async function fetchPriceFromUniswap(amountIn) {
    if (!provider || isFetchingPrice) return null;
    
    isFetchingPrice = true;
    const priceInfo = document.getElementById('price-info');
    const pricePerToken = document.getElementById('price-per-token');
    
    console.log('🔍 Fetching price...');
    console.log('Pool address:', DETECTED_POOL_ADDRESS);
    console.log('Fee tier:', DETECTED_FEE_TIER);
    console.log('Amount in:', amountIn);
    
    try {
        const quoter = new ethers.Contract(CONTRACTS.QuoterV2, QUOTER_ABI, provider);
        const amountInWei = ethers.parseEther(amountIn.toString());
        
        console.log('📞 Calling QuoterV2...');
        
        const quote = await quoter.quoteExactInputSingle({
            tokenIn: CONTRACTS.WETH,
            tokenOut: CONTRACTS.QWEN,
            amountIn: amountInWei,
            fee: DETECTED_FEE_TIER,
            sqrtPriceLimitX96: 0
        });
        
        console.log('✅ Quote received:', quote.amountOut.toString());
        
        const qwenContract = new ethers.Contract(CONTRACTS.QWEN, ERC20_ABI, provider);
        const qwenDecimals = await qwenContract.decimals();
        const amountOut = ethers.formatUnits(quote.amountOut, qwenDecimals);
        
        priceInfo.innerText = parseFloat(amountOut).toLocaleString() + " QWEN";
        priceInfo.classList.remove('loading-text', 'text-slate-400', 'text-red-400');
        priceInfo.classList.add('text-brand-primary');
        
        const pricePerEth = (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(2);
        pricePerToken.innerHTML = `
            <span class="text-green-400">●</span> 
            1 ETH = ${parseFloat(pricePerEth).toLocaleString()} QWEN (@ ${getFeeTierLabel(DETECTED_FEE_TIER)})
        `;
        
        isFetchingPrice = false;
        return amountOut;
        
    } catch (error) {
        console.error("❌ Error fetching price:", error);
        console.error("Error code:", error.code);
        console.error("Error reason:", error.reason);
        console.error("Error data:", error.data);
        
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('loading-text', 'text-slate-400');
        
        let errorMsg = "Error fetching price";
        if (error.code === 'CALL_EXCEPTION') {
            errorMsg = "Pool tidak ada liquidity";
        } else if (error.code === 'NETWORK_ERROR') {
            errorMsg = "Masalah jaringan";
        } else if (error.reason) {
            errorMsg = error.reason;
        }
        
        pricePerToken.innerHTML = `
            <span class="text-yellow-400">●</span> 
            ${errorMsg}
        `;
        
        isFetchingPrice = false;
        return null;
    }
}

// ============================================
// EXECUTE SWAP
// ============================================
async function executeSwap(amountIn, amountOutMinimum) {
    if (!signer) throw new Error("Wallet not connected");
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) throw new Error("No liquidity pool found");
    
    const router = new ethers.Contract(CONTRACTS.Router, ROUTER_ABI, signer);
    
    const tx = await router.exactInputSingle(
        {
            tokenIn: CONTRACTS.WETH,
            tokenOut: CONTRACTS.QWEN,
            fee: DETECTED_FEE_TIER,
            recipient: userAddress,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: ethers.parseEther(amountIn.toString()),
            amountOutMinimum: ethers.parseEther(amountOutMinimum.toString()),
            sqrtPriceLimitX96: 0
        },
        {
            value: ethers.parseEther(amountIn.toString())
        }
    );
    
    await tx.wait();
    return tx.hash;
}
