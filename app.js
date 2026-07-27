(() => {
  'use strict';
  const cfg = window.BONES_CONFIG;
  const isTba = value => !value || value === 'TBA' || String(value).startsWith('TBA_');
  const short = value => isTba(value) ? 'TBA' : `${value.slice(0, 6)}…${value.slice(-4)}`;

  document.querySelectorAll('[data-contract]').forEach(el => {
    const value = cfg.contracts[el.dataset.contract] || 'TBA';
    el.textContent = el.closest('.contract-pill') ? value : short(value);
    el.title = value;
  });

  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const value = cfg.contracts[btn.dataset.copy];
    if (isTba(value)) return;
    await navigator.clipboard.writeText(value);
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = old, 1200);
  }));

  const dashboard = {
    projectStatus: cfg.dashboard.status,
    creatorPurchase: cfg.dashboard.creatorPurchase,
    creatorFeesClaimed: cfg.dashboard.creatorFeesClaimed,
    wishboneTreasury: cfg.dashboard.wishboneTreasury,
    bonesActivity: cfg.dashboard.bonesActivity
  };
  Object.entries(dashboard).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  const walletInfo = {
    creatorRevenue: {
      name: 'Developer Creator-Fee Wallet',
      purpose: 'Receives the Pons creator rewards and acts as the main public reference wallet for disclosed developer income and creator-fee settlements.'
    }
  };

  const table = document.getElementById('walletTable');
  if (table) {
    const value = cfg.wallets.creatorRevenue;
    const info = walletInfo.creatorRevenue;
    const row = document.createElement('div');
    row.className = 'wallet-row';
    const explorerHref = isTba(value) ? '#' : `${cfg.network.explorerUrl}/address/${value}`;
    row.innerHTML = `<div><strong>${info.name}</strong><small>${info.purpose}</small></div><code title="${value}">${short(value)}</code><button type="button">Copy</button><a href="${explorerHref}" target="_blank" rel="noopener">Explorer</a>`;
    const copyButton = row.querySelector('button');
    copyButton.disabled = isTba(value);
    copyButton.addEventListener('click', async event => {
      if (isTba(value)) return;
      await navigator.clipboard.writeText(value);
      event.currentTarget.textContent = 'Copied';
      setTimeout(() => event.currentTarget.textContent = 'Copy', 1000);
    });
    if (isTba(value)) {
      const link = row.querySelector('a');
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
    }
    table.appendChild(row);
  }



  const treasuryGrid = document.getElementById('treasuryWalletsGrid');
  if (treasuryGrid) {
    const treasuryWallets = [
      {
        label: 'Creator-fee wallet',
        tag: 'SETTLEMENTS',
        address: cfg.wallets.creatorRevenue,
        text: 'Receives creator-fee claims from Pons and is the source wallet for disclosed founder income and treasury settlements.'
      },
      {
        label: 'Public WISHBONE treasury',
        tag: 'TREASURY',
        address: cfg.wallets.communityTreasury,
        text: 'Public wallet intended to hold WISHBONE bought with creator-fee revenue and community-directed BONES balances.'
      },
      {
        label: 'Launch / initial buyer wallet',
        tag: 'LAUNCH',
        address: cfg.wallets.deployer,
        text: 'Used for the Pons launch and the disclosed initial BONES purchase before the public treasury flow is distributed.'
      }
    ];

    treasuryWallets.forEach(item => {
      const card = document.createElement('article');
      card.className = 'treasury-wallet-card';
      const explorerHref = isTba(item.address) ? '#' : `${cfg.network.explorerUrl}/address/${item.address}`;
      card.innerHTML = `<span>${item.tag}</span><strong>${item.label}</strong><small>${item.text}</small><div class="treasury-wallet-actions"><code title="${item.address}">${short(item.address)}</code><button type="button">Copy</button><a href="${explorerHref}" target="_blank" rel="noopener">Explorer</a></div>`;
      const btn = card.querySelector('button');
      btn.disabled = isTba(item.address);
      btn.addEventListener('click', async event => {
        if (isTba(item.address)) return;
        await navigator.clipboard.writeText(item.address);
        event.currentTarget.textContent = 'Copied';
        setTimeout(() => event.currentTarget.textContent = 'Copy', 1000);
      });
      if (isTba(item.address)) {
        const link = card.querySelector('a');
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
      }
      treasuryGrid.appendChild(card);
    });
  }

  const buy = document.getElementById('buyBonesHero');
  if (buy && cfg.links.ponsToken && cfg.links.ponsToken !== '#') {
    buy.href = cfg.links.ponsToken;
    buy.textContent = 'Buy $BONES';
  }

  const connect = document.getElementById('connectWallet');
  if (connect) connect.addEventListener('click', async () => {
    if (!window.ethereum) {
      alert('No EVM wallet detected. Install Rabby, MetaMask or Robinhood Wallet.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cfg.network.chainIdHex }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: cfg.network.chainIdHex,
              chainName: cfg.network.name,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [cfg.network.rpcUrl],
              blockExplorerUrls: [cfg.network.explorerUrl]
            }]
          });
        } else {
          throw switchError;
        }
      }
      connect.textContent = short(accounts[0]);
    } catch (error) {
      console.error(error);
      alert('Wallet connection was cancelled or failed.');
    }
  });
})();
