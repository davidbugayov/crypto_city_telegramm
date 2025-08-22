// Игровые данные
const gameData = {
  buildings: [
    {"id": 1, "name": "Mining Farm", "icon": "⛏️", "baseCost": 100, "baseIncome": 10, "energyCost": 1, "description": "Добывает криптовалюту каждые 30 секунд"},
    {"id": 2, "name": "Exchange Tower", "icon": "🏢", "baseCost": 500, "baseIncome": 25, "energyCost": 2, "description": "Торговый центр с высокой доходностью"},
    {"id": 3, "name": "Solar Plant", "icon": "☀️", "baseCost": 300, "baseIncome": 0, "energyCost": 0, "description": "Генерирует +5 энергии в час"},
    {"id": 4, "name": "Residential Block", "icon": "🏠", "baseCost": 200, "baseIncome": 5, "energyCost": 1, "description": "Жилой комплекс, увеличивает население"},
    {"id": 5, "name": "Market", "icon": "🏪", "baseCost": 400, "baseIncome": 15, "energyCost": 2, "description": "Торговый центр с бонусом к доходу"}
  ],
  dailyRewards: [
    {"day": 1, "coins": 100, "energy": 50},
    {"day": 2, "coins": 150, "energy": 60},
    {"day": 3, "coins": 200, "energy": 70},
    {"day": 4, "coins": 300, "energy": 80},
    {"day": 5, "coins": 500, "energy": 100},
    {"day": 6, "coins": 750, "energy": 120},
    {"day": 7, "coins": 1000, "energy": 150}
  ],
  shopItems: [
    {"id": 1, "name": "Energy Boost", "icon": "⚡", "cost": 50, "effect": "+100 энергии", "type": "energy"},
    {"id": 2, "name": "2x Income", "icon": "💰", "cost": 100, "effect": "Удваивает доход на 1 час", "type": "multiplier"},
    {"id": 3, "name": "Speed Up", "icon": "⏰", "cost": 75, "effect": "Ускоряет производство на 30 мин", "type": "speed"},
    {"id": 4, "name": "Golden Tree", "icon": "🌳", "cost": 200, "effect": "Декорация +5% к общему доходу", "type": "decoration"}
  ],
  friends: [
    {"id": 1, "name": "Alex_Crypto", "level": 5, "city": "Neo Tokyo", "lastActive": "2 часа назад"},
    {"id": 2, "name": "Maria_Trader", "level": 8, "city": "Crypto Valley", "lastActive": "30 мин назад"},
    {"id": 3, "name": "Bitcoin_Bob", "level": 12, "city": "Mining City", "lastActive": "онлайн"},
    {"id": 4, "name": "EthereumQueen", "level": 6, "city": "Smart Contract Town", "lastActive": "1 час назад"}
  ]
};

// Telegram WebApp and persistence
let tg = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
let telegramUserId = null;
const STORAGE_KEY_PREFIX = 'crypto-city-state-v1:';

function getStorageKey() {
  const userKey = telegramUserId ? `tg_${telegramUserId}` : 'guest';
  return `${STORAGE_KEY_PREFIX}${userKey}`;
}

function saveState() {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(gameState));
  } catch (e) {
    // ignore storage errors in mini app webview
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      gameState = { ...gameState, ...parsed };
    }
  } catch (e) {
    // ignore parse errors
  }
}

// Состояние игры
let gameState = {
  coins: 1000,
  energy: 100,
  level: 1,
  experience: 0,
  experienceToNext: 100,
  dailyRewardDay: 1,
  lastRewardClaim: null,
  cityBuildings: [
    { slot: 0, buildingId: 1, level: 1 },
    { slot: 1, buildingId: 4, level: 1 }
  ],
  multipliers: {
    income: 1,
    speed: 1
  },
  bonuses: {
    decoration: 0
  }
};

