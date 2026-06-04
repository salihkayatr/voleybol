// Volleyball Tournament Manager - Application Logic

// --- STATE MANAGEMENT ---
let state = {
  players: [],
  teams: [],
  fixtures: [],
  activeTab: 'player-pool-tab',
  currentEditingMatchId: null
};

// --- CLOUD SYNC STATE ---
let cloudState = {
  token: null,          // keyvalue.immanuel.co AppKey
  syncMode: 'local',    // 'local' | 'cloud_owner' | 'cloud_viewer'
  adminMode: true,      // If false, editor views are disabled
  pollInterval: null,   // Timer for pulling data
  isSyncing: false      // Semaphore to prevent double syncs
};

// Available Team Names list for kura draw
const TEAM_NAMES_POOL = [
  "File Canavarları ☄️",
  "Smaçör Kralları ⚡",
  "Defans Duvarı 🛡️",
  "Kral Servisler 👑",
  "Altın Setçiler 🏆",
  "Voleybol Kaplanları 🐯",
  "Rüzgar Gücü 💨",
  "Derin Manşetler ⚓",
  "Ateş Smaçörleri 🔥",
  "Yıldırım Blokçuları ⚡",
  "Akrep Pasörler 🦂",
  "Buz Fırtınası ❄️"
];

// --- SAMPLE PLAYERS DATA ---
const SAMPLE_PLAYERS = [
  "Ahmet Yılmaz", "Burak Demir", "Ceren Kaya", "Can Öztürk", 
  "Derya Çelik", "Emre Aslan", "Fatma Koç", "Gökhan Şahin", 
  "Gizem Yıldız", "Hakan Aydın", "İrem Bulut", "Kemal Yavuz", 
  "Lale Yurt", "Murat Polat", "Nalan Tekin", "Orhan Kılıç", 
  "Ömer Demirci", "Pınar Güler", "Rıza Aksoy", "Selin Karaca",
  "Tolga Uçar", "Umut Özdemir", "Yasemin Şen", "Zafer Çetin"
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize PWA Service Worker
  registerServiceWorker();
  
  // 2. Initialize Cloud State & Load Data
  initializeSyncState().then(() => {
    // 3. Render views
    renderPlayerPool();
    renderTeams();
    renderFixtures();
    renderStandings();
    
    // 4. Update UI components
    updateDrawSummary();
    updateSyncBanner();
    updateAdminUI();
  });
});

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);
  
  // Slide out after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// --- LOCAL STORAGE ---
function saveToLocalStorage() {
  localStorage.setItem('voleybol_players', JSON.stringify(state.players));
  localStorage.setItem('voleybol_teams', JSON.stringify(state.teams));
  localStorage.setItem('voleybol_fixtures', JSON.stringify(state.fixtures));
  
  // Bulut senkronizasyonu aktifse ve düzenleme yetkisi varsa buluta yükle
  if (cloudState.syncMode !== 'local' && cloudState.adminMode) {
    pushDataToCloud();
  }
}

function loadFromLocalStorage() {
  const savedPlayers = localStorage.getItem('voleybol_players');
  const savedTeams = localStorage.getItem('voleybol_teams');
  const savedFixtures = localStorage.getItem('voleybol_fixtures');
  
  if (savedPlayers) state.players = JSON.parse(savedPlayers);
  if (savedTeams) state.teams = JSON.parse(savedTeams);
  if (savedFixtures) state.fixtures = JSON.parse(savedFixtures);
}

// --- TAB SWITCHER ---
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Remove active from all tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active to current button
  const matchingBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
    return btn.getAttribute('onclick').includes(tabId);
  });
  if (matchingBtn) matchingBtn.classList.add('active');
  
  // Hide all contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Show active content
  document.getElementById(tabId).classList.add('active');
  
  // Refresh views when switching tabs
  if (tabId === 'player-pool-tab') {
    renderPlayerPool();
  } else if (tabId === 'draw-tab') {
    updateDrawSummary();
    renderTeams();
  } else if (tabId === 'fixtures-tab') {
    renderFixtures();
  } else if (tabId === 'standings-tab') {
    renderStandings();
  }
}

// --- TAB 1: PLAYER POOL LOGIC ---

