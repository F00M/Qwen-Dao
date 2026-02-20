// ============================================
// WEB3 STATE (SEMUA VARIABEL DI SINI)
// ============================================
let provider, signer, userAddress;
let isSwapping = false;
let isFetchingPrice = false;
let priceDebounceTimer = null;
let isPoolDetecting = false;

// Pool info (HANYA di web3.js)
let DETECTED_POOL_ADDRESS = null;
let DETECTED_FEE_TIER = null;
let POOL_EXISTS = false;
let POOL_TOKEN0 = null;
let POOL_TOKEN1 = null;
let TOKEN_IN_IS_TOKEN0 = false;

// ============================================
// CONNECT WALLET
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
                const token0 = await pool.token0();
                const token1 = await pool.token1();
                const fee = await pool.fee();
                const liquidity = await pool.liquidity();
                const slot0 = await pool.slot0();
                
                DETECTED_POOL_ADDRESS = CONTRACTS.QWEN_WETH_POOL;
                DETECTED_FEE_TIER = fee;
                POOL_EXISTS = true;
                POOL_TOKEN0 = token0.toLowerCase();
                POOL_TOKEN1 = token1.toLowerCase();
                
                TOKEN_IN_IS_TOKEN0 = (CONTRACTS.WETH.toLowerCase() === POOL_TOKEN0);
                
                console.log(`✅ Pool verified!`);
                console.log(`   Address: ${DETECTED_POOL_ADDRESS}`);
                console.log(`   Token0: ${POOL_TOKEN0}`);
                console.log(`   Token1: ${POOL_TOKEN1}`);
                console.log(`   Fee Tier: ${getFeeTierLabel(fee)} (${fee})`);
                console.log(`   Liquidity: ${liquidity.toString()}`);
                console.log(`   Tick: ${slot0.tick}`);
                console.log(`   WETH is Token0: ${TOKEN_IN_IS_TOKEN0}`);
                
                isPoolDetecting = false;
                return true;
                
            } catch (error) {
                console.error('❌ Pool address invalid:', error);
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
    console.log('POOL_EXISTS:', POOL_EXISTS);
    console.log('DETECTED_FEE_TIER:', DETECTED_FEE_TIER);
    console.log('POOL_TOKEN0:', POOL_TOKEN0);
    console.log('POOL_TOKEN1:', POOL_TOKEN1);
    console.log('TOKEN_IN_IS_TOKEN0:', TOKEN_IN_IS_TOKEN0);
    console.log('Amount In:', amountIn);
    
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) {
        priceInfo.innerText = "No Liquidity Pool";
        priceInfo.classList.add('text-red-400');
        pricePerToken.innerHTML = `<span class="text-red-400">●</span> Pool tidak ditemukan`;
        isFetchingPrice = false;
        return null;
    }
    
    try {
        console.log('📞 Calling QuoterV2...');
        
        const quoter = new ethers.Contract(CONTRACTS.QuoterV2, QUOTER_ABI, provider);
        const amountInWei = ethers.parseEther(amountIn.toString());
        
        const tokenIn = TOKEN_IN_IS_TOKEN0 ? CONTRACTS.WETH : CONTRACTS.QWEN;
        const tokenOut = TOKEN_IN_IS_TOKEN0 ? CONTRACTS.QWEN : CONTRACTS.WETH;
        
        console.log('Token In:', tokenIn);
        console.log('Token Out:', tokenOut);
        console.log('Fee:', DETECTED_FEE_TIER);
        
        const quote = await quoter.quoteExactInputSingle.staticCall({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountInWei,
            fee: DETECTED_FEE_TIER,
            sqrtPriceLimitX96: 0
        });
        
        console.log('✅ QuoterV2 result:', quote.amountOut.toString());
        
        if (quote.amountOut === 0n) {
            console.warn('⚠️ QuoterV2 returned 0! Trying fallback price from pool...');
            await fetchPriceFromPool(amountIn);
            isFetchingPrice = false;
            return null;
        }
        
        const qwenContract = new ethers.Contract(CONTRACTS.QWEN, ERC20_ABI, provider);
        const qwenDecimals = await qwenContract.decimals();
        
        console.log('QWEN Decimals:', qwenDecimals);
        
        const amountOut = ethers.formatUnits(quote.amountOut, qwenDecimals);
        
        console.log('Amount Out:', amountOut);
        
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
        console.error("❌ QuoterV2 failed:", error);
        console.log('⚠️ Trying fallback price from pool...');
        
        await fetchPriceFromPool(amountIn);
        
        isFetchingPrice = false;
        return null;
    }
}