// DOM элементы
const elements = {
  coins: document.getElementById('coins'),
  energy: document.getElementById('energy'),
  level: document.getElementById('level'),
  screens: document.querySelectorAll('.screen'),
  navBtns: document.querySelectorAll('.nav-btn'),
  citySlots: document.querySelectorAll('.city-slot'),
  dailyRewardBtn: document.getElementById('dailyRewardBtn'),
  dailyRewardModal: document.getElementById('dailyRewardModal'),
  upgradeModal: document.getElementById('upgradeModal'),
  notifications: document.getElementById('notifications')
};

// Инициализация игры
function initGame() {
  // Telegram init
  if (tg) {
    try {
      tg.ready();
      tg.expand && tg.expand();
      telegramUserId = tg.initDataUnsafe?.user?.id || null;
      // Theme sync
      const colorSchemeAttr = document.documentElement.getAttribute('data-color-scheme');
      const scheme = tg.colorScheme || (colorSchemeAttr || 'light');
      document.documentElement.setAttribute('data-color-scheme', scheme);
      tg.onEvent && tg.onEvent('themeChanged', () => {
        const newScheme = tg.colorScheme || 'light';
        document.documentElement.setAttribute('data-color-scheme', newScheme);
      });
    } catch (_) {}
  }

  // Persistence
  loadState();
  updateUI();
  setupNavigation();
  setupCityInteraction();
  setupModals();
  populateScreens();
  startGameLoop();
  checkDailyReward();

  // Autosave
  setInterval(saveState, 15000);
  window.addEventListener('beforeunload', saveState);
}

// Обновление интерфейса
function updateUI() {
  elements.coins.textContent = formatNumber(gameState.coins);
  elements.energy.textContent = gameState.energy;
  elements.level.textContent = gameState.level;
}

// Форматирование чисел
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Настройка навигации
function setupNavigation() {
  elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScreen = btn.dataset.screen;
      showScreen(targetScreen);
      
      // Обновление активной кнопки
      elements.navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Показ экрана
function showScreen(screenId) {
  elements.screens.forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

// Настройка взаимодействия с городом
function setupCityInteraction() {
  elements.citySlots.forEach(slot => {
    slot.addEventListener('click', () => {
      const slotIndex = parseInt(slot.dataset.slot);
      const building = slot.querySelector('.building');
      
      if (building) {
        // Клик по зданию - сбор ресурсов
        collectFromBuilding(slotIndex, building);
      } else {
        // Клик по пустому слоту - открыть меню строительства
        showScreen('buildScreen');
        elements.navBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-screen="buildScreen"]').classList.add('active');
      }
    });

    // Долгий клик для апгрейда
    let pressTimer;
    const building = slot.querySelector('.building');
    if (building) {
      building.addEventListener('mousedown', (e) => {
        pressTimer = setTimeout(() => {
          const slotIndex = parseInt(slot.dataset.slot);
          showUpgradeModal(slotIndex);
        }, 500);
      });

      building.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
      });

      building.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
      });
    }
  });
}

// Сбор ресурсов с здания
function collectFromBuilding(slotIndex, buildingElement) {
  const cityBuilding = gameState.cityBuildings.find(b => b.slot === slotIndex);
  if (!cityBuilding) return;

  const buildingData = gameData.buildings.find(b => b.id === cityBuilding.buildingId);
  if (!buildingData) return;

  // Проверка энергии
  if (gameState.energy < buildingData.energyCost) {
    showNotification('Недостаточно энергии!', 'error');
    return;
  }

  // Расчет дохода
  let income = buildingData.baseIncome * cityBuilding.level * gameState.multipliers.income;
  
  // Бонус от декораций
  income += income * (gameState.bonuses.decoration / 100);
  
  income = Math.floor(income);

  // Добавление ресурсов
  gameState.coins += income;
  gameState.energy -= buildingData.energyCost;
  gameState.experience += 5;

  // Специальная логика для солнечной электростанции
  if (buildingData.id === 3) {
    gameState.energy += 5 * cityBuilding.level;
    income = 5 * cityBuilding.level;
  }

  // Показ анимации дохода
  showIncomeAnimation(buildingElement, income);

  // Проверка повышения уровня
  checkLevelUp();

  updateUI();
  saveState();
}

