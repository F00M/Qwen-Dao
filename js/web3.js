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

// Slippage tolerance (0.5% = 50 basis points)
const SLIPPAGE_BPS = 50;

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
        
        // ✅ FIXED: Selalu WETH → QWEN (sesuai UI)
        const tokenIn = CONTRACTS.WETH;
        const tokenOut = CONTRACTS.QWEN;
        
        console.log('Token In (WETH):', tokenIn);
        console.log('Token Out (QWEN):', tokenOut);
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
            console.warn('⚠️ QuoterV2 returned 0!');
            
            priceInfo.innerText = "No Liquidity";
            priceInfo.classList.add('text-red-400');
            pricePerToken.innerHTML = `<span class="text-red-400">●</span> Pool kosong`;
            isFetchingPrice = false;
            return null;
        }
        
        // QWEN decimals = 18
        const qwenDecimals = 18;
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
        return {
            amountOut: amountOut,
            amountOutWei: quote.amountOut
        };
        
    } catch (error) {
        console.error("❌ QuoterV2 failed:", error);
        
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('loading-text', 'text-slate-400');
        pricePerToken.innerHTML = `<span class="text-yellow-400">●</span> ${error.message}`;
        
        isFetchingPrice = false;
        return null;
    }
}

// ============================================
// EXECUTE SWAP
// ============================================
async function executeSwap(amountIn, amountOutWei) {
    if (!signer) throw new Error("Wallet not connected");
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) throw new Error("No liquidity pool found");
    if (!amountOutWei) throw new Error("Amount out not calculated");
    
    console.log('🔄 Executing swap...');
    console.log('Amount In:', amountIn);
    console.log('Amount Out Wei:', amountOutWei.toString());
    console.log('Fee Tier:', DETECTED_FEE_TIER);
    
    // Calculate minimum amount out with slippage tolerance (0.5%)
    const slippageMultiplier = 10000 - SLIPPAGE_BPS;
    const amountOutMinimum = (amountOutWei * BigInt(slippageMultiplier)) / 10000n;
    
    console.log('Slippage BPS:', SLIPPAGE_BPS);
    console.log('Amount Out Minimum:', amountOutMinimum.toString());
    
    const router = new ethers.Contract(CONTRACTS.Router, ROUTER_ABI, signer);
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    
    console.log('Deadline:', deadline);
    console.log('Token In:', CONTRACTS.WETH);
    console.log('Token Out:', CONTRACTS.QWEN);
    
    try {
        const tx = await router.exactInputSingle(
            {
                tokenIn: CONTRACTS.WETH,
                tokenOut: CONTRACTS.QWEN,
                fee: DETECTED_FEE_TIER,
                recipient: userAddress,
                deadline: deadline,
                amountIn: ethers.parseEther(amountIn.toString()),
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.parseEther(amountIn.toString())
            }
        );
        
        console.log('📤 Transaction sent:', tx.hash);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await tx.wait();
        
        console.log('✅ Transaction confirmed!');
        console.log('Tx Hash:', receipt.hash);
        console.log('Gas Used:', receipt.gasUsed.toString());
        
        return receipt.hash;
        
    } catch (error) {
        console.error('❌ Swap transaction failed:', error);
        
        let errorMsg = error.message;
        if (error.code === 'CALL_EXCEPTION') {
            errorMsg = 'Transaksi gagal - slippage terlalu rendah atau liquidity tidak cukup';
        } else if (error.reason) {
            errorMsg = error.reason;
        }
        
        throw new Error(errorMsg);
    }
}