function renderPlayerPool() {
  const grid = document.getElementById('player-list-grid');
  const emptyState = document.getElementById('players-empty-state');
  
  // Clear list
  grid.innerHTML = '';
  
  // Update stats
  const total = state.players.length;
  const active = state.players.filter(p => p.active).length;
  const passive = total - active;
  
  document.getElementById('stat-total-players').innerText = total;
  document.getElementById('stat-active-players').innerText = active;
  document.getElementById('stat-passive-players').innerText = passive;
  document.getElementById('player-count-badge').innerText = `${total} Oyuncu`;
  
  // Display Empty State or Grid
  if (total === 0) {
    emptyState.style.display = 'block';
    grid.style.display = 'none';
    return;
  } else {
    emptyState.style.display = 'none';
    grid.style.display = 'grid';
  }
  
  // Sort players alphabetically
  const sortedPlayers = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  
  sortedPlayers.forEach(player => {
    const card = document.createElement('div');
    card.className = `player-card ${player.active ? 'active' : ''}`;
    // Click on card toggles status (unless clicking on delete button)
    card.onclick = (e) => {
      if (!cloudState.adminMode) return; // Salt okunur ise tıklamayı engelle
      if (e.target.closest('.del-btn')) return;
      togglePlayerActive(player.id);
    };
    
    card.innerHTML = `
      <div class="player-card-info">
        <div class="player-status-dot"></div>
        <div class="player-name" title="${player.name}">${player.name}</div>
      </div>
      <div class="player-actions" style="display: ${cloudState.adminMode ? 'flex' : 'none'}">
        <button class="del-btn" title="Sil" onclick="deletePlayer('${player.id}')">🗑️</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleAddPlayer(e) {
  e.preventDefault();
  const input = document.getElementById('player-name-input');
  const name = input.value.trim();
  
  if (!name) return;
  
  // Check if player name already exists
  if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast('Bu isimde bir oyuncu zaten var!', 'warning');
    return;
  }
  
  const newPlayer = {
    id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: name,
    active: true
  };
  
  state.players.push(newPlayer);
  saveToLocalStorage();
  renderPlayerPool();
  input.value = '';
  showToast(`${name} başarıyla eklendi.`, 'success');
}

function togglePlayerActive(id) {
  const idx = state.players.findIndex(p => p.id === id);
  if (idx !== -1) {
    state.players[idx].active = !state.players[idx].active;
    saveToLocalStorage();
    renderPlayerPool();
  }
}

function deletePlayer(id) {
  const player = state.players.find(p => p.id === id);
  if (!player) return;
  
  state.players = state.players.filter(p => p.id !== id);
  saveToLocalStorage();
  renderPlayerPool();
  showToast(`${player.name} havuzdan silindi.`, 'warning');
}

function loadSamplePlayers() {
  // Add players from SAMPLE_PLAYERS list that do not exist yet
  let addedCount = 0;
  SAMPLE_PLAYERS.forEach(name => {
    if (!state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      state.players.push({
        id: 'player_' + Math.random().toString(36).substr(2, 9),
        name: name,
        active: true
      });
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    saveToLocalStorage();
    renderPlayerPool();
    showToast(`${addedCount} örnek oyuncu havuza yüklendi.`, 'success');
  } else {
    showToast('Tüm örnek oyuncular zaten havuzda kayıtlı.', 'info');
  }
}

function setAllPlayersStatus(status) {
  if (state.players.length === 0) {
    showToast('Havuza kayıtlı oyuncu yok.', 'warning');
    return;
  }
  state.players.forEach(p => p.active = status);
  saveToLocalStorage();
  renderPlayerPool();
  showToast(status ? 'Tüm oyuncular AKTİF yapıldı.' : 'Tüm oyuncular PASİF yapıldı.', 'info');
}

function clearAllPlayers() {
  if (state.players.length === 0) return;
  
  if (confirm('Tüm oyuncu havuzunu silmek istediğinize emin misiniz?')) {
    state.players = [];
    state.teams = [];
    state.fixtures = [];
    saveToLocalStorage();
    renderPlayerPool();
    renderTeams();
    renderFixtures();
    renderStandings();
    showToast('Tüm oyuncular ve turnuva verileri silindi.', 'danger');
  }
}

// --- TAB 2: DRAW & TEAMS LOGIC ---

function updateDrawSummary() {
  const activeCount = state.players.filter(p => p.active).length;
  const teamCount = parseInt(document.getElementById('team-count-select').value);
  
  document.getElementById('summary-active-count').innerText = activeCount;
  document.getElementById('summary-team-count').innerText = teamCount;
  
  const summaryDist = document.getElementById('summary-distribution');
  
  if (activeCount === 0) {
    summaryDist.innerText = 'Oyuncu yok';
    return;
  }
  
  if (activeCount < teamCount) {
    summaryDist.innerText = 'Oyuncu sayısı takım sayısından az!';
    summaryDist.style.color = 'var(--accent-danger)';
    return;
  }
  
  summaryDist.style.color = 'var(--accent-secondary)';
  const baseSize = Math.floor(activeCount / teamCount);
  const remainder = activeCount % teamCount;
  
  if (remainder === 0) {
    summaryDist.innerText = `${teamCount} takım x ${baseSize} kişi`;
  } else {
    summaryDist.innerText = `${remainder} takım ${baseSize + 1} kişi, ${teamCount - remainder} takım ${baseSize} kişi`;
  }
}

// Fisher-Yates Shuffling Algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function triggerDraw() {
  const activePlayers = state.players.filter(p => p.active);
  const teamCount = parseInt(document.getElementById('team-count-select').value);
  
  if (activePlayers.length < 2) {
    showToast('Kura çekebilmek için en az 2 aktif oyuncu olmalıdır!', 'danger');
    return;
  }
  
  if (activePlayers.length < teamCount) {
    showToast(`Oluşturmak istediğiniz takım sayısı (${teamCount}), aktif oyuncu sayısından (${activePlayers.length}) fazla olamaz!`, 'danger');
    return;
  }
  
  // Disable draw button during animation
  const drawBtn = document.getElementById('draw-teams-btn');
  drawBtn.disabled = true;
  
  // Show animation container
  const animContainer = document.getElementById('draw-animation');
  animContainer.style.display = 'block';
  
  // Scroll to animation
  animContainer.scrollIntoView({ behavior: 'smooth' });
  
  // Hide old results
  document.getElementById('teams-result-card').style.display = 'none';
  
  // Progress animation
  const fill = document.getElementById('draw-loading-fill');
  const animTitle = document.getElementById('draw-anim-title');
  fill.style.width = '0%';
  
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    fill.style.width = `${progress}%`;
    
    // Fun loading texts
    if (progress === 25) animTitle.innerText = "Havuz karıştırılıyor... 🏐";
    if (progress === 55) animTitle.innerText = "Takımlar kuruluyor... 🛡️";
    if (progress === 85) animTitle.innerText = "Fikstür hazırlanıyor... ⚡";
    
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        executeDraw(activePlayers, teamCount);
        animContainer.style.display = 'none';
        drawBtn.disabled = false;
        showToast('Kura başarıyla tamamlandı, takımlar kuruldu!', 'success');
      }, 300);
    }
  }, 100);
}

function executeDraw(activePlayers, teamCount) {
  // 1. Shuffle players randomly
  const shuffledPlayers = shuffleArray(activePlayers);
  
  // 2. Prepare teams
  const generatedTeams = [];
  const shuffledNamesPool = shuffleArray(TEAM_NAMES_POOL);
  
  for (let i = 0; i < teamCount; i++) {
    generatedTeams.push({
      id: 'team_' + i + '_' + Date.now(),
      name: shuffledNamesPool[i % shuffledNamesPool.length] || `Takım ${i + 1}`,
      players: []
    });
  }
  
  // 3. Distribute players
  shuffledPlayers.forEach((player, idx) => {
    const targetTeamIdx = idx % teamCount;
    generatedTeams[targetTeamIdx].players.push(player);
  });
  
  // Save to State
  state.teams = generatedTeams;
  // Reset fixtures and standings as teams have changed
  state.fixtures = [];
  saveToLocalStorage();
  
  // Render teams result
  renderTeams();
  renderFixtures();
  renderStandings();
}

function renderTeams() {
  const resultCard = document.getElementById('teams-result-card');
  const showcase = document.getElementById('teams-showcase-grid');
  
  if (state.teams.length === 0) {
    resultCard.style.display = 'none';
    return;
  }
  
  resultCard.style.display = 'block';
  showcase.innerHTML = '';
  
  state.teams.forEach((team, teamIdx) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    
    // Team header
    const header = document.createElement('div');
    header.className = 'team-card-header';
    header.innerHTML = `
      <div class="team-name">🛡️ ${team.name}</div>
      <div class="team-size-badge">${team.players.length} Oyuncu</div>
    `;
    card.appendChild(header);
    
    // Team player list
    const playerList = document.createElement('ul');
    playerList.className = 'team-players-list';
    
    team.players.forEach((player, pIdx) => {
      const item = document.createElement('li');
      item.className = 'team-player-item';
      
      // Get initials
      const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
      
      item.innerHTML = `
        <span class="player-index">${pIdx + 1}.</span>
        <div class="player-avatar">${initials}</div>
        <span class="player-name">${player.name}</span>
      `;
      playerList.appendChild(item);
    });
    
    card.appendChild(playerList);
    showcase.appendChild(card);
  });
  
  resultCard.scrollIntoView({ behavior: 'smooth' });
}

// --- TAB 3: FIXTURES LOGIC (ROUND ROBIN) ---

function generateFixturesFromTeams() {
  if (state.teams.length < 2) {
    showToast('Fikstür oluşturmak için en az 2 takım kurulmuş olmalıdır!', 'danger');
    return;
  }
  
  const list = [...state.teams];
  const n = list.length;
  const isOdd = n % 2 !== 0;
  
  const tempTeams = [...list];
  if (isOdd) {
    // Add a dummy team for "BAY" (resting team)
    tempTeams.push({ id: 'bay', name: 'BAY (Dinlenen Takım)', players: [] });
  }
  
  const numTeams = tempTeams.length;
  const rounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;
  
  let matchCount = 1;
  const newFixtures = [];
  
  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = (round + match) % (numTeams - 1);
      let away = (round + numTeams - 1 - match) % (numTeams - 1);
      
      if (match === 0) {
        away = numTeams - 1;
      }
      
      const teamA = tempTeams[home];
      const teamB = tempTeams[away];
      
      // If either is the BAY dummy, skip the match but we could display it,
      // here we just skip it to avoid blank matches.
      if (teamA.id === 'bay' || teamB.id === 'bay') {
        continue;
      }
      
      // Alternating home/away
      const homeTeam = round % 2 === 0 ? teamA : teamB;
      const awayTeam = round % 2 === 0 ? teamB : teamA;
      
      newFixtures.push({
        id: 'match_' + round + '_' + matchCount + '_' + Date.now(),
        round: round + 1, // Round 1, Round 2...
        teamAId: homeTeam.id,
        teamBId: awayTeam.id,
        teamAName: homeTeam.name,
        teamBName: awayTeam.name,
        scores: { 
          set1: [null, null], 
          set2: [null, null], 
          set3: [null, null] 
        },
        winnerId: null,
        isFinished: false
      });
      matchCount++;
    }
  }
  
  // Save to State & LocalStorage
  state.fixtures = newFixtures;
  saveToLocalStorage();
  
  // Render & switch to fixtures tab
  switchTab('fixtures-tab');
  showToast('Lig fikstürü başarıyla oluşturuldu!', 'success');
}

function renderFixtures() {
  const container = document.getElementById('fixtures-list-container');
  const emptyState = document.getElementById('fixtures-empty-state');
  const resetBtn = document.getElementById('reset-fixtures-btn');
  
  container.innerHTML = '';
  
  if (state.fixtures.length === 0) {
    emptyState.style.display = 'block';
    resetBtn.style.display = 'none';
    return;
  }
  
  emptyState.style.display = 'none';
  resetBtn.style.display = 'block';
  
  // Group matches by Round
  const rounds = {};
  state.fixtures.forEach(match => {
    if (!rounds[match.round]) {
      rounds[match.round] = [];
    }
    rounds[match.round].push(match);
  });
  
  // Render each round
  Object.keys(rounds).forEach(roundNum => {
    const roundHeader = document.createElement('h3');
    roundHeader.style.marginTop = '25px';
    roundHeader.style.marginBottom = '12px';
    roundHeader.style.color = 'var(--accent-secondary)';
    roundHeader.style.fontSize = '1.1rem';
    roundHeader.style.borderBottom = '1px dashed var(--glass-border)';
    roundHeader.style.paddingBottom = '6px';
    roundHeader.innerText = `${roundNum}. Tur Maçları`;
    container.appendChild(roundHeader);
    
    rounds[roundNum].forEach(match => {
      const card = document.createElement('div');
      card.className = 'fixture-match-card';
      
      // Status string & class
      let statusText = 'Oynanmadı';
      let statusClass = '';
      if (match.isFinished) {
        statusText = 'Tamamlandı';
        statusClass = 'finished';
      }
      
      // Determine sets score
      let setA = 0;
      let setB = 0;
      let detailedSetsText = '';
      
      if (match.isFinished) {
        const s1A = match.scores.set1[0] || 0;
        const s1B = match.scores.set1[1] || 0;
        const s2A = match.scores.set2[0] || 0;
        const s2B = match.scores.set2[1] || 0;
        const s3A = match.scores.set3[0] || 0;
        const s3B = match.scores.set3[1] || 0;
        
        if (s1A > s1B) setA++; else setB++;
        if (s2A > s2B) setA++; else setB++;
        
        if (match.scores.set3[0] !== null && match.scores.set3[1] !== null) {
          if (s3A > s3B) setA++; else setB++;
          detailedSetsText = `(${s1A}-${s1B}, ${s2A}-${s2B}, ${s3A}-${s3B})`;
        } else {
          detailedSetsText = `(${s1A}-${s1B}, ${s2A}-${s2B})`;
        }
      }
      
      const isWinnerA = match.isFinished && match.winnerId === match.teamAId;
      const isWinnerB = match.isFinished && match.winnerId === match.teamBId;
      
      card.innerHTML = `
        <div class="match-info">
          <span class="match-number">Maç #${match.round}-${state.fixtures.indexOf(match) + 1}</span>
          <span class="match-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="match-teams-display">
          <div class="display-team team-a ${isWinnerA ? 'winner' : ''}" title="${match.teamAName}">${match.teamAName}</div>
          <div class="match-score-vs">
            <div class="match-score-box ${match.isFinished ? 'finished' : ''}">
              ${match.isFinished ? `${setA} - ${setB}` : 'VS'}
            </div>
            ${match.isFinished ? `<div class="sets-detail">${detailedSetsText}</div>` : ''}
          </div>
          <div class="display-team team-b ${isWinnerB ? 'winner' : ''}" title="${match.teamBName}">${match.teamBName}</div>
        </div>
        
        <div class="match-action-btn">
          <button class="btn btn-sm ${match.isFinished ? 'btn-secondary' : 'btn-warning'}" onclick="openScoreModal('${match.id}')">
            ${cloudState.adminMode ? (match.isFinished ? 'Düzenle' : 'Skor Gir') : 'Skor Gör'}
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

function resetFixtures() {
  if (confirm('Fikstürü ve girilen tüm maç skorlarını sıfırlamak istediğinize emin misiniz?')) {
    state.fixtures = [];
    saveToLocalStorage();
    renderFixtures();
    renderStandings();
    showToast('Turnuva fikstürü ve skorlar sıfırlandı.', 'warning');
  }
}

// --- TAB 4: STANDINGS LOGIC ---

function renderStandings() {
  const emptyState = document.getElementById('standings-empty-state');
  const container = document.getElementById('standings-table-container');
  const tbody = document.getElementById('standings-table-body');
  
  tbody.innerHTML = '';
  
  if (state.teams.length === 0) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
    return;
  }
  
  emptyState.style.display = 'none';
  container.style.display = 'block';
  
  // Calculate standings map
  const standings = {};
  
  // Initialize
  state.teams.forEach(team => {
    standings[team.id] = {
      id: team.id,
      name: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0, // raw scoring points (e.g. 25, 23 etc)
      pointsLost: 0,
      points: 0
    };
  });
  
  // Loop over finished matches to aggregate stats
  state.fixtures.forEach(match => {
    if (!match.isFinished) return;
    
    const teamA = standings[match.teamAId];
    const teamB = standings[match.teamBId];
    
    if (!teamA || !teamB) return; // Team might have been deleted/recreated
    
    teamA.played++;
    teamB.played++;
    
    // Set scores
    const s1A = match.scores.set1[0] || 0;
    const s1B = match.scores.set1[1] || 0;
    const s2A = match.scores.set2[0] || 0;
    const s2B = match.scores.set2[1] || 0;
    const s3A = match.scores.set3[0] || 0;
    const s3B = match.scores.set3[1] || 0;
    
    // Sum points
    teamA.pointsWon += s1A + s2A + s3A;
    teamA.pointsLost += s1B + s2B + s3B;
    
    teamB.pointsWon += s1B + s2B + s3B;
    teamB.pointsLost += s1A + s2A + s3A;
    
    // Determine set wins
    let setsA = 0;
    let setsB = 0;
    
    if (s1A > s1B) setsA++; else setsB++;
    if (s2A > s2B) setsA++; else setsB++;
    
    if (match.scores.set3[0] !== null && match.scores.set3[1] !== null) {
      if (s3A > s3B) setsA++; else setsB++;
    }
    
    teamA.setsWon += setsA;
    teamA.setsLost += setsB;
    teamB.setsWon += setsB;
    teamB.setsLost += setsA;
    
    // Pro Volleyball Points System:
    // - 2-0 Win: Winner = 3 pts, Loser = 0 pts
    // - 2-1 Win: Winner = 2 pts, Loser = 1 pt
    if (setsA > setsB) {
      teamA.wins++;
      teamB.losses++;
      if (setsB === 0) {
        teamA.points += 3; // 2-0 win
      } else {
        teamA.points += 2; // 2-1 win
        teamB.points += 1; // 2-1 loss
      }
    } else {
      teamB.wins++;
      teamA.losses++;
      if (setsA === 0) {
        teamB.points += 3; // 2-0 win
      } else {
        teamB.points += 2; // 2-1 win
        teamA.points += 1; // 2-1 loss
      }
    }
  });
  
  // Convert standings object to array
  const standingsList = Object.values(standings);
  
  // Sort standings by:
  // 1. Points desc
  // 2. Set Difference (setsWon - setsLost) desc
  // 3. Score Points Difference (pointsWon - pointsLost) desc
  // 4. Wins desc
  standingsList.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    
    const setDiffA = a.setsWon - a.setsLost;
    const setDiffB = b.setsWon - b.setsLost;
    if (setDiffB !== setDiffA) {
      return setDiffB - setDiffA;
    }
    
    const scoreDiffA = a.pointsWon - a.pointsLost;
    const scoreDiffB = b.pointsWon - b.pointsLost;
    if (scoreDiffB !== scoreDiffA) {
      return scoreDiffB - scoreDiffA;
    }
    
    return b.wins - a.wins;
  });
  
  // Render table rows
  standingsList.forEach((row, idx) => {
    const tr = document.createElement('tr');
    
    const setDiff = row.setsWon - row.setsLost;
    const setDiffText = setDiff > 0 ? `+${setDiff}` : setDiff;
    
    const scoreDiff = row.pointsWon - row.pointsLost;
    const scoreDiffText = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff;
    
    tr.innerHTML = `
      <td class="rank" style="text-align: center;">${idx + 1}</td>
      <td class="team-col">🛡️ ${row.name}</td>
      <td class="stat-col">${row.played}</td>
      <td class="stat-col" style="color: var(--accent-success); font-weight:600;">${row.wins}</td>
      <td class="stat-col" style="color: var(--accent-danger); font-weight:600;">${row.losses}</td>
      <td class="stat-col" style="font-weight: 500;">${row.setsWon}:${row.setsLost} (${setDiffText})</td>
      <td class="stat-col" style="font-size: 0.85rem; color: var(--text-muted);">${row.pointsWon}:${row.pointsLost} (${scoreDiffText})</td>
      <td class="points-col" style="text-align: center; font-size: 1.1rem;">${row.points}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- SCORE MODAL LOGIC ---

function openScoreModal(matchId) {
  const match = state.fixtures.find(m => m.id === matchId);
  if (!match) return;
  
  state.currentEditingMatchId = matchId;
  
  // Fill team names
  document.getElementById('modal-team-a-name').innerText = match.teamAName;
  document.getElementById('modal-team-b-name').innerText = match.teamBName;
  
  // Fill scores (if already entered)
  document.getElementById('set1-a').value = match.scores.set1[0] !== null ? match.scores.set1[0] : '';
  document.getElementById('set1-b').value = match.scores.set1[1] !== null ? match.scores.set1[1] : '';
  
  document.getElementById('set2-a').value = match.scores.set2[0] !== null ? match.scores.set2[0] : '';
  document.getElementById('set2-b').value = match.scores.set2[1] !== null ? match.scores.set2[1] : '';
  
  document.getElementById('set3-a').value = match.scores.set3[0] !== null ? match.scores.set3[0] : '';
  document.getElementById('set3-b').value = match.scores.set3[1] !== null ? match.scores.set3[1] : '';
  
  // Attach change event listeners to set inputs for smart enabling/disabling of Set 3
  const inputList = ['set1-a', 'set1-b', 'set2-a', 'set2-b'];
  inputList.forEach(id => {
    document.getElementById(id).oninput = checkSetScoresForDecider;
  });
  
  // Initial check
  checkSetScoresForDecider();
  
  // Düzenleme yetkisine göre form elemanlarını kilitle
  const inputs = ['set1-a', 'set1-b', 'set2-a', 'set2-b', 'set3-a', 'set3-b'];
  inputs.forEach(id => {
    document.getElementById(id).disabled = !cloudState.adminMode;
  });
  
  // Kaydet butonunu gizle/göster
  const saveBtn = document.querySelector('#score-modal .modal-actions .btn-warning');
  if (saveBtn) {
    saveBtn.style.display = cloudState.adminMode ? 'inline-block' : 'none';
  }
  
  // Open modal CSS
  const modal = document.getElementById('score-modal');
  modal.style.display = 'flex';
}

function checkSetScoresForDecider() {
  const s1A_val = document.getElementById('set1-a').value;
  const s1B_val = document.getElementById('set1-b').value;
  const s2A_val = document.getElementById('set2-a').value;
  const s2B_val = document.getElementById('set2-b').value;
  
  const set3A = document.getElementById('set3-a');
  const set3B = document.getElementById('set3-b');
  
  // If set 1 and set 2 scores are both filled, determine set winners
  if (s1A_val !== '' && s1B_val !== '' && s2A_val !== '' && s2B_val !== '') {
    const s1A = parseInt(s1A_val);
    const s1B = parseInt(s1B_val);
    const s2A = parseInt(s2A_val);
    const s2B = parseInt(s2B_val);
    
    let winner1 = s1A > s1B ? 'A' : 'B';
    let winner2 = s2A > s2B ? 'A' : 'B';
    
    if (winner1 === winner2) {
      // 2-0 win! Disable Set 3
      set3A.disabled = true;
      set3B.disabled = true;
      set3A.value = '';
      set3B.value = '';
      set3A.placeholder = 'Gereksiz';
      set3B.placeholder = 'Gereksiz';
    } else {
      // 1-1 split! Enable Set 3
      set3A.disabled = false;
      set3B.disabled = false;
      set3A.placeholder = '0';
      set3B.placeholder = '0';
    }
  } else {
    // Scores not fully entered yet. Disable Set 3 by default
    set3A.disabled = true;
    set3B.disabled = true;
    set3A.placeholder = 'Önce 1 ve 2. Seti girin';
    set3B.placeholder = 'Önce 1 ve 2. Seti girin';
  }
}

function closeScoreModal() {
  const modal = document.getElementById('score-modal');
  modal.style.display = 'none';
  state.currentEditingMatchId = null;
}

function saveMatchScore() {
  if (!state.currentEditingMatchId) return;
  
  const s1A_val = document.getElementById('set1-a').value;
  const s1B_val = document.getElementById('set1-b').value;
  const s2A_val = document.getElementById('set2-a').value;
  const s2B_val = document.getElementById('set2-b').value;
  const s3A_val = document.getElementById('set3-a').value;
  const s3B_val = document.getElementById('set3-b').value;
  
  // Basic validation: Set 1 and 2 are mandatory
  if (s1A_val === '' || s1B_val === '' || s2A_val === '' || s2B_val === '') {
    showToast('Lütfen en azından 1. ve 2. Set sonuçlarını giriniz!', 'danger');
    return;
  }
  
  const s1A = parseInt(s1A_val);
  const s1B = parseInt(s1B_val);
  const s2A = parseInt(s2A_val);
  const s2B = parseInt(s2B_val);
  
  if (s1A === s1B || s2A === s2B) {
    showToast('Bir set beraberlikle bitemez!', 'danger');
    return;
  }
  
  let setWinsA = 0;
  let setWinsB = 0;
  
  if (s1A > s1B) setWinsA++; else setWinsB++;
  if (s2A > s2B) setWinsA++; else setWinsB++;
  
  let set3A = null;
  let set3B = null;
  let finalWinnerId = null;
  
  if (setWinsA === 2) {
    // Team A won 2-0
    finalWinnerId = state.fixtures.find(m => m.id === state.currentEditingMatchId).teamAId;
  } else if (setWinsB === 2) {
    // Team B won 2-0
    finalWinnerId = state.fixtures.find(m => m.id === state.currentEditingMatchId).teamBId;
  } else {
    // 1-1 Draw. Set 3 is required
    if (s3A_val === '' || s3B_val === '') {
      showToast('Setlerde durum 1-1! 3. Set sonucunu girmelisiniz.', 'danger');
      return;
    }
    
    set3A = parseInt(s3A_val);
    set3B = parseInt(s3B_val);
    
    if (set3A === set3B) {
      showToast('3. Set (Karar Seti) beraberlikle bitemez!', 'danger');
      return;
    }
    
    const matchObj = state.fixtures.find(m => m.id === state.currentEditingMatchId);
    if (set3A > set3B) {
      finalWinnerId = matchObj.teamAId;
    } else {
      finalWinnerId = matchObj.teamBId;
    }
  }
  
  // Save match scores into State
  const matchIdx = state.fixtures.findIndex(m => m.id === state.currentEditingMatchId);
  if (matchIdx !== -1) {
    state.fixtures[matchIdx].scores.set1 = [s1A, s1B];
    state.fixtures[matchIdx].scores.set2 = [s2A, s2B];
    state.fixtures[matchIdx].scores.set3 = finalWinnerId !== null && set3A !== null ? [set3A, set3B] : [null, null];
    state.fixtures[matchIdx].winnerId = finalWinnerId;
    state.fixtures[matchIdx].isFinished = true;
    
    saveToLocalStorage();
    renderFixtures();
    renderStandings();
    closeScoreModal();
    showToast('Maç skoru başarıyla güncellendi.', 'success');
  }
}

// --- PWA & CLOUD SYNC HELPERS ---

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Kaydedildi. Kapsam:', reg.scope))
      .catch(err => console.warn('Service Worker kaydı başarısız:', err));
  }
}

async function initializeSyncState() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('t');
  
  if (tokenParam) {
    const cleanToken = tokenParam.replace(/^"+|"+$/g, '');
    cloudState.token = cleanToken;
    cloudState.syncMode = 'cloud_viewer';
    cloudState.adminMode = false; // İzleyiciler varsayılan olarak salt okunur
    
    localStorage.setItem('voleybol_cloud_token', cleanToken);
    localStorage.setItem('voleybol_sync_mode', 'cloud_viewer');
    localStorage.setItem('voleybol_admin_mode', 'false');
    
    showToast('Bulut turnuvasına bağlandınız! (İzleyici Modu)', 'info');
    await fetchCloudData();
    startPolling();
    return;
  }
  
  const savedToken = localStorage.getItem('voleybol_cloud_token');
  const savedSyncMode = localStorage.getItem('voleybol_sync_mode');
  const savedAdminMode = localStorage.getItem('voleybol_admin_mode');
  
  if (savedToken && savedSyncMode) {
    cloudState.token = savedToken.replace(/^"+|"+$/g, '');
    cloudState.syncMode = savedSyncMode;
    cloudState.adminMode = savedAdminMode === 'true';
    
    await fetchCloudData();
    startPolling();
  } else {
    loadFromLocalStorage();
  }
}

async function fetchCloudData() {
  if (!cloudState.token) return;
  cloudState.isSyncing = true;
  
  try {
    const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${cloudState.token}/state`);
    if (!res.ok) throw new Error('Buluttan veri çekme hatası');
    const rawVal = await res.text();
    
    if (rawVal && rawVal !== '""' && rawVal !== 'null') {
      let base64 = rawVal;
      if (base64.startsWith('"') && base64.endsWith('"')) {
        base64 = base64.slice(1, -1);
      }
      
      const remoteState = decodeState(base64);
      if (remoteState && JSON.stringify(remoteState) !== JSON.stringify(state)) {
        state = remoteState;
        
        // Tetikleme döngüsünü önlemek için doğrudan localStorage'a yazıyoruz
        localStorage.setItem('voleybol_players', JSON.stringify(state.players));
        localStorage.setItem('voleybol_teams', JSON.stringify(state.teams));
        localStorage.setItem('voleybol_fixtures', JSON.stringify(state.fixtures));
        
        renderPlayerPool();
        renderTeams();
        renderFixtures();
        renderStandings();
        updateDrawSummary();
        showToast('Veriler buluttan anlık güncellendi!', 'success');
      }
    }
  } catch (err) {
    console.error('Bulut çekme hatası:', err);
  } finally {
    cloudState.isSyncing = false;
  }
}