// Анимация дохода
function showIncomeAnimation(buildingElement, amount) {
  const popup = buildingElement.querySelector('.income-popup');
  const icon = gameData.buildings.find(b => b.id === 3) && 
               gameState.cityBuildings.find(cb => cb.slot === parseInt(buildingElement.parentElement.dataset.slot))?.buildingId === 3 
               ? '⚡' : '💰';
  
  popup.textContent = `+${amount} ${icon}`;
  popup.classList.remove('hidden');
  popup.classList.add('show');

  setTimeout(() => {
    popup.classList.remove('show');
    popup.classList.add('hidden');
  }, 1000);
}

// Проверка повышения уровня
function checkLevelUp() {
  if (gameState.experience >= gameState.experienceToNext) {
    gameState.level++;
    gameState.experience -= gameState.experienceToNext;
    gameState.experienceToNext = Math.floor(gameState.experienceToNext * 1.5);
    gameState.energy = Math.min(100 + gameState.level * 10, gameState.energy + 50);
    
    showNotification(`Поздравляем! Достигнут уровень ${gameState.level}!`);
    updateUI();
  }
}

// Заполнение экранов данными
function populateScreens() {
  populateBuildingsScreen();
  populateFriendsScreen();
  populateShopScreen();
}

// Заполнение экрана строительства
function populateBuildingsScreen() {
  const buildingsList = document.getElementById('buildingsList');
  buildingsList.innerHTML = '';

  gameData.buildings.forEach(building => {
    const buildingItem = document.createElement('div');
    buildingItem.className = 'building-item';
    buildingItem.innerHTML = `
      <div class="item-icon">${building.icon}</div>
      <div class="item-info">
        <div class="item-name">${building.name}</div>
        <div class="item-description">${building.description}</div>
        <div class="item-cost">💰 ${building.baseCost} | ⚡ ${building.energyCost}</div>
      </div>
    `;

    buildingItem.addEventListener('click', () => {
      buyBuilding(building.id);
    });

    buildingsList.appendChild(buildingItem);
  });
}

// Покупка здания
function buyBuilding(buildingId) {
  const building = gameData.buildings.find(b => b.id === buildingId);
  const emptySlot = gameState.cityBuildings.length < 9 ? 
    Array.from({length: 9}, (_, i) => i).find(i => !gameState.cityBuildings.find(b => b.slot === i)) :
    null;

  if (emptySlot === null) {
    showNotification('Нет свободных слотов!', 'error');
    return;
  }

  if (gameState.coins < building.baseCost) {
    showNotification('Недостаточно монет!', 'error');
    return;
  }

  gameState.coins -= building.baseCost;
  gameState.cityBuildings.push({
    slot: emptySlot,
    buildingId: building.id,
    level: 1
  });

  updateCityDisplay();
  updateUI();
  showNotification(`${building.name} построено!`);
  saveState();
}

// Обновление отображения города
function updateCityDisplay() {
  elements.citySlots.forEach((slot, index) => {
    const cityBuilding = gameState.cityBuildings.find(b => b.slot === index);
    slot.innerHTML = '';
    
    if (cityBuilding) {
      const building = gameData.buildings.find(b => b.id === cityBuilding.buildingId);
      slot.classList.remove('empty');
      slot.innerHTML = `
        <div class="building" data-building="${building.id}">
          <span class="building-icon">${building.icon}</span>
          <span class="building-level">${cityBuilding.level}</span>
          <div class="income-popup hidden">+${building.baseIncome} 💰</div>
        </div>
      `;
    } else {
      slot.classList.add('empty');
    }
  });
  
  setupCityInteraction();
}

