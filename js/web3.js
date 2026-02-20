// Web3 State
let provider, signer, userAddress;
let isSwapping = false;
let isFetchingPrice = false;
let priceDebounceTimer = null;
let isPoolDetecting = false;

// ============================================
// REOWN APPKIT CONFIGURATION
// ============================================
const REOWN_PROJECT_ID = 'fec8257713128744eb3a392f52db227f'; // GANTI DENGAN PROJECT ID LO DARI cloud.reown.com

// Initialize Reown AppKit
async function initReownAppKit() {
    try {
        const { createAppKit } = window.AppKit;
        const { EthersAdapter } = window.AppKitAdapterEthers;
        
        const ethersAdapter = new EthersAdapter();
        
        const appkit = createAppKit({
            adapters: [ethersAdapter],
            projectId: REOWN_PROJECT_ID,
            networks: [
                {
                    id: 11155111,
                    name: 'Sepolia',
                    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
                    blockExplorerUrl: 'https://sepolia.etherscan.io'
                }
            ],
            defaultNetwork: {
                id: 11155111,
                name: 'Sepolia'
            },
            themeMode: 'dark',
            themeVariables: {
                '--w3m-accent': '#6366f1',
                '--w3m-color-mix': '#6366f1'
            },
            metadata: {
                name: 'Qwen DAO',
                description: 'Qwen DAO DEX on Sepolia',
                url: window.location.origin,
                icons: ['https://cdn-icons-png.flaticon.com/512/6132/6132976.png']
            }
        });
        
        console.log('✅ Reown AppKit initialized');
        
        // Listen for account changes
        window.addEventListener('appkit:account', async (event) => {
            const account = event.detail;
            if (account && account.address) {
                userAddress = account.address;
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                
                await onWalletConnected();
            }
        });
        
        // Listen for disconnect
        window.addEventListener('appkit:disconnect', () => {
            userAddress = null;
            provider = null;
            signer = null;
            console.log('🔌 Wallet disconnected');
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize Reown AppKit:', error);
    }
}

// ============================================
// WALLET CONNECTED CALLBACK
// ============================================
async function onWalletConnected() {
    const shortAddr = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
    console.log(`✅ Wallet connected: ${userAddress}`);
    
    // Detect pool & fetch balances
    await detectPool();
    await fetchBalances();
    
    updatePoolStatusUI(POOL_EXISTS);
}

// ============================================
// AUTO-DETECT POOL
// ============================================
async function detectPool() {
    if (isPoolDetecting || !provider) return false;
    
    isPoolDetecting = true;
    console.log("🔍 Detecting pool for QWEN/WETH...");
    
    try {
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
                    
                    console.log(`✅ Pool detected!`);
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
    
    if (!POOL_EXISTS) {
        await detectPool();
    }
    
    if (!POOL_EXISTS || !DETECTED_FEE_TIER) {
        const priceInfo = document.getElementById('price-info');
        const pricePerToken = document.getElementById('price-per-token');
        priceInfo.innerText = "No Liquidity Pool";
        priceInfo.classList.add('text-red-400');
        pricePerToken.innerHTML = `<span class="text-red-400">●</span> Create Pool First`;
        return null;
    }
    
    isFetchingPrice = true;
    const priceInfo = document.getElementById('price-info');
    const pricePerToken = document.getElementById('price-per-token');
    
    try {
        const quoter = new ethers.Contract(CONTRACTS.QuoterV2, QUOTER_ABI, provider);
        const amountInWei = ethers.parseEther(amountIn.toString());
        
        const quote = await quoter.quoteExactInputSingle({
            tokenIn: CONTRACTS.WETH,
            tokenOut: CONTRACTS.QWEN,
            amountIn: amountInWei,
            fee: DETECTED_FEE_TIER,
            sqrtPriceLimitX96: 0
        });
        
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
        console.error("Error fetching price:", error);
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('loading-text', 'text-slate-400');
        pricePerToken.innerHTML = `<span class="text-yellow-400">●</span> Error fetching price`;
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
