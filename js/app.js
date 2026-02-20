// Handle Swap Button
async function handleSwap() {
    if (!userAddress) {
        connectWallet();
        return;
    }

    const btn = document.getElementById('swap-action-btn');
    const inputVal = document.getElementById('input-amount').value;

    if (!inputVal || parseFloat(inputVal) <= 0) {
        alert('Masukkan jumlah yang valid');
        return;
    }

    if(isSwapping) return;
    isSwapping = true;

    const originalText = btn.innerText;
    btn.innerText = "Fetching price...";
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-wait');

    try {
        // Step 1: Get price quote
        const quote = await fetchPriceFromUniswap(inputVal);
        
        if (!quote || !quote.amountOutWei) {
            throw new Error('Gagal mendapatkan harga');
        }

        // Step 2: Confirm with user
        const priceInfo = document.getElementById('price-info').innerText;
        const confirmMsg = `Konfirmasi Swap:\n\nKirim: ${inputVal} ETH\nTerima: ${priceInfo}\n\nLanjutkan?`;
        
        if (!confirm(confirmMsg)) {
            isSwapping = false;
            btn.innerText = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-wait');
            return;
        }

        // Step 3: Execute swap
        btn.innerText = "Confirm in Wallet...";
        
        const txHash = await executeSwap(inputVal, quote.amountOutWei);
        
        alert(`✅ Swap Successful!\n\nSent: ${inputVal} ETH\nReceived: ${priceInfo}\n\nTx Hash: ${txHash}`);
        
        document.getElementById('input-amount').value = '';
        checkInputState();
        fetchBalances();

    } catch (error) {
        console.error("Swap failed:", error);
        alert("Swap Failed: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-wait');
        isSwapping = false;
    }
}