// Заполнение экрана друзей
function populateFriendsScreen() {
  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '';

  gameData.friends.forEach(friend => {
    const friendItem = document.createElement('div');
    friendItem.className = 'friend-item';
    const statusClass = friend.lastActive === 'онлайн' ? 'online' : '';
    
    friendItem.innerHTML = `
      <div class="item-icon">👤</div>
      <div class="item-info">
        <div class="item-name">${friend.name}</div>
        <div class="item-description">${friend.city}</div>
        <div class="friend-status ${statusClass}">${friend.lastActive}</div>
      </div>
      <div class="friend-level">Ур. ${friend.level}</div>
    `;

    friendItem.addEventListener('click', () => {
      visitFriend(friend.id);
    });

    friendsList.appendChild(friendItem);
  });
}

// Посещение друга
function visitFriend(friendId) {
  const friend = gameData.friends.find(f => f.id === friendId);
  gameState.coins += 25;
  gameState.energy += 10;
  updateUI();
  showNotification(`Посетили ${friend.name}! +25 💰 +10 ⚡`);
  saveState();
}

// Заполнение магазина
function populateShopScreen() {
  const shopItems = document.getElementById('shopItems');
  shopItems.innerHTML = '';

  gameData.shopItems.forEach(item => {
    const shopItem = document.createElement('div');
    shopItem.className = 'shop-item';
    shopItem.innerHTML = `
      <div class="item-icon">${item.icon}</div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-description">${item.effect}</div>
        <div class="item-cost">💰 ${item.cost}</div>
      </div>
    `;

    shopItem.addEventListener('click', () => {
      buyShopItem(item.id);
    });

    shopItems.appendChild(shopItem);
  });
}

// Покупка предмета в магазине
function buyShopItem(itemId) {
  const item = gameData.shopItems.find(i => i.id === itemId);
  
  if (gameState.coins < item.cost) {
    showNotification('Недостаточно монет!', 'error');
    return;
  }

  gameState.coins -= item.cost;

  switch (item.type) {
    case 'energy':
      gameState.energy += 100;
      break;
    case 'multiplier':
      gameState.multipliers.income = 2;
      setTimeout(() => {
        gameState.multipliers.income = 1;
        showNotification('2x множитель дохода закончился');
      }, 3600000); // 1 час
      break;
    case 'speed':
      gameState.multipliers.speed = 2;
      setTimeout(() => {
        gameState.multipliers.speed = 1;
        showNotification('Ускорение производства закончилось');
      }, 1800000); // 30 минут
      break;
    case 'decoration':
      gameState.bonuses.decoration += 5;
      break;
  }

  updateUI();
  showNotification(`Куплено: ${item.name}!`);
  saveState();
}

// Настройка модальных окон
function setupModals() {
  // Ежедневная награда
  elements.dailyRewardBtn.addEventListener('click', () => {
    showDailyRewardModal();
  });

  document.getElementById('claimRewardBtn').addEventListener('click', () => {
    claimDailyReward();
  });

  document.getElementById('closeRewardBtn').addEventListener('click', () => {
    hideDailyRewardModal();
  });

  // Апгрейд здания
  document.getElementById('confirmUpgradeBtn').addEventListener('click', () => {
    confirmUpgrade();
  });

  document.getElementById('cancelUpgradeBtn').addEventListener('click', () => {
    hideUpgradeModal();
  });
}

// Показ модального окна ежедневной награды
function showDailyRewardModal() {
  const reward = gameData.dailyRewards[gameState.dailyRewardDay - 1];
  document.getElementById('rewardDay').textContent = gameState.dailyRewardDay;
  document.getElementById('rewardCoins').textContent = reward.coins;
  document.getElementById('rewardEnergy').textContent = reward.energy;
  
  elements.dailyRewardModal.classList.remove('hidden');
  elements.dailyRewardModal.classList.add('show');
}

// Получение ежедневной награды
function claimDailyReward() {
  const reward = gameData.dailyRewards[gameState.dailyRewardDay - 1];
  gameState.coins += reward.coins;
  gameState.energy += reward.energy;
  gameState.lastRewardClaim = new Date();
  gameState.dailyRewardDay = gameState.dailyRewardDay < 7 ? gameState.dailyRewardDay + 1 : 1;
  
  updateUI();
  showNotification(`Получена ежедневная награда! +${reward.coins} 💰 +${reward.energy} ⚡`);
  hideDailyRewardModal();
  saveState();
}