async function pushDataToCloud() {
  if (!cloudState.token || cloudState.isSyncing) return;
  
  try {
    const base64 = encodeState(state);
    const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${cloudState.token}/state/${base64}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Buluta yazma hatası');
    console.log('Bulut senkronizasyonu tamamlandı.');
  } catch (err) {
    console.error('Bulut gönderme hatası:', err);
    showToast('Bulut senkronizasyonu başarısız oldu!', 'danger');
  }
}

// Base64 kodlayıcı ve çözücüler (URL-Safe)
function encodeState(stateObj) {
  const jsonStr = JSON.stringify(stateObj);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  utf8Bytes.forEach(b => binary += String.fromCharCode(b));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeState(base64Str) {
  let base64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function startPolling() {
  if (cloudState.pollInterval) clearInterval(cloudState.pollInterval);
  cloudState.pollInterval = setInterval(() => {
    if (cloudState.syncMode !== 'local' && !cloudState.isSyncing) {
      fetchCloudData();
    }
  }, 10000); // 10 saniyede bir arka planda yenile
}

function updateSyncBanner() {
  const statusIcon = document.getElementById('sync-status-icon');
  const statusText = document.getElementById('sync-status-text');
  const statusDesc = document.getElementById('sync-status-desc');
  const actionsContainer = document.getElementById('cloud-actions-container');
  const joinPanel = document.getElementById('join-cloud-panel');
  const sharePanel = document.getElementById('share-cloud-panel');
  
  if (cloudState.syncMode === 'local') {
    statusIcon.innerText = '📶';
    statusText.innerText = 'Yerel Mod (Veriler Cihazınızda)';
    statusDesc.innerText = 'Diğer oyuncuların kendi telefonlarından takip etmesi için bulut paylaşımını açın.';
    actionsContainer.style.display = 'flex';
    sharePanel.style.display = 'none';
  } else {
    statusIcon.innerText = '🌐';
    const isOwner = cloudState.syncMode === 'cloud_owner';
    statusText.innerText = isOwner ? 'Bulut Turnuvası Aktif (Canlı Yayın)' : 'Ortak Turnuva Canlı Takip Ediliyor';
    statusDesc.innerText = isOwner ? 'Verileriniz bulut üzerinden tüm cihazlarla senkronize ediliyor.' : 'Canlı skorlar ve fikstür buluttan anlık güncelleniyor.';
    actionsContainer.style.display = 'none';
    joinPanel.style.display = 'none';
    
    sharePanel.style.display = 'flex';
    document.getElementById('share-code-display').innerText = cloudState.token;
    document.getElementById('admin-mode-checkbox').checked = cloudState.adminMode;
  }
}

function toggleJoinPanel() {
  const panel = document.getElementById('join-cloud-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    document.getElementById('join-code-input').focus();
  }
}

async function startCloudTournament() {
  if (state.players.length === 0) {
    showToast('Lütfen önce oyuncu havuzuna en azından birkaç kişi ekleyin.', 'warning');
    return;
  }
  
  showToast('Bulut kanalı açılıyor, lütfen bekleyin...', 'info');
  
  try {
    const res = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetAppKey');
    if (!res.ok) throw new Error('Anahtar alınamadı');
    let token = await res.text();
    token = token.replace(/^"+|"+$/g, '');
    
    if (token) {
      cloudState.token = token;
      cloudState.syncMode = 'cloud_owner';
      cloudState.adminMode = true;
      
      localStorage.setItem('voleybol_cloud_token', token);
      localStorage.setItem('voleybol_sync_mode', 'cloud_owner');
      localStorage.setItem('voleybol_admin_mode', 'true');
      
      await pushDataToCloud();
      startPolling();
      updateSyncBanner();
      updateAdminUI();
      
      const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?t=${token}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      showToast(`Turnuva başarıyla paylaşıma açıldı! Kod: ${token}`, 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('Bulut kanalı açılamadı. İnternet bağlantınızı kontrol edin.', 'danger');
  }
}

async function connectToCloudTournament() {
  const input = document.getElementById('join-code-input');
  const rawCode = input.value.trim().toLowerCase();
  const code = rawCode.replace(/^"+|"+$/g, '');
  
  if (!code) {
    showToast('Lütfen geçerli bir kod girin!', 'warning');
    return;
  }
  
  showToast('Buluta bağlanılıyor...', 'info');
  
  try {
    const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${code}/state`);
    if (!res.ok) throw new Error('Bağlantı hatası');
    const val = await res.text();
    
    if (!val || val === '""' || val === 'null') {
      showToast('Bu kodda bir turnuva bulunamadı. Lütfen kodu kontrol edin.', 'danger');
      return;
    }
    
    cloudState.token = code;
    cloudState.syncMode = 'cloud_viewer';
    cloudState.adminMode = false; // Varsayılan olarak salt okunur izleyici
    
    localStorage.setItem('voleybol_cloud_token', code);
    localStorage.setItem('voleybol_sync_mode', 'cloud_viewer');
    localStorage.setItem('voleybol_admin_mode', 'false');
    
    input.value = '';
    
    let base64 = val;
    if (base64.startsWith('"') && base64.endsWith('"')) {
      base64 = base64.slice(1, -1);
    }
    state = decodeState(base64);
    
    localStorage.setItem('voleybol_players', JSON.stringify(state.players));
    localStorage.setItem('voleybol_teams', JSON.stringify(state.teams));
    localStorage.setItem('voleybol_fixtures', JSON.stringify(state.fixtures));
    
    renderPlayerPool();
    renderTeams();
    renderFixtures();
    renderStandings();
    updateDrawSummary();
    
    startPolling();
    updateSyncBanner();
    updateAdminUI();
    
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?t=${code}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    
    showToast('Turnuvaya başarıyla bağlandınız! Canlı senkronizasyon aktif.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Bağlantı hatası oluştu. Kodu ve internetinizi kontrol edin.', 'danger');
  }
}

function disconnectCloud() {
  if (confirm('Bulut senkronizasyonunu kapatmak ve yerel moda geçmek istiyor musunuz? (Cihazınızdaki veriler kalacaktır)')) {
    if (cloudState.pollInterval) clearInterval(cloudState.pollInterval);
    
    cloudState.token = null;
    cloudState.syncMode = 'local';
    cloudState.adminMode = true;
    
    localStorage.removeItem('voleybol_cloud_token');
    localStorage.removeItem('voleybol_sync_mode');
    localStorage.removeItem('voleybol_admin_mode');
    
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    
    updateSyncBanner();
    updateAdminUI();
    
    renderPlayerPool();
    renderFixtures();
    
    showToast('Bulut senkronizasyonu kapatıldı. Yerel moda geçildi.', 'info');
  }
}

function toggleAdminMode(isChecked) {
  cloudState.adminMode = isChecked;
  localStorage.setItem('voleybol_admin_mode', isChecked ? 'true' : 'false');
  updateAdminUI();
  
  renderPlayerPool();
  renderFixtures();
  
  showToast(isChecked ? 'Yönetici Modu: Skor girme ve düzenleme yetkisi AÇIK.' : 'Yönetici Modu: Sadece görüntüleme yetkisi (Okuma Modu).', 'info');
}

function updateAdminUI() {
  const isAdmin = cloudState.adminMode;
  
  const addPlayerForm = document.getElementById('add-player-form');
  if (addPlayerForm) {
    const parentCard = addPlayerForm.closest('.glass-card');
    if (parentCard) parentCard.style.display = isAdmin ? 'block' : 'none';
  }
  
  const drawBtn = document.getElementById('draw-teams-btn');
  const teamSelect = document.getElementById('team-count-select');
  if (drawBtn) drawBtn.disabled = !isAdmin;
  if (teamSelect) teamSelect.disabled = !isAdmin;
  
  const teamResultCard = document.getElementById('teams-result-card');
  if (teamResultCard) {
    const fixturesBtn = teamResultCard.querySelector('button.btn-secondary');
    if (fixturesBtn) fixturesBtn.style.display = isAdmin ? 'block' : 'none';
  }
  
  const resetFixturesBtn = document.getElementById('reset-fixtures-btn');
  if (resetFixturesBtn) {
    resetFixturesBtn.style.display = (isAdmin && state.fixtures.length > 0) ? 'block' : 'none';
  }
}

function copyShareCode() {
  if (!cloudState.token) return;
  navigator.clipboard.writeText(cloudState.token).then(() => {
    showToast('Turnuva kodu panoya kopyalandı!', 'success');
  }).catch(() => {
    showToast('Kopyalama başarısız oldu.', 'danger');
  });
}

function copyShareLink() {
  if (!cloudState.token) return;
  const link = `${window.location.protocol}//${window.location.host}${window.location.pathname}?t=${cloudState.token}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Paylaşım linki panoya kopyalandı!', 'success');
  }).catch(() => {
    showToast('Kopyalama başarısız oldu.', 'danger');
  });
}