// ============================================
// FALLBACK: FETCH PRICE FROM POOL SLOT0
// ============================================
async function fetchPriceFromPool(amountIn) {
    console.log('🔄 Calculating price from pool slot0...');
    
    try {
        const pool = new ethers.Contract(CONTRACTS.QWEN_WETH_POOL, POOL_ABI, provider);
        const slot0 = await pool.slot0();
        const liquidity = await pool.liquidity();
        
        console.log('Pool slot0:', slot0);
        console.log('Pool liquidity:', liquidity.toString());
        
        const sqrtPriceX96 = slot0.sqrtPriceX96;
        const tick = slot0.tick;
        
        console.log('sqrtPriceX96:', sqrtPriceX96.toString());
        console.log('tick:', tick);
        
        if (liquidity === 0n) {
            console.warn('⚠️ Pool liquidity is 0! No price available.');
            
            const priceInfo = document.getElementById('price-info');
            const pricePerToken = document.getElementById('price-per-token');
            
            priceInfo.innerText = "No Liquidity";
            priceInfo.classList.add('text-red-400');
            pricePerToken.innerHTML = `
                <span class="text-red-400">●</span> 
                Pool kosong - Tambah liquidity dulu
            `;
            return null;
        }
        
        const price = (sqrtPriceX96 * sqrtPriceX96) / (2n ** 192n);
        
        console.log('Raw price from pool:', price.toString());
        
        const qwenContract = new ethers.Contract(CONTRACTS.QWEN, ERC20_ABI, provider);
        const qwenDecimals = await qwenContract.decimals();
        
        let adjustedPrice;
        if (TOKEN_IN_IS_TOKEN0) {
            adjustedPrice = price / (10n ** BigInt(18 - qwenDecimals));
        } else {
            adjustedPrice = (2n ** 192n) / price / (10n ** BigInt(18 - qwenDecimals));
        }
        
        console.log('Adjusted price:', adjustedPrice.toString());
        
        const priceFloat = parseFloat(ethers.formatUnits(adjustedPrice, 0));
        const amountOut = amountIn * priceFloat;
        
        console.log('Amount Out (fallback):', amountOut);
        
        const priceInfo = document.getElementById('price-info');
        const pricePerToken = document.getElementById('price-per-token');
        
        priceInfo.innerText = amountOut.toLocaleString() + " QWEN";
        priceInfo.classList.remove('loading-text', 'text-slate-400', 'text-red-400');
        priceInfo.classList.add('text-brand-primary');
        
        pricePerToken.innerHTML = `
            <span class="text-yellow-400">●</span> 
            1 ETH = ${priceFloat.toLocaleString()} QWEN (@ ${getFeeTierLabel(DETECTED_FEE_TIER)}) [Pool Price]
        `;
        
        return amountOut.toString();
        
    } catch (error) {
        console.error("❌ Fallback price failed:", error);
        
        const priceInfo = document.getElementById('price-info');
        const pricePerToken = document.getElementById('price-per-token');
        
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('text-slate-400');
        pricePerToken.innerHTML = `
            <span class="text-red-400">●</span> 
            Gagal ambil harga: ${error.message}
        `;
        
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
