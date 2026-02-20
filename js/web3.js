// ============================================
// WEB3 STATE (SEMUA VARIABEL DI SINI)
// ============================================
let provider, signer, userAddress;
let isSwapping = false;
let isFetchingPrice = false;
let priceDebounceTimer = null;
let isPoolDetecting = false;

// Pool info
let DETECTED_POOL_ADDRESS = null;
let DETECTED_FEE_TIER = null;
let POOL_EXISTS = false;
let POOL_TOKEN0 = null;
let POOL_TOKEN1 = null;
let TOKEN_IN_IS_TOKEN0 = false;

// Swap direction (true = ETH→QWEN, false = QWEN→ETH)
let swapDirection = 'ETH_TO_QWEN';

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
    const outputInput = document.getElementById('output-amount');
    
    console.log('🔍 Fetching price...');
    console.log('Swap Direction:', swapDirection);
    console.log('Amount In:', amountIn);
    
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) {
        priceInfo.innerText = "No Liquidity Pool";
        priceInfo.classList.add('text-red-400');
        pricePerToken.innerHTML = `<span class="text-red-400">●</span> Pool tidak ditemukan`;
        outputInput.value = '0.0';
        isFetchingPrice = false;
        return null;
    }
    
    try {
        console.log('📞 Calling QuoterV2...');
        
        const quoter = new ethers.Contract(CONTRACTS.QuoterV2, QUOTER_ABI, provider);
        const amountInWei = ethers.parseEther(amountIn.toString());
        
        // Determine tokens based on swap direction
        let tokenIn, tokenOut, outputDecimals;
        
        if (swapDirection === 'ETH_TO_QWEN') {
            tokenIn = CONTRACTS.WETH;
            tokenOut = CONTRACTS.QWEN;
            outputDecimals = 18; // QWEN decimals
        } else {
            tokenIn = CONTRACTS.QWEN;
            tokenOut = CONTRACTS.WETH;
            outputDecimals = 18; // WETH decimals
        }
        
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
            console.warn('⚠️ QuoterV2 returned 0!');
            
            priceInfo.innerText = "No Liquidity";
            priceInfo.classList.add('text-red-400');
            pricePerToken.innerHTML = `<span class="text-red-400">●</span> Pool kosong`;
            outputInput.value = '0.0';
            isFetchingPrice = false;
            return null;
        }
        
        const amountOut = ethers.formatUnits(quote.amountOut, outputDecimals);
        
        console.log('Amount Out:', amountOut);
        
        // ✅ UPDATE: Isi kolom Receive dengan jumlah yang akan diterima
        outputInput.value = parseFloat(amountOut).toLocaleString('en-US', { maximumFractionDigits: 6 });
        
        priceInfo.innerText = parseFloat(amountOut).toLocaleString() + " " + (swapDirection === 'ETH_TO_QWEN' ? 'QWEN' : 'ETH');
        priceInfo.classList.remove('loading-text', 'text-slate-400', 'text-red-400');
        priceInfo.classList.add('text-brand-primary');
        
        // Calculate price per token
        const pricePerToken_value = (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6);
        const outputToken = swapDirection === 'ETH_TO_QWEN' ? 'QWEN' : 'ETH';
        const inputToken = swapDirection === 'ETH_TO_QWEN' ? 'ETH' : 'QWEN';
        
        pricePerToken.innerHTML = `
            <span class="text-green-400">●</span> 
            1 ${inputToken} = ${parseFloat(pricePerToken_value).toLocaleString()} ${outputToken} (@ ${getFeeTierLabel(DETECTED_FEE_TIER)})
        `;
        
        isFetchingPrice = false;
        return {
            amountOut: amountOut,
            amountOutWei: quote.amountOut,
            tokenIn: tokenIn,
            tokenOut: tokenOut
        };
        
    } catch (error) {
        console.error("❌ QuoterV2 failed:", error);
        
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('loading-text', 'text-slate-400');
        pricePerToken.innerHTML = `<span class="text-yellow-400">●</span> ${error.message}`;
        outputInput.value = '0.0';
        
        isFetchingPrice = false;
        return null;
    }
}

// ============================================
// EXECUTE SWAP
// ============================================
async function executeSwap(amountIn, amountOutWei, tokenIn, tokenOut) {
    if (!signer) throw new Error("Wallet not connected");
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) throw new Error("No liquidity pool found");
    if (!amountOutWei) throw new Error("Amount out not calculated");
    
    console.log('🔄 Executing swap...');
    console.log('Amount In:', amountIn);
    console.log('Token In:', tokenIn);
    console.log('Token Out:', tokenOut);
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
    
    try {
        // Check if swapping ETH or ERC20
        const isEthSwap = tokenIn.toLowerCase() === CONTRACTS.WETH.toLowerCase();
        
        const txParams = {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: DETECTED_FEE_TIER,
            recipient: userAddress,
            deadline: deadline,
            amountIn: ethers.parseEther(amountIn.toString()),
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        };
        
        const txOptions = isEthSwap 
            ? { value: ethers.parseEther(amountIn.toString()) }
            : {};
        
        const tx = await router.exactInputSingle(txParams, txOptions);
        
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

// ============================================
// SWAP DIRECTION TOGGLE
// ============================================
function toggleSwapDirection() {
    console.log('🔄 Toggling swap direction...');
    
    const labelFrom = document.getElementById('label-from');
    const labelTo = document.getElementById('label-to');
    const iconFrom = document.getElementById('icon-from');
    const iconTo = document.getElementById('icon-to');
    const inputFrom = document.getElementById('input-amount');
    const inputTo = document.getElementById('output-amount');
    
    if (swapDirection === 'ETH_TO_QWEN') {
        // Switch to QWEN → ETH
        swapDirection = 'QWEN_TO_ETH';
        
        labelFrom.innerText = 'QWEN';
        labelTo.innerText = 'ETH';
        iconFrom.src = 'https://cdn-icons-png.flaticon.com/512/6132/6132976.png';
        iconTo.src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
        
        document.getElementById('balance-from').innerText = document.getElementById('modal-bal-QWEN').innerText;
        document.getElementById('balance-to').innerText = document.getElementById('modal-bal-ETH').innerText;
    } else {
        // Switch to ETH → QWEN
        swapDirection = 'ETH_TO_QWEN';
        
        labelFrom.innerText = 'ETH';
        labelTo.innerText = 'QWEN';
        iconFrom.src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
        iconTo.src = 'https://cdn-icons-png.flaticon.com/512/6132/6132976.png';
        
        document.getElementById('balance-from').innerText = document.getElementById('modal-bal-ETH').innerText;
        document.getElementById('balance-to').innerText = document.getElementById('modal-bal-QWEN').innerText;
    }
    
    // Clear inputs
    inputFrom.value = '';
    inputTo.value = '0.0';
    
    // Reset price display
    document.getElementById('price-info').innerText = '?? ' + (swapDirection === 'ETH_TO_QWEN' ? 'QWEN' : 'ETH');
    document.getElementById('price-per-token').innerHTML = `<span class="text-yellow-400">●</span> Detecting pool...`;
    
    console.log('✅ Swap direction changed to:', swapDirection);
}
