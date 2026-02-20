// Web3 State
let provider, signer, userAddress;
let isSwapping = false;
let isFetchingPrice = false;
let priceDebounceTimer = null;

// Connect Wallet
async function connectWallet() {
    const btn = document.getElementById('connectBtn');
    
    if (typeof window.ethereum !== 'undefined') {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();

            const shortAddr = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
            btn.innerText = shortAddr;
            btn.classList.add('bg-slate-800', 'text-white', 'border', 'border-slate-600');
            btn.classList.remove('bg-slate-200', 'text-slate-900');
            
            await fetchBalances();
            console.log("✅ Wallet connected:", userAddress);
        } catch (error) {
            console.error("❌ Connection failed:", error);
            alert("Connection failed. Please try again.");
        }
    } else {
        alert("Please install MetaMask!");
    }
}

// Fetch Token Balances
async function fetchBalances() {
    if(!userAddress) return;

    // ETH Balance
    const ethBalance = await provider.getBalance(userAddress);
    const ethFormatted = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);
    
    document.getElementById('balance-from').innerText = ethFormatted;
    document.getElementById('modal-bal-ETH').innerText = ethFormatted;

    // QWEN Balance
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

// Fetch Real-Time Price from Uniswap
async function fetchPriceFromUniswap(amountIn) {
    if (!provider || isFetchingPrice) return null;
    
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
            fee: FEE_TIER,
            sqrtPriceLimitX96: 0
        });
        
        const qwenContract = new ethers.Contract(CONTRACTS.QWEN, ERC20_ABI, provider);
        const qwenDecimals = await qwenContract.decimals();
        const amountOut = ethers.formatUnits(quote.amountOut, qwenDecimals);
        
        priceInfo.innerText = parseFloat(amountOut).toLocaleString() + " QWEN";
        priceInfo.classList.remove('loading-text', 'text-slate-400');
        priceInfo.classList.add('text-brand-primary');
        
        const pricePerEth = (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(2);
        pricePerToken.innerText = `1 ETH = ${parseFloat(pricePerEth).toLocaleString()} QWEN`;
        
        isFetchingPrice = false;
        return amountOut;
        
    } catch (error) {
        console.error("Error fetching price:", error);
        priceInfo.innerText = "Price unavailable";
        priceInfo.classList.add('loading-text', 'text-slate-400');
        pricePerToken.innerText = "1 ETH = ?? QWEN";
        isFetchingPrice = false;
        return null;
    }
}

// Execute Swap
async function executeSwap(amountIn, amountOutMinimum) {
    if (!signer) throw new Error("Wallet not connected");
    
    const router = new ethers.Contract(CONTRACTS.Router, ROUTER_ABI, signer);
    
    const tx = await router.exactInputSingle(
        {
            tokenIn: CONTRACTS.WETH,
            tokenOut: CONTRACTS.QWEN,
            fee: FEE_TIER,
            recipient: userAddress,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
            amountIn: ethers.parseEther(amountIn.toString()),
            amountOutMinimum: ethers.parseEther(amountOutMinimum.toString()),
            sqrtPriceLimitX96: 0
        },
        {
            value: ethers.parseEther(amountIn.toString()) // Send ETH with transaction
        }
    );
    
    await tx.wait();
    return tx.hash;
}