// Скрытие модального окна наград
function hideDailyRewardModal() {
  elements.dailyRewardModal.classList.remove('show');
  elements.dailyRewardModal.classList.add('hidden');
}

// Показ модального окна апгрейда
function showUpgradeModal(slotIndex) {
  const cityBuilding = gameState.cityBuildings.find(b => b.slot === slotIndex);
  if (!cityBuilding) return;

  const building = gameData.buildings.find(b => b.id === cityBuilding.buildingId);
  const upgradeCost = building.baseCost * cityBuilding.level * 2;

  document.getElementById('upgradeInfo').innerHTML = `
    <div class="item-icon">${building.icon}</div>
    <div class="item-name">${building.name}</div>
    <div class="item-description">Уровень: ${cityBuilding.level} → ${cityBuilding.level + 1}</div>
    <div class="item-description">Доход: ${building.baseIncome * cityBuilding.level} → ${building.baseIncome * (cityBuilding.level + 1)}</div>
    <div class="item-cost">Стоимость: 💰 ${upgradeCost}</div>
  `;

  elements.upgradeModal.dataset.slotIndex = slotIndex;
  elements.upgradeModal.classList.remove('hidden');
  elements.upgradeModal.classList.add('show');
}

// Подтверждение апгрейда
function confirmUpgrade() {
  const slotIndex = parseInt(elements.upgradeModal.dataset.slotIndex);
  const cityBuilding = gameState.cityBuildings.find(b => b.slot === slotIndex);
  const building = gameData.buildings.find(b => b.id === cityBuilding.buildingId);
  const upgradeCost = building.baseCost * cityBuilding.level * 2;

  if (gameState.coins < upgradeCost) {
    showNotification('Недостаточно монет для улучшения!', 'error');
    return;
  }

  gameState.coins -= upgradeCost;
  cityBuilding.level++;

  updateCityDisplay();
  updateUI();
  showNotification(`${building.name} улучшено до уровня ${cityBuilding.level}!`);
  hideUpgradeModal();
  saveState();
}

// Скрытие модального окна апгрейда
function hideUpgradeModal() {
  elements.upgradeModal.classList.remove('show');
  elements.upgradeModal.classList.add('hidden');
}

// Проверка ежедневной награды
function checkDailyReward() {
  const now = new Date();
  const lastClaim = gameState.lastRewardClaim ? new Date(gameState.lastRewardClaim) : null;
  
  if (!lastClaim || (now - lastClaim) >= 86400000) { // 24 часа
    elements.dailyRewardBtn.style.animation = 'pulse 2s infinite';
  }
}

// Показ уведомления
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  elements.notifications.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Игровой цикл
function startGameLoop() {
  setInterval(() => {
    // Автоматическая регенерация энергии
    if (gameState.energy < 100 + gameState.level * 10) {
      gameState.energy += 1;
      updateUI();
    }

    // Пассивный доход каждые 30 секунд
    gameState.cityBuildings.forEach(cityBuilding => {
      const building = gameData.buildings.find(b => b.id === cityBuilding.buildingId);
      if (building.baseIncome > 0) {
        let passiveIncome = Math.floor(building.baseIncome * cityBuilding.level * 0.1);
        passiveIncome += passiveIncome * (gameState.bonuses.decoration / 100);
        gameState.coins += passiveIncome;
      }
    });

    updateUI();
  }, 30000); // Каждые 30 секунд
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', initGame);

// Haptic feedback helpers and wiring
function hapticImpact(style = 'light') {
  if (!tg || !tg.HapticFeedback || !tg.HapticFeedback.impactOccurred) return;
  try { tg.HapticFeedback.impactOccurred(style); } catch (_) {}
}

window.addEventListener('load', () => {
  const ids = ['dailyRewardBtn', 'claimRewardBtn', 'confirmUpgradeBtn'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => hapticImpact('medium'));
  });
});